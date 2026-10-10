/**
 * Prévision de trésorerie : ce que les factures émises doivent rapporter et
 * ce que les factures reçues des fournisseurs vont coûter, semaine par semaine,
 * d'après leurs dates d'échéance.
 *
 * Module pur (aucun accès réseau) : partagé par la page réelle (/tresorerie)
 * et sa démo, testé dans __tests__/treasury-forecast.test.ts. Dates
 * « AAAA-MM-JJ » à l'heure de Paris (lib/utils/paris-date) : une facture qui
 * échoit aujourd'hui n'est en retard qu'à partir de demain.
 *
 * Montants, en TTC :
 * - à encaisser : total de la facture, moins les avoirs déjà émis sur elle et
 *   la retenue de garantie (due seulement à sa libération, comme au tableau de bord) ;
 * - à payer : reste dû de la facture reçue (`amount_due`) ; un avoir fournisseur
 *   vient en déduction. Sans échéance, le paiement est attendu 30 jours après
 *   l'émission (délai légal par défaut, Code de commerce, art. L441-10).
 */
import { addDays, daysBetween } from "@/lib/utils/paris-date"

/** Factures émises et non réglées (même liste que le tableau de bord). */
export const OPEN_INVOICE_STATUSES = ["sent", "pending", "received", "accepted", "overdue"] as const

/** Délai légal par défaut quand une facture reçue n'a pas d'échéance. */
export const DEFAULT_PAYMENT_DAYS = 30

export type Horizon = 30 | 60 | 90

export interface ForecastInvoice {
  id: string
  /** Vide pour un brouillon (exclu de toute façon). */
  invoice_number: string | null
  client_name: string | null
  due_date: string | null
  total_ttc: number
  /** Total TTC des avoirs déjà émis sur cette facture. */
  credited_ttc?: number
  /** Retenue de garantie (formule Artisan), hors du montant à encaisser. */
  retention_ttc?: number
  status: string
}

export interface ForecastPayable {
  id: string
  invoice_number: string
  supplier_name: string
  issue_date: string
  due_date: string | null
  /** Reste dû, TTC. */
  amount_due: number
  /** Avoir du fournisseur : vient en déduction. */
  credit: boolean
}

export type FlowKind = "in" | "out"

export interface ScheduleItem {
  kind: FlowKind
  id: string
  number: string
  party: string
  due_date: string
  /** Positif ; un avoir fournisseur est négatif. */
  amount: number
  /** Jours de retard (0 si pas encore échue). */
  daysLate: number
  /** Échéance supposée (facture reçue sans date d'échéance). */
  assumedDue: boolean
}

export interface WeekBucket {
  /** Lundi de la semaine. */
  start: string
  /** Dimanche de la semaine. */
  end: string
  in: number
  out: number
  inCount: number
  outCount: number
}

export interface Total { amount: number; count: number }

export interface Forecast {
  today: string
  horizon: Horizon
  inflow: { overdue: Total & { over30: number }; thisWeek: Total; inHorizon: Total; later: Total; total: Total }
  outflow: { overdue: Total; inHorizon: Total; later: Total; total: Total }
  /** Entrées attendues dans l'horizon, moins les sorties de l'horizon et les sorties déjà en retard. */
  net: number
  weeks: WeekBucket[]
  /** Retards d'abord (les plus anciens en tête), puis les échéances de l'horizon, entrées et sorties mêlées. */
  schedule: ScheduleItem[]
}

const round2 = (n: number) => Math.round(n * 100) / 100
const emptyTotal = (): Total => ({ amount: 0, count: 0 })
const add = (t: Total, amount: number) => { t.amount += amount; t.count++ }
const fix = (t: Total): Total => ({ amount: round2(t.amount), count: t.count })

/** Lundi de la semaine qui contient `iso`. */
export function mondayOf(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = dimanche
  return addDays(iso, dow === 0 ? -6 : 1 - dow)
}

const dayFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" })
/** « 14 oct. » depuis « 2026-10-14 ». */
export function fmtDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number)
  return dayFmt.format(new Date(Date.UTC(y, m - 1, d, 12)))
}

/** Reste à encaisser d'une facture émise. */
export function receivableOf(inv: Pick<ForecastInvoice, "total_ttc" | "credited_ttc" | "retention_ttc">): number {
  return Math.max(0, round2((Number(inv.total_ttc) || 0) - (Number(inv.credited_ttc) || 0) - (Number(inv.retention_ttc) || 0)))
}

/** Reste à payer d'une facture reçue (négatif pour un avoir). */
export function payableOf(p: Pick<ForecastPayable, "amount_due" | "credit">): number {
  const v = Math.abs(Number(p.amount_due) || 0)
  return round2(p.credit ? -v : v)
}

export function buildForecast(
  invoices: ForecastInvoice[],
  payables: ForecastPayable[],
  today: string,
  horizon: Horizon,
): Forecast {
  const open = OPEN_INVOICE_STATUSES as readonly string[]
  const end = addDays(today, horizon)
  const weekEnd = addDays(mondayOf(today), 6)

  const inflow = { overdue: { ...emptyTotal(), over30: 0 }, thisWeek: emptyTotal(), inHorizon: emptyTotal(), later: emptyTotal(), total: emptyTotal() }
  const outflow = { overdue: emptyTotal(), inHorizon: emptyTotal(), later: emptyTotal(), total: emptyTotal() }

  const weeks: WeekBucket[] = []
  for (let start = mondayOf(today); start <= end; start = addDays(start, 7)) {
    weeks.push({ start, end: addDays(start, 6), in: 0, out: 0, inCount: 0, outCount: 0 })
  }
  const weekOf = (day: string) => weeks.find((w) => day >= w.start && day <= w.end)

  const late: ScheduleItem[] = []
  const upcoming: ScheduleItem[] = []

  for (const inv of invoices) {
    if (!open.includes(inv.status) || !inv.due_date) continue
    const amount = receivableOf(inv)
    if (amount <= 0) continue
    const due = inv.due_date.slice(0, 10)
    const item: ScheduleItem = {
      kind: "in", id: inv.id, number: inv.invoice_number ?? "", party: inv.client_name || "Client",
      due_date: due, amount, daysLate: 0, assumedDue: false,
    }
    add(inflow.total, amount)
    if (due < today) {
      item.daysLate = daysBetween(due, today)
      add(inflow.overdue, amount)
      if (item.daysLate > 30) inflow.overdue.over30 += amount
      late.push(item)
    } else if (due > end) {
      add(inflow.later, amount)
    } else {
      add(inflow.inHorizon, amount)
      if (due <= weekEnd) add(inflow.thisWeek, amount)
      const w = weekOf(due)
      if (w) { w.in += amount; w.inCount++ }
      upcoming.push(item)
    }
  }

  for (const p of payables) {
    const amount = payableOf(p)
    if (amount === 0) continue
    const assumedDue = !p.due_date
    const due = (p.due_date ?? addDays(p.issue_date.slice(0, 10), DEFAULT_PAYMENT_DAYS)).slice(0, 10)
    const item: ScheduleItem = {
      kind: "out", id: p.id, number: p.invoice_number, party: p.supplier_name || "Fournisseur",
      due_date: due, amount, daysLate: 0, assumedDue,
    }
    add(outflow.total, amount)
    if (due < today) {
      item.daysLate = daysBetween(due, today)
      add(outflow.overdue, amount)
      late.push(item)
    } else if (due > end) {
      add(outflow.later, amount)
    } else {
      add(outflow.inHorizon, amount)
      const w = weekOf(due)
      if (w) { w.out += amount; w.outCount++ }
      upcoming.push(item)
    }
  }

  const byDate = (a: ScheduleItem, b: ScheduleItem) =>
    a.due_date.localeCompare(b.due_date) || a.kind.localeCompare(b.kind) || a.number.localeCompare(b.number)
  late.sort(byDate)
  upcoming.sort(byDate)

  return {
    today,
    horizon,
    inflow: {
      overdue: { ...fix(inflow.overdue), over30: round2(inflow.overdue.over30) },
      thisWeek: fix(inflow.thisWeek),
      inHorizon: fix(inflow.inHorizon),
      later: fix(inflow.later),
      total: fix(inflow.total),
    },
    outflow: { overdue: fix(outflow.overdue), inHorizon: fix(outflow.inHorizon), later: fix(outflow.later), total: fix(outflow.total) },
    net: round2(inflow.inHorizon.amount - outflow.inHorizon.amount - outflow.overdue.amount),
    weeks: weeks.map((w) => ({ ...w, in: round2(w.in), out: round2(w.out) })),
    schedule: [...late, ...upcoming],
  }
}
