/**
 * Lectures des données Search Console enregistrées (tables seo_gsc_*, fonctions
 * SQL seo_gsc_* de la migration 20261009_seo_admin.sql) pour la Vue
 * d'ensemble et Performance › Recherche Google.
 *
 * - Une période se termine au dernier jour enregistré (Search Console a 2 à
 *   3 jours de décalage) : lib/seo/period.ts.
 * - Un jour sans ligne vaut 0 clic et 0 impression ; son taux de clic et sa
 *   position sont absents (null), jamais 0.
 * - La période précédente n'est comparée que si l'historique la couvre (sinon
 *   « +100 % » viendrait d'une reprise pas encore faite, pas du trafic).
 *
 * Toute lecture en échec lève SeoDbError (lib/seo/db.ts : migration absente
 * ou lecture impossible), jamais un résultat vide.
 */
import { must, type SeoDb } from "@/lib/seo/db"
import { readJob } from "@/lib/seo/cron"
import { ctrOf, fmtDay } from "@/lib/seo/format"
import { daysOf, missingRecentDays, resolvePeriod, GSC_LAG_DAYS, type DateRange, type PeriodKey, type ResolvedPeriod } from "@/lib/seo/period"
import type { DeviceFilter, GscDay, GscDevice, GscPageRow, GscQueryRow, GscTotals } from "@/lib/seo/types"
import { countryValue, deviceValue, type CountryFilter } from "@/lib/seo/search-console/filters"
import { parseCursor } from "@/lib/seo/search-console/sync"
import { daysBetween } from "@/lib/utils/paris-date"

export interface GscFilterValues {
  device: GscDevice | null
  country: string | null
}

export function filterValues(device: DeviceFilter, country: CountryFilter): GscFilterValues {
  return { device: deviceValue(device), country: countryValue(country) }
}

function rpcArgs(range: DateRange, filters: GscFilterValues) {
  return { p_from: range.from, p_to: range.to, p_device: filters.device, p_country: filters.country }
}

const num = (v: unknown): number => {
  const n = typeof v === "string" ? Number(v) : v
  return typeof n === "number" && Number.isFinite(n) ? n : 0
}
const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined) return null
  const n = typeof v === "string" ? Number(v) : v
  return typeof n === "number" && Number.isFinite(n) ? n : null
}

/* ------------------------------------------------------------------ */
/* Conversions pures (testées)                                         */
/* ------------------------------------------------------------------ */

interface AggRow {
  clicks?: unknown
  impressions?: unknown
  avg_position?: unknown
}

/** Ligne agrégée d'une fonction SQL → indicateurs (taux de clic = clics / impressions). */
export function toTotals(row: AggRow | null | undefined): GscTotals {
  const clicks = num(row?.clicks)
  const impressions = num(row?.impressions)
  return {
    clicks,
    impressions,
    ctr: ctrOf(clicks, impressions),
    position: impressions > 0 ? numOrNull(row?.avg_position) : null,
  }
}

/** Série complète de la plage : un jour sans ligne vaut 0 (taux et position absents). */
export function fillSeries(days: string[], rows: (AggRow & { date?: unknown })[]): GscDay[] {
  const byDay = new Map<string, GscTotals>()
  rows.forEach((r) => {
    if (typeof r.date === "string") byDay.set(r.date.slice(0, 10), toTotals(r))
  })
  return days.map((date) => ({ date, ...(byDay.get(date) ?? { clicks: 0, impressions: 0, ctr: null, position: null }) }))
}

/** Vrai si l'historique enregistré couvre le début de la période précédente. */
export function historyCovers(firstStored: string | null, backfillDone: boolean, from: string): boolean {
  if (backfillDone) return true
  return firstStored !== null && daysBetween(firstStored, from) >= 0
}

function dayNumber(iso: string): string {
  const d = Number(iso.slice(8, 10))
  return d === 1 ? "1er" : String(d)
}

/** « le 5 et le 6 oct. », « le 30 sept. et le 1er oct. », « du 2 au 6 oct. ». */
export function fmtDayList(days: string[]): string {
  if (days.length === 0) return ""
  const first = days[0]
  const last = days[days.length - 1]
  const sameMonth = first.slice(0, 7) === last.slice(0, 7)
  if (days.length === 1) return `le ${fmtDay(first)}`
  if (days.length === 2) return sameMonth ? `le ${dayNumber(first)} et le ${fmtDay(last)}` : `le ${fmtDay(first)} et le ${fmtDay(last)}`
  return sameMonth ? `du ${dayNumber(first)} au ${fmtDay(last)}` : `du ${fmtDay(first)} au ${fmtDay(last)}`
}

/**
 * Ligne « données en retard » : « 2 à 3 jours de décalage : le 5 et le 6 oct. ne
 * sont pas encore disponibles ». Au-delà du décalage habituel, le ton passe en
 * alerte (synchronisation à vérifier).
 */
export function missingDaysNotice(days: string[]): { text: string; late: boolean } | null {
  if (days.length === 0) return null
  const late = days.length > GSC_LAG_DAYS
  const list = fmtDayList(days)
  const verb = days.length === 1 ? "n'est pas encore disponible" : "ne sont pas encore disponibles"
  const subject = days.length > 2 ? `les jours ${list}` : list
  return late
    ? { text: `Données en retard : ${subject} ${verb}. Vérifiez la synchronisation de Search Console.`, late }
    : { text: `2 à 3 jours de décalage : ${subject} ${verb}.`, late }
}

/* ------------------------------------------------------------------ */
/* Lectures                                                            */
/* ------------------------------------------------------------------ */

function firstRow<T>(data: unknown): T | null {
  return ((Array.isArray(data) ? data[0] : data) ?? null) as T | null
}

export interface GscBounds {
  first: string | null
  last: string | null
}

export async function readBounds(db: SeoDb): Promise<GscBounds> {
  const row = firstRow<{ first_date?: string | null; last_date?: string | null }>(
    must(await db.rpc("seo_gsc_bounds"), "les bornes de Search Console"),
  )
  return {
    first: row?.first_date ? String(row.first_date).slice(0, 10) : null,
    last: row?.last_date ? String(row.last_date).slice(0, 10) : null,
  }
}

export async function readTotals(db: SeoDb, range: DateRange, filters: GscFilterValues): Promise<GscTotals> {
  return toTotals(firstRow<AggRow>(must(await db.rpc("seo_gsc_totals", rpcArgs(range, filters)), "les totaux de Search Console")))
}

export async function readDailySeries(db: SeoDb, range: DateRange, filters: GscFilterValues): Promise<GscDay[]> {
  const rows = must(await db.rpc("seo_gsc_by_date", rpcArgs(range, filters)), "la série de Search Console") as (AggRow & { date?: unknown })[] | null
  return fillSeries(daysOf(range), rows ?? [])
}

/** Plafond de lignes rendues par PostgREST : au-delà, la liste est tronquée (et l'écran le dit). */
export const ROWS_LIMIT = 1000

export async function readPages(db: SeoDb, range: DateRange, filters: GscFilterValues): Promise<GscPageRow[]> {
  const rows = must(
    await db.rpc("seo_gsc_by_page", rpcArgs(range, filters)).limit(ROWS_LIMIT),
    "les pages de Search Console",
  ) as (AggRow & { page?: unknown })[] | null
  return (rows ?? []).filter((r) => typeof r.page === "string").map((r) => ({ page: r.page as string, ...toTotals(r) }))
}

export async function readQueries(db: SeoDb, range: DateRange, filters: GscFilterValues): Promise<GscQueryRow[]> {
  const rows = must(
    await db.rpc("seo_gsc_by_query", rpcArgs(range, filters)).limit(ROWS_LIMIT),
    "les requêtes de Search Console",
  ) as (AggRow & { query?: unknown })[] | null
  return (rows ?? []).filter((r) => typeof r.query === "string").map((r) => ({ query: r.query as string, ...toTotals(r) }))
}

/* ------------------------------------------------------------------ */
/* Écran « Performances »                                              */
/* ------------------------------------------------------------------ */

export interface SyncState {
  status: "idle" | "running" | "ok" | "error"
  finishedAt: string | null
  lastOkAt: string | null
  error: string | null
  backfillDone: boolean
  backfillUntil: string | null
}

export interface SearchPerformance {
  bounds: GscBounds
  period: ResolvedPeriod
  totals: GscTotals
  /** null : l'historique ne couvre pas encore la période précédente (pas d'évolution affichée). */
  previous: GscTotals | null
  series: GscDay[]
  /** Jours entre le dernier jour enregistré et hier. */
  missingDays: string[]
  sync: SyncState | null
}

export async function readSyncState(db: SeoDb): Promise<SyncState | null> {
  const job = await readJob(db, "search-console")
  if (!job) return null
  const cursor = parseCursor(job.cursor)
  return {
    status: job.status,
    finishedAt: job.finished_at,
    lastOkAt: job.last_ok_at,
    error: job.error,
    backfillDone: cursor.backfillDone === true,
    backfillUntil: cursor.backfillUntil ?? null,
  }
}

/** Indicateurs de la période, de la précédente, et série quotidienne. */
export async function readSearchPerformance(
  db: SeoDb,
  opts: { period: PeriodKey; device: DeviceFilter; country: CountryFilter; now?: Date },
): Promise<SearchPerformance> {
  const now = opts.now ?? new Date()
  const [bounds, sync] = await Promise.all([readBounds(db), readSyncState(db)])
  const period = resolvePeriod(opts.period, bounds.last, now)
  const filters = filterValues(opts.device, opts.country)
  const compare = bounds.last !== null && historyCovers(bounds.first, sync?.backfillDone === true, period.previous.from)

  const [totals, previous, series] = await Promise.all([
    bounds.last ? readTotals(db, period.current, filters) : Promise.resolve(toTotals(null)),
    compare ? readTotals(db, period.previous, filters) : Promise.resolve(null),
    bounds.last ? readDailySeries(db, period.current, filters) : Promise.resolve(fillSeries(daysOf(period.current), [])),
  ])

  return { bounds, period, totals, previous, series, missingDays: missingRecentDays(bounds.last, now), sync }
}
