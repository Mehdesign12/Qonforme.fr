/**
 * Périodes de l'onglet SEO (« 7 jours », « 28 jours », « 3 mois ») et
 * comparaison à la période précédente.
 *
 * Search Console publie ses données avec 2 à 3 jours de décalage : une période
 * se termine au dernier jour enregistré (seo_gsc_bounds), pas à aujourd'hui,
 * sinon les derniers jours paraîtraient vides. Dates calendaires AAAA-MM-JJ,
 * heure de Paris (lib/utils/paris-date.ts).
 *
 * Module pur : utilisable côté serveur, navigateur et tests.
 */
import { addDays, daysBetween, todayInParis } from "@/lib/utils/paris-date"

export type PeriodKey = "7j" | "28j" | "3m"

export const PERIODS: { key: PeriodKey; label: string; days: number; compareLabel: string }[] = [
  { key: "7j", label: "7 jours", days: 7, compareLabel: "vs 7 jours précédents" },
  { key: "28j", label: "28 jours", days: 28, compareLabel: "vs 28 jours précédents" },
  { key: "3m", label: "3 mois", days: 90, compareLabel: "vs 3 mois précédents" },
]

export const DEFAULT_PERIOD: PeriodKey = "28j"

/** Décalage habituel de Search Console (jours). */
export const GSC_LAG_DAYS = 3

export function parsePeriod(value: string | string[] | undefined | null): PeriodKey {
  const v = Array.isArray(value) ? value[0] : value
  return PERIODS.some((p) => p.key === v) ? (v as PeriodKey) : DEFAULT_PERIOD
}

export function periodDef(key: PeriodKey) {
  return PERIODS.find((p) => p.key === key) ?? PERIODS[1]
}

export interface DateRange {
  from: string
  to: string
}

export interface ResolvedPeriod {
  key: PeriodKey
  label: string
  days: number
  compareLabel: string
  current: DateRange
  previous: DateRange
  /** Dernier jour disponible attendu sans données enregistrées : aujourd'hui − 3 jours. */
  expectedLastDay: string
}

/**
 * Bornes de la période qui se termine au dernier jour disponible
 * (`lastDataDay`, sinon aujourd'hui − 3 jours) et de la période précédente.
 */
export function resolvePeriod(key: PeriodKey, lastDataDay?: string | null, now: Date = new Date()): ResolvedPeriod {
  const def = periodDef(key)
  const expectedLastDay = addDays(todayInParis(now), -GSC_LAG_DAYS)
  const to = lastDataDay ?? expectedLastDay
  const from = addDays(to, -(def.days - 1))
  const prevTo = addDays(from, -1)
  const prevFrom = addDays(prevTo, -(def.days - 1))
  return { ...def, current: { from, to }, previous: { from: prevFrom, to: prevTo }, expectedLastDay }
}

/** Tous les jours de la plage, dans l'ordre (graphiques : un jour sans ligne vaut 0). */
export function daysOf(range: DateRange): string[] {
  const n = daysBetween(range.from, range.to)
  const out: string[] = []
  for (let i = 0; i <= n; i++) out.push(addDays(range.from, i))
  return out
}

/**
 * Jours manquants entre le dernier jour enregistré et le dernier jour attendu
 * (« le 5 et le 6 oct. ne sont pas encore disponibles »).
 */
export function missingRecentDays(lastDataDay: string | null, now: Date = new Date()): string[] {
  if (!lastDataDay) return []
  const yesterday = addDays(todayInParis(now), -1)
  const out: string[] = []
  for (let d = addDays(lastDataDay, 1); d <= yesterday; d = addDays(d, 1)) out.push(d)
  return out
}
