import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendEmail } from "@/lib/email/resend"
import { buildQuoteEmail } from "@/lib/email/templates/quote"

interface Params { params: Promise<{ id: string }> }

// Génère le PDF devis en appelant la route interne GET /api/quotes/[id]/pdf
// → identique au PDF téléchargé depuis l'interface (avec logo, TVA, etc.)
async function generateQuotePdfBuffer(quoteId: string, accessToken: string): Promise<Buffer> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const res = await fetch(`${baseUrl}/api/quotes/${quoteId}/pdf`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error("Impossible de générer le PDF du devis")
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

    // 2. Devis + client
    const { data: quote, error: qErr } = await supabase
      .from("quotes")
      .select("*, client:clients(id,name,email,address,zip_code,city,siren,vat_number)")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()
    if (qErr || !quote) return NextResponse.json({ error: "Devis introuvable" }, { status: 404 })

    const clientEmail = quote.client?.email
    if (!clientEmail) return NextResponse.json({ error: "Le client n'a pas d'adresse email" }, { status: 422 })

    // 3. Entreprise
    const { data: company } = await supabase
      .from("companies")
      .select("name,accent_color,email")
      .eq("user_id", user.id)
      .single()

    const companyName = company?.name?.trim() || user.email?.split("@")[0] || "Votre prestataire"
    const senderEmail = company?.email?.trim() || user.email
    const accentColor = company?.accent_color ?? "#15803D"
    const clientName  = quote.client?.name ?? ""

    // 4. Générer le PDF via la route /pdf — identique au téléchargement
    const pdfBuffer = await generateQuotePdfBuffer(id, accessToken)

    // 5. Construire et envoyer l'email
    const { subject, html } = buildQuoteEmail({
      quoteNumber:  quote.quote_number,
      issueDate:    quote.issue_date,
      validUntil:   quote.valid_until,
      subtotalHt:   quote.subtotal_ht,
      totalVat:     quote.total_vat,
      totalTtc:     quote.total_ttc,
      notes:        quote.notes,
      companyName,
      accentColor,
      clientName,
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "https://qonforme.fr",
    })

    const cc        = senderEmail ? [senderEmail] : []
    const ccSubject = `Copie — Devis ${quote.quote_number} pour ${clientName}`

    await sendEmail({
      to:          clientEmail,
      subject,
      html,
      fromName:    companyName,
      ccSubject,
      replyTo:     senderEmail,
      cc,
      attachments: [{ filename: `${quote.quote_number}.pdf`, content: pdfBuffer }],
    })

    // 6. Mettre à jour le statut
    await supabase
      .from("quotes")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)

    return NextResponse.json({ success: true, sentTo: clientEmail })
  } catch (err) {
    console.error("Quote send error:", err)
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
