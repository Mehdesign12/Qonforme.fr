import { NextRequest, NextResponse } from "next/server"
import { createAdminClient, createClient } from "@/lib/supabase/server"
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
import { choiceAllowed, parseDeliveryChoice, PLATFORM_UNAVAILABLE_TEXT } from "@/lib/pa/delivery"
import { loadDeliveryOptions } from "@/lib/pa/delivery-server"
import { markDeposited, markFailed, reserveOutbound, toOutboundEvent } from "@/lib/pa/outbound"
import { depositErrorText, depositExternalId, duplicateIdOf, obtainToken } from "@/lib/pa/deposit"
import { loadConnection } from "@/lib/pa/store"
import { createSuperPdpApi } from "@/lib/pa/superpdp/api"
import { sirenToVAT } from "@/lib/utils/invoice"
import type { SupabaseClient } from "@supabase/supabase-js"

interface Params { params: Promise<{ id: string }> }

// Timeout étendu : génération PDF + envoi Resend peut prendre > 10s
export const maxDuration = 30

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const { id } = await params
    console.log(`[invoice-send] Début envoi facture ${id} par user ${user.id}`)

    // Canal choisi dans la fenêtre d'envoi (sans corps : email, comme avant)
    const choice = parseDeliveryChoice(await req.json().catch(() => ({})))
    if ("error" in choice) return NextResponse.json({ error: choice.error }, { status: 400 })

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

    // Par la plateforme agréée : aucun email au client, l'adresse vient de l'annuaire
    if (choice.channel === "platform") return sendByPlatform({ supabase, userId: user.id, id, invoice, address: choice.address })

    // Client sans email : l'adresse tapée dans la fenêtre d'envoi est enregistrée sur sa fiche
    let clientEmail = invoice.client?.email
    if (!clientEmail && choice.channel === "email" && choice.email && invoice.client?.id) {
      const { error: clientErr } = await supabase
        .from("clients")
        .update({ email: choice.email })
        .eq("id", invoice.client.id)
        .eq("user_id", user.id)
      if (clientErr) return NextResponse.json({ error: "L'adresse email du client n'a pas pu être enregistrée. Réessayez." }, { status: 500 })
      clientEmail = choice.email
      invoice = { ...invoice, client: { ...invoice.client, email: choice.email } }
    }
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

const CLIENT_SELECT = "*, client:clients(id,name,email,address,zip_code,city,country,siren,vat_number)"
const COMPANY_SELECT = "name,siren,siret,vat_number,address,zip_code,city,country,iban,legal_notice,accent_color,logo_url,email,invoice_prefix"

type InvoiceRecord = Record<string, unknown> & { status: string; invoice_number?: string | null; client?: Record<string, unknown> | null }

/**
 * Envoi par la plateforme agréée (Super PDP, lib/pa). Ordre : contrôle des
 * canaux, réservation de l'envoi, jeton (sous verrou), puis émission du
 * brouillon, PDF Factur-X avec les adresses de l'annuaire, dépôt. Tout ce qui
 * échoue avant l'émission laisse la facture en brouillon ; après, elle reste
 * émise et se renvoie depuis sa fiche (comme un email non parti).
 */
async function sendByPlatform(p: { supabase: SupabaseClient; userId: string; id: string; invoice: InvoiceRecord; address: string }) {
  const { supabase, userId, id, address } = p
  let invoice = p.invoice
  const admin = createAdminClient()

  // 1. La route refait le contrôle de la fenêtre : mode ouvert, raccordement,
  //    client dans l'annuaire, adresse proposée, pas déjà transmise
  const delivery = await loadDeliveryOptions(admin, userId, invoice.client as never, { document: { type: "invoice", id } })
  if (!delivery.ok) return NextResponse.json({ error: delivery.error }, { status: delivery.status })
  const { options, mode } = delivery
  if (!mode || !choiceAllowed(options, { channel: "platform", address })) {
    const error = options.platform.offered
      ? "Cette adresse de facturation électronique n'est pas celle de votre client dans l'annuaire."
      : PLATFORM_UNAVAILABLE_TEXT[options.platform.reason]
    return NextResponse.json({ error }, { status: 409 })
  }
  const conn = await loadConnection(admin, userId)
  const senderAddress = conn.ok ? conn.row?.electronic_address ?? null : null
  // Bac à sable : Super PDP exige que le vendeur soit l'entreprise raccordée, au numéro
  // fictif (« 000000001 ») ; en production, la concordance est contrôlée plus haut
  const platformSiren = mode === "test" && conn.ok ? conn.row?.siren ?? null : null

  // 2. Réservation : un seul envoi à la fois pour cette facture
  const reserved = await reserveOutbound(admin, {
    userId, mode, type: "invoice", documentId: id,
    documentNumber: invoice.invoice_number ?? "Brouillon",
    recipientAddress: address, senderAddress,
  })
  if (!reserved.ok) {
    const error = reserved.reason === "in_progress" ? "Un envoi de cette facture par la plateforme est déjà en cours."
      : reserved.reason === "already_sent" ? "Cette facture a déjà été transmise par la plateforme agréée."
      : "L'envoi par la plateforme est indisponible pour le moment. Réessayez dans un instant."
    return NextResponse.json({ error }, { status: reserved.reason === "error" || reserved.reason === "missing" ? 503 : 409 })
  }
  const row = reserved.row

  // 3. Jeton : un raccordement indisponible n'attribue aucun numéro
  const token = await obtainToken(admin, userId)
  if (!token.ok) {
    await markFailed(admin, row.id, token.error)
    return NextResponse.json({ error: token.error }, { status: 503 })
  }

  const { data: company } = await supabase.from("companies").select(COMPANY_SELECT).eq("user_id", userId).single()

  // 4. Émission du brouillon (numéro, statut, date du jour), avant le PDF qui porte le numéro
  let wasIssuedNow = false
  if (invoice.status === "draft") {
    const issued = await issueDraftInvoice<InvoiceRecord>(supabase, {
      invoiceId: id,
      userId,
      companyPrefix: (company as { invoice_prefix?: string | null } | null)?.invoice_prefix,
      draft: invoice as never,
      status: statusAfterSend("invoice", invoice.status),
      today: todayInParis(),
      selectClause: CLIENT_SELECT,
    })
    if (issued.error || !issued.data) {
      await markFailed(admin, row.id, issued.error?.message ?? "Émission impossible.")
      return NextResponse.json({ error: issued.error?.message ?? "La facture n'a pas pu être émise. Réessayez." }, { status: 500 })
    }
    invoice = issued.data
    wasIssuedNow = true
  }
  const number = invoice.invoice_number ?? null
  const failedAfterIssue = async (text: string, status = 502) => {
    await markFailed(admin, row.id, text, number)
    if (!wasIssuedNow) return NextResponse.json({ error: text }, { status })
    return NextResponse.json({ error: `La facture ${number} est émise, mais elle n'est pas partie : ${text} Renvoyez-la depuis sa fiche.`, issued: true, invoice }, { status })
  }

  // 5. PDF Factur-X avec les adresses de facturation électronique de l'annuaire
  let pdf: Uint8Array
  try {
    pdf = await generateInvoicePdf({
      invoice: { ...invoice, client: { ...(invoice.client ?? {}), electronic_address: address } } as never,
      company: {
        ...(company ?? {}),
        electronic_address: senderAddress,
        ...(platformSiren && /^\d{9}$/.test(platformSiren) ? { siren: platformSiren, siret: null, vat_number: sirenToVAT(platformSiren) } : {}),
      } as never,
    })
  } catch (err) {
    console.error("[invoice-send] PDF pour la plateforme:", err)
    return failedAfterIssue("Le fichier de la facture n'a pas pu être produit.", 500)
  }

  // 6. Dépôt chez Super PDP
  let platformInvoiceId: number
  let events: ReturnType<typeof toOutboundEvent>[] = []
  try {
    const deposited = await createSuperPdpApi(token.token).depositInvoice(pdf, { externalId: depositExternalId(id, row.attempt) })
    platformInvoiceId = deposited.id
    events = (deposited.events ?? []).map(toOutboundEvent)
  } catch (err) {
    // Déjà déposée (un essai précédent interrompu avant la réponse) : on la reprend
    const existing = duplicateIdOf(err)
    if (existing == null) {
      console.error("[invoice-send] Dépôt refusé:", err instanceof Error ? err.message : err)
      return failedAfterIssue(depositErrorText(err))
    }
    platformInvoiceId = existing
  }
  await markDeposited(admin, row, { platformInvoiceId, events, documentNumber: number })

  // 7. Statut « Envoyée » et date d'envoi (jamais par-dessus un statut payé ou crédité)
  const sentAt = new Date().toISOString()
  const status = statusAfterSend("invoice", invoice.status)
  await supabase.from("invoices").update({ status, sent_at: sentAt }).eq("id", id).eq("user_id", userId)
  return NextResponse.json({ success: true, channel: "platform", sentTo: address, invoice: { ...invoice, status, sent_at: sentAt } })
}
