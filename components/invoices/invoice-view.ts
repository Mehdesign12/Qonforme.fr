/**
 * Données et règles d'affichage communes à la liste et à la fiche facture,
 * réelles et démo (règle « Mode démo » de CLAUDE.md) : mêmes dates courtes,
 * même calcul du retard et du montant à encaisser des deux côtés.
 *
 * Purement présentation : les vraies règles de statut vivent côté serveur
 * (lib/utils/document-status.ts).
 */
import type { InvoiceStatus } from "@/types"
import { todayInParis } from "@/lib/utils/paris-date"

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/** Ligne de la liste des factures. */
export interface InvoiceListItem {
  id: string
  /** Vide tant que la facture est un brouillon : le numéro est attribué à l'émission. */
  invoice_number: string | null
  status: InvoiceStatus
  is_archived: boolean
  issue_date: string
  due_date: string
  total_ttc: number
  client_name: string | null
  /** Objet du chantier (démo) ou première ligne de la facture (réel). */
  subject: string | null
}

export interface InvoiceViewLine {
  description: string
  quantity: number
  unit?: string | null
  unit_price_ht: number
  vat_rate: number
  total_ht: number
  total_ttc: number
  /** Autoliquidation (sous-traitance du BTP) : lue par le XML et les mentions. */
  vat_treatment?: string | null
}

export interface InvoiceViewClient {
  id?: string
  name: string
  email?: string | null
  address?: string | null
  zip_code?: string | null
  city?: string | null
  siren?: string | null
  vat_number?: string | null
}

/** Facture telle que la fiche l'affiche (API réelle ou lib/demo/data.ts). */
export interface InvoiceView {
  id: string
  /** Vide tant que la facture est un brouillon : le numéro est attribué à l'émission. */
  invoice_number: string | null
  status: InvoiceStatus
  is_archived: boolean
  issue_date: string
  due_date: string
  created_at?: string | null
  sent_at?: string | null
  paid_at?: string | null
  reminder_1_sent_at?: string | null
  reminder_2_sent_at?: string | null
  /**
   * Relances envoyées (journal, automatiques et manuelles). `null` ou absent :
   * journal pas encore en place, l'historique s'en tient aux deux colonnes ci-dessus.
   */
  reminders?: { stage: string; origin: string; sent_at: string }[] | null
  subject?: string | null
  lines: InvoiceViewLine[]
  subtotal_ht: number
  total_vat: number
  total_ttc: number
  notes?: string | null
  client: InvoiceViewClient | null
  /** Mentions de l'entreprise figées à l'émission (lib/legal/mentions.ts). */
  legal_snapshot?: unknown
  /** Formule Artisan : acompte, situation, solde (lib/artisan/billing.ts), figés à l'émission. */
  invoice_kind?: string | null
  billing_context?: unknown
  /** Retenue de garantie TTC (à régler à sa libération). */
  retention_amount?: number | null
  /** Chantier de rattachement (lien de la fiche). */
  chantier?: { id: string; name: string; href: string } | null
}

export interface CompanyView {
  name: string
  address?: string | null
  zip_code?: string | null
  city?: string | null
  siret?: string | null
  siren?: string | null
  vat_number?: string | null
  iban?: string | null
  legal_notice?: string | null
  /** Profil légal (mentions automatiques d'un brouillon), colonne `legal_profile`. */
  legal_profile?: unknown
}

/* ------------------------------------------------------------------ */
/* Statuts                                                             */
/* ------------------------------------------------------------------ */

/** Émises et non réglées : ce qui reste à encaisser (même liste que les relances). */
export const OPEN_STATUSES: readonly InvoiceStatus[] = ["sent", "pending", "received", "accepted", "overdue"]

export const isOpen = (status: InvoiceStatus) => OPEN_STATUSES.includes(status)

/** Jours de retard (0 si l'échéance n'est pas dépassée ou si la facture n'est plus à encaisser). */
export function daysLate(status: InvoiceStatus, dueDate: string, today: string): number {
  if (!isOpen(status)) return 0
  return Math.max(0, daysBetween(dueDate, today))
}

/** En retard : statut « En retard » posé, ou échéance dépassée sans règlement. */
export function isLate(status: InvoiceStatus, dueDate: string, today: string): boolean {
  return status === "overdue" || daysLate(status, dueDate, today) > 0
}

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

const MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]
const MONTHS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]

/**
 * Jour, mois, année d'une date. Une date seule (« 2026-09-12 ») est lue telle
 * quelle, sans passer par un fuseau : `new Date("2026-09-12")` la lirait en
 * minuit UTC et pourrait reculer d'un jour.
 */
function parts(value: string): { y: number; m: number; d: number } {
  const only = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (only) return { y: +only[1], m: +only[2], d: +only[3] }
  const dt = new Date(value)
  return { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() }
}

const dayLabel = (d: number) => (d === 1 ? "1er" : String(d))

/** « 12 sept. », avec l'année si elle diffère de celle de référence (« 12 déc. 2025 »). */
export function shortDate(value: string | null | undefined, refYear?: number): string {
  if (!value) return "—"
  const { y, m, d } = parts(value)
  const base = `${dayLabel(d)} ${MONTHS_SHORT[m - 1]}`
  return refYear !== undefined && y !== refYear ? `${base} ${y}` : base
}

/** « 12 septembre 2026 » (ou sans l'année si `withYear` est faux). */
export function longDate(value: string | null | undefined, withYear = true): string {
  if (!value) return "—"
  const { y, m, d } = parts(value)
  return `${dayLabel(d)} ${MONTHS_LONG[m - 1]}${withYear ? ` ${y}` : ""}`
}

/** « 12 sept. 2026 » */
export function mediumDate(value: string | null | undefined): string {
  if (!value) return "—"
  const { y, m, d } = parts(value)
  return `${dayLabel(d)} ${MONTHS_SHORT[m - 1]} ${y}`
}

/** Heure « 10:42 » d'un horodatage (vide pour une date seule). */
export function timeOf(value: string | null | undefined): string {
  if (!value || /^\d{4}-\d{2}-\d{2}$/.test(value)) return ""
  const dt = new Date(value)
  return `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`
}

/** Nombre de jours de `from` à `to` (dates « AAAA-MM-JJ » ou horodatages). */
export function daysBetween(from: string, to: string): number {
  const a = parts(from)
  const b = parts(to)
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000)
}

/** Date du jour à Paris, « AAAA-MM-JJ » : les retards se comptent à l'heure française, où que soit le navigateur. */
export function todayISO(): string {
  return todayInParis()
}

export const yearOf = (value: string) => parts(value).y

/* ------------------------------------------------------------------ */
/* Divers                                                              */
/* ------------------------------------------------------------------ */

/** IBAN groupé par quatre caractères. */
export function formatIban(iban: string): string {
  return iban.replace(/\s+/g, "").toUpperCase().replace(/(.{4})/g, "$1 ").trim()
}

/** SIREN groupé « 948 211 375 ». */
export function formatSiren(siren: string): string {
  const s = siren.replace(/\s+/g, "")
  return /^\d{9}$/.test(s) ? `${s.slice(0, 3)} ${s.slice(3, 6)} ${s.slice(6)}` : siren
}

/** Objet court d'une facture réelle : sa première ligne, tronquée. */
export function subjectFromLines(lines: { description?: string | null }[] | null | undefined, max = 48): string | null {
  const first = lines?.find((l) => l.description?.trim())?.description?.trim()
  if (!first) return null
  return first.length > max ? `${first.slice(0, max - 1).trimEnd()}…` : first
}

/** Comparaison sans accents ni casse, pour la recherche. */
export function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

export const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`
