/**
 * Synchronisation de Search Console vers les tables seo_gsc_* (migration
 * 20261009_seo_admin.sql, section 2).
 *
 * Une plage de dates = quatre requêtes Search Analytics :
 * - [date, device, country]         → seo_gsc_daily       (totaux du site)
 * - [date, page, device, country]   → seo_gsc_pages
 * - [date, query, device, country]  → seo_gsc_queries
 * - [date, query, page]             → seo_gsc_query_pages (la page qui répond à un mot-clé)
 *
 * Les URL deviennent des chemins du site (lib/seo/site.ts : toSitePath) ; une
 * ligne hors du site est ignorée. Deux URL qui donnent le même chemin
 * (« /modele » et « /modele/ ») sont fusionnées avant l'écriture : clics et
 * impressions additionnés, position pondérée par les impressions.
 *
 * Passage quotidien (06:00, heure de Paris) : les derniers jours enregistrés
 * sont relus (Search Console complète encore ses données récentes), puis la
 * reprise de l'historique remonte 16 mois en arrière par tranches de 30 jours,
 * de la plus récente à la plus ancienne, sur plusieurs passages s'il le faut
 * (curseur `backfillUntil` dans seo_jobs).
 */
import { must, type SeoDb } from "@/lib/seo/db"
import { gscQuery, type GscApiRow, type GscQueryBody } from "@/lib/seo/google"
import { isDailyDue, parisClock, type SeoJobRow, type SeoTaskContext } from "@/lib/seo/cron"
import { toSitePath } from "@/lib/seo/site"
import type { DateRange } from "@/lib/seo/period"
import { addDays, daysBetween } from "@/lib/utils/paris-date"

/* ------------------------------------------------------------------ */
/* Réglages de la synchronisation                                      */
/* ------------------------------------------------------------------ */

/** Search Console garde 16 mois de données. */
export const HISTORY_MONTHS = 16
/** Taille d'une tranche de reprise (jours). */
export const SLICE_DAYS = 30
/** Jours relus à chaque passage, en partant du dernier jour enregistré. */
export const REFRESH_DAYS = 5
/** Heure du passage quotidien (minutes après minuit, heure de Paris). */
export const DAILY_AFTER_MINUTES = 6 * 60
/** Marge laissée avant la limite du passage (contrat de lib/seo/cron.ts). */
export const DEADLINE_MARGIN_MS = 15_000
/** Après un échec, attente avant un nouvel essai automatique (pas d'erreur en boucle toutes les 15 minutes). */
export const RETRY_AFTER_ERROR_MS = 60 * 60_000
/** Lignes écrites par requête. */
export const UPSERT_BATCH = 500
/** Plafond de lignes lues par requête Search Console. */
export const MAX_ROWS = 200_000

/* ------------------------------------------------------------------ */
/* Curseur de reprise                                                  */
/* ------------------------------------------------------------------ */

export interface GscCursor {
  /** Plus ancien jour déjà repris : la tranche suivante se termine la veille. */
  backfillUntil?: string
  /** Reprise terminée (16 mois atteints). */
  backfillDone?: boolean
  /** Jour (heure de Paris) du dernier rafraîchissement complet. */
  refreshedOn?: string
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

export function parseCursor(raw: unknown): GscCursor {
  const out: GscCursor = {}
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out
  const r = raw as Record<string, unknown>
  if (typeof r.backfillUntil === "string" && ISO_DAY.test(r.backfillUntil)) out.backfillUntil = r.backfillUntil
  if (r.backfillDone === true) out.backfillDone = true
  if (typeof r.refreshedOn === "string" && ISO_DAY.test(r.refreshedOn)) out.refreshedOn = r.refreshedOn
  return out
}

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

/** « 2026-10-09 » moins 16 mois → « 2025-06-09 » (jour ramené à la fin d'un mois plus court). */
export function monthsBefore(day: string, months: number): string {
  const [y, m, d] = day.slice(0, 10).split("-").map(Number)
  const total = y * 12 + (m - 1) - months
  const ny = Math.floor(total / 12)
  const nm = total - ny * 12
  const lastDay = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate()
  return `${ny}-${String(nm + 1).padStart(2, "0")}-${String(Math.min(d, lastDay)).padStart(2, "0")}`
}

/** Tranches de `days` jours de `from` à `to`, de la plus ancienne à la plus récente. */
export function slicesBetween(from: string, to: string, days = SLICE_DAYS): DateRange[] {
  const out: DateRange[] = []
  if (daysBetween(from, to) < 0) return out
  for (let start = from; daysBetween(start, to) >= 0; start = addDays(start, days)) {
    const end = addDays(start, days - 1)
    out.push({ from: start, to: daysBetween(end, to) < 0 ? to : end })
  }
  return out
}

/** Tranche de reprise suivante : les `days` jours avant `until`, sans dépasser `floor` ; null une fois `floor` atteint. */
export function backfillSlice(until: string, floor: string, days = SLICE_DAYS): DateRange | null {
  const to = addDays(until, -1)
  if (daysBetween(floor, to) < 0) return null
  const from = addDays(to, -(days - 1))
  return { from: daysBetween(floor, from) < 0 ? floor : from, to }
}

/** Premier jour relu par le rafraîchissement : les 5 derniers jours enregistrés, ou la dernière semaine au premier passage. */
export function refreshStart(lastStored: string | null, yesterday: string, floor: string): string {
  const start = lastStored ? addDays(lastStored, -(REFRESH_DAYS - 1)) : addDays(yesterday, -6)
  return daysBetween(floor, start) < 0 ? floor : start
}

/* ------------------------------------------------------------------ */
/* Lignes de Search Console → lignes des tables                        */
/* ------------------------------------------------------------------ */

interface Measures {
  clicks: number
  impressions: number
  position: number
}

export type DailyRow = Measures & { date: string; device: string; country: string }
export type PageRow = Measures & { date: string; page: string; device: string; country: string }
export type QueryRow = Measures & { date: string; query: string; device: string; country: string }
export type QueryPageRow = Measures & { date: string; query: string; page: string }

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0)
const device = (v: string | undefined) => (v ?? "").toUpperCase()
const country = (v: string | undefined) => (v ?? "").toLowerCase()

/**
 * Fusionne les lignes de même clé (après normalisation des pages) : clics et
 * impressions additionnés, position pondérée par les impressions. Sans
 * fusion, un même lot d'écriture contiendrait deux fois la même clé et
 * Postgres refuserait l'upsert.
 */
export function mergeRows<T extends Measures>(rows: T[], keyOf: (row: T) => string): T[] {
  const byKey = new Map<string, { row: T; weighted: number }>()
  rows.forEach((row) => {
    const key = keyOf(row)
    const seen = byKey.get(key)
    if (!seen) {
      byKey.set(key, { row: { ...row }, weighted: row.position * row.impressions })
      return
    }
    seen.row.clicks += row.clicks
    seen.row.impressions += row.impressions
    seen.weighted += row.position * row.impressions
  })
  return Array.from(byKey.values()).map(({ row, weighted }) => ({
    ...row,
    position: row.impressions > 0 ? weighted / row.impressions : row.position,
  }))
}

function measures(r: GscApiRow): Measures {
  return { clicks: num(r.clicks), impressions: num(r.impressions), position: num(r.position) }
}

export function toDailyRows(rows: GscApiRow[]): DailyRow[] {
  return mergeRows(
    rows
      .filter((r) => r.keys?.length >= 3)
      .map((r) => ({ date: r.keys[0], device: device(r.keys[1]), country: country(r.keys[2]), ...measures(r) })),
    (r) => `${r.date}|${r.device}|${r.country}`,
  )
}

export function toPageRows(rows: GscApiRow[]): PageRow[] {
  const out: PageRow[] = []
  rows.forEach((r) => {
    if (!r.keys || r.keys.length < 4) return
    const page = toSitePath(r.keys[1])
    if (!page) return
    out.push({ date: r.keys[0], page, device: device(r.keys[2]), country: country(r.keys[3]), ...measures(r) })
  })
  return mergeRows(out, (r) => `${r.date}|${r.page}|${r.device}|${r.country}`)
}

export function toQueryRows(rows: GscApiRow[]): QueryRow[] {
  return mergeRows(
    rows
      .filter((r) => r.keys?.length >= 4 && r.keys[1])
      .map((r) => ({ date: r.keys[0], query: r.keys[1], device: device(r.keys[2]), country: country(r.keys[3]), ...measures(r) })),
    (r) => `${r.date}|${r.query}|${r.device}|${r.country}`,
  )
}

export function toQueryPageRows(rows: GscApiRow[]): QueryPageRow[] {
  const out: QueryPageRow[] = []
  rows.forEach((r) => {
    if (!r.keys || r.keys.length < 3 || !r.keys[1]) return
    const page = toSitePath(r.keys[2])
    if (!page) return
    out.push({ date: r.keys[0], query: r.keys[1], page, ...measures(r) })
  })
  return mergeRows(out, (r) => `${r.date}|${r.query}|${r.page}`)
}

/* ------------------------------------------------------------------ */
/* Écriture d'une plage                                                */
/* ------------------------------------------------------------------ */

export type GscFetcher = (body: GscQueryBody, maxRows?: number) => Promise<GscApiRow[]>

export interface SyncCounts {
  daily: number
  pages: number
  queries: number
  queryPages: number
}

export const ZERO_COUNTS: SyncCounts = { daily: 0, pages: 0, queries: 0, queryPages: 0 }

export function addCounts(a: SyncCounts, b: SyncCounts): SyncCounts {
  return { daily: a.daily + b.daily, pages: a.pages + b.pages, queries: a.queries + b.queries, queryPages: a.queryPages + b.queryPages }
}

const TABLES = {
  daily: { table: "seo_gsc_daily", conflict: "date,device,country" },
  pages: { table: "seo_gsc_pages", conflict: "date,page,device,country" },
  queries: { table: "seo_gsc_queries", conflict: "date,query,device,country" },
  queryPages: { table: "seo_gsc_query_pages", conflict: "date,query,page" },
} as const

async function writeTable(
  db: SeoDb,
  spec: (typeof TABLES)[keyof typeof TABLES],
  range: DateRange,
  rows: object[],
  syncedAt: string,
  complete: boolean,
): Promise<void> {
  for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
    const batch = rows.slice(i, i + UPSERT_BATCH).map((r) => ({ ...r, synced_at: syncedAt }))
    must(await db.from(spec.table).upsert(batch, { onConflict: spec.conflict }), `l'écriture de ${spec.table}`)
  }
  // Lignes de la plage que Search Console ne rend plus (ancienne forme d'URL…) : retirées,
  // sauf si la réponse a été tronquée au plafond de lignes.
  if (complete) {
    must(
      await db.from(spec.table).delete().gte("date", range.from).lte("date", range.to).lt("synced_at", syncedAt),
      `le nettoyage de ${spec.table}`,
    )
  }
}

/** Synchronise une plage de dates (quatre requêtes, quatre tables). */
export async function syncRange(db: SeoDb, range: DateRange, fetcher: GscFetcher = gscQuery, now = new Date()): Promise<SyncCounts> {
  const base = { startDate: range.from, endDate: range.to }
  const [daily, pages, queries, queryPages] = await Promise.all([
    fetcher({ ...base, dimensions: ["date", "device", "country"] }, MAX_ROWS),
    fetcher({ ...base, dimensions: ["date", "page", "device", "country"] }, MAX_ROWS),
    fetcher({ ...base, dimensions: ["date", "query", "device", "country"] }, MAX_ROWS),
    fetcher({ ...base, dimensions: ["date", "query", "page"] }, MAX_ROWS),
  ])
  const syncedAt = now.toISOString()
  const dailyRows = toDailyRows(daily)
  const pageRows = toPageRows(pages)
  const queryRows = toQueryRows(queries)
  const queryPageRows = toQueryPageRows(queryPages)
  await writeTable(db, TABLES.pages, range, pageRows, syncedAt, pages.length < MAX_ROWS)
  await writeTable(db, TABLES.queries, range, queryRows, syncedAt, queries.length < MAX_ROWS)
  await writeTable(db, TABLES.queryPages, range, queryPageRows, syncedAt, queryPages.length < MAX_ROWS)
  // En dernier : seo_gsc_daily sert de marqueur d'avancement (refreshStart lit son dernier jour).
  // Une écriture en échec plus haut laisse le marqueur en arrière, et la plage est relue en entier.
  await writeTable(db, TABLES.daily, range, dailyRows, syncedAt, daily.length < MAX_ROWS)
  return { daily: dailyRows.length, pages: pageRows.length, queries: queryRows.length, queryPages: queryPageRows.length }
}

/** Dernier jour enregistré (null : aucune donnée). */
export async function lastStoredDay(db: SeoDb): Promise<string | null> {
  const data = must(await db.rpc("seo_gsc_bounds"), "les bornes de Search Console") as unknown
  const row = (Array.isArray(data) ? data[0] : data) as { last_date?: string | null } | null | undefined
  return row?.last_date ? String(row.last_date).slice(0, 10) : null
}

/* ------------------------------------------------------------------ */
/* Échéance et passage                                                 */
/* ------------------------------------------------------------------ */

/**
 * Vrai si la synchronisation doit tourner : reprise de l'historique en cours
 * (à chaque passage du cron), sinon une fois par jour après 06:00 (Paris).
 * Jamais sans compte de service ; une heure d'attente après un échec.
 */
export function searchConsoleDue(job: SeoJobRow | null, now: Date, configured: boolean): boolean {
  if (!configured) return false
  if (job?.status === "error" && job.finished_at && now.getTime() - Date.parse(job.finished_at) < RETRY_AFTER_ERROR_MS) return false
  const cursor = parseCursor(job?.cursor)
  if (!cursor.backfillDone) return true
  const clock = parisClock(now)
  if (clock.minutes < DAILY_AFTER_MINUTES) return false
  return cursor.refreshedOn !== clock.day || isDailyDue(job, now, DAILY_AFTER_MINUTES)
}

/** Estime si une tranche de plus tient avant la limite (durée de la précédente, marge de 15 s). */
class Budget {
  private lastMs = 5_000
  constructor(private readonly deadline: number) {}
  canStart(): boolean {
    return Date.now() + this.lastMs + DEADLINE_MARGIN_MS < this.deadline
  }
  track(startedAt: number) {
    this.lastMs = Math.max(2_000, Math.round((Date.now() - startedAt) * 1.2))
  }
}

export interface SyncRunResult extends Record<string, unknown> {
  skipped?: "not_configured"
  refreshed?: { from: string; to: string; complete: boolean }
  backfill?: { until: string | null; done: boolean; slices: number }
  rows?: SyncCounts
}

/**
 * Un passage : rafraîchissement des derniers jours (une fois par jour, ou à
 * chaque lancement manuel), puis reprise de l'historique jusqu'à la limite.
 */
export async function runSearchConsoleSync(
  ctx: SeoTaskContext,
  deps: { configured: boolean; fetcher?: GscFetcher },
): Promise<SyncRunResult> {
  if (!deps.configured) return { skipped: "not_configured" }
  const fetcher = deps.fetcher ?? gscQuery
  const clock = parisClock(ctx.now)
  const today = clock.day
  const yesterday = addDays(today, -1)
  const floor = monthsBefore(today, HISTORY_MONTHS)
  const cursor = parseCursor(ctx.job?.cursor)
  const budget = new Budget(ctx.deadline)
  let rows = { ...ZERO_COUNTS }
  const out: SyncRunResult = {}

  // 1. Rafraîchissement : les données récentes évoluent encore
  const wantRefresh =
    ctx.trigger === "manual" || (cursor.refreshedOn !== today && (!cursor.refreshedOn || clock.minutes >= DAILY_AFTER_MINUTES))
  if (wantRefresh) {
    const from = refreshStart(await lastStoredDay(ctx.db), yesterday, floor)
    let complete = true
    // Plus ancienne d'abord : un passage interrompu reprend où il s'est arrêté (dernier jour enregistré)
    for (const slice of slicesBetween(from, yesterday)) {
      if (!budget.canStart()) {
        complete = false
        break
      }
      const started = Date.now()
      rows = addCounts(rows, await syncRange(ctx.db, slice, fetcher, ctx.now))
      budget.track(started)
    }
    out.refreshed = { from, to: yesterday, complete }
    if (complete) {
      cursor.refreshedOn = today
      // Premier passage : la reprise démarre la veille du premier jour relu
      if (!cursor.backfillUntil) cursor.backfillUntil = from
      await ctx.saveCursor({ ...cursor })
    }
  }

  // 2. Reprise de l'historique, de la tranche la plus récente à la plus ancienne
  let slices = 0
  if (!cursor.backfillDone && cursor.backfillUntil) {
    for (;;) {
      const slice = backfillSlice(cursor.backfillUntil, floor)
      if (!slice) {
        cursor.backfillDone = true
        await ctx.saveCursor({ ...cursor })
        break
      }
      if (!budget.canStart()) break
      const started = Date.now()
      rows = addCounts(rows, await syncRange(ctx.db, slice, fetcher, ctx.now))
      budget.track(started)
      slices++
      cursor.backfillUntil = slice.from
      if (slice.from === floor) cursor.backfillDone = true
      await ctx.saveCursor({ ...cursor })
      if (cursor.backfillDone) break
    }
  }
  out.backfill = { until: cursor.backfillUntil ?? null, done: cursor.backfillDone === true, slices }
  out.rows = rows
  return out
}
