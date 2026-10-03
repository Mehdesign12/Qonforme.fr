/**
 * Où en est la facturation d'un devis accepté (formule Artisan) : acomptes
 * émis, situations, solde, brouillon en cours, et ce qu'il est encore possible
 * de créer. Fonction pure, partagée par l'API (qui décide) et l'écran (qui
 * affiche les mêmes règles).
 *
 * Règles :
 * - une facture annulée par un avoir total (statut « credited ») ne compte
 *   plus : son avancement et ses acomptes sont à refacturer ;
 * - un seul brouillon à la fois par devis : l'avancement et les reprises
 *   d'acompte se calculent toujours sur des factures émises, jamais deux fois ;
 * - acomptes avant toute situation ; situations jusqu'au décompte final (toutes
 *   les lignes à 100 %) ; facture de solde seulement sans situation, après au
 *   moins un acompte (sinon, la conversion du devis en facture suffit) ;
 * - un devis déjà converti en facture (conversion simple) est facturé : plus
 *   d'acompte, de situation ni de solde.
 */
import {
  depositGroups, parseBillingContext, parseInvoiceKind, previousProgress, sumGroups, vatGroupsOf,
  type BillingLine, type DeductedRecord, type DepositRecord, type InvoiceKind, type SituationPrevious, type SourceLine,
} from "./billing"
import { toCents } from "./money"

export interface QuoteForBilling {
  id: string
  quote_number: string
  status: string
  issue_date: string
  lines: SourceLine[] | null
  total_ttc?: number | string | null
  converted_invoice_id?: string | null
}

export interface InvoiceForBilling {
  id: string
  invoice_number: string | null
  status: string
  issue_date: string | null
  invoice_kind?: string | null
  billing_context?: unknown
  lines?: SourceLine[] | BillingLine[] | null
  total_ttc?: number | string | null
  retention_amount?: number | string | null
}

export type Allowed = { ok: true } | { ok: false; reason: string }

export interface QuoteBillingState {
  contractTtc: number
  contractHt: number
  deposits: DepositRecord[]
  depositsTtc: number
  deducted: DeductedRecord[]
  /** TTC repris sur les acomptes (situations et solde émis). */
  deductedTtc: number
  previous: SituationPrevious
  /** Numéro de la prochaine situation. */
  nextSituation: number
  situationsIssued: number
  finalIssued: boolean
  draft: { id: string; kind: InvoiceKind } | null
  /** TTC facturé (factures émises non annulées). */
  billedTtc: number
  /** Retenue de garantie sur ces factures. */
  retentionTtc: number
  /** Avancement facturé, en % du HT du devis (situations). */
  progressPercent: number
  canDeposit: Allowed
  canSituation: Allowed
  canFinal: Allowed
}

const ok: Allowed = { ok: true }
const no = (reason: string): Allowed => ({ ok: false, reason })

export function quoteBillingState(quote: QuoteForBilling, invoices: InvoiceForBilling[]): QuoteBillingState {
  const lines = quote.lines ?? []
  const contract = sumGroups(vatGroupsOf(lines))
  const kindOf = (i: InvoiceForBilling) => parseBillingContext(i.billing_context)?.kind ?? parseInvoiceKind(i.invoice_kind)
  const artisan = invoices.filter((i) => kindOf(i) !== "standard")
  const live = artisan.filter((i) => i.status !== "draft" && i.status !== "cancelled" && i.status !== "credited")
  const draftRow = artisan.find((i) => i.status === "draft") ?? null

  const deposits: DepositRecord[] = live
    .filter((i) => kindOf(i) === "deposit")
    .map((i) => ({ invoice_id: i.id, number: i.invoice_number ?? "", issue_date: (i.issue_date ?? "").slice(0, 10), groups: depositGroups(i.lines as SourceLine[]) }))
    .sort((a, b) => a.issue_date.localeCompare(b.issue_date) || a.number.localeCompare(b.number))
  const depositsTtc = deposits.reduce((s, d) => s + sumGroups(d.groups).ttc, 0)

  const deducted: DeductedRecord[] = []
  for (const i of live) {
    const ctx = parseBillingContext(i.billing_context)
    for (const d of ctx?.deductions ?? []) deducted.push({ invoice_id: d.invoice_id, groups: d.groups ?? [] })
  }
  const deductedTtc = deducted.reduce((s, d) => s + sumGroups(d.groups).ttc, 0)

  const situations = live.filter((i) => kindOf(i) === "situation")
  const previous = previousProgress(lines.length, situations.map((s) => ({ lines: s.lines as BillingLine[] })))
  const numbers = artisan
    .filter((i) => kindOf(i) === "situation" && i.status !== "draft")
    .map((i) => parseBillingContext(i.billing_context)?.situation?.number ?? 0)
  const nextSituation = Math.max(0, ...numbers) + 1
  const finalIssued = live.some((i) => kindOf(i) === "final" || (kindOf(i) === "situation" && parseBillingContext(i.billing_context)?.situation?.final === true))

  const billedTtc = live.reduce((s, i) => s + toCents(i.total_ttc), 0)
  const retentionTtc = live.reduce((s, i) => s + Math.max(0, toCents(i.retention_amount)), 0)
  const contractHt = contract.ht
  const billedHt = previous.billedHt.reduce((s, v) => s + v, 0)
  const progressPercent = contractHt > 0 ? Math.round((billedHt / contractHt) * 10_000) / 100 : 0

  // ── Ce qui reste possible ──
  let base: Allowed = ok
  if (quote.status !== "accepted") base = no("Le devis doit d'abord être accepté par votre client.")
  else if (quote.converted_invoice_id) base = no("Ce devis a déjà été converti en facture.")
  else if (lines.length === 0 || contract.ttc <= 0) base = no("Le devis n'a pas de montant à facturer.")
  else if (draftRow) base = no("Un brouillon est en cours pour ce devis : envoyez-le ou supprimez-le d'abord.")
  else if (finalIssued) base = no("Ce devis est entièrement facturé.")

  const canDeposit: Allowed = !base.ok ? base
    : situations.length > 0 ? no("Les acomptes se facturent avant la première situation.")
    : depositsTtc >= contract.ttc ? no("Les acomptes couvrent déjà tout le devis.")
    : ok
  const canSituation: Allowed = base
  const canFinal: Allowed = !base.ok ? base
    : situations.length > 0 ? no("Facturation par situations en cours : la dernière situation, à 100 %, fait office de décompte final.")
    : deposits.length === 0 ? no("Sans acompte, convertissez simplement le devis en facture.")
    : ok

  return {
    contractTtc: contract.ttc,
    contractHt,
    deposits,
    depositsTtc,
    deducted,
    deductedTtc,
    previous,
    nextSituation,
    situationsIssued: situations.length,
    finalIssued,
    draft: draftRow ? { id: draftRow.id, kind: kindOf(draftRow) } : null,
    billedTtc,
    retentionTtc,
    progressPercent,
    canDeposit,
    canSituation,
    canFinal,
  }
}

/** Une conversion simple (devis → facture) est-elle encore possible ? Non dès qu'une facture Artisan existe. */
export function conversionBlockedBy(invoices: InvoiceForBilling[]): string | null {
  const artisan = invoices.filter((i) => (parseBillingContext(i.billing_context)?.kind ?? parseInvoiceKind(i.invoice_kind)) !== "standard" && i.status !== "credited")
  return artisan.length > 0
    ? "Ce devis est facturé par acomptes ou situations : terminez-le par une facture de solde ou une situation à 100 %."
    : null
}
