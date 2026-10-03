import { NextRequest, NextResponse } from "next/server"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { sendEmail } from "@/lib/email/resend"
import { buildSignatureRequestEmail } from "@/lib/email/templates/signature"
import { hasSignatureAccess, requireSignatureAccess } from "@/lib/signature/access"
import { decryptToken, tokenMatches } from "@/lib/signature/crypto"
import { canCreateLink, clientKindOf, computeLinkState, isValidEmail, linkExpiry } from "@/lib/signature/rules"
import {
  SignatureError, createLink, ensureLink, generateDocumentPdf, getSignatureSettings, latestLink, linkUrl, listEvents,
  loadCompany, loadDocument, markDocumentSent, pdfFilename, recordEvent, requestMeta, type LoadedDoc,
} from "@/lib/signature/server"
import type { SignatureDocType, SignaturePanelData, SignaturePanelLink, SignatureRow } from "@/lib/signature/types"

/**
 * Panneau « Signature en ligne » de la fiche devis ou bon de commande.
 *
 * GET  : état du lien, journal, lien à copier (s'il est actif).
 * POST : { action: "link" | "send" | "renew" | "disable" }
 *   - link   : crée (ou reprend) le lien de signature et le renvoie ;
 *   - send   : envoie au client l'email « Consulter et signer » avec le PDF ;
 *   - renew  : remplace le lien actif par un nouveau (l'ancien devient caduc) ;
 *   - disable: désactive le lien actif.
 * Créer, envoyer ou renouveler demande une formule (402 SUBSCRIPTION_REQUIRED) ;
 * désactiver reste toujours possible.
 */
export const dynamic = "force-dynamic"
export const maxDuration = 30

type Params = { params: { type: string; id: string } }

function docType(raw: string): SignatureDocType | null {
  return raw === "quote" ? "quote" : raw === "purchase_order" || raw === "purchase-order" ? "purchase_order" : null
}

async function authed() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

function panelLink(row: SignatureRow, events: SignaturePanelLink["events"], now: Date): SignaturePanelLink {
  const state = computeLinkState(row, now)
  const token = row.status === "pending" && state !== "expired" ? decryptToken(row.token_ciphertext) : null
  return {
    id: row.id,
    mode: row.mode,
    state,
    version: row.version,
    url: token && tokenMatches(token, row.token_hash) ? linkUrl(token) : null,
    expires_at: row.expires_at,
    created_at: row.created_at,
    sent_at: row.sent_at,
    sent_to: row.sent_to,
    view_count: row.view_count ?? 0,
    first_viewed_at: row.first_viewed_at,
    last_viewed_at: row.last_viewed_at,
    code_required: row.code_required,
    client_kind: row.client_kind,
    signer_name: row.signer_name,
    signer_email: row.signer_email,
    signer_role: row.signer_role,
    signer_company: row.signer_company,
    client_order_number: row.client_order_number,
    signature_method: row.signature_method,
    signature_context: row.signature_context,
    signed_at: row.signed_at,
    signer_ip: row.signer_ip,
    document_sha256: row.document_sha256,
    consents: row.consents,
    refused_at: row.refused_at,
    refusal_reason: row.refusal_reason,
    refusal_message: row.refusal_message,
    events,
  }
}

async function panelData(admin: ReturnType<typeof createAdminClient>, doc: LoadedDoc, access: boolean): Promise<SignaturePanelData> {
  const settings = await getSignatureSettings(admin, doc.user_id)
  if (!settings.available) {
    return { available: false, access, enabled: false, client_kind: clientKindOf(doc.client), client_email: doc.client?.email ?? null, link: null }
  }
  const { available, row } = await latestLink(admin, doc.user_id, doc.type, doc.id)
  const events = row ? await listEvents(admin, row.id) : []
  return {
    available,
    access,
    enabled: settings.settings.enabled,
    client_kind: clientKindOf(doc.client),
    client_email: doc.client?.email ?? null,
    link: row ? panelLink(row, events, new Date()) : null,
  }
}

export async function GET(_req: NextRequest, { params }: Params) {
  const type = docType(params.type)
  if (!type) return NextResponse.json({ error: "Type de document inconnu" }, { status: 404 })
  const { supabase, user } = await authed()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  try {
    const admin = createAdminClient()
    const doc = await loadDocument(admin, type, params.id, user.id)
    if (!doc) return NextResponse.json({ error: "Document introuvable" }, { status: 404 })
    const access = (await hasSignatureAccess(supabase, user.id)) === true
    return NextResponse.json(await panelData(admin, doc, access), { headers: { "Cache-Control": "no-store" } })
  } catch (err) {
    console.error("[signature] panneau :", err)
    // Le panneau se masque : l'accord sur papier reste disponible
    return NextResponse.json({ available: false, access: false, enabled: false, client_kind: "consumer", client_email: null, link: null } satisfies SignaturePanelData)
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const type = docType(params.type)
  if (!type) return NextResponse.json({ error: "Type de document inconnu" }, { status: 404 })
  const { supabase, user } = await authed()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* corps vide */ }
  const action = body.action

  const admin = createAdminClient()
  const doc = await loadDocument(admin, type, params.id, user.id)
  if (!doc) return NextResponse.json({ error: "Document introuvable" }, { status: 404 })

  try {
    /* ── Désactiver : toujours possible, sans formule ── */
    if (action === "disable") {
      const { row } = await latestLink(admin, user.id, type, doc.id)
      if (!row || row.status !== "pending") return NextResponse.json({ error: "Aucun lien actif à désactiver." }, { status: 409 })
      await admin.from("document_signatures").update({ status: "disabled", disabled_at: new Date().toISOString() }).eq("id", row.id).eq("status", "pending")
      await recordEvent(admin, row, "disabled", requestMeta(req))
      return NextResponse.json(await panelData(admin, doc, (await hasSignatureAccess(supabase, user.id)) === true))
    }

    if (action !== "link" && action !== "send" && action !== "renew") {
      return NextResponse.json({ error: "Action inconnue" }, { status: 400 })
    }

    const paywall = await requireSignatureAccess(supabase, user.id)
    if (paywall) return paywall

    const settings = await getSignatureSettings(admin, user.id)
    if (!settings.available) return NextResponse.json({ error: "La signature en ligne n'est pas encore activée." }, { status: 503 })
    if (!settings.settings.enabled) {
      return NextResponse.json({ error: "La signature en ligne est désactivée dans Paramètres › Modèles de documents." }, { status: 409 })
    }

    // Vérifications avant de faire sortir un brouillon : document signable, devis non expiré
    if (!canCreateLink(type, doc.status, "sign")) {
      return NextResponse.json({ error: type === "quote" ? "Ce devis n'attend plus de signature." : "Ce bon de commande n'attend plus de confirmation." }, { status: 409 })
    }
    if (!linkExpiry({ docType: type, mode: "sign", validUntil: doc.valid_until, linkValidityDays: settings.settings.link_validity_days, now: new Date() })) {
      return NextResponse.json({ error: "Ce devis a expiré : dupliquez-le pour proposer une version à jour." }, { status: 409 })
    }

    // L'email part uniquement à l'adresse de la fiche client, comme l'envoi classique
    let to: string | null = null
    if (action === "send") {
      to = doc.client?.email?.trim().toLowerCase() || null
      if (!isValidEmail(to)) return NextResponse.json({ error: "Ajoutez l'adresse email du client dans sa fiche." }, { status: 422 })
    }

    // Un brouillon partagé pour signature est émis : il passe à « envoyé » et ne se modifie plus.
    // Par email, seulement une fois l'email parti (comme l'envoi classique).
    if (action !== "send") await markDocumentSent(admin, doc, { byEmail: false })

    const { row, token } = action === "renew"
      ? await createLink(admin, { doc, mode: "sign", settings: settings.settings })
      : await ensureLink(admin, { doc, mode: "sign", settings: settings.settings })
    const url = linkUrl(token)

    if (action === "send" && to) {
      const company = await loadCompany(admin, user.id)
      const companyName = company?.name?.trim() || user.email?.split("@")[0] || "Votre prestataire"
      const replyTo = company?.email?.trim() || user.email || undefined
      const pdf = await generateDocumentPdf(doc, company)
      const { subject, html } = buildSignatureRequestEmail({
        docType: type, docNumber: doc.number, companyName, accentColor: company?.accent_color ?? "#2563EB",
        subtotalHt: doc.subtotal_ht, totalVat: doc.total_vat, totalTtc: doc.total_ttc,
        expiresAt: row.expires_at, url, codeRequired: row.code_required,
      })
      await sendEmail({
        to, subject, html, fromName: companyName, replyTo,
        cc: replyTo ? [replyTo] : [], ccSubject: `Copie — ${subject}`,
        attachments: [{ filename: pdfFilename(doc.number, false), content: pdf }],
      })
      await markDocumentSent(admin, doc, { byEmail: true })
      await admin.from("document_signatures").update({ sent_at: new Date().toISOString(), sent_to: to }).eq("id", row.id)
      await recordEvent(admin, row, "sent", requestMeta(req), { to })
    }

    const data = await panelData(admin, doc, true)
    // Le lien vient d'être créé ou relu : on le renvoie même si le chiffrement de la copie est indisponible
    if (data.link && data.link.id === row.id && !data.link.url) data.link.url = url
    return NextResponse.json({ ...data, url, sentTo: to })
  } catch (err) {
    if (err instanceof SignatureError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status })
    console.error("[signature] action artisan :", err)
    const message = err instanceof Error && /Resend/.test(err.message) ? "L'email n'a pas pu partir. Réessayez dans un instant." : "Une erreur est survenue. Réessayez dans un instant."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
