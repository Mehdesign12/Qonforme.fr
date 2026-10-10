/**
 * Accès aux données de la signature en ligne, côté serveur uniquement.
 *
 * Toutes les écritures passent par le client service_role (la table n'a pas
 * de politique d'écriture) ; chaque requête est bornée par `user_id` et par
 * l'identifiant du document, si bien qu'un lien ne donne jamais accès qu'à
 * son propre document.
 *
 * Migration absente (lib/supabase/schema-guard.ts) : les fonctions renvoient
 * `available: false` et l'interface garde l'accord sur papier.
 */
import { selectCompanyWithProfile } from "@/lib/legal/db"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { NextRequest } from "next/server"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import { generateQuotePdf } from "@/lib/pdf/quote"
import { generatePurchaseOrderPdf } from "@/lib/pdf/purchase-order"
import { decryptToken, encryptToken, generateToken, hashToken, sha256Hex, tokenMatches } from "@/lib/signature/crypto"
import type { BankDetails } from "@/lib/signature/deposit"
import { SETTINGS_BASE_COLUMNS, SETTINGS_EXTRA_COLUMNS, settingsFromRow } from "@/lib/signature/settings"
import {
  canCreateLink, clientKindOf, computeLinkState, contentFingerprintSource, linkExpiry, needsVerificationCode,
} from "@/lib/signature/rules"
import {
  DEFAULT_SIGNATURE_SETTINGS, type SignatureDocType, type SignatureEvent, type SignatureEventType, type SignatureMode,
  type SignatureRow, type SignatureSettings,
} from "@/lib/signature/types"

type Admin = SupabaseClient

export class SignatureError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message)
  }
}

/** Adresse publique du site (liens des emails). */
export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://qonforme.fr").replace(/\/+$/, "")
}

/**
 * Lien court envoyé au client : il pose le jeton dans un cookie puis redirige
 * (app/s/[token]/route.ts). `withdraw` ouvre directement le formulaire de
 * rétractation (lien « Changer d'avis » de l'email de confirmation).
 */
export function linkUrl(token: string, opts: { onSite?: boolean; withdraw?: boolean } = {}): string {
  const query = opts.onSite ? "?sur-place=1" : opts.withdraw ? "?retractation=1" : ""
  return `${appUrl()}/s/${token}${query}`
}

/**
 * Colonnes de 20261010_signature_withdrawal_deposit_reminder.sql présentes ?
 * Une ligne lue avec select("*") porte toutes les colonnes de la table : leur
 * absence signale une migration pas encore appliquée (rétractation en ligne,
 * acompte et relance avant expiration restent alors masqués).
 */
export function signatureExtrasAvailable(row: object | null | undefined): boolean {
  return !!row && "withdrawn_at" in row
}

/** Cookie qui porte le jeton d'un lien, propre à ce lien (plusieurs onglets possibles). */
export function linkCookieName(signatureId: string): string {
  return `qsig_${signatureId}`
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v)
}

/** Adresse IP et navigateur du client (Vercel renseigne x-forwarded-for et x-real-ip). */
export function requestMeta(req: NextRequest | Request): { ip: string | null; userAgent: string | null } {
  const h = req.headers
  const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim()
  const ip = (h.get("x-real-ip")?.trim() || fwd || "").slice(0, 64) || null
  const userAgent = (h.get("user-agent") ?? "").slice(0, 400) || null
  return { ip, userAgent }
}

/* ------------------------------------------------------------------ */
/* Réglages                                                            */
/* ------------------------------------------------------------------ */

/**
 * Réglages d'un compte. `extras` : colonnes de la relance avant expiration et
 * de l'acompte présentes (sinon, valeurs par défaut et fonctions masquées).
 */
export async function getSignatureSettings(admin: Admin, userId: string): Promise<{ available: boolean; extras: boolean; settings: SignatureSettings }> {
  const full = await admin
    .from("signature_settings")
    .select(`${SETTINGS_BASE_COLUMNS},${SETTINGS_EXTRA_COLUMNS}`)
    .eq("user_id", userId)
    .maybeSingle()
  if (!full.error) return { available: true, extras: true, settings: settingsFromRow(full.data) }
  if (!isMissingSchemaError(full.error)) throw full.error

  const base = await admin.from("signature_settings").select(SETTINGS_BASE_COLUMNS).eq("user_id", userId).maybeSingle()
  if (base.error) {
    if (isMissingSchemaError(base.error)) return { available: false, extras: false, settings: DEFAULT_SIGNATURE_SETTINGS }
    throw base.error
  }
  // Sans la migration : pas d'acompte, et pas de relance avant expiration (aucune colonne pour la tracer)
  return {
    available: true,
    extras: false,
    settings: { ...settingsFromRow(base.data), expiry_reminder_enabled: false, deposit_percent: 0 },
  }
}

/* ------------------------------------------------------------------ */
/* Documents                                                           */
/* ------------------------------------------------------------------ */

export interface DocClient {
  id: string
  name: string | null
  email: string | null
  address: string | null
  zip_code: string | null
  city: string | null
  siren: string | null
  vat_number: string | null
}

export interface LoadedDoc {
  type: SignatureDocType
  id: string
  user_id: string
  number: string
  status: string
  issue_date: string
  valid_until: string | null
  delivery_date: string | null
  reference: string | null
  lines: { description: string; quantity: number; unit?: string | null; unit_price_ht: number; vat_rate: number; total_ht: number; total_vat?: number | null }[]
  subtotal_ht: number
  total_vat: number
  total_ttc: number
  notes: string | null
  client_id: string | null
  client: DocClient | null
  /** Ligne brute (pour les générateurs PDF existants). */
  raw: Record<string, unknown>
}

const CLIENT_COLUMNS = "client:clients(id,name,email,address,zip_code,city,siren,vat_number)"

export async function loadDocument(admin: Admin, type: SignatureDocType, id: string, userId: string): Promise<LoadedDoc | null> {
  if (!isUuid(id)) return null
  const table = type === "quote" ? "quotes" : "purchase_orders"
  const { data, error } = await admin
    .from(table)
    .select(`*, ${CLIENT_COLUMNS}`)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle()
  if (error || !data) return null
  const raw = data as Record<string, unknown>
  const lines = Array.isArray(raw.lines) ? (raw.lines as LoadedDoc["lines"]) : []
  return {
    type,
    id: String(raw.id),
    user_id: String(raw.user_id),
    number: String(type === "quote" ? raw.quote_number : raw.po_number),
    status: String(raw.status),
    issue_date: String(raw.issue_date ?? ""),
    valid_until: (raw.valid_until as string | null) ?? null,
    delivery_date: (raw.delivery_date as string | null) ?? null,
    reference: (raw.reference as string | null) ?? null,
    lines: lines.map((l) => ({
      description: String(l.description ?? ""),
      quantity: Number(l.quantity) || 0,
      unit: l.unit ?? null,
      unit_price_ht: Number(l.unit_price_ht) || 0,
      vat_rate: Number(l.vat_rate) || 0,
      total_ht: Number(l.total_ht) || 0,
      total_vat: l.total_vat == null ? null : Number(l.total_vat),
    })),
    subtotal_ht: Number(raw.subtotal_ht) || 0,
    total_vat: Number(raw.total_vat) || 0,
    total_ttc: Number(raw.total_ttc) || 0,
    notes: (raw.notes as string | null) ?? null,
    client_id: (raw.client_id as string | null) ?? null,
    client: (raw.client as DocClient | null) ?? null,
    raw,
  }
}

export interface CompanyInfo {
  name: string | null
  siren: string | null
  siret: string | null
  vat_number: string | null
  address: string | null
  zip_code: string | null
  city: string | null
  iban: string | null
  legal_notice: string | null
  accent_color: string | null
  logo_url: string | null
  email: string | null
  /** Profil légal (lib/legal/profile.ts) : mentions du bâtiment ; absent avant sa migration. */
  legal_profile?: unknown
}

export async function loadCompany(admin: Admin, userId: string): Promise<CompanyInfo | null> {
  // Avec le profil légal quand sa colonne existe : le PDF signé porte les mêmes
  // mentions que le PDF envoyé (lib/legal/db.ts relit sans elle sinon)
  const { data } = await selectCompanyWithProfile(
    admin,
    "name,siren,siret,vat_number,address,zip_code,city,iban,legal_notice,accent_color,logo_url,email",
    userId,
  )
  return (data as CompanyInfo | null) ?? null
}

/**
 * Coordonnées bancaires pour l'acompte. BIC et titulaire du compte viennent de
 * 20261003_payment_links.sql : sans elle, l'IBAN seul.
 */
export async function loadBankDetails(admin: Admin, userId: string): Promise<BankDetails | null> {
  const full = await admin.from("companies").select("name,iban,bic,bank_account_holder").eq("user_id", userId).maybeSingle()
  if (!full.error) return (full.data as BankDetails | null) ?? null
  if (!isMissingSchemaError(full.error)) return null
  const { data } = await admin.from("companies").select("name,iban").eq("user_id", userId).maybeSingle()
  return (data as BankDetails | null) ?? null
}

/** Adresse de l'artisan pour les notifications : celle de l'entreprise, sinon celle du compte. */
export async function ownerEmail(admin: Admin, userId: string, company: CompanyInfo | null): Promise<string | null> {
  if (company?.email?.trim()) return company.email.trim()
  try {
    const { data } = await admin.auth.admin.getUserById(userId)
    return data.user?.email ?? null
  } catch {
    return null
  }
}

/** Empreinte SHA-256 du contenu du document (version). */
export function documentFingerprint(doc: LoadedDoc): string {
  return sha256Hex(contentFingerprintSource(doc.type, {
    number: doc.number,
    issue_date: doc.issue_date,
    valid_until: doc.valid_until,
    delivery_date: doc.delivery_date,
    reference: doc.reference,
    client_id: doc.client_id,
    lines: doc.lines,
    subtotal_ht: doc.subtotal_ht,
    total_vat: doc.total_vat,
    total_ttc: doc.total_ttc,
    notes: doc.notes,
  }))
}

/** PDF du document, par les générateurs existants (lib/pdf). */
export async function generateDocumentPdf(doc: LoadedDoc, company: CompanyInfo | null): Promise<Buffer> {
  // Les générateurs attendent des champs facultatifs, pas des null
  const comp = company ? Object.fromEntries(Object.entries(company).map(([k, v]) => [k, v ?? undefined])) : null
  const client = doc.client ? Object.fromEntries(Object.entries(doc.client).map(([k, v]) => [k, v ?? undefined])) : null
  const raw = doc.raw as Record<string, unknown>
  if (doc.type === "quote") {
    return generateQuotePdf({ quote: { ...raw, lines: doc.lines, client } as never, company: comp })
  }
  return generatePurchaseOrderPdf({ po: { ...raw, lines: doc.lines, client } as never, company: comp })
}

/** Passe un brouillon à « envoyé » (lib/utils/document-status.ts : draft → sent). */
export async function markDocumentSent(admin: Admin, doc: LoadedDoc, opts: { byEmail: boolean }): Promise<void> {
  if (doc.status !== "draft" && !opts.byEmail) return
  const table = doc.type === "quote" ? "quotes" : "purchase_orders"
  const now = new Date().toISOString()
  const update: Record<string, unknown> = { updated_at: now }
  if (doc.status === "draft") update.status = "sent"
  if (opts.byEmail || doc.type === "purchase_order") update.sent_at = now
  await admin.from(table).update(update).eq("id", doc.id).eq("user_id", doc.user_id)
  if (doc.status === "draft") doc.status = "sent"
}

/* ------------------------------------------------------------------ */
/* Liens                                                               */
/* ------------------------------------------------------------------ */

/** Dernier lien du document (actif ou non). `available: false` si la table n'existe pas encore. */
export async function latestLink(admin: Admin, userId: string, type: SignatureDocType, documentId: string): Promise<{ available: boolean; row: SignatureRow | null }> {
  const { data, error } = await admin
    .from("document_signatures")
    .select("*")
    .eq("user_id", userId)
    .eq("document_type", type)
    .eq("document_id", documentId)
    .order("created_at", { ascending: false })
    .limit(1)
  if (error) {
    if (isMissingSchemaError(error)) return { available: false, row: null }
    throw error
  }
  return { available: true, row: ((data ?? [])[0] as SignatureRow | undefined) ?? null }
}

export async function listEvents(admin: Admin, signatureId: string): Promise<SignatureEvent[]> {
  const { data } = await admin
    .from("document_signature_events")
    .select("type,created_at,ip,details")
    .eq("signature_id", signatureId)
    .order("created_at", { ascending: true })
    .limit(200)
  return (data as SignatureEvent[] | null) ?? []
}

/** Journal : une erreur d'écriture ne bloque jamais l'action principale. */
export async function recordEvent(
  admin: Admin,
  row: Pick<SignatureRow, "id" | "user_id">,
  type: SignatureEventType,
  meta: { ip?: string | null; userAgent?: string | null } = {},
  details: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await admin.from("document_signature_events").insert({
    signature_id: row.id,
    user_id: row.user_id,
    type,
    ip: meta.ip ?? null,
    user_agent: meta.userAgent ?? null,
    details,
  })
  if (error) console.error("[signature] journal :", error.message)
}

/** Remplace les liens actifs d'un document (nouvelle version ou nouveau lien). */
async function supersedePending(admin: Admin, userId: string, type: SignatureDocType, documentId: string): Promise<SignatureRow[]> {
  const { data } = await admin
    .from("document_signatures")
    .update({ status: "superseded", superseded_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("document_type", type)
    .eq("document_id", documentId)
    .eq("status", "pending")
    .select("*")
  return (data as SignatureRow[] | null) ?? []
}

/** Crée un lien neuf (les liens actifs du document sont remplacés). */
export async function createLink(admin: Admin, params: {
  doc: LoadedDoc
  mode: SignatureMode
  settings: SignatureSettings
  now?: Date
}): Promise<{ row: SignatureRow; token: string }> {
  const { doc, mode, settings } = params
  const now = params.now ?? new Date()
  if (!canCreateLink(doc.type, doc.status, mode)) {
    throw new SignatureError("not_signable", doc.type === "quote"
      ? "Ce devis n'attend plus de signature (déjà accepté ou refusé)."
      : "Ce bon de commande n'attend plus de confirmation.", 409)
  }
  const expires = linkExpiry({ docType: doc.type, mode, validUntil: doc.valid_until, linkValidityDays: settings.link_validity_days, now })
  if (!expires) {
    throw new SignatureError("expired", "Ce devis a expiré : dupliquez-le pour proposer une version à jour, puis envoyez-la pour signature.", 409)
  }

  const previous = await supersedePending(admin, doc.user_id, doc.type, doc.id)
  const { data: last } = await admin
    .from("document_signatures")
    .select("version")
    .eq("user_id", doc.user_id)
    .eq("document_type", doc.type)
    .eq("document_id", doc.id)
    .order("version", { ascending: false })
    .limit(1)
  const version = (((last ?? [])[0] as { version?: number } | undefined)?.version ?? 0) + 1

  const token = generateToken()
  let ciphertext: string | null = null
  try { ciphertext = encryptToken(token) } catch { ciphertext = null }

  const { data, error } = await admin
    .from("document_signatures")
    .insert({
      user_id: doc.user_id,
      document_type: doc.type,
      document_id: doc.id,
      document_number: doc.number,
      version,
      mode,
      content_sha256: documentFingerprint(doc),
      token_hash: hashToken(token),
      token_ciphertext: ciphertext,
      status: "pending",
      client_kind: clientKindOf(doc.client),
      expires_at: expires.toISOString(),
      code_required: mode === "sign" && needsVerificationCode(settings, doc.total_ttc),
    })
    .select("*")
    .single()
  if (error || !data) {
    if (isMissingSchemaError(error)) throw new SignatureError("unavailable", "La signature en ligne n'est pas encore activée.", 503)
    throw new SignatureError("create_failed", "Le lien n'a pas pu être créé. Réessayez dans un instant.", 500)
  }
  const row = data as SignatureRow

  if (previous.length > 0) {
    await admin.from("document_signatures").update({ superseded_by: row.id }).in("id", previous.map((p) => p.id))
    for (const p of previous) await recordEvent(admin, p, "superseded", {}, { by_version: version })
  }
  await recordEvent(admin, row, "created", {}, { mode, version })
  return { row, token }
}

/**
 * Lien à partager : le lien actif s'il convient encore (même contenu, mode au
 * moins aussi large, non expiré, jeton relisible), sinon un nouveau.
 */
export async function ensureLink(admin: Admin, params: {
  doc: LoadedDoc
  mode: SignatureMode
  settings: SignatureSettings
  now?: Date
}): Promise<{ row: SignatureRow; token: string; created: boolean }> {
  const now = params.now ?? new Date()
  const { row } = await latestLink(admin, params.doc.user_id, params.doc.type, params.doc.id)
  if (row && row.status === "pending") {
    const state = computeLinkState(row, now)
    const sameContent = row.content_sha256 === documentFingerprint(params.doc)
    const modeOk = row.mode === params.mode || row.mode === "sign"
    const token = decryptToken(row.token_ciphertext)
    if (state !== "expired" && sameContent && modeOk && token && tokenMatches(token, row.token_hash)) {
      return { row, token, created: false }
    }
  }
  const created = await createLink(admin, { ...params, now })
  return { ...created, created: true }
}

/** Lien du client, retrouvé par son identifiant et vérifié par son jeton (cookie). */
export async function loadLinkForToken(admin: Admin, signatureId: string, token: string | null | undefined): Promise<SignatureRow | null> {
  if (!isUuid(signatureId) || !token) return null
  const { data, error } = await admin.from("document_signatures").select("*").eq("id", signatureId).maybeSingle()
  if (error || !data) return null
  const row = data as SignatureRow
  return tokenMatches(token, row.token_hash) ? row : null
}

/** Identifiant du lien d'un jeton (entrée /s/<jeton>). */
export async function findLinkIdByToken(admin: Admin, token: string): Promise<string | null> {
  const { data, error } = await admin.from("document_signatures").select("id,token_hash").eq("token_hash", hashToken(token)).maybeSingle()
  if (error || !data) return null
  return tokenMatches(token, (data as { token_hash: string }).token_hash) ? String((data as { id: string }).id) : null
}

/* ------------------------------------------------------------------ */
/* PDF signés (stockage privé)                                         */
/* ------------------------------------------------------------------ */

const BUCKET = "signed-documents"

export async function storePdf(admin: Admin, path: string, bytes: Uint8Array): Promise<boolean> {
  const { error } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: "application/pdf", upsert: false })
  if (error) console.error("[signature] stockage du PDF :", error.message)
  return !error
}

export async function readPdf(admin: Admin, path: string | null | undefined): Promise<Uint8Array | null> {
  if (!path) return null
  const { data, error } = await admin.storage.from(BUCKET).download(path)
  if (error || !data) return null
  return new Uint8Array(await data.arrayBuffer())
}

export function storagePaths(row: Pick<SignatureRow, "user_id" | "id">): { original: string; signed: string } {
  return { original: `${row.user_id}/${row.id}/original.pdf`, signed: `${row.user_id}/${row.id}/signe.pdf` }
}

/** Nom de fichier sûr pour l'en-tête Content-Disposition. */
export function pdfFilename(number: string, signed: boolean): string {
  const safe = number.replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 60) || "document"
  return `${safe}${signed ? "-signe" : ""}.pdf`
}
