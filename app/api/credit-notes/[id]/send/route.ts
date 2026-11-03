import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendEmail } from "@/lib/email/resend"
import { buildCreditNoteEmail } from "@/lib/email/templates/credit-note"
import { generateCreditNotePdf } from "@/lib/pdf/credit-note"
import { createAdminClient } from "@/lib/supabase/server"
import { resolveRecipient } from "@/lib/email/recipient"
import { CREDIT_NOTE_PLATFORM_TEXT, loadCreditNoteDelivery } from "@/lib/pa/credit-note-delivery"
import { markDeposited, markFailed, reserveOutbound, toOutboundEvent } from "@/lib/pa/outbound"
import { depositErrorText, depositExternalId, duplicateIdOf, obtainToken } from "@/lib/pa/deposit"
import { loadConnection } from "@/lib/pa/store"
import { createSuperPdpApi } from "@/lib/pa/superpdp/api"
import { sirenToVAT } from "@/lib/utils/invoice"
import type { SupabaseClient } from "@supabase/supabase-js"

interface Params { params: Promise<{ id: string }> }

export const maxDuration = 30

export async function POST(req: NextRequest, { params }: Params) {
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
        client:clients(id,name,email,address,zip_code,city,country,siren,vat_number),
        original_invoice:invoices(id,invoice_number,issue_date,total_ttc),
        invoice:invoices(invoice_number)
      `)
      .eq("id", id)
      .eq("user_id", user.id)
      .single()
    if (cnErr || !creditNote) return NextResponse.json({ error: "Avoir introuvable" }, { status: 404 })

    // Canal : « platform » (avoir d'une facture transmise par la plateforme agréée) ou email
    const body = await req.clone().json().catch(() => null) as { channel?: unknown } | null
    if (body?.channel === "platform") {
      return sendCreditNoteByPlatform({ supabase, userId: user.id, id, creditNote })
    }

    // Client sans adresse : celle tapée dans la fenêtre d'envoi est enregistrée sur sa fiche
    const recipient = await resolveRecipient(req, supabase, user.id, creditNote.client)
    if ("response" in recipient) return recipient.response
    const clientEmail = recipient.email

    // 2. Entreprise
    const { data: company } = await supabase
      .from("companies")
      .select("name,siren,siret,vat_number,address,zip_code,city,country,iban,legal_notice,accent_color,logo_url,email")
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

const COMPANY_SELECT = "name,siren,siret,vat_number,address,zip_code,city,country,iban,legal_notice,accent_color,logo_url,email"

/**
 * Avoir par la plateforme agréée : même enchaînement que la facture (contrôle,
 * réservation, jeton sous verrou, PDF Factur-X 381 avec les adresses de
 * facturation électronique, contrôle de Super PDP, dépôt). L'avoir est déjà
 * numéroté : un échec le laisse tel quel, à renvoyer depuis sa fiche.
 */
async function sendCreditNoteByPlatform(p: {
  supabase: SupabaseClient
  userId: string
  id: string
  creditNote: Record<string, unknown> & { credit_note_number: string; original_invoice_id?: string | null; client?: Record<string, unknown> | null }
}) {
  const { supabase, userId, id, creditNote } = p
  const admin = createAdminClient()

  const delivery = await loadCreditNoteDelivery(admin, userId, { id, original_invoice_id: creditNote.original_invoice_id ?? null })
  if (!delivery.platform.offered) {
    return NextResponse.json({ error: CREDIT_NOTE_PLATFORM_TEXT[delivery.platform.reason] }, { status: 409 })
  }
  const { address, mode } = delivery.platform
  const conn = await loadConnection(admin, userId)
  const senderAddress = conn.ok ? conn.row?.electronic_address ?? null : null

  const reserved = await reserveOutbound(admin, {
    userId, mode, type: "credit_note", documentId: id,
    documentNumber: creditNote.credit_note_number,
    recipientAddress: address, senderAddress,
  })
  if (!reserved.ok) {
    const error = reserved.reason === "in_progress" ? "Un envoi de cet avoir par la plateforme est déjà en cours."
      : reserved.reason === "already_sent" ? CREDIT_NOTE_PLATFORM_TEXT.already_sent
      : "L'envoi par la plateforme est indisponible pour le moment. Réessayez dans un instant."
    return NextResponse.json({ error }, { status: reserved.reason === "error" || reserved.reason === "missing" ? 503 : 409 })
  }
  const row = reserved.row
  const fail = async (text: string, status = 502) => {
    await markFailed(admin, row.id, text, creditNote.credit_note_number)
    return NextResponse.json({ error: `L'avoir ${creditNote.credit_note_number} n'est pas parti : ${text}` }, { status })
  }

  const token = await obtainToken(admin, userId)
  if (!token.ok) return fail(token.error, 503)
  const sp = createSuperPdpApi(token.token)

  const { data: company } = await supabase.from("companies").select(COMPANY_SELECT).eq("user_id", userId).single()
  // Vendeur = entreprise raccordée (règle de Super PDP) ; en bac à sable, son numéro fictif
  const platformCompany = await sp.company().catch(() => null)
  const platformNumber = platformCompany?.number && /^\d{9}$/.test(platformCompany.number) ? platformCompany.number : null
  const issuerSiren = String((company as { siren?: string | null } | null)?.siren ?? "").replace(/\D/g, "")
  if (mode === "live" && platformNumber && issuerSiren !== platformNumber) {
    return fail("Le SIREN de votre entreprise n'est pas celui de l'entreprise raccordée chez Super PDP.", 409)
  }
  const platformSiren = mode === "test" ? platformNumber : null

  let pdf: Uint8Array
  try {
    pdf = await generateCreditNotePdf({
      creditNote: { ...creditNote, client: { ...(creditNote.client ?? {}), electronic_address: address } } as never,
      company: {
        ...(company ?? {}),
        electronic_address: senderAddress,
        ...(platformSiren ? { siren: platformSiren, siret: null, vat_number: sirenToVAT(platformSiren) } : {}),
      } as never,
    })
  } catch (err) {
    console.error("[credit-note-send] PDF pour la plateforme:", err)
    return fail("Le fichier de l'avoir n'a pas pu être produit.", 500)
  }

  const check = await sp.validateInvoice(pdf).catch(() => null)
  if (check && !check.valid) {
    console.error("[credit-note-send] Contrôle Super PDP refusé:", check.failures.slice(0, 3).join(" | "))
    const detail = check.failures[0] ? ` (${check.failures[0].slice(0, 220)})` : ""
    return fail(`le contrôle de la plateforme a refusé l'avoir${detail}.`)
  }

  let platformInvoiceId: number
  let events: ReturnType<typeof toOutboundEvent>[] = []
  try {
    const deposited = await sp.depositInvoice(pdf, { externalId: depositExternalId(id, row.attempt) })
    platformInvoiceId = deposited.id
    events = (deposited.events ?? []).map(toOutboundEvent)
  } catch (err) {
    const existing = duplicateIdOf(err)
    if (existing == null) {
      console.error("[credit-note-send] Dépôt refusé:", err instanceof Error ? err.message : err)
      return fail(depositErrorText(err))
    }
    platformInvoiceId = existing
  }
  await markDeposited(admin, row, { platformInvoiceId, events, documentNumber: creditNote.credit_note_number })

  const sentAt = new Date().toISOString()
  await supabase.from("credit_notes").update({ sent_at: sentAt }).eq("id", id).eq("user_id", userId)
  return NextResponse.json({ success: true, channel: "platform", sentTo: address, sent_at: sentAt })
}
