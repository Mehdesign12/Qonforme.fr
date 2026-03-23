import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendEmail } from "@/lib/email/resend"
import { buildCreditNoteEmail } from "@/lib/email/templates/credit-note"
import { generateCreditNotePdf } from "@/lib/pdf/credit-note"

interface Params { params: Promise<{ id: string }> }

export const maxDuration = 30

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const { id } = await params

    // 1. Avoir + client + facture originale
    const { data: creditNote, error: cnErr } = await supabase
      .from("credit_notes")
      .select(`
        *,
        client:clients(id,name,email,address,zip_code,city,siren,vat_number),
        original_invoice:invoices(id,invoice_number,issue_date,total_ttc),
        invoice:invoices(invoice_number)
      `)
      .eq("id", id)
      .eq("user_id", user.id)
      .single()
    if (cnErr || !creditNote) return NextResponse.json({ error: "Avoir introuvable" }, { status: 404 })

    const clientEmail = creditNote.client?.email
    if (!clientEmail) return NextResponse.json({ error: "Le client n'a pas d'adresse email" }, { status: 422 })

    // 2. Entreprise
    const { data: company } = await supabase
      .from("companies")
      .select("name,siren,siret,vat_number,address,zip_code,city,iban,legal_notice,accent_color,logo_url,email")
      .eq("user_id", user.id)
      .single()

    const companyName = company?.name?.trim() || user.email?.split("@")[0] || "Votre prestataire"
    const senderEmail = company?.email?.trim() || user.email
    const clientName  = creditNote.client?.name ?? ""

    // 3. Générer le PDF via la lib partagée — identique au téléchargement (logo, SIRET, etc.)
    const pdfBuffer = await generateCreditNotePdf({ creditNote, company })

    // 4. Construire et envoyer l'email
    const { subject, html } = buildCreditNoteEmail({
      creditNoteNumber: creditNote.credit_note_number,
      issueDate:        creditNote.issue_date,
      subtotalHt:       creditNote.subtotal_ht,
      totalVat:         creditNote.total_vat,
      totalTtc:         creditNote.total_ttc,
      invoiceNumber:    creditNote.invoice?.invoice_number ?? creditNote.original_invoice?.invoice_number ?? null,
      notes:            creditNote.notes,
      companyName,
      accentColor:      company?.accent_color ?? "#EA580C",
      clientName,
    })

    const cc        = senderEmail ? [senderEmail] : []
    const ccSubject = `Copie — Avoir ${creditNote.credit_note_number} pour ${clientName}`

    await sendEmail({
      to:          clientEmail,
      subject,
      html,
      fromName:    companyName,
      ccSubject,
      replyTo:     senderEmail,
      cc,
      attachments: [{ filename: `${creditNote.credit_note_number}.pdf`, content: pdfBuffer }],
    })

    // 5. Mettre à jour sent_at
    await supabase
      .from("credit_notes")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)

    return NextResponse.json({ success: true, sentTo: clientEmail })
  } catch (err) {
    console.error("Credit note send error:", err)
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
