/**
 * Briques d'affichage des factures reçues, partagées par l'application et la
 * démo : pastilles de statut, montants, unités, filtres.
 */
import {
  AlertTriangle, Check, CheckCheck, CircleDot, Clock, Eye, FileCheck2, Inbox, PauseCircle, Send, X,
} from "lucide-react"
import { StatusPill, type Tone } from "@/components/app/kit"
import {
  CLOSED, IN_DISPUTE, STATUS_DEFS, TO_PAY, TO_PROCESS, type ReceivedStatus,
} from "@/lib/reception/lifecycle"
import { isCreditNoteType } from "@/lib/reception/types"
import type { ReceivedListItem } from "@/lib/reception/view"

/* ------------------------------------------------------------------ */
/* Statuts                                                              */
/* ------------------------------------------------------------------ */

const PILLS: Record<ReceivedStatus, { tone: Tone; icon: React.ReactNode; label?: string }> = {
  received:           { tone: "info",    icon: <Inbox strokeWidth={2.25} aria-hidden /> },
  made_available:     { tone: "info",    icon: <Inbox strokeWidth={2.25} aria-hidden /> },
  in_hand:            { tone: "neutral", icon: <Eye strokeWidth={2.25} aria-hidden /> },
  approved:           { tone: "ok",      icon: <Check strokeWidth={2.75} aria-hidden /> },
  partially_approved: { tone: "ok",      icon: <CircleDot strokeWidth={2.25} aria-hidden /> },
  disputed:           { tone: "warn",    icon: <AlertTriangle strokeWidth={2.25} aria-hidden /> },
  suspended:          { tone: "warn",    icon: <PauseCircle strokeWidth={2.25} aria-hidden /> },
  completed:          { tone: "info",    icon: <FileCheck2 strokeWidth={2.25} aria-hidden /> },
  refused:            { tone: "danger",  icon: <X strokeWidth={2.75} aria-hidden /> },
  // Libellé court dans les listes ; le cycle de vie garde « Paiement transmis » (211)
  payment_sent:       { tone: "ok",      icon: <Send strokeWidth={2.25} aria-hidden />, label: "Payée" },
  cashed:             { tone: "ok",      icon: <CheckCheck strokeWidth={2.5} aria-hidden /> },
  rejected:           { tone: "danger",  icon: <X strokeWidth={2.75} aria-hidden /> },
}

export function statusLabel(status: ReceivedStatus): string {
  return PILLS[status].label ?? STATUS_DEFS[status].label
}

export function ReceivedStatusPill({ status, className }: { status: ReceivedStatus; className?: string }) {
  const p = PILLS[status]
  return <StatusPill tone={p.tone} icon={p.icon} className={className}>{statusLabel(status)}</StatusPill>
}

/** Pastille « Échéance dépassée » pour une facture encore à régler. */
export function LatePill({ days }: { days: number }) {
  return <StatusPill tone="warn" icon={<Clock strokeWidth={2.25} aria-hidden />}>Échue depuis {days} j</StatusPill>
}

/* ------------------------------------------------------------------ */
/* Montants et unités                                                   */
/* ------------------------------------------------------------------ */

/** Montant dans la devise de la facture (espaces insécables, comme formatCurrency). */
export function money(amount: number, currency = "EUR"): string {
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency, minimumFractionDigits: 2 }).format(amount)
  } catch {
    return `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)} ${currency}`
  }
}

/** Montant signé : un avoir du fournisseur vient en déduction. */
export function signedMoney(item: Pick<ReceivedListItem, "document_type" | "total_ttc" | "currency">): string {
  return isCreditNoteType(item.document_type) ? `−${money(item.total_ttc, item.currency)}` : money(item.total_ttc, item.currency)
}

/** Unités UN/ECE Rec. 20 les plus courantes, en clair. */
const UNITS: Record<string, string> = {
  C62: "u", H87: "pce", EA: "u", XPP: "pce", DAY: "j", HUR: "h", MIN: "min", WEE: "sem.", MON: "mois",
  MTK: "m²", MTR: "m", MTQ: "m³", KGM: "kg", TNE: "t", LTR: "L", LS: "forfait", SET: "lot", PR: "paire", KMT: "km",
  ANN: "an", CMT: "cm", MMT: "mm", GRM: "g",
}

export function unitLabel(code: string | null | undefined): string {
  if (!code) return ""
  return UNITS[code] ?? code
}

const PAYMENT_MEANS: Record<string, string> = {
  "10": "Espèces", "20": "Chèque", "30": "Virement", "31": "Virement", "42": "Virement", "48": "Carte bancaire",
  "49": "Prélèvement", "57": "Ordre permanent", "58": "Virement SEPA", "59": "Prélèvement SEPA", "97": "Compensation",
}

export function paymentMeansLabel(code: string | null | undefined): string | null {
  if (!code) return null
  return PAYMENT_MEANS[code] ?? `Code ${code}`
}

const VAT_CATEGORIES: Record<string, string> = {
  S: "Taux normal ou réduit", Z: "Taux zéro", E: "Exonération", AE: "Autoliquidation", K: "Livraison intracommunautaire",
  G: "Exportation", O: "Hors champ de la TVA", L: "Canaries", M: "Ceuta et Melilla",
}

export function vatCategoryLabel(category: string): string {
  return VAT_CATEGORIES[category] ?? category
}

/* ------------------------------------------------------------------ */
/* Filtres                                                              */
/* ------------------------------------------------------------------ */

export type ReceivedTab = "all" | "todo" | "topay" | "dispute" | "paid" | "refused"

export const RECEIVED_TABS: { key: ReceivedTab; label: string; empty: string; statuses: readonly ReceivedStatus[] | null }[] = [
  { key: "all",     label: "Toutes",     empty: "Aucune facture reçue",        statuses: null },
  { key: "todo",    label: "À traiter",  empty: "Rien à traiter",              statuses: TO_PROCESS },
  { key: "topay",   label: "À payer",    empty: "Aucune facture à payer",      statuses: TO_PAY },
  { key: "dispute", label: "En litige",  empty: "Aucun litige en cours",       statuses: IN_DISPUTE },
  { key: "paid",    label: "Payées",     empty: "Aucune facture payée",        statuses: ["payment_sent", "cashed"] },
  { key: "refused", label: "Refusées",   empty: "Aucune facture refusée",      statuses: ["refused", "rejected"] },
]

/** Encore à régler par l'artisan (ni payée, ni refusée). */
export const isUnpaid = (status: ReceivedStatus) => !CLOSED.includes(status)
