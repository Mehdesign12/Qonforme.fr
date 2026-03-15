import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendEmail } from "@/lib/email/resend"
import { buildReminderEmail } from "@/lib/email/templates/reminder"

interface Params { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const { id } = await params

    // 1. Facture + client (vérifier que la facture appartient à l'utilisateur)
    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .select("*, client:clients(id,name,email)")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()

    if (invErr || !invoice) {
      return NextResponse.json({ error: "Facture introuvable" }, { status: 404 })
    }

    const clientEmail = invoice.client?.email
    if (!clientEmail) {
      return NextResponse.json({ error: "Le client n'a pas d'adresse email" }, { status: 422 })
    }

    // 2. Déterminer quelle relance envoyer
    const reminderNumber: 1 | 2 = invoice.reminder_1_sent_at ? 2 : 1

    if (reminderNumber === 2 && invoice.reminder_2_sent_at) {
      return NextResponse.json({ error: "Les deux relances ont déjà été envoyées" }, { status: 422 })
    }

    // 3. Entreprise
    const { data: company } = await supabase
      .from("companies")
      .select("name,iban,accent_color,email")
      .eq("user_id", user.id)
      .single()

    const accentColor = company?.accent_color ?? "#2563EB"
    const companyName = company?.name?.trim() || user.email?.split("@")[0] || "Votre prestataire"
    const senderEmail = company?.email?.trim() || user.email

    // 4. Construire et envoyer l'email de relance
    const { subject, html } = buildReminderEmail({
      reminderNumber,
      invoiceNumber: invoice.invoice_number,
      issueDate:     invoice.issue_date,
      dueDate:       invoice.due_date,
      subtotalHt:    invoice.subtotal_ht,
      totalVat:      invoice.total_vat,
      totalTtc:      invoice.total_ttc,
      companyName,
      companyIban:   company?.iban,
      accentColor,
      clientName:    invoice.client?.name ?? "",
    })

    await sendEmail({
      to:       clientEmail,
      subject,
      html,
      fromName: companyName,
      replyTo:  senderEmail,
      // Copie à l'émetteur pour traçabilité
      cc:       senderEmail ? [senderEmail] : [],
      ccSubject: `Copie — Relance ${reminderNumber} — Facture ${invoice.invoice_number} pour ${invoice.client?.name ?? ""}`,
    })

    // 5. Mettre à jour les champs de relance + passer en overdue
    const now = new Date().toISOString()
    const updateFields =
      reminderNumber === 1
        ? { reminder_1_sent_at: now, status: "overdue" }
        : { reminder_2_sent_at: now, status: "overdue" }

    const { data: updated } = await supabase
      .from("invoices")
      .update(updateFields)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single()

    return NextResponse.json({
      success: true,
      reminderNumber,
      sentTo: clientEmail,
      invoice: updated,
    })
  } catch (err) {
    console.error("Invoice remind error:", err)
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
