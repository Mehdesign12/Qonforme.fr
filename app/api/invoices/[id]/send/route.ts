import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { statusAfterSend } from "@/lib/utils/document-status"
import { requireIssuingAccess } from "@/lib/stripe/subscription"
import { requireIssuerIdentity } from "@/lib/legal/issuer"
import { sendEmail } from "@/lib/email/resend"
import { buildInvoiceEmail } from "@/lib/email/templates/invoice"
import { generateInvoicePdf } from "@/lib/pdf/invoice"
import { issueDraftInvoice } from "@/lib/utils/document-numbering"
import { todayInParis } from "@/lib/utils/paris-date"
import { paymentLinkFor } from "@/lib/payment-link/server"
import { artisanEmailExtras, isArtisanKind } from "@/lib/artisan/billing"
import { requireArtisanAccess } from "@/lib/artisan/access"

interface Params { params: Promise<{ id: string }> }

// Timeout étendu : génération PDF + envoi Resend peut prendre > 10s
export const maxDuration = 30

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const { id } = await params
    console.log(`[invoice-send] Début envoi facture ${id} par user ${user.id}`)

    // 1. Facture + client
    const { data: loaded, error: invErr } = await supabase
      .from("invoices")
      .select("*, client:clients(id,name,email,address,zip_code,city,country,siren,vat_number)")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()
    if (invErr || !loaded) {
      console.error(`[invoice-send] Facture introuvable: ${invErr?.message}`)
      return NextResponse.json({ error: "Facture introuvable" }, { status: 404 })
    }
    let invoice = loaded

    // Identité de l'émetteur (SIREN, adresse), obligatoire sur la facture :
    // vérifiée AVANT le mur de paiement, pour qu'un artisan ne paie jamais une
    // formule et se voie ensuite refuser l'envoi (lib/legal/issuer.ts)
    const noIdentity = await requireIssuerIdentity(supabase, user.id)
    if (noIdentity) return noIdentity

    // Envoyer une facture demande une formule active (devis gratuits, factures
    // payantes). Acompte, situation ou solde à émettre : la formule Artisan
    // (colonne absente avant la migration : facture ordinaire, rien ne change).
    const blocked = invoice.status === "draft" && isArtisanKind((invoice as { invoice_kind?: string }).invoice_kind)
      ? await requireArtisanAccess(supabase, user.id)
      : await requireIssuingAccess(supabase, user.id)
    if (blocked) return blocked

    const clientEmail = invoice.client?.email
    console.log(`[invoice-send] Client: ${invoice.client?.name}, email: ${clientEmail}`)
    if (!clientEmail) {
      return NextResponse.json({ error: "Le client n'a pas d'adresse email" }, { status: 422 })
    }

    // 2. Entreprise
    const { data: company } = await supabase
      .from("companies")
      .select("name,siren,siret,vat_number,address,zip_code,city,country,iban,legal_notice,accent_color,logo_url,email,invoice_prefix")
      .eq("user_id", user.id)
      .single()

    const accentColor = company?.accent_color ?? "#2563EB"
    const companyName = company?.name?.trim() || user.email?.split("@")[0] || "Votre prestataire"
    const senderEmail = company?.email?.trim() || user.email
    const clientName  = invoice.client?.name ?? ""

    // 3. Émission d'un brouillon : numéro définitif, statut « Envoyée » et date
    //    d'émission en une seule écriture, AVANT le PDF qui doit porter le numéro
    //    (lib/utils/document-numbering.ts). Une facture numérotée est émise : si
    //    l'email échoue ensuite, elle le reste et se renvoie depuis sa fiche.
    let wasIssuedNow = false
    if (invoice.status === "draft") {
      const issued = await issueDraftInvoice<typeof invoice>(supabase, {
        invoiceId: id,
        userId: user.id,
        companyPrefix: company?.invoice_prefix,
        draft: invoice,
        status: statusAfterSend("invoice", invoice.status),
        today: todayInParis(),
        selectClause: "*, client:clients(id,name,email,address,zip_code,city,country,siren,vat_number)",
      })
      if (issued.error || !issued.data) {
        console.error(`[invoice-send] Émission impossible: ${issued.error?.message}`)
        return NextResponse.json({ error: issued.error?.message ?? "La facture n'a pas pu être émise. Réessayez." }, { status: 500 })
      }
      invoice = issued.data
      wasIssuedNow = true
    }

    // 4. Générer le PDF via la lib partagée — identique au téléchargement (logo, SIRET, etc.)
    console.log(`[invoice-send] Génération PDF...`)
    let pdfBuffer: Buffer
    try {
      const pdfBytes = await generateInvoicePdf({ invoice, company })
      pdfBuffer = Buffer.from(pdfBytes)
    } catch (err) {
      return sendFailed(err, invoice, wasIssuedNow)
    }
    console.log(`[invoice-send] PDF généré (${pdfBuffer.length} bytes)`)

    // Lien de la page de règlement par virement, sur la facture désormais émise et
    // numérotée (null sans IBAN valide ou si l'artisan l'a désactivé ; ne fait
    // jamais échouer l'envoi)
    const paymentUrl = await paymentLinkFor({ invoiceId: id, userId: user.id, issuing: true })

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
      appUrl:        process.env.NEXT_PUBLIC_APP_URL ?? "https://qonforme.fr",
      paymentUrl,
      // Acompte, situation, solde : nature du document et retenue de garantie
      ...artisanEmailExtras(invoice),
    })

    const cc        = senderEmail ? [senderEmail] : []
    const ccSubject = `Copie — Facture ${invoice.invoice_number} pour ${clientName}`

    console.log(`[invoice-send] Envoi email à ${clientEmail}, CC: ${cc.join(",")}`)
    try {
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
    } catch (err) {
      return sendFailed(err, invoice, wasIssuedNow)
    }
    console.log(`[invoice-send] Email envoyé avec succès`)

    // 6. Mettre à jour statut + sent_at. Renvoyer une copie d'une facture payée
    //    ou créditée ne doit pas écraser son statut (lib/utils/document-status.ts).
    const sentAt = new Date().toISOString()
    const status = statusAfterSend("invoice", invoice.status)
    await supabase
      .from("invoices")
      .update({ status, sent_at: sentAt })
      .eq("id", id)
      .eq("user_id", user.id)

    return NextResponse.json({ success: true, sentTo: clientEmail, invoice: { ...invoice, status, sent_at: sentAt } })
  } catch (err) {
    console.error("Invoice send error:", err)
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * Échec du PDF ou de l'email. Si la facture vient d'être émise (numérotée),
 * elle le reste — un numéro attribué ne se retire pas — et la réponse le dit
 * pour que l'artisan la renvoie depuis sa fiche.
 */
function sendFailed(err: unknown, invoice: { invoice_number?: string | null }, wasIssuedNow: boolean) {
  console.error("Invoice send error:", err)
  const detail = err instanceof Error ? err.message : "Erreur inconnue"
  if (!wasIssuedNow) return NextResponse.json({ error: detail }, { status: 500 })
  return NextResponse.json(
    {
      error: `La facture ${invoice.invoice_number} est émise, mais l'email n'est pas parti. Renvoyez-la depuis sa fiche.`,
      issued: true,
      invoice,
    },
    { status: 502 },
  )
}
