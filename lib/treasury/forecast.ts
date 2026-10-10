/**
 * Prévision de trésorerie : ce que les factures ouvertes doivent rapporter,
 * semaine par semaine, à partir de leurs dates d'échéance.
 *
 * Logique pure (aucun accès réseau) : partagée par la page réelle et la démo,
 * et couverte par __tests__/treasury-forecast.test.ts.
 *
 * Les dates sont des chaînes « AAAA-MM-JJ » en heure locale : une facture qui
 * échoit aujourd'hui n'est pas en retard avant demain (même règle que la fiche
 * facture, qui compare à `${due_date}T23:59:59`).
 */

/** Statuts d'une facture émise et pas encore réglée */
export const OPEN_INVOICE_STATUSES = ["sent", "pending", "received", "accepted", "overdue"] as const

export type Horizon = 30 | 60 | 90

export interface ForecastInvoice {
  id:             string
  invoice_number: string
  client_name:    string | null
  due_date:       string        // AAAA-MM-JJ
  total_ttc:      number
  /** Total TTC des avoirs déjà émis sur cette facture */
  credited_ttc?:  number
  status:         string
}

export interface ScheduleItem {
  id:         string
  number:     string
  client:     string
  due_date:   string
  amount:     number
  /** Jours de retard (0 si la facture n'est pas encore échue) */
  daysLate:   number
  overdue:    boolean
}

export interface WeekBucket {
  /** Lundi de la semaine */
  start:  string
  /** Dimanche de la semaine */
  end:    string
  amount: number
  count:  number
}

export interface Total {
  amount: number
  count:  number
}

export interface Forecast {
  today:        string
  horizon:      Horizon
  overdue:      Total & { over30: number }
  thisWeek:     Total
  dueInHorizon: Total
  later:        Total
  totalOpen:    Total
  weeks:        WeekBucket[]
  /** Retards d'abord (les plus anciens en tête), puis les échéances de l'horizon */
  schedule:     ScheduleItem[]
}

const DAY_MS = 24 * 60 * 60 * 1000

const round2 = (n: number) => Math.round(n * 100) / 100

/** Date locale au format AAAA-MM-JJ */
export function isoDay(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Midi UTC du jour : insensible aux changements d'heure */
function toUtcNoon(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number)
  return Date.UTC(y, m - 1, d, 12)
}

function fromUtcNoon(ms: number): string {
  const d = new Date(ms)
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${d.getUTCFullYear()}-${m}-${day}`
}

export function addDays(iso: string, n: number): string {
  return fromUtcNoon(toUtcNoon(iso) + n * DAY_MS)
}

/** Nombre de jours de `from` à `to` (positif si `to` est après) */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcNoon(to) - toUtcNoon(from)) / DAY_MS)
}

/** Lundi de la semaine contenant `iso` */
export function mondayOf(iso: string): string {
  const dow = new Date(toUtcNoon(iso)).getUTCDay() // 0 = dimanche
  return addDays(iso, dow === 0 ? -6 : 1 - dow)
}

const dayFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" })
/** « 14 oct. » à partir de « 2026-10-14 » */
export function fmtDay(iso: string): string {
  return dayFmt.format(new Date(toUtcNoon(iso)))
}

/** Reste dû d'une facture, avoirs déduits */
export function amountDue(inv: Pick<ForecastInvoice, "total_ttc" | "credited_ttc">): number {
  return Math.max(0, round2((inv.total_ttc || 0) - (inv.credited_ttc || 0)))
}

export function buildForecast(invoices: ForecastInvoice[], today: string, horizon: Horizon): Forecast {
  const open = (OPEN_INVOICE_STATUSES as readonly string[])
  const end = addDays(today, horizon)
  const weekEnd = addDays(mondayOf(today), 6)

  const overdue = { amount: 0, count: 0, over30: 0 }
  const thisWeek: Total = { amount: 0, count: 0 }
  const dueInHorizon: Total = { amount: 0, count: 0 }
  const later: Total = { amount: 0, count: 0 }
  const totalOpen: Total = { amount: 0, count: 0 }

  // semaines contiguës, de la semaine en cours à celle qui contient la fin de l'horizon
  const weeks: WeekBucket[] = []
  for (let start = mondayOf(today); start <= end; start = addDays(start, 7)) {
    weeks.push({ start, end: addDays(start, 6), amount: 0, count: 0 })
  }

  const late: ScheduleItem[] = []
  const upcoming: ScheduleItem[] = []

  for (const inv of invoices) {
    if (!open.includes(inv.status) || !inv.due_date) continue
    const amount = amountDue(inv)
    if (amount <= 0) continue

    const due = inv.due_date.slice(0, 10)
    const item: ScheduleItem = {
      id:       inv.id,
      number:   inv.invoice_number,
      client:   inv.client_name || "Client",
      due_date: due,
      amount,
      daysLate: 0,
      overdue:  false,
    }

    totalOpen.amount += amount
    totalOpen.count++

    if (due < today) {
      item.overdue = true
      item.daysLate = daysBetween(due, today)
      overdue.amount += amount
      overdue.count++
      if (item.daysLate > 30) overdue.over30 += amount
      late.push(item)
      continue
    }

    if (due > end) {
      later.amount += amount
      later.count++
      continue
    }

    dueInHorizon.amount += amount
    dueInHorizon.count++
    if (due <= weekEnd) {
      thisWeek.amount += amount
      thisWeek.count++
    }
    const w = weeks.find((b) => due >= b.start && due <= b.end)
    if (w) {
      w.amount += amount
      w.count++
    }
    upcoming.push(item)
  }

  late.sort((a, b) => a.due_date.localeCompare(b.due_date) || a.number.localeCompare(b.number))
  upcoming.sort((a, b) => a.due_date.localeCompare(b.due_date) || a.number.localeCompare(b.number))

  const fix = (t: Total) => ({ ...t, amount: round2(t.amount) })
  return {
    today,
    horizon,
    overdue:      { ...fix(overdue), over30: round2(overdue.over30) },
    thisWeek:     fix(thisWeek),
    dueInHorizon: fix(dueInHorizon),
    later:        fix(later),
    totalOpen:    fix(totalOpen),
    weeks:        weeks.map((w) => ({ ...w, amount: round2(w.amount) })),
    schedule:     [...late, ...upcoming],
  }
}
