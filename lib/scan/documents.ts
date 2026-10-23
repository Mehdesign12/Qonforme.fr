/**
 * Documents scannés (devis reçus, bons de commande, bons de livraison) :
 * types, validation des champs, lecture des lignes de la base et quotas.
 * Module pur, sans réseau : serveur, navigateur et tests.
 *
 * Qonforme ne lit pas le texte de la photo : l'artisan saisit lui-même les
 * champs qu'il veut retrouver (fournisseur, numéro, date, montant), tous
 * facultatifs.
 */
import { isIsoDay } from "@/lib/utils/paris-date"
import { SCAN_QUOTAS, type PlanId } from "@/lib/stripe/plans"

export const SCAN_KINDS = ["quote_received", "purchase_order", "delivery_note", "other"] as const
export type ScanKind = (typeof SCAN_KINDS)[number]

export const SCAN_KIND_LABELS: Record<ScanKind, string> = {
  quote_received: "Devis reçu",
  purchase_order: "Bon de commande",
  delivery_note: "Bon de livraison",
  other: "Autre",
}

export type ScanStatus = "to_classify" | "classified"

/** Pages d'un document : 30 au plus (contrainte de la base). */
export const MAX_PAGES = 30
/** Poids maximal d'une page envoyée : sous la limite de 4,5 Mo des fonctions serveur. */
export const MAX_PAGE_UPLOAD_BYTES = 4 * 1024 * 1024

export interface ScanPage {
  id: string
  position: number
  width: number | null
  height: number | null
  bytes: number
  /** Adresse signée (1 h) ; null si elle n'a pas pu être créée. */
  url: string | null
}

export interface ScanDocument {
  id: string
  kind: ScanKind
  status: ScanStatus
  title: string | null
  supplier: string | null
  doc_number: string | null
  doc_date: string | null
  amount_cents: number | null
  client_id: string | null
  client_name: string | null
  chantier_id: string | null
  page_count: number
  total_bytes: number
  created_at: string
  /** Première page, en miniature (adresse signée). */
  thumb_url: string | null
}

export interface ScanDocumentDetail extends ScanDocument {
  pages: ScanPage[]
}

export interface ScanUsage {
  documents: number
  bytes: number
  plan: "free" | PlanId
  quota: { documents: number; megabytes: number }
}

/** Nom affiché d'un document : fournisseur, sinon titre, sinon son type. */
export function documentName(d: Pick<ScanDocument, "supplier" | "title" | "kind">): string {
  return d.supplier?.trim() || d.title?.trim() || SCAN_KIND_LABELS[d.kind]
}

/* ------------------------------------------------------------------ */
/* Lecture des lignes                                                  */
/* ------------------------------------------------------------------ */

export const DOCUMENT_COLUMNS =
  "id, kind, status, title, supplier, doc_number, doc_date, amount_cents, client_id, chantier_id, created_at, client:clients(name), pages:scanned_document_pages(id, position, storage_path, bytes, width, height)"

type Join = { name?: string | null } | { name?: string | null }[] | null
export interface PageRow { id: string; position: number; storage_path: string; bytes: number; width: number | null; height: number | null }

export function documentFromRow(row: Record<string, unknown>, urls: Map<string, string> = new Map()): ScanDocumentDetail {
  const join = row.client as Join
  const client = Array.isArray(join) ? join[0] ?? null : join
  const pages = ((row.pages as PageRow[] | null) ?? []).slice().sort((a, b) => a.position - b.position)
  const kind = (SCAN_KINDS as readonly string[]).includes(String(row.kind)) ? (row.kind as ScanKind) : "other"
  return {
    id: String(row.id),
    kind,
    status: row.status === "classified" ? "classified" : "to_classify",
    title: (row.title as string | null) ?? null,
    supplier: (row.supplier as string | null) ?? null,
    doc_number: (row.doc_number as string | null) ?? null,
    doc_date: (row.doc_date as string | null) ?? null,
    amount_cents: typeof row.amount_cents === "number" ? row.amount_cents : row.amount_cents ? Number(row.amount_cents) : null,
    client_id: (row.client_id as string | null) ?? null,
    client_name: client?.name ?? null,
    chantier_id: (row.chantier_id as string | null) ?? null,
    page_count: pages.length,
    total_bytes: pages.reduce((s, p) => s + (Number(p.bytes) || 0), 0),
    created_at: String(row.created_at ?? ""),
    thumb_url: pages[0] ? urls.get(pages[0].storage_path) ?? null : null,
    pages: pages.map((p) => ({ id: p.id, position: p.position, width: p.width, height: p.height, bytes: Number(p.bytes) || 0, url: urls.get(p.storage_path) ?? null })),
  }
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** « 1 240,50 », « 1240.5 », « 12 » → centimes ; null si vide ; undefined si invalide. */
export function parseAmountCents(value: unknown): number | null | undefined {
  if (value === undefined || value === null) return null
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0 || value > 10_000_000) return undefined
    return Math.round(value * 100)
  }
  if (typeof value !== "string") return undefined
  const cleaned = value.replace(/[\s  €]/g, "").replace(",", ".")
  if (cleaned === "") return null
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(cleaned)) return undefined
  return Math.round(parseFloat(cleaned) * 100)
}

export interface ScanFields {
  kind?: ScanKind
  status?: ScanStatus
  title?: string | null
  supplier?: string | null
  doc_number?: string | null
  doc_date?: string | null
  amount_cents?: number | null
  client_id?: string | null
  chantier_id?: string | null
}

function text(value: unknown, max: number): string | null | "invalid" {
  if (value === null) return null
  if (typeof value !== "string") return "invalid"
  const t = value.trim()
  if (t.length === 0) return null
  return t.length > max ? "invalid" : t
}

/**
 * Valide les champs reçus (création ou modification). Seuls les champs présents
 * sont lus : une modification ne touche que ce qu'elle envoie. Le montant
 * arrive en euros (`amount`), jamais en centimes.
 */
export function parseScanFields(body: Record<string, unknown>): { ok: true; value: ScanFields } | { ok: false; error: string } {
  const out: ScanFields = {}
  if (body.kind !== undefined) {
    if (typeof body.kind !== "string" || !(SCAN_KINDS as readonly string[]).includes(body.kind)) return { ok: false, error: "Type de document inconnu." }
    out.kind = body.kind as ScanKind
  }
  if (body.status !== undefined) {
    if (body.status !== "to_classify" && body.status !== "classified") return { ok: false, error: "État inconnu." }
    out.status = body.status
  }
  for (const [key, max, label] of [["title", 200, "Le titre"], ["supplier", 200, "Le fournisseur"], ["doc_number", 80, "Le numéro"]] as const) {
    if (body[key] === undefined) continue
    const t = text(body[key], max)
    if (t === "invalid") return { ok: false, error: `${label} est invalide ou trop long (${max} caractères au plus).` }
    out[key] = t
  }
  if (body.doc_date !== undefined) {
    if (body.doc_date === null || body.doc_date === "") out.doc_date = null
    else if (isIsoDay(body.doc_date)) out.doc_date = body.doc_date
    else return { ok: false, error: "Date invalide." }
  }
  if (body.amount !== undefined) {
    const cents = parseAmountCents(body.amount)
    if (cents === undefined) return { ok: false, error: "Montant invalide (par exemple 1 240,50)." }
    out.amount_cents = cents
  }
  for (const key of ["client_id", "chantier_id"] as const) {
    if (body[key] === undefined) continue
    if (body[key] === null || body[key] === "") out[key] = null
    else if (typeof body[key] === "string" && UUID.test(body[key] as string)) out[key] = body[key] as string
    else return { ok: false, error: key === "client_id" ? "Client invalide." : "Chantier invalide." }
  }
  return { ok: true, value: out }
}

/** Centimes → texte saisissable en euros (« 1 240,50 », « 12 »). */
export function formatAmountInput(cents: number): string {
  const euros = cents / 100
  return Number.isInteger(euros)
    ? String(euros)
    : euros.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })
}

/** Nettoie un texte de recherche pour un filtre PostgREST `.or()` : ni virgule, ni parenthèse, ni joker. */
export function searchTerm(raw: string | null): string | null {
  const t = (raw ?? "").replace(/[,()*%\\"':;]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60)
  return t.length >= 2 ? t : null
}

/* ------------------------------------------------------------------ */
/* Quotas                                                              */
/* ------------------------------------------------------------------ */

export const BYTES_PER_MB = 1024 * 1024

export function quotaOf(plan: "free" | PlanId): { documents: number; megabytes: number } {
  return SCAN_QUOTAS[plan]
}

export type QuotaCheck = { ok: true } | { ok: false; code: "SCAN_QUOTA"; message: string }

/**
 * Un ajout tient-il dans l'espace du compte ? `addDocuments` : nouveaux
 * documents ; `addBytes` : poids des pages à enregistrer. Un dépassement bloque
 * seulement l'ajout, jamais la consultation ni la suppression.
 */
export function checkQuota(
  plan: "free" | PlanId,
  usage: { documents: number; bytes: number },
  add: { documents?: number; bytes?: number },
): QuotaCheck {
  const q = quotaOf(plan)
  const upsell = plan === "free"
    ? ` La formule Essentiel en accepte ${SCAN_QUOTAS.starter.documents.toLocaleString("fr-FR")}.`
    : ""
  if (usage.documents + (add.documents ?? 0) > q.documents) {
    return { ok: false, code: "SCAN_QUOTA", message: `Votre espace de scan est plein (${q.documents.toLocaleString("fr-FR")} documents).${upsell} Supprimez des documents pour en ajouter.` }
  }
  if (usage.bytes + (add.bytes ?? 0) > q.megabytes * BYTES_PER_MB) {
    return { ok: false, code: "SCAN_QUOTA", message: `Votre espace de scan est plein (${formatMegabytes(q.megabytes)}).${upsell} Supprimez des documents pour en ajouter.` }
  }
  return { ok: true }
}

export function formatMegabytes(mb: number): string {
  return mb >= 1024 ? `${(mb / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Go` : `${mb.toLocaleString("fr-FR")} Mo`
}

export function formatBytes(bytes: number): string {
  const mb = bytes / BYTES_PER_MB
  if (mb >= 1024) return formatMegabytes(mb)
  if (mb >= 10) return `${Math.round(mb).toLocaleString("fr-FR")} Mo`
  return `${mb.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`
}

/** Part de l'espace utilisée (0 à 1), la plus élevée du nombre de documents et du poids. */
export function usageRatio(u: ScanUsage): number {
  const byDocs = u.quota.documents > 0 ? u.documents / u.quota.documents : 0
  const byBytes = u.quota.megabytes > 0 ? u.bytes / (u.quota.megabytes * BYTES_PER_MB) : 0
  return Math.min(1, Math.max(byDocs, byBytes))
}
