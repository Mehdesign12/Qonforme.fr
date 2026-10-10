import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { PDFDocument } from "pdf-lib"
import { createAdminClient } from "@/lib/supabase/server"
import { sendEmail } from "@/lib/email/resend"
import {
  buildSignatureCodeEmail, buildSignatureConfirmationEmail, buildSignatureNotificationEmail, buildWithdrawalAckEmail,
} from "@/lib/email/templates/signature"
import { depositOfRow, publicDeposit, transferAccount } from "@/lib/signature/deposit"
import { codeMatches, decodeSignaturePng, generateCode, hashCode, sha256Hex } from "@/lib/signature/crypto"
import { buildSignedPdf } from "@/lib/signature/pdf"
import { publicState } from "@/lib/signature/public"
import {
  CODE_MAX_ATTEMPTS, CODE_TTL_MINUTES, canSendCode, canWithdraw, codeAttemptState, depositReference, isValidEmail, maskEmail,
  needsReducedVatCertification, parisDay, planDeposit, reducedVatCertificationText, refusedStatusFor, signedStatusFor,
  validateRefusePayload, validateSignPayload, validateWithdrawPayload, withdrawalDeadline, withdrawnStatusFor,
} from "@/lib/signature/rules"
import {
  appUrl, documentFingerprint, generateDocumentPdf, getSignatureSettings, isUuid, linkCookieName, linkUrl, listEvents,
  loadBankDetails, loadCompany, loadDocument, loadLinkForToken, ownerEmail, recordEvent, requestMeta, signatureExtrasAvailable,
  storagePaths, storePdf, pdfFilename, type CompanyInfo, type LoadedDoc,
} from "@/lib/signature/server"
import { canTransition } from "@/lib/utils/document-status"
import type { SignatureRow } from "@/lib/signature/types"

/**
 * POST /api/signature/public/[id] — actions du client sur sa page de signature.
 *
 * Route publique (sans compte) : l'accès se fait uniquement par le jeton du
 * lien, lu dans le cookie HttpOnly posé par /s/<jeton> et comparé à son
 * empreinte. Chaque requête ne touche que le lien et le document de ce lien.
 *
 * Actions : view, send_code, verify_code, sign, refuse, withdraw (rétractation
 * d'un particulier, après la signature et dans le délai de 14 jours).
 */
export const dynamic = "force-dynamic"
export const maxDuration = 30

type Admin = ReturnType<typeof createAdminClient>

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })
const fail = (error: string, status = 400, extra: Record<string, unknown> = {}) => json({ error, ...extra }, status)

/** Défense en profondeur contre les requêtes d'un autre site (le cookie est déjà SameSite=Lax). */
function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin")
  if (!origin) return true
  try {
    const o = new URL(origin).origin
    return o === req.nextUrl.origin || o === new URL(appUrl()).origin
  } catch {
    return false
  }
}

const docLabel = (t: SignatureRow["document_type"]) => (t === "quote" ? "Devis" : "Bon de commande") as "Devis" | "Bon de commande"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id
  if (!isUuid(id)) return fail("Lien introuvable.", 404)
  if (!sameOrigin(req)) return fail("Requête refusée.", 403)
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) return fail("Requête invalide.", 415)

  let body: Record<string, unknown>
  try {
    const raw = await req.text()
    if (raw.length > 400_000) return fail("Requête trop volumineuse.", 413)
    body = JSON.parse(raw)
  } catch {
    return fail("Requête invalide.")
  }

  const admin = createAdminClient()
  const token = cookies().get(linkCookieName(id))?.value
  const row = await loadLinkForToken(admin, id, token)
  if (!row || !token) return fail("Ce lien n'est plus valable sur cet appareil. Ouvrez le lien reçu par email.", 404)

  const meta = requestMeta(req)
  const now = new Date()

  try {
    switch (body.action) {
      case "view": return await onView(admin, row, meta)
      case "send_code": return await onSendCode(admin, row, body, meta, now)
      case "verify_code": return await onVerifyCode(admin, row, body, meta, now)
      case "sign": return await onSign(admin, row, body, meta, now, token)
      case "refuse": return await onRefuse(admin, row, body, meta, now)
      case "withdraw": return await onWithdraw(admin, row, body, meta, now)
      default: return fail("Action inconnue.")
    }
  } catch (err) {
    console.error("[signature] action publique :", err)
    return fail("Une erreur est survenue. Réessayez dans un instant.", 500)
  }
}

/* ------------------------------------------------------------------ */
/* Contexte commun                                                     */
/* ------------------------------------------------------------------ */

async function signableContext(admin: Admin, row: SignatureRow, now: Date): Promise<
  { ok: true; doc: LoadedDoc; company: CompanyInfo | null } | { ok: false; res: NextResponse }
> {
  const [doc, company] = await Promise.all([
    loadDocument(admin, row.document_type, row.document_id, row.user_id),
    loadCompany(admin, row.user_id),
  ])
  const state = publicState(row, doc, now)
  if (state === "superseded" && row.status === "pending" && doc && row.content_sha256 !== documentFingerprint(doc)) {
    // Le document a changé depuis l'envoi du lien : le lien devient caduc
    await admin.from("document_signatures").update({ status: "superseded", superseded_at: now.toISOString() }).eq("id", row.id).eq("status", "pending")
    await recordEvent(admin, row, "superseded", {}, { reason: "content_changed" })
  }
  if (state !== "sign" || !doc) {
    return { ok: false, res: fail("Ce document n'attend plus de signature. Rechargez la page.", 409, { state }) }
  }
  return { ok: true, doc, company }
}

async function trySend(admin: Admin, row: SignatureRow, what: string, send: () => Promise<unknown>): Promise<boolean> {
  try {
    await send()
    return true
  } catch (err) {
    console.error(`[signature] email ${what} :`, err)
    await recordEvent(admin, row, "email_failed", {}, { what })
    return false
  }
}

/* ------------------------------------------------------------------ */
/* Consultation                                                        */
/* ------------------------------------------------------------------ */

async function onView(admin: Admin, row: SignatureRow, meta: { ip: string | null; userAgent: string | null }) {
  if (row.status !== "pending") return json({ ok: true })
  const nowIso = new Date().toISOString()
  // Une consultation par tranche de 10 minutes : un rechargement de page ne compte pas
  const recent = row.last_viewed_at && Date.now() - new Date(row.last_viewed_at).getTime() < 10 * 60 * 1000
  if (recent) {
    await admin.from("document_signatures").update({ last_viewed_at: nowIso }).eq("id", row.id)
    return json({ ok: true })
  }
  await admin.from("document_signatures").update({
    view_count: (row.view_count ?? 0) + 1,
    first_viewed_at: row.first_viewed_at ?? nowIso,
    last_viewed_at: nowIso,
  }).eq("id", row.id).eq("view_count", row.view_count ?? 0)
  await recordEvent(admin, row, "viewed", meta)
  return json({ ok: true })
}

/* ------------------------------------------------------------------ */
/* Code de vérification                                                */
/* ------------------------------------------------------------------ */

async function onSendCode(admin: Admin, row: SignatureRow, body: Record<string, unknown>, meta: { ip: string | null; userAgent: string | null }, now: Date) {
  const ctx = await signableContext(admin, row, now)
  if (!ctx.ok) return ctx.res
  if (!row.code_required) return fail("Aucun code n'est demandé pour ce document.")
  if (row.code_verified_at) return json({ ok: true, verified: true })

  const allowed = canSendCode(row, now)
  if (!allowed.ok) {
    return allowed.reason === "too_soon"
      ? fail(`Patientez ${allowed.retryIn} secondes avant de demander un nouveau code.`, 429, { retryIn: allowed.retryIn })
      : fail("Trop de codes demandés pour ce lien. Demandez un nouveau lien à l'entreprise.", 429)
  }

  // Le code part à l'adresse de la fiche client ; à défaut, à celle que saisit le signataire
  const onFile = ctx.doc.client?.email?.trim() || null
  const target = onFile ?? (typeof body.email === "string" ? body.email.trim().toLowerCase() : "")
  if (!isValidEmail(target)) return fail("Indiquez votre adresse email pour recevoir le code.", 400, { field: "signer_email" })

  const code = generateCode()
  const { data: updated } = await admin.from("document_signatures").update({
    code_hash: hashCode(row.id, code),
    code_expires_at: new Date(now.getTime() + CODE_TTL_MINUTES * 60_000).toISOString(),
    code_attempts: 0,
    code_sent_count: row.code_sent_count + 1,
    code_last_sent_at: now.toISOString(),
    code_sent_to: target,
  }).eq("id", row.id).eq("status", "pending").eq("code_sent_count", row.code_sent_count).select("id")
  if (!updated || updated.length === 0) return fail("Un code vient d'être envoyé. Consultez votre boîte de réception.", 429)

  const companyName = ctx.company?.name?.trim() || "L'entreprise"
  const { subject, html } = buildSignatureCodeEmail({
    docType: row.document_type, docNumber: row.document_number, companyName,
    accentColor: ctx.company?.accent_color ?? "#2563EB", code, ttlMinutes: CODE_TTL_MINUTES,
  })
  const sent = await trySend(admin, row, "code", () => sendEmail({ to: target, subject, html, fromName: companyName }))
  if (!sent) return fail("Le code n'a pas pu être envoyé. Réessayez dans une minute.", 502)
  await recordEvent(admin, row, "code_sent", meta, { to: maskEmail(target) })
  return json({ ok: true, sentTo: maskEmail(target) })
}

async function onVerifyCode(admin: Admin, row: SignatureRow, body: Record<string, unknown>, meta: { ip: string | null; userAgent: string | null }, now: Date) {
  const ctx = await signableContext(admin, row, now)
  if (!ctx.ok) return ctx.res
  if (row.code_verified_at) return json({ ok: true })

  const check = codeAttemptState(row, now)
  if (check === "none") return fail("Demandez d'abord un code.", 400)
  if (check === "expired") return fail("Ce code a expiré. Demandez-en un nouveau.", 400, { expired: true })
  if (check === "locked") return fail("Trop d'essais avec ce code. Demandez-en un nouveau.", 429, { locked: true })

  const code = typeof body.code === "string" ? body.code.replace(/\s+/g, "") : ""
  if (codeMatches(row.id, code, row.code_hash)) {
    await admin.from("document_signatures").update({ code_verified_at: now.toISOString(), code_hash: null }).eq("id", row.id).eq("status", "pending")
    await recordEvent(admin, row, "code_verified", meta)
    return json({ ok: true })
  }

  // Compteur incrémenté de façon atomique (même valeur lue) : deux essais simultanés ne passent pas l'un sur l'autre
  const { data: counted } = await admin.from("document_signatures")
    .update({ code_attempts: row.code_attempts + 1 })
    .eq("id", row.id).eq("code_attempts", row.code_attempts).select("id")
  await recordEvent(admin, row, "code_failed", meta)
  if (!counted || counted.length === 0) return fail("Code incorrect.", 400, { remaining: 0 })
  const remaining = Math.max(0, CODE_MAX_ATTEMPTS - row.code_attempts - 1)
  return fail(remaining > 0 ? `Code incorrect. Encore ${remaining} essai${remaining > 1 ? "s" : ""}.` : "Code incorrect. Demandez un nouveau code.", 400, { remaining })
}

/* ------------------------------------------------------------------ */
/* Signature                                                           */
/* ------------------------------------------------------------------ */

async function onSign(admin: Admin, row: SignatureRow, body: Record<string, unknown>, meta: { ip: string | null; userAgent: string | null }, now: Date, token: string) {
  const ctx = await signableContext(admin, row, now)
  if (!ctx.ok) return ctx.res
  const { doc, company } = ctx
  // Rétractation en ligne et acompte : seulement une fois la migration 20261010 appliquée
  const extras = signatureExtrasAvailable(row)

  const reducedVat = needsReducedVatCertification(doc.lines)
  const parsed = validateSignPayload(body, { clientKind: row.client_kind, reducedVat })
  if (!parsed.ok) return fail(parsed.error, 400, { field: parsed.field })
  const p = parsed.value

  if (row.code_required && !row.code_verified_at) return fail("Saisissez d'abord le code reçu par email.", 400, { field: "code" })

  let imagePng: Buffer | null = null
  if (p.method === "drawn") {
    imagePng = decodeSignaturePng(p.image)
    if (!imagePng) return fail("Votre signature n'a pas pu être lue. Tracez-la de nouveau ou tapez votre nom.", 400, { field: "signature" })
    try { await (await PDFDocument.create()).embedPng(imagePng) } catch {
      return fail("Votre signature n'a pas pu être lue. Tracez-la de nouveau ou tapez votre nom.", 400, { field: "signature" })
    }
  }

  // 1. Le PDF tel qu'il est accepté, et son empreinte
  const original = await generateDocumentPdf(doc, company)
  const documentSha256 = sha256Hex(original)

  // Acompte figé à la signature, d'après le réglage de l'artisan (aucun sans IBAN)
  const [bank, settings] = extras
    ? await Promise.all([loadBankDetails(admin, row.user_id), getSignatureSettings(admin, row.user_id).catch(() => null)])
    : [null, null]
  const depositPercent = settings?.extras ? settings.settings.deposit_percent : 0
  const depositPlan = extras
    ? planDeposit({
        percent: depositPercent, totalTtc: doc.total_ttc, hasIban: !!transferAccount(bank), clientKind: row.client_kind,
        context: p.context, urgentRepair: !!p.consents.urgent_repair_requested, signedAt: now,
      })
    : null
  const depositColumns = extras ? {
    deposit_amount: depositPlan?.amount ?? null,
    deposit_percent: depositPlan?.percent ?? null,
    deposit_reference: depositPlan ? depositReference(doc.type, doc.number) : null,
    deposit_request_on: depositPlan?.requestOn ?? null,
    deposit_requested_at: depositPlan?.timing === "now" ? now.toISOString() : null,
  } : {}

  // 2. Enregistrement de la signature, une seule fois (garde sur le statut)
  const signedAtIso = now.toISOString()
  const { data: signedRows, error: signErr } = await admin.from("document_signatures").update({
    status: "signed",
    signed_at: signedAtIso,
    signer_name: p.signer_name,
    signer_email: p.signer_email,
    signer_role: p.signer_role,
    signer_company: p.signer_company,
    client_order_number: p.client_order_number,
    signature_method: p.method,
    signature_image: p.method === "drawn" ? p.image : null,
    signature_context: p.context,
    consents: { ...p.consents, ...(reducedVat ? { reduced_vat_text: reducedVatCertificationText(doc.lines) } : {}), ...(p.typed_name ? { typed_name: p.typed_name } : {}) },
    signer_ip: meta.ip,
    signer_user_agent: meta.userAgent,
    document_sha256: documentSha256,
    ...depositColumns,
  }).eq("id", row.id).eq("status", "pending").select("*")
  if (signErr || !signedRows || signedRows.length === 0) return fail("Ce document vient d'être traité. Rechargez la page.", 409)
  const signed = signedRows[0] as SignatureRow

  // 3. Statut du document (liste blanche de lib/utils/document-status.ts)
  const target = signedStatusFor(doc.type)
  if (canTransition(doc.type, doc.status, target)) {
    const table = doc.type === "quote" ? "quotes" : "purchase_orders"
    const update: Record<string, unknown> = { status: target, updated_at: signedAtIso }
    if (doc.type === "purchase_order") update.confirmed_at = signedAtIso
    const { error: docErr } = await admin.from(table).update(update).eq("id", doc.id).eq("user_id", doc.user_id).eq("status", doc.status)
    if (docErr) console.error("[signature] statut du document :", docErr.message)
  }
  await recordEvent(admin, signed, "signed", meta, { method: p.method, context: p.context })
  if (depositPlan?.timing === "now") await recordEvent(admin, signed, "deposit_requested", {}, { amount: depositPlan.amount, at_signature: true })

  // 4. PDF signé avec son dossier de preuve, conservé dans le stockage privé
  const events = await listEvents(admin, signed.id)
  const companyName = company?.name?.trim() || "L'entreprise"
  let signedPdf: Uint8Array | null = null
  try {
    signedPdf = await buildSignedPdf({
      original, docLabel: docLabel(doc.type), docNumber: doc.number, companyName, version: signed.version, totalTtc: doc.total_ttc,
      contentSha256: signed.content_sha256, documentSha256,
      signer: { name: p.signer_name, email: p.signer_email, role: p.signer_role, company: p.signer_company },
      clientOrderNumber: p.client_order_number, clientKind: signed.client_kind, method: p.method, imagePng, typedName: p.typed_name,
      context: p.context, consents: p.consents, reducedVatText: reducedVat ? reducedVatCertificationText(doc.lines) : null,
      signedAt: now, ip: meta.ip, userAgent: meta.userAgent,
      code: signed.code_verified_at ? { verifiedAt: new Date(signed.code_verified_at), sentTo: maskEmail(signed.code_sent_to) } : null,
      events,
    })
    const paths = storagePaths(signed)
    const [okOriginal, okSigned] = await Promise.all([storePdf(admin, paths.original, original), storePdf(admin, paths.signed, signedPdf)])
    await admin.from("document_signatures").update({
      signed_pdf_path: okOriginal && okSigned ? paths.signed : null,
      signed_pdf_sha256: sha256Hex(signedPdf),
    }).eq("id", signed.id)
  } catch (err) {
    console.error("[signature] PDF signé :", err)
  }

  // 5. Emails : exemplaire signé au client, notification à l'artisan
  const accent = company?.accent_color ?? "#2563EB"
  const deadline = signed.client_kind === "consumer" ? withdrawalDeadline(now) : null
  const companyAddress = [company?.address, [company?.zip_code, company?.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null
  const artisanEmail = await ownerEmail(admin, row.user_id, company)
  const deposit = publicDeposit(depositOfRow(signed), bank, parisDay(now))
  // Liens par le jeton : ils rouvrent la page sur n'importe quel appareil (le cookie du lien n'existe que sur celui-ci)
  const confirmation = buildSignatureConfirmationEmail({
    docType: doc.type, docNumber: doc.number, companyName, companyAddress, companyEmail: company?.email ?? artisanEmail,
    accentColor: accent, signerName: p.signer_name, signedAt: now, totalTtc: doc.total_ttc, clientKind: signed.client_kind,
    context: p.context, earlyStartRequested: !!p.consents.early_start_requested, withdrawalDeadline: deadline,
    pageUrl: linkUrl(token),
    withdrawUrl: extras && signed.client_kind === "consumer" ? linkUrl(token, { withdraw: true }) : null,
    urgentRepair: !!p.consents.urgent_repair_requested,
    deposit,
  })
  await trySend(admin, signed, "confirmation", () => sendEmail({
    to: p.signer_email, subject: confirmation.subject, html: confirmation.html, fromName: companyName,
    replyTo: company?.email ?? artisanEmail ?? undefined,
    attachments: signedPdf ? [{ filename: pdfFilename(doc.number, true), content: Buffer.from(signedPdf) }] : [],
  }))
  if (artisanEmail) {
    const notice = buildSignatureNotificationEmail({
      outcome: "signed", docType: doc.type, docNumber: doc.number, clientName: doc.client?.name ?? null,
      signerName: p.signer_name, signerRole: p.signer_role, at: now, totalTtc: doc.total_ttc,
      clientOrderNumber: p.client_order_number, clientKind: signed.client_kind, context: p.context,
      earlyStartRequested: !!p.consents.early_start_requested, withdrawalDeadline: deadline,
      deposit: deposit ? { amount: deposit.amount, reference: deposit.reference, timing: deposit.timing, requestOn: deposit.requestOn } : null,
      depositMissingIban: depositPercent > 0 && !transferAccount(bank),
      docUrl: `${appUrl()}/${doc.type === "quote" ? "quotes" : "purchase-orders"}/${doc.id}`,
    })
    await trySend(admin, signed, "notification", () => sendEmail({ to: artisanEmail, subject: notice.subject, html: notice.html, fromName: "Qonforme" }))
  }

  return json({
    ok: true, signed_at: signedAtIso, withdrawalDeadline: deadline, deposit,
    withdrawal: { available: extras && signed.client_kind === "consumer", open: extras && canWithdraw(signed, now) },
  })
}

/* ------------------------------------------------------------------ */
/* Refus                                                               */
/* ------------------------------------------------------------------ */

async function onRefuse(admin: Admin, row: SignatureRow, body: Record<string, unknown>, meta: { ip: string | null; userAgent: string | null }, now: Date) {
  const ctx = await signableContext(admin, row, now)
  if (!ctx.ok) return ctx.res
  const { doc, company } = ctx

  const parsed = validateRefusePayload(body)
  if (!parsed.ok) return fail(parsed.error, 400, { field: parsed.field })
  const { reason, message, name } = parsed.value

  const nowIso = now.toISOString()
  const { data: refusedRows } = await admin.from("document_signatures").update({
    status: "refused", refused_at: nowIso, refusal_reason: reason, refusal_message: message,
    signer_name: name, signer_ip: meta.ip, signer_user_agent: meta.userAgent,
  }).eq("id", row.id).eq("status", "pending").select("id")
  if (!refusedRows || refusedRows.length === 0) return fail("Ce document vient d'être traité. Rechargez la page.", 409)

  const target = refusedStatusFor(doc.type)
  if (target && canTransition(doc.type, doc.status, target)) {
    await admin.from("quotes").update({ status: target, updated_at: nowIso }).eq("id", doc.id).eq("user_id", doc.user_id).eq("status", doc.status)
  }
  await recordEvent(admin, row, "refused", meta, { reason })

  const artisanEmail = await ownerEmail(admin, row.user_id, company)
  if (artisanEmail) {
    const notice = buildSignatureNotificationEmail({
      outcome: "refused", docType: doc.type, docNumber: doc.number, clientName: doc.client?.name ?? null,
      signerName: name, signerRole: null, at: now, totalTtc: doc.total_ttc, clientKind: row.client_kind, context: null,
      reason, message, docUrl: `${appUrl()}/${doc.type === "quote" ? "quotes" : "purchase-orders"}/${doc.id}`,
    })
    await trySend(admin, row, "notification", () => sendEmail({ to: artisanEmail, subject: notice.subject, html: notice.html, fromName: "Qonforme" }))
  }
  return json({ ok: true })
}

/* ------------------------------------------------------------------ */
/* Rétractation (particulier, 14 jours)                                */
/* ------------------------------------------------------------------ */

async function onWithdraw(admin: Admin, row: SignatureRow, body: Record<string, unknown>, meta: { ip: string | null; userAgent: string | null }, now: Date) {
  if (row.status === "withdrawn") return fail("Votre rétractation est déjà enregistrée.", 409, { state: "withdrawn" })
  if (row.status !== "signed") return fail("Ce document n'est pas signé : il n'y a rien à rétracter.", 409)
  if (row.client_kind !== "consumer") {
    return fail("Le droit de rétractation est réservé aux particuliers. Contactez l'entreprise pour toute question.", 400)
  }
  if (!signatureExtrasAvailable(row)) {
    return fail("La rétractation en ligne n'est pas encore disponible : envoyez le formulaire de rétractation reçu par email à l'entreprise.", 503)
  }
  if (!canWithdraw(row, now)) {
    const deadline = row.signed_at ? withdrawalDeadline(new Date(row.signed_at)) : null
    return fail(`Le délai de rétractation est écoulé${deadline ? ` depuis le ${deadline.split("-").reverse().join("/")}` : ""}. Contactez l'entreprise pour toute question.`, 400)
  }

  const parsed = validateWithdrawPayload(body)
  if (!parsed.ok) return fail(parsed.error, 400, { field: parsed.field })
  const { name, message } = parsed.value

  const nowIso = now.toISOString()
  const { data: rows } = await admin.from("document_signatures").update({
    status: "withdrawn", withdrawn_at: nowIso, withdrawal_name: name, withdrawal_message: message,
    withdrawal_ip: meta.ip, withdrawal_user_agent: meta.userAgent,
  }).eq("id", row.id).eq("status", "signed").select("*")
  if (!rows || rows.length === 0) return fail("Ce document vient d'être traité. Rechargez la page.", 409)
  const withdrawn = rows[0] as SignatureRow
  await recordEvent(admin, withdrawn, "withdrawn", meta)

  // Statut du document : devis « rétracté », bon de commande « annulé »
  const [doc, company] = await Promise.all([
    loadDocument(admin, row.document_type, row.document_id, row.user_id),
    loadCompany(admin, row.user_id),
  ])
  let invoiced = false
  if (doc) {
    const signedStatus = signedStatusFor(doc.type)
    if (doc.status === signedStatus) {
      const table = doc.type === "quote" ? "quotes" : "purchase_orders"
      const { error: docErr } = await admin.from(table)
        .update({ status: withdrawnStatusFor(doc.type), updated_at: nowIso })
        .eq("id", doc.id).eq("user_id", doc.user_id).eq("status", signedStatus)
      if (docErr) console.error("[signature] statut après rétractation :", docErr.message)
    }
    invoiced = !!doc.raw.converted_invoice_id
    if (!invoiced && doc.type === "quote") {
      // Factures d'acompte ou de situation (formule Artisan) rattachées au devis
      const { data: linked, error: linkedErr } = await admin.from("invoices").select("id")
        .eq("user_id", doc.user_id).eq("quote_id", doc.id).neq("status", "draft").limit(1)
      invoiced = !linkedErr && (linked ?? []).length > 0
    }
  }

  const companyName = company?.name?.trim() || "L'entreprise"
  const artisanEmail = await ownerEmail(admin, row.user_id, company)
  const to = row.signer_email
  if (to) {
    const ack = buildWithdrawalAckEmail({
      docType: row.document_type, docNumber: row.document_number, companyName, accentColor: company?.accent_color ?? "#2563EB",
      name, signedAt: new Date(row.signed_at ?? nowIso), withdrawnAt: now, message,
    })
    await trySend(admin, withdrawn, "withdrawal_ack", () => sendEmail({
      to, subject: ack.subject, html: ack.html, fromName: companyName, replyTo: company?.email ?? artisanEmail ?? undefined,
    }))
  }
  if (artisanEmail) {
    const notice = buildSignatureNotificationEmail({
      outcome: "withdrawn", docType: row.document_type, docNumber: row.document_number, clientName: doc?.client?.name ?? null,
      signerName: name, signerRole: null, at: now, totalTtc: doc?.total_ttc ?? 0, clientKind: row.client_kind, context: row.signature_context,
      message, invoiced, docUrl: `${appUrl()}/${row.document_type === "quote" ? "quotes" : "purchase-orders"}/${row.document_id}`,
    })
    await trySend(admin, withdrawn, "notification", () => sendEmail({ to: artisanEmail, subject: notice.subject, html: notice.html, fromName: "Qonforme" }))
  }

  return json({ ok: true, withdrawn_at: nowIso })
}
