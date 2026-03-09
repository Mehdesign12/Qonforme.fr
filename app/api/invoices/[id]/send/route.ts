import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendEmail } from "@/lib/email/resend"
import { buildInvoiceEmail } from "@/lib/email/templates/invoice"

interface Params { params: Promise<{ id: string }> }

// Génère le PDF facture en appelant la route interne GET /api/invoices/[id]/pdf
// → identique au PDF téléchargé depuis l'interface (avec logo, SIRET, TVA, etc.)
async function generateInvoicePdfBuffer(invoiceId: string, accessToken: string): Promise<Buffer> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const res = await fetch(`${baseUrl}/api/invoices/${invoiceId}/pdf`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => "")
    throw new Error(`Impossible de générer le PDF de la facture (${res.status}): ${errText}`)
  }
  return Buffer.from(await res.arrayBuffer())
}

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const { id } = await params

    // 1. Récupérer le token de session pour l'appel interne PDF
    const { data: { session } } = await supabase.auth.getSession()
    const accessToken = session?.access_token
    if (!accessToken) return NextResponse.json({ error: "Session invalide" }, { status: 401 })

    // 2. Facture + client
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

    // 3. Entreprise (pour l'email uniquement — le PDF utilise sa propre requête)
    const { data: company } = await supabase
      .from("companies")
      .select("name,accent_color,email,iban")
      .eq("user_id", user.id)
      .single()

    const accentColor = company?.accent_color ?? "#2563EB"
    const companyName = company?.name?.trim() || user.email?.split("@")[0] || "Votre prestataire"
    const senderEmail = company?.email?.trim() || user.email
    const clientName  = invoice.client?.name ?? ""

    // 4. Générer le PDF via la route /pdf — identique au téléchargement (avec logo, SIRET, etc.)
    const pdfBuffer = await generateInvoicePdfBuffer(id, accessToken)

    // 5. Construire et envoyer l'email
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
      clientName,
      clientEmail,
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "https://qonforme.fr",
    })

    const cc        = senderEmail ? [senderEmail] : []
    const ccSubject = `Copie — Facture ${invoice.invoice_number} pour ${clientName}`

    await sendEmail({
      to:          clientEmail,
      subject,
      html,
      fromName:    companyName,
      ccSubject,
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
