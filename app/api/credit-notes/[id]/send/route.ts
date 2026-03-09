import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendEmail } from "@/lib/email/resend"
import { buildCreditNoteEmail } from "@/lib/email/templates/credit-note"

interface Params { params: Promise<{ id: string }> }

// Génère le PDF avoir en appelant la route interne GET /api/credit-notes/[id]/pdf
async function generateCreditNotePdfBuffer(creditNoteId: string, accessToken: string): Promise<Buffer> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const res = await fetch(`${baseUrl}/api/credit-notes/${creditNoteId}/pdf`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error("Impossible de générer le PDF de l'avoir")
  return Buffer.from(await res.arrayBuffer())
}

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const { id } = await params

    const { data: creditNote, error: cnErr } = await supabase
      .from("credit_notes")
      .select("*, client:clients(id,name,email), invoice:invoices(invoice_number)")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()
    if (cnErr || !creditNote) return NextResponse.json({ error: "Avoir introuvable" }, { status: 404 })

    const clientEmail = creditNote.client?.email
    if (!clientEmail) return NextResponse.json({ error: "Le client n'a pas d'adresse email" }, { status: 422 })

    const { data: company } = await supabase
      .from("companies")
      .select("name,accent_color,email")
      .eq("user_id", user.id)
      .single()

    const companyName = (company as { name?: string } | null)?.name ?? "Votre prestataire"
    const senderEmail = (company as { email?: string } | null)?.email ?? user.email

    // Récupérer le token de session pour appel interne
    const { data: { session } } = await supabase.auth.getSession()
    const accessToken = session?.access_token ?? ""
    const pdfBuffer = await generateCreditNotePdfBuffer(id, accessToken)

    const { subject, html } = buildCreditNoteEmail({
      creditNoteNumber: creditNote.credit_note_number,
      issueDate:        creditNote.issue_date,
      subtotalHt:       creditNote.subtotal_ht,
      totalVat:         creditNote.total_vat,
      totalTtc:         creditNote.total_ttc,
      invoiceNumber:    creditNote.invoice?.invoice_number ?? null,
      notes:            creditNote.notes,
      companyName,
      accentColor:      (company as { accent_color?: string } | null)?.accent_color ?? "#EA580C",
      clientName:       creditNote.client?.name ?? "",
    })

    const cc = senderEmail ? [senderEmail] : []
    await sendEmail({
      to:          clientEmail,
      subject,
      html,
      replyTo:     senderEmail,
      cc,
      attachments: [{ filename: `${creditNote.credit_note_number}.pdf`, content: pdfBuffer }],
    })

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
