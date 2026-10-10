/**
 * Exploration du plan du site par paquets (Performance › Audit du site).
 *
 * Une exploration = une ligne de seo_crawl_runs. Son curseur (colonne
 * `cursor`) garde la liste des pages du plan du site et l'avancement, pour
 * reprendre au passage suivant : bouton « Ré-analyser le site » puis appels
 * successifs tant que la page est ouverte, ou tâche planifiée (lib/seo/audit/task.ts).
 *
 * Trois phases : pages du plan du site (paquets de 8, 4 à la fois) → liens
 * internes hors du plan du site (150 au plus) → synthèse. Chaque requête ne
 * vise que qonforme.fr (lib/seo/audit/fetcher.ts).
 */
import { must, type SeoDb } from "@/lib/seo/db"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import { addDays, parisDayOf } from "@/lib/utils/paris-date"
import { parisClock } from "@/lib/seo/cron"
import { toSitePath } from "@/lib/seo/site"
import { fetchSitePath, isHtml, mapPool, PAGE_TIMEOUT_MS, type FetchLike } from "@/lib/seo/audit/fetcher"
import { isNoindex, parseHtml } from "@/lib/seo/audit/html"
import { readSitemapPaths, SitemapError } from "@/lib/seo/audit/sitemap"
import {
  buildCrawlSummary,
  isGeoPage,
  pageIssues,
  type CrawlPageRow,
  type CrawlSummary,
  type LinkResult,
  type SitemapFreshness,
} from "@/lib/seo/audit/checks"

export const CRAWL_BATCH = 8
export const CRAWL_CONCURRENCY = 4
export const MAX_OUTSIDE_LINKS = 150
/** Une exploration qui n'avance plus depuis 24 h est abandonnée. */
export const STALE_RUN_MS = 24 * 60 * 60_000
/** Temps minimal pour lancer un paquet. */
const MIN_STEP_MS = 3_000
/** Explorations gardées (les pages des plus anciennes sont supprimées avec elles). */
const KEEP_RUNS = 8
/** Le plan du site est recalculé toutes les heures (app/sitemap.ts) : un article plus récent n'est pas signalé. */
const FRESHNESS_GRACE_MS = 2 * 60 * 60_000

export type CrawlStatus = "running" | "done" | "failed"

export interface CrawlRunRow {
  id: string
  status: CrawlStatus
  trigger: "cron" | "manual"
  started_at: string
  finished_at: string | null
  pages_total: number
  pages_done: number
  cursor?: unknown
  summary: unknown
  error: string | null
}

export interface CrawlCursor {
  phase: "pages" | "links" | "finish"
  /** Pages du plan du site. */
  paths: string[]
  /** Prochaine page à explorer. */
  next: number
  /** Heure de lecture du plan du site. */
  sitemapReadAt: string
  links?: { targets: string[]; next: number; total: number; results: Record<string, LinkResult> }
}

export interface CrawlProgress {
  id: string
  status: CrawlStatus
  phase: CrawlCursor["phase"] | null
  pagesDone: number
  pagesTotal: number
  error: string | null
}

const RUN_COLUMNS = "id, status, trigger, started_at, finished_at, pages_total, pages_done, summary, error"
const PAGE_COLUMNS = "run_id, path, status_code, redirect_to, title, description, h1_count, h1, canonical, robots, noindex, internal_links, word_count, issues, error"

export function readCursor(value: unknown): CrawlCursor | null {
  if (!value || typeof value !== "object") return null
  const c = value as Partial<CrawlCursor>
  if (!Array.isArray(c.paths) || typeof c.next !== "number" || !c.phase) return null
  return c as CrawlCursor
}

export function progressOf(run: CrawlRunRow): CrawlProgress {
  const cursor = readCursor(run.cursor)
  return {
    id: run.id,
    status: run.status,
    phase: run.status === "running" ? cursor?.phase ?? null : null,
    pagesDone: run.pages_done,
    pagesTotal: run.pages_total,
    error: run.error,
  }
}

/* ------------------------------------------------------------------ */
/* Lectures                                                            */
/* ------------------------------------------------------------------ */

/** Dernières explorations, la plus récente d'abord (sans le curseur). */
export async function listRuns(db: SeoDb, limit = 10): Promise<CrawlRunRow[]> {
  return must(
    await db.from("seo_crawl_runs").select(RUN_COLUMNS).order("started_at", { ascending: false }).limit(limit),
    "les explorations du site",
  ) as CrawlRunRow[]
}

/** Exploration en cours (avec son curseur), s'il y en a une. */
export async function findRunningRun(db: SeoDb): Promise<CrawlRunRow | null> {
  const rows = must(
    await db.from("seo_crawl_runs").select(`${RUN_COLUMNS}, cursor`).eq("status", "running").order("started_at", { ascending: false }).limit(1),
    "l'exploration en cours",
  ) as CrawlRunRow[]
  return rows[0] ?? null
}

/** Dernière exploration terminée. */
export async function latestDoneRun(db: SeoDb): Promise<CrawlRunRow | null> {
  const rows = must(
    await db.from("seo_crawl_runs").select(RUN_COLUMNS).eq("status", "done").order("finished_at", { ascending: false }).limit(1),
    "la dernière exploration",
  ) as CrawlRunRow[]
  return rows[0] ?? null
}

export async function getRun(db: SeoDb, id: string): Promise<CrawlRunRow | null> {
  return must(await db.from("seo_crawl_runs").select(`${RUN_COLUMNS}, cursor`).eq("id", id).maybeSingle(), "l'exploration") as CrawlRunRow | null
}

/** Pages enregistrées d'une exploration, par tranches de 1 000. */
export async function readCrawlPages(db: SeoDb, runId: string, columns = PAGE_COLUMNS): Promise<CrawlPageRow[]> {
  const out: CrawlPageRow[] = []
  for (let from = 0; from < 20_000; from += 1000) {
    const rows = must(
      await db.from("seo_crawl_pages").select(columns).eq("run_id", runId).order("path").range(from, from + 999),
      "les pages explorées",
    ) as unknown as CrawlPageRow[]
    rows.forEach((r) => out.push({ ...r, internal_links: r.internal_links ?? [], issues: r.issues ?? [] }))
    if (rows.length < 1000) break
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Échéance de la tâche planifiée                                      */
/* ------------------------------------------------------------------ */

/**
 * Vrai si une exploration est en cours (à poursuivre), ou si aucune n'a fini
 * cette semaine (heure de Paris), à partir du lundi 03:00. Une tentative de
 * moins d'une heure (échec compris) n'est pas relancée tout de suite.
 */
export function isCrawlDue(runs: Pick<CrawlRunRow, "status" | "started_at" | "finished_at">[], now: Date): boolean {
  if (runs.some((r) => r.status === "running")) return true
  const clock = parisClock(now)
  if (clock.weekday === 1 && clock.minutes < 3 * 60) return false
  const monday = addDays(clock.day, -(clock.weekday - 1))
  const doneThisWeek = runs.some((r) => r.status === "done" && r.finished_at && parisDayOf(r.finished_at) >= monday)
  if (doneThisWeek) return false
  return !runs.some((r) => Date.parse(r.started_at) > now.getTime() - 60 * 60_000)
}

export function isStale(run: Pick<CrawlRunRow, "status" | "started_at">, now: Date): boolean {
  return run.status === "running" && Date.parse(run.started_at) < now.getTime() - STALE_RUN_MS
}

/* ------------------------------------------------------------------ */
/* Démarrage                                                           */
/* ------------------------------------------------------------------ */

/**
 * Crée une exploration à partir du plan du site. Plan illisible : l'exploration
 * est enregistrée en échec, avec la raison (l'écran l'affiche).
 */
export async function startCrawl(
  db: SeoDb,
  opts: { trigger: "cron" | "manual"; now?: Date; fetchImpl?: FetchLike },
): Promise<CrawlRunRow> {
  const startedAt = (opts.now ?? new Date()).toISOString()
  let paths: string[]
  try {
    paths = await readSitemapPaths(opts.fetchImpl)
  } catch (error) {
    const message = error instanceof SitemapError ? error.message : "Plan du site illisible."
    if (!(error instanceof SitemapError)) console.error("[seo-audit] lecture du plan du site", error)
    return must(
      await db
        .from("seo_crawl_runs")
        .insert({ status: "failed", trigger: opts.trigger, started_at: startedAt, finished_at: startedAt, pages_total: 0, pages_done: 0, error: message })
        .select(`${RUN_COLUMNS}, cursor`)
        .single(),
      "l'enregistrement de l'exploration",
    ) as CrawlRunRow
  }
  const cursor: CrawlCursor = { phase: "pages", paths, next: 0, sitemapReadAt: startedAt }
  return must(
    await db
      .from("seo_crawl_runs")
      .insert({ status: "running", trigger: opts.trigger, started_at: startedAt, pages_total: paths.length, pages_done: 0, cursor })
      .select(`${RUN_COLUMNS}, cursor`)
      .single(),
    "l'enregistrement de l'exploration",
  ) as CrawlRunRow
}

export async function failRun(db: SeoDb, id: string, error: string): Promise<void> {
  must(
    await db
      .from("seo_crawl_runs")
      .update({ status: "failed", finished_at: new Date().toISOString(), error: error.slice(0, 500), cursor: {} })
      .eq("id", id)
      .eq("status", "running"),
    "l'exploration",
  )
}

/* ------------------------------------------------------------------ */
/* Avancement                                                          */
/* ------------------------------------------------------------------ */

const clip = (s: string | null, max: number) => (s && s.length > max ? s.slice(0, max) : s)

/** Explore une page du plan du site et prépare sa ligne de seo_crawl_pages. */
export async function crawlPage(runId: string, path: string, opts: { timeoutMs: number; fetchImpl?: FetchLike }): Promise<CrawlPageRow> {
  const res = await fetchSitePath(path, { readBody: true, timeoutMs: opts.timeoutMs, fetchImpl: opts.fetchImpl })
  const html = res.status === 200 && isHtml(res.contentType)
  const parsed = html && res.body !== null ? parseHtml(res.body, res.path, { xRobotsTag: res.xRobotsTag }) : null
  const issues = pageIssues({ path: res.path, status: res.status, error: res.error, html, parsed })
  return {
    run_id: runId,
    path: res.path,
    status_code: res.status,
    redirect_to: res.redirectTo,
    title: clip(parsed?.title ?? null, 500),
    description: clip(parsed?.description ?? null, 1000),
    h1_count: parsed ? parsed.h1Count : null,
    h1: parsed?.h1 ?? null,
    canonical: clip(parsed?.canonical ?? null, 500),
    robots: clip(parsed?.robots ?? (isNoindex(res.xRobotsTag) ? res.xRobotsTag : null), 300),
    noindex: parsed?.noindex ?? isNoindex(res.xRobotsTag),
    internal_links: parsed?.internalLinks.slice(0, 1000) ?? [],
    word_count: parsed ? parsed.wordCount : null,
    issues,
    fetched_at: new Date().toISOString(),
    error: res.error,
  }
}

/**
 * Statut d'un lien interne hors du plan du site : HEAD, puis GET si HEAD est
 * refusé (405, 501). Une page métier × ville est lue (GET) pour vérifier son noindex.
 */
export async function checkLink(path: string, opts: { timeoutMs: number; fetchImpl?: FetchLike }): Promise<LinkResult> {
  if (isGeoPage(path)) {
    const res = await fetchSitePath(path, { readBody: true, timeoutMs: opts.timeoutMs, fetchImpl: opts.fetchImpl })
    const noindex = res.body !== null && res.status === 200 ? parseHtml(res.body, res.path, { xRobotsTag: res.xRobotsTag }).noindex : isNoindex(res.xRobotsTag)
    return { status: res.status, redirectTo: res.redirectTo, noindex, error: res.error }
  }
  let res = await fetchSitePath(path, { method: "HEAD", timeoutMs: opts.timeoutMs, fetchImpl: opts.fetchImpl })
  if (res.status === 405 || res.status === 501) {
    res = await fetchSitePath(path, { method: "GET", timeoutMs: opts.timeoutMs, fetchImpl: opts.fetchImpl })
  }
  return { status: res.status, redirectTo: res.redirectTo, error: res.error }
}

async function saveProgress(db: SeoDb, id: string, cursor: CrawlCursor): Promise<void> {
  must(
    await db
      .from("seo_crawl_runs")
      .update({ pages_done: Math.min(cursor.next, cursor.paths.length), cursor })
      .eq("id", id)
      .eq("status", "running"),
    "l'avancement de l'exploration",
  )
}

/** Liens internes trouvés hors du plan du site, les plus liés d'abord (150 au plus). */
export function outsideTargets(rows: Pick<CrawlPageRow, "internal_links">[], sitemapPaths: string[]): { targets: string[]; total: number } {
  const inSitemap = new Set(sitemapPaths)
  const counts = new Map<string, number>()
  rows.forEach((r) => {
    ;(r.internal_links ?? []).forEach((t) => {
      if (!inSitemap.has(t)) counts.set(t, (counts.get(t) ?? 0) + 1)
    })
  })
  const all = Array.from(counts.keys()).sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.localeCompare(b))
  return { targets: all.slice(0, MAX_OUTSIDE_LINKS), total: all.length }
}

/**
 * Fait avancer une exploration jusqu'à `stopAt` (ms) : paquets de pages, puis
 * liens, puis synthèse. Rend la main avant `stopAt` ; chaque requête a un
 * délai ramené au temps restant (15 s au plus).
 */
export async function advanceCrawl(
  db: SeoDb,
  run: CrawlRunRow,
  opts: { stopAt: number; fetchImpl?: FetchLike; now?: () => Date },
): Promise<CrawlProgress> {
  const progress = (cursor: CrawlCursor | null, status: CrawlStatus, error: string | null = null): CrawlProgress => ({
    id: run.id,
    status,
    phase: status === "running" ? cursor?.phase ?? null : null,
    pagesDone: cursor ? Math.min(cursor.next, cursor.paths.length) : run.pages_done,
    pagesTotal: cursor ? cursor.paths.length : run.pages_total,
    error,
  })

  let cursor: CrawlCursor | null = readCursor(run.cursor)
  if (!cursor) {
    const message = "Exploration illisible : relancez l'analyse du site."
    await failRun(db, run.id, message)
    return progress(null, "failed", message)
  }
  const remaining = () => opts.stopAt - Date.now()
  const timeout = () => Math.max(1000, Math.min(PAGE_TIMEOUT_MS, remaining()))

  while (remaining() > MIN_STEP_MS) {
    if (cursor.phase === "pages") {
      if (cursor.next >= cursor.paths.length) {
        const rows = await readCrawlPages(db, run.id, "path, internal_links")
        const { targets, total } = outsideTargets(rows, cursor.paths)
        cursor = { ...cursor, phase: "links", links: { targets, next: 0, total, results: {} } }
        await saveProgress(db, run.id, cursor)
        continue
      }
      const batch = cursor.paths.slice(cursor.next, cursor.next + CRAWL_BATCH)
      const rows = await mapPool(batch, CRAWL_CONCURRENCY, (path) => crawlPage(run.id, path, { timeoutMs: timeout(), fetchImpl: opts.fetchImpl }))
      // Un même chemin ne peut apparaître qu'une fois par paquet (le plan du site est dédoublonné).
      must(await db.from("seo_crawl_pages").upsert(rows, { onConflict: "run_id,path" }), "les pages explorées")
      cursor = { ...cursor, next: cursor.next + batch.length }
      await saveProgress(db, run.id, cursor)
    } else if (cursor.phase === "links") {
      const links: NonNullable<CrawlCursor["links"]> = cursor.links ?? { targets: [], next: 0, total: 0, results: {} }
      if (links.next >= links.targets.length) {
        cursor = { ...cursor, phase: "finish", links }
        await saveProgress(db, run.id, cursor)
        continue
      }
      const batch: string[] = links.targets.slice(links.next, links.next + CRAWL_BATCH)
      const results = await mapPool(batch, CRAWL_CONCURRENCY, (path) => checkLink(path, { timeoutMs: timeout(), fetchImpl: opts.fetchImpl }))
      const merged: Record<string, LinkResult> = { ...links.results }
      batch.forEach((p, i) => {
        merged[p] = results[i]
      })
      cursor = { ...cursor, links: { ...links, next: links.next + batch.length, results: merged } }
      await saveProgress(db, run.id, cursor)
    } else {
      await finishCrawl(db, run.id, cursor, (opts.now ?? (() => new Date()))())
      return progress(cursor, "done")
    }
  }
  return progress(cursor, "running")
}

/* ------------------------------------------------------------------ */
/* Fin                                                                 */
/* ------------------------------------------------------------------ */

/**
 * Les 5 derniers articles publiés figurent-ils dans le plan du site lu au
 * début de l'exploration ? Un article en noindex (choix de l'éditeur) n'y a
 * pas sa place ; un article publié depuis moins de 2 h n'est pas signalé.
 */
export async function sitemapFreshness(db: SeoDb, sitemapPaths: string[], readAt: string): Promise<SitemapFreshness> {
  type Post = { slug: string; title: string | null; published_at: string | null; robots?: unknown }
  const query = (columns: string) =>
    db.from("blog_posts").select(columns).eq("is_published", true).order("published_at", { ascending: false, nullsFirst: false }).limit(5)

  let res = await query("slug, title, published_at, robots")
  if (res.error && isMissingSchemaError(res.error)) res = await query("slug, title, published_at")
  if (res.error) {
    console.error("[seo-audit] lecture des articles", res.error.message)
    return { checked: 0, missing: [], error: "Lecture des articles impossible" }
  }
  const posts = ((res.data ?? []) as unknown as Post[]).filter((p) => {
    const robots = p.robots as { index?: unknown } | null | undefined
    return !(robots && (robots.index === false || robots.index === "false"))
  })
  const inSitemap = new Set(sitemapPaths)
  const limit = Date.parse(readAt) - FRESHNESS_GRACE_MS
  const missing = posts
    .map((p) => ({ path: toSitePath(`/blog/${p.slug}`) ?? `/blog/${p.slug}`, title: p.title, publishedAt: p.published_at }))
    .filter((p) => !inSitemap.has(p.path) && p.publishedAt !== null && Date.parse(p.publishedAt) < limit)
  return { checked: posts.length, missing, error: null }
}

async function finishCrawl(db: SeoDb, runId: string, cursor: CrawlCursor, now: Date): Promise<CrawlSummary> {
  const rows = await readCrawlPages(db, runId, "path, status_code, redirect_to, noindex, internal_links, issues, error")
  const freshness = await sitemapFreshness(db, cursor.paths, cursor.sitemapReadAt)
  const summary = buildCrawlSummary({
    pages: rows,
    sitemapPaths: cursor.paths,
    outsideResults: cursor.links?.results ?? {},
    outsideTotal: cursor.links?.total ?? 0,
    freshness,
  })
  must(
    await db
      .from("seo_crawl_runs")
      .update({ status: "done", finished_at: now.toISOString(), pages_done: rows.length, summary, cursor: {} })
      .eq("id", runId)
      .eq("status", "running"),
    "la fin de l'exploration",
  )
  await pruneRuns(db)
  return summary
}

/** Garde les dernières explorations ; les pages des plus anciennes partent avec elles (ON DELETE CASCADE). */
async function pruneRuns(db: SeoDb): Promise<void> {
  try {
    const old = must(
      await db.from("seo_crawl_runs").select("id").in("status", ["done", "failed"]).order("started_at", { ascending: false }).range(KEEP_RUNS, KEEP_RUNS + 99),
      "les anciennes explorations",
    ) as { id: string }[]
    if (old.length > 0) must(await db.from("seo_crawl_runs").delete().in("id", old.map((r) => r.id)), "les anciennes explorations")
  } catch (error) {
    console.error("[seo-audit] nettoyage des anciennes explorations", error)
  }
}
