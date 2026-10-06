import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { statusAfterSend } from "@/lib/utils/document-status"
import { sendEmail } from "@/lib/email/resend"
import { buildQuoteEmail } from "@/lib/email/templates/quote"
import { generateQuotePdf } from "@/lib/pdf/quote"
import { markShareLinkSent, shareLinkForEmail } from "@/lib/signature/share"
import { selectCompanyWithProfile } from "@/lib/legal/db"
import { requireIssuerIdentity } from "@/lib/legal/issuer"

interface Params { params: Promise<{ id: string }> }

export const maxDuration = 30

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const { id } = await params

    // 1. Devis + client
    const { data: quote, error: qErr } = await supabase
      .from("quotes")
      .select("*, client:clients(id,name,email,address,zip_code,city,siren,vat_number)")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()
    if (qErr || !quote) return NextResponse.json({ error: "Devis introuvable" }, { status: 404 })

    // Identité de l'émetteur (SIREN, adresse) : obligatoire sur le devis envoyé
    const noIdentity = await requireIssuerIdentity(supabase, user.id)
    if (noIdentity) return noIdentity

    const clientEmail = quote.client?.email
    if (!clientEmail) return NextResponse.json({ error: "Le client n'a pas d'adresse email" }, { status: 422 })

    // 2. Entreprise
    // Profil légal compris (mentions automatiques d'un brouillon), s'il existe déjà en base
    const { data: company } = await selectCompanyWithProfile(supabase, "name,siren,siret,vat_number,address,zip_code,city,iban,legal_notice,accent_color,logo_url,email", user.id)

    const companyName = company?.name?.trim() || user.email?.split("@")[0] || "Votre prestataire"
    const senderEmail = company?.email?.trim() || user.email
    const accentColor = company?.accent_color ?? "#15803D"
    const clientName  = quote.client?.name ?? ""

    // 3. Générer le PDF via la lib partagée — identique au téléchargement (logo, SIRET, etc.)
    const pdfBuffer = await generateQuotePdf({ quote, company })

    // Lien en ligne : signature (formule active) ou consultation (compte gratuit) ;
    // null tant que la migration de la signature n'est pas appliquée
    const share = await shareLinkForEmail(supabase, user.id, "quote", id)

    // 4. Construire et envoyer l'email
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
      link: share ? { url: share.url, mode: share.mode } : null,
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

    // 5. Mettre à jour le statut
    await supabase
      .from("quotes")
      .update({ status: statusAfterSend("quote", quote.status), sent_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)

    await markShareLinkSent(share, clientEmail)

    return NextResponse.json({ success: true, sentTo: clientEmail, link: share?.mode ?? null })
  } catch (err) {
    console.error("Quote send error:", err)
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
