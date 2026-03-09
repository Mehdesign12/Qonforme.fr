import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendEmail } from "@/lib/email/resend"
import { buildInvoiceEmail } from "@/lib/email/templates/invoice"
import { generateInvoicePdf } from "@/lib/pdf/invoice"

interface Params { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const { id } = await params

    // 1. Facture + client
    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .select("*, client:clients(id,name,email,address,zip_code,city,siren,vat_number)")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()
    if (invErr || !invoice) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 })

    const clientEmail = invoice.client?.email
    if (!clientEmail) {
      return NextResponse.json({ error: "Le client n'a pas d'adresse email" }, { status: 422 })
    }

    // 2. Entreprise
    const { data: company } = await supabase
      .from("companies")
      .select("name,siren,siret,vat_number,address,zip_code,city,iban,legal_notice,accent_color,logo_url,email")
      .eq("user_id", user.id)
      .single()

    const accentColor = company?.accent_color ?? "#2563EB"
    const companyName = company?.name ?? "Votre prestataire"
    const senderEmail = (company as { email?: string } | null)?.email ?? user.email

    // 3. Générer le PDF (Factur-X)
    const pdfBytes  = await generateInvoicePdf({ invoice, company })
    const pdfBuffer = Buffer.from(pdfBytes)

    // 4. Template email
    const { subject, html } = buildInvoiceEmail({
      invoiceNumber: invoice.invoice_number,
      issueDate:     invoice.issue_date,
      dueDate:       invoice.due_date,
      subtotalHt:    invoice.subtotal_ht,
      totalVat:      invoice.total_vat,
      totalTtc:      invoice.total_ttc,
      notes:         invoice.notes,
      companyName,
      companyIban:   company?.iban,
      accentColor,
      clientName:    invoice.client?.name ?? "",
      clientEmail,
      appUrl:        process.env.NEXT_PUBLIC_APP_URL ?? "https://qonforme.fr",
    })

    // 5. Envoi via Resend (client + copie émetteur)
    const cc = senderEmail ? [senderEmail] : []
    await sendEmail({
      to:          clientEmail,
      subject,
      html,
      replyTo:     senderEmail,
      cc,
      attachments: [{
        filename: `${invoice.invoice_number}.pdf`,
        content:  pdfBuffer,
      }],
    })

    // 6. Mettre à jour statut + sent_at
    await supabase
      .from("invoices")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)

    return NextResponse.json({ success: true, sentTo: clientEmail })
  } catch (err) {
    console.error("Invoice send error:", err)
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
