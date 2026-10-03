/**
 * Accès du comptable : règles pures (sans réseau), partagées par le serveur,
 * les pages, la démo et les tests.
 *
 * - Statut d'un accès (invitation en attente, expirée, accès actif, révoqué).
 * - Ce que voit le comptable : les factures émises, jamais un brouillon
 *   (ni une facture annulée avant envoi, comme le FEC : lib/export/fec.ts).
 * - Statut de paiement, périodes, ventilation de la TVA par taux.
 */
import { addDays, isIsoDay, daysBetween } from "@/lib/utils/paris-date"
import { VAT_EXEMPTIONS, parseVatTreatment } from "@/lib/facturx/vat"
import type {
  AccessRow, AccessStatus, AccessView, DossierCreditNote, DossierInvoice, DossierTotals, PaymentState, Period, VatRow,
} from "@/lib/accountant/types"

/* ------------------------------------------------------------------ */
/* Réglages                                                            */
/* ------------------------------------------------------------------ */

/**
 * Réservé aux comptes qui ont une formule ? Décision du fondateur en attente :
 * `false`, l'accès comptable est ouvert à tous les comptes, gratuits compris.
 * À `true`, l'invitation passe par requireIssuingAccess (402 sans formule).
 */
export const ACCOUNTANT_ACCESS_REQUIRES_PLAN = false

/** Durée de validité d'un lien d'invitation. */
export const INVITE_TTL_DAYS = 7
/** Invitations en attente et accès actifs, au plus, par entreprise. */
export const MAX_LIVE_ACCESSES = 5
/** Délai minimal entre deux envois de la même invitation (anti-abus). */
export const RESEND_COOLDOWN_MS = 60_000
/** Invitations créées au plus par entreprise sur 24 heures (anti-abus). */
export const MAX_INVITES_PER_DAY = 20
/** Une consultation est journalisée au plus toutes les 30 minutes par accès (rechargements, changements de période). */
export const VIEW_LOG_INTERVAL_MS = 30 * 60_000
/**
 * Durée de conservation du journal : un an, dans la fourchette de six mois à
 * un an recommandée par la CNIL pour les journaux d'accès (délibération
 * n° 2021-122 du 14 octobre 2021, recommandation relative aux mesures de
 * journalisation : https://www.cnil.fr/fr/la-cnil-publie-une-recommandation-relative-aux-mesures-de-journalisation).
 */
export const EVENT_RETENTION_DAYS = 365
/** Documents au plus dans une archive de PDF (temps de génération d'une requête). */
export const ZIP_MAX_DOCUMENTS = 100
/** Lignes affichées au plus par liste (les exports contiennent tout). */
export const LIST_MAX_ROWS = 500
/** Période la plus longue acceptée (un premier exercice peut durer jusqu'à 24 mois). */
export const MAX_PERIOD_DAYS = 1100

export const round2 = (n: number) => Math.round(n * 100) / 100

const num = (v: unknown): number => {
  const n = typeof v === "string" ? parseFloat(v) : Number(v)
  return Number.isFinite(n) ? n : 0
}

/* ------------------------------------------------------------------ */
/* Accès                                                               */
/* ------------------------------------------------------------------ */

type StatusFields = Pick<AccessRow, "revoked_at" | "accepted_at" | "accountant_id" | "expires_at">

/**
 * Statut d'un accès. Un accès accepté dont le compte du comptable a été
 * supprimé (accountant_id remis à NULL) est terminé : « revoked ».
 */
export function accessStatus(row: StatusFields, now: Date = new Date()): AccessStatus {
  if (row.revoked_at) return "revoked"
  if (row.accepted_at) return row.accountant_id ? "active" : "revoked"
  return new Date(row.expires_at).getTime() <= now.getTime() ? "expired" : "pending"
}

/** Vue artisan d'un accès (null pour un accès révoqué : il ne s'affiche plus). */
export function toAccessView(row: AccessRow, now: Date = new Date()): AccessView | null {
  const status = accessStatus(row, now)
  if (status === "revoked") return null
  return {
    id: row.id,
    email: row.email,
    label: row.label,
    status,
    invitedAt: row.invited_at,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    lastSeenAt: row.last_seen_at,
  }
}

/** Date d'expiration d'une invitation envoyée à `now`. */
export function inviteExpiry(now: Date = new Date()): string {
  return new Date(now.getTime() + INVITE_TTL_DAYS * 86_400_000).toISOString()
}

const EMAIL_SHAPE = /^[^\s@<>()",;:\\[\]]+@[^\s@<>()",;:\\[\]]+\.[^\s@<>()",;:\\[\]]{2,}$/

/** Adresse email normalisée (minuscules, sans espaces), ou null si invalide. */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const v = raw.trim().toLowerCase()
  if (v.length < 6 || v.length > 254 || !EMAIL_SHAPE.test(v)) return null
  return v
}

/** Nom ou cabinet saisi par l'artisan : une ligne, 80 caractères au plus. */
export function cleanLabel(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const v = raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim()
  return v ? v.slice(0, 80) : null
}

/** « c•••@cabinet.fr » : l'adresse invitée, sans la livrer entière à qui tiendrait le lien. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@")
  if (at < 1) return "•••"
  return `${email[0]}•••${email.slice(at)}`
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Vrai pour un identifiant UUID (contrôle avant toute requête en base). */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value)
}

/* ------------------------------------------------------------------ */
/* Documents visibles par le comptable                                 */
/* ------------------------------------------------------------------ */

/**
 * Statuts jamais montrés au comptable : le brouillon (pas une facture) et la
 * facture annulée avant envoi. Mêmes exclusions que le FEC (lib/export/fec.ts).
 */
export const HIDDEN_INVOICE_STATUSES: readonly string[] = ["draft", "cancelled"]

/** Facture émise : statut d'une facture envoyée et numéro attribué (il l'est à l'émission). */
export function isIssuedInvoice(inv: { status?: string | null; invoice_number?: string | null }): boolean {
  return (
    typeof inv.status === "string" &&
    !HIDDEN_INVOICE_STATUSES.includes(inv.status) &&
    typeof inv.invoice_number === "string" &&
    inv.invoice_number.trim() !== ""
  )
}

/** Émises et non réglées (même liste que les relances et la liste des factures). */
const OPEN_STATUSES = ["sent", "pending", "received", "accepted", "overdue"]

/**
 * Statut de paiement d'une facture émise. « En retard » : statut posé, ou
 * échéance dépassée sans règlement (date du jour à Paris).
 */
export function paymentState(status: string, dueDate: string | null | undefined, today: string): PaymentState {
  if (status === "paid") return "paid"
  if (status === "credited") return "credited"
  if (OPEN_STATUSES.includes(status)) {
    return status === "overdue" || (!!dueDate && dueDate < today) ? "late" : "open"
  }
  return "other"
}

export const PAYMENT_LABELS: Record<PaymentState, string> = {
  paid: "Payée",
  open: "À encaisser",
  late: "En retard",
  credited: "Avoir émis",
  other: "Émise",
}

/* ------------------------------------------------------------------ */
/* Périodes                                                            */
/* ------------------------------------------------------------------ */

/** Période valide « du … au … » (dates AAAA-MM-JJ), ou null. */
export function parsePeriod(from: unknown, to: unknown): Period | null {
  if (!isIsoDay(from) || !isIsoDay(to)) return null
  if (from > to) return null
  if (daysBetween(from, to) > MAX_PERIOD_DAYS) return null
  return { from, to }
}

const pad = (n: number) => String(n).padStart(2, "0")

/** Dernier jour d'un mois (1 à 12). */
function lastDay(y: number, m: number): string {
  return addDays(`${m === 12 ? y + 1 : y}-${pad(m === 12 ? 1 : m + 1)}-01`, -1)
}

function monthRange(y: number, m: number): Period {
  return { from: `${y}-${pad(m)}-01`, to: lastDay(y, m) }
}

function quarterRange(y: number, q: number): Period {
  const start = (q - 1) * 3 + 1
  return { from: `${y}-${pad(start)}-01`, to: lastDay(y, start + 2) }
}

/** Période par défaut : l'année civile en cours. */
export function defaultPeriod(today: string): Period {
  const y = Number(today.slice(0, 4))
  return { from: `${y}-01-01`, to: `${y}-12-31` }
}

export interface PeriodPreset {
  key: string
  label: string
  period: Period
}

/** Raccourcis de période (mois, trimestre, année, en cours et précédents). */
export function periodPresets(today: string): PeriodPreset[] {
  const y = Number(today.slice(0, 4))
  const m = Number(today.slice(5, 7))
  const q = Math.floor((m - 1) / 3) + 1
  const prevMonth = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 }
  const prevQuarter = q === 1 ? { y: y - 1, q: 4 } : { y, q: q - 1 }
  return [
    { key: "mois", label: "Ce mois", period: monthRange(y, m) },
    { key: "mois-precedent", label: "Mois précédent", period: monthRange(prevMonth.y, prevMonth.m) },
    { key: "trimestre", label: "Ce trimestre", period: quarterRange(y, q) },
    { key: "trimestre-precedent", label: "Trimestre précédent", period: quarterRange(prevQuarter.y, prevQuarter.q) },
    { key: "annee", label: `Année ${y}`, period: { from: `${y}-01-01`, to: `${y}-12-31` } },
    { key: "annee-precedente", label: `Année ${y - 1}`, period: { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` } },
  ]
}

/* ------------------------------------------------------------------ */
/* TVA                                                                 */
/* ------------------------------------------------------------------ */

export interface VatLine {
  vat_rate?: number | string | null
  total_ht?: number | string | null
  total_vat?: number | string | null
  vat_treatment?: string | null
}

/** « 5,5 », « 20 ». */
export function formatRate(rate: number): string {
  return String(round2(rate)).replace(".", ",")
}

/** Motif d'absence de TVA d'une ligne à 0 % (ligne, sinon document), ou null. */
function zeroRateTreatment(line: VatLine, docTreatment?: string | null): string | null {
  const t = parseVatTreatment(line.vat_treatment) ?? parseVatTreatment(docTreatment)
  return t && t !== "standard" ? t : null
}

/** Libellé d'un groupe de TVA. */
export function vatGroupLabel(rate: number, treatment: string | null): string {
  if (rate > 0) return `TVA ${formatRate(rate)} %`
  if (treatment && treatment in VAT_EXEMPTIONS) {
    return VAT_EXEMPTIONS[treatment as keyof typeof VAT_EXEMPTIONS].reason
  }
  return "Sans TVA (0 %)"
}

/**
 * Lignes d'un document regroupées par taux de TVA (et, à 0 %, par motif :
 * franchise, autoliquidation…). Montants arrondis au centime, signe conservé.
 */
export function vatGroups(lines: VatLine[] | null | undefined, docTreatment?: string | null): VatRow[] {
  const groups = new Map<string, VatRow>()
  for (const line of lines ?? []) {
    const rate = round2(num(line.vat_rate))
    const treatment = rate === 0 ? zeroRateTreatment(line, docTreatment) : null
    const key = rate > 0 ? formatRate(rate) : `0:${treatment ?? "aucun"}`
    const g = groups.get(key) ?? { key, rate, treatment, label: vatGroupLabel(rate, treatment), base: 0, vat: 0 }
    g.base += num(line.total_ht)
    g.vat += num(line.total_vat)
    groups.set(key, g)
  }
  return Array.from(groups.values())
    .map((g) => ({ ...g, base: round2(g.base), vat: round2(g.vat) }))
    .sort((a, b) => b.rate - a.rate || a.key.localeCompare(b.key))
}

/** Somme de ventilations (factures, puis avoirs avec `sign = -1`). */
export function addVat(into: Map<string, VatRow>, rows: VatRow[], sign: 1 | -1 = 1): Map<string, VatRow> {
  for (const r of rows) {
    const g = into.get(r.key) ?? { ...r, base: 0, vat: 0 }
    g.base = round2(g.base + sign * r.base)
    g.vat = round2(g.vat + sign * r.vat)
    into.set(r.key, g)
  }
  return into
}

/** Ventilation triée (taux décroissants). */
export function sortedVat(map: Map<string, VatRow>): VatRow[] {
  return Array.from(map.values()).sort((a, b) => b.rate - a.rate || a.key.localeCompare(b.key))
}

/* ------------------------------------------------------------------ */
/* Totaux d'une période                                                */
/* ------------------------------------------------------------------ */

export function computeTotals(invoices: DossierInvoice[], credits: DossierCreditNote[]): DossierTotals {
  const sum = <T>(list: T[], pick: (x: T) => number) => round2(list.reduce((s, x) => s + pick(x), 0))
  const open = invoices.filter((i) => i.payment === "open" || i.payment === "late")
  return {
    invoiceCount: invoices.length,
    invoicedHt: sum(invoices, (i) => i.totalHt),
    invoicedVat: sum(invoices, (i) => i.totalVat),
    invoicedTtc: sum(invoices, (i) => i.totalTtc),
    creditCount: credits.length,
    creditedHt: sum(credits, (c) => c.totalHt),
    creditedVat: sum(credits, (c) => c.totalVat),
    creditedTtc: sum(credits, (c) => c.totalTtc),
    paidTtc: sum(invoices.filter((i) => i.payment === "paid"), (i) => i.totalTtc),
    openTtc: sum(open, (i) => i.totalTtc),
    lateTtc: sum(invoices.filter((i) => i.payment === "late"), (i) => i.totalTtc),
  }
}
