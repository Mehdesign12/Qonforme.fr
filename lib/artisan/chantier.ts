/**
 * Chantiers (formule Artisan) : le fil conducteur des documents
 * (DECISIONS-STRATEGIQUES.md § 11, « La cascade »). Un chantier regroupe ses
 * devis, factures d'acompte, situations, factures, avoirs et bons de commande,
 * et suit sa retenue de garantie.
 *
 * Fonctions pures : types, libellés, validation et synthèse des montants,
 * partagées par l'API, l'application et la démo.
 *
 * Les montants viennent uniquement des documents existants : un devis accepté
 * (signé), des factures émises, des avoirs, le statut « payée ». Aucun
 * paiement partiel n'est inventé : une facture compte comme encaissée quand
 * elle est marquée payée, retenue de garantie déduite tant qu'elle n'est pas
 * libérée.
 */
import { toCents, fromCents } from "./money"
import { parseInvoiceKind, type InvoiceKind } from "./billing"
import { parseRetentionMode, parseRetentionRate, retentionStatus, type RetentionMode, type RetentionStatus } from "./retention"

export type ChantierStatus = "preparation" | "in_progress" | "received" | "closed"

export const CHANTIER_STATUSES: readonly ChantierStatus[] = ["preparation", "in_progress", "received", "closed"]

export const CHANTIER_STATUS_LABELS: Record<ChantierStatus, string> = {
  preparation: "En préparation",
  in_progress: "En cours",
  received: "Réceptionné",
  closed: "Clôturé",
}

export interface Chantier {
  id: string
  client_id: string | null
  name: string
  address: string | null
  zip_code: string | null
  city: string | null
  start_date: string | null
  end_date: string | null
  status: ChantierStatus
  /** Date de réception des travaux (point de départ de l'année de garantie). */
  reception_date: string | null
  retention_mode: RetentionMode
  /** Taux de la retenue en % (5 au plus). */
  retention_rate: number
  /** Retenue libérée et encaissée le… */
  retention_released_at: string | null
  /** Chantier en sous-traitance : autoliquidation proposée par défaut. */
  subcontracting: boolean
  notes: string | null
  created_at?: string | null
  client?: { id: string; name: string; email?: string | null; siren?: string | null; vat_number?: string | null; city?: string | null } | null
}

export function parseChantierStatus(value: unknown): ChantierStatus {
  return typeof value === "string" && (CHANTIER_STATUSES as readonly string[]).includes(value) ? (value as ChantierStatus) : "preparation"
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")
const dateOrNull = (v: unknown) => (typeof v === "string" && DATE.test(v.trim()) ? v.trim() : null)

export interface ChantierInput {
  client_id: string | null
  name: string
  address: string | null
  zip_code: string | null
  city: string | null
  start_date: string | null
  end_date: string | null
  status: ChantierStatus
  reception_date: string | null
  retention_mode: RetentionMode
  retention_rate: number
  subcontracting: boolean
  notes: string | null
}

/**
 * Valide un chantier venu d'un formulaire. `partial` : seuls les champs
 * présents sont lus (modification). Renvoie les champs à écrire, ou une erreur.
 */
export function parseChantierInput(body: Record<string, unknown>, partial = false): { ok: true; value: Partial<ChantierInput> } | { ok: false; error: string } {
  const out: Partial<ChantierInput> = {}
  const has = (k: string) => !partial || body[k] !== undefined

  if (has("name")) {
    const name = str(body.name, 160)
    if (!name) return { ok: false, error: "Donnez un nom au chantier." }
    out.name = name
  }
  if (has("client_id")) {
    const c = typeof body.client_id === "string" && body.client_id.trim() ? body.client_id.trim() : null
    out.client_id = c
  }
  for (const k of ["address", "city", "notes"] as const) {
    if (has(k)) out[k] = str(body[k], k === "notes" ? 2000 : 200) || null
  }
  if (has("zip_code")) out.zip_code = str(body.zip_code, 10) || null
  for (const k of ["start_date", "end_date", "reception_date"] as const) {
    if (has(k)) {
      const raw = body[k]
      if (raw !== null && raw !== "" && raw !== undefined && !dateOrNull(raw)) return { ok: false, error: "Date invalide." }
      out[k] = dateOrNull(raw)
    }
  }
  if (out.start_date && out.end_date && out.end_date < out.start_date) {
    return { ok: false, error: "La fin prévue ne peut pas précéder le début du chantier." }
  }
  if (has("status")) {
    if (body.status !== undefined && !(CHANTIER_STATUSES as readonly unknown[]).includes(body.status)) return { ok: false, error: "Statut de chantier inconnu." }
    out.status = parseChantierStatus(body.status)
  }
  if (has("retention_mode")) out.retention_mode = parseRetentionMode(body.retention_mode)
  if (has("retention_rate")) {
    const r = parseRetentionRate(body.retention_rate ?? 0)
    if (r === null) return { ok: false, error: "Le taux de retenue de garantie est de 5 % au plus (loi n° 71-584 du 16 juillet 1971)." }
    out.retention_rate = r
  }
  if (has("subcontracting")) out.subcontracting = body.subcontracting === true
  return { ok: true, value: out }
}

/** Ligne de la table → chantier (valeurs inconnues ramenées aux défauts). */
export function chantierFromRow(row: Record<string, unknown>): Chantier {
  const client = row.client && typeof row.client === "object" ? (row.client as Chantier["client"]) : null
  return {
    id: String(row.id),
    client_id: typeof row.client_id === "string" ? row.client_id : null,
    name: String(row.name ?? ""),
    address: (row.address as string | null) ?? null,
    zip_code: (row.zip_code as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    start_date: (row.start_date as string | null) ?? null,
    end_date: (row.end_date as string | null) ?? null,
    status: parseChantierStatus(row.status),
    reception_date: (row.reception_date as string | null) ?? null,
    retention_mode: parseRetentionMode(row.retention_mode),
    retention_rate: parseRetentionRate(row.retention_rate) ?? 0,
    retention_released_at: (row.retention_released_at as string | null) ?? null,
    subcontracting: row.subcontracting === true,
    notes: (row.notes as string | null) ?? null,
    created_at: (row.created_at as string | null) ?? null,
    client,
  }
}

/* ------------------------------------------------------------------ */
/* Documents d'un chantier et synthèse                                 */
/* ------------------------------------------------------------------ */

export type ChantierDocType = "quote" | "invoice" | "credit_note" | "purchase_order"

export interface ChantierDoc {
  type: ChantierDocType
  id: string
  number: string | null
  status: string
  issue_date: string | null
  total_ht: number
  total_ttc: number
  /** Facture : nature (acompte, situation, solde). */
  kind?: InvoiceKind
  /** Facture : libellé de nature (« Situation n° 2 »). */
  kind_label?: string | null
  retention_amount?: number
  /** Avoir : facture d'origine. */
  original_invoice_id?: string | null
  /** Facture : devis d'origine (acomptes, situations, solde). */
  quote_id?: string | null
  paid_at?: string | null
}

const ISSUED_EXCLUDED = new Set(["draft", "cancelled"])
const OPEN_INVOICE = new Set(["sent", "pending", "received", "accepted", "overdue"])

export interface ChantierSummary {
  /** Devis acceptés (signés), TTC, en centimes. */
  signed: number
  signedHt: number
  /** Factures émises, avoirs déduits. */
  invoiced: number
  /** Factures marquées payées, avoirs et retenue non libérée déduits. */
  collected: number
  /** Factures émises non réglées, retenue déduite. */
  outstanding: number
  /** Devis signés pas encore facturés. */
  toInvoice: number
  /** Retenue de garantie sur les factures émises (non annulées par un avoir). */
  retentionHeld: number
  retention: RetentionStatus
  /** Facturé / signé, en % (0 sans devis signé). */
  progress: number
  counts: { quotes: number; invoices: number; drafts: number; creditNotes: number; purchaseOrders: number }
}

/**
 * Synthèse d'un chantier, au centime. Un avoir n'est compté qu'une fois, même
 * s'il est à la fois rattaché au chantier et lié à une facture du chantier.
 */
export function chantierSummary(
  docs: ChantierDoc[],
  chantier: Pick<Chantier, "reception_date" | "retention_released_at">,
  today: string,
): ChantierSummary {
  const quotes = docs.filter((d) => d.type === "quote")
  const invoices = docs.filter((d) => d.type === "invoice")
  const issued = invoices.filter((d) => !ISSUED_EXCLUDED.has(d.status))
  const credits = new Map<string, ChantierDoc>()
  for (const d of docs) if (d.type === "credit_note") credits.set(d.id, d)
  const creditList = Array.from(credits.values())
  const creditedOn = (invoiceId: string) => creditList
    .filter((c) => c.original_invoice_id === invoiceId)
    .reduce((s, c) => s + toCents(c.total_ttc), 0)

  const signed = quotes.filter((q) => q.status === "accepted").reduce((s, q) => s + toCents(q.total_ttc), 0)
  const signedHt = quotes.filter((q) => q.status === "accepted").reduce((s, q) => s + toCents(q.total_ht), 0)
  // Tous les avoirs du chantier : rattachés, ou émis sur une de ses factures
  const creditTotal = creditList.reduce((s, c) => s + toCents(c.total_ttc), 0)
  const invoiced = Math.max(0, issued.reduce((s, d) => s + toCents(d.total_ttc), 0) - creditTotal)

  const released = Boolean(chantier.retention_released_at)
  const heldOf = (d: ChantierDoc) => (d.status === "credited" ? 0 : Math.max(0, toCents(d.retention_amount ?? 0)))
  const retentionHeld = issued.reduce((s, d) => s + heldOf(d), 0)

  let collected = 0
  let outstanding = 0
  for (const d of issued) {
    const net = Math.max(0, toCents(d.total_ttc) - creditedOn(d.id))
    const held = Math.min(net, heldOf(d))
    if (d.status === "paid") collected += released ? net : net - held
    else if (OPEN_INVOICE.has(d.status)) outstanding += net - held
  }

  return {
    signed,
    signedHt,
    invoiced,
    collected,
    outstanding,
    toInvoice: Math.max(0, signed - invoiced),
    retentionHeld,
    retention: retentionStatus(retentionHeld, chantier.reception_date, chantier.retention_released_at, today),
    progress: signed > 0 ? Math.min(100, Math.round((invoiced / signed) * 1000) / 10) : 0,
    counts: {
      quotes: quotes.length,
      invoices: issued.length,
      drafts: invoices.filter((d) => d.status === "draft").length,
      creditNotes: creditList.length,
      purchaseOrders: docs.filter((d) => d.type === "purchase_order").length,
    },
  }
}

/** Montants de la synthèse en euros (pour l'affichage). */
export function summaryInEuros(s: ChantierSummary) {
  return {
    signed: fromCents(s.signed),
    invoiced: fromCents(s.invoiced),
    collected: fromCents(s.collected),
    outstanding: fromCents(s.outstanding),
    toInvoice: fromCents(s.toInvoice),
    retentionHeld: fromCents(s.retentionHeld),
  }
}

/** Ligne de facture de la base → document de chantier. */
export function invoiceDoc(row: Record<string, unknown>, kindLabel: string | null = null): ChantierDoc {
  return {
    type: "invoice",
    id: String(row.id),
    number: (row.invoice_number as string | null) ?? null,
    status: String(row.status ?? "draft"),
    issue_date: (row.issue_date as string | null) ?? null,
    total_ht: Number(row.subtotal_ht ?? 0) || 0,
    total_ttc: Number(row.total_ttc ?? 0) || 0,
    kind: parseInvoiceKind(row.invoice_kind),
    kind_label: kindLabel,
    retention_amount: Number(row.retention_amount ?? 0) || 0,
    quote_id: (row.quote_id as string | null) ?? null,
    paid_at: (row.paid_at as string | null) ?? null,
  }
}
