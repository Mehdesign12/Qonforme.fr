/**
 * Search Console pour une seule page du site (fenêtre d'un article du
 * calendrier, éditeur d'articles) : totaux, courbe jour par jour et requêtes
 * qui l'affichent, sur une plage de jours (AAAA-MM-JJ).
 *
 * Les pages sont enregistrées en chemin du site (toSitePath, lib/seo/site.ts) ;
 * « /blog/x » et « /blog/x/ » sont lus ensemble.
 *
 * Lectures par la clé service_role (tables et fonctions seo_gsc_* de la
 * migration 20261009_seo_admin.sql) ; une erreur lève SeoDbError (must).
 */
import { must, type SeoDb } from "@/lib/seo/db"
import { pgrstInList } from "@/lib/seo/keywords/data"
import { canonicalKeyword } from "@/lib/seo/keywords/normalize"
import { daysOf, type DateRange } from "@/lib/seo/period"
import type { GscTotalsLite, PageQuery } from "@/lib/seo/articles/editor-types"

/** Chemin et sa variante avec ou sans barre finale. */
export function pathVariants(path: string): string[] {
  const clean = path.trim()
  if (!clean || clean === "/") return ["/"]
  const base = clean.replace(/\/+$/, "")
  return [base, `${base}/`]
}

type AggRow = { clicks: number | string; impressions: number | string; avg_position: number | string | null }

/** Totaux d'une ou plusieurs lignes agrégées (position pondérée par les impressions). */
export function totalsOf(rows: AggRow[]): GscTotalsLite {
  let clicks = 0
  let impressions = 0
  let weighted = 0
  let weight = 0
  rows.forEach((r) => {
    const c = Number(r.clicks) || 0
    const i = Number(r.impressions) || 0
    clicks += c
    impressions += i
    const p = r.avg_position === null || r.avg_position === undefined ? NaN : Number(r.avg_position)
    if (Number.isFinite(p) && i > 0) {
      weighted += p * i
      weight += i
    }
  })
  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : null,
    position: weight > 0 ? Math.round((weighted / weight) * 10) / 10 : null,
  }
}

/**
 * Totaux d'une page : lignes de la page lues directement (index page + date
 * de seo_gsc_pages), sommées ici. La fonction seo_gsc_by_page agrégerait
 * toutes les pages de la plage (jusqu'à 16 mois depuis la publication) avant
 * le filtre sur la page : Postgres ne peut pas y faire descendre le filtre.
 */
export async function readPageTotals(db: SeoDb, path: string, range: DateRange): Promise<GscTotalsLite> {
  const rows: AggRow[] = []
  for (let from = 0; from < 50_000; from += 1000) {
    const page = must(
      await db
        .from("seo_gsc_pages")
        .select("clicks, impressions, position")
        .filter("page", "in", pgrstInList(pathVariants(path)))
        .gte("date", range.from)
        .lte("date", range.to)
        // Ordre unique (lu par tranches de 1 000 lignes) : la clé primaire
        .order("date", { ascending: true })
        .order("page", { ascending: true })
        .order("device", { ascending: true })
        .order("country", { ascending: true })
        .range(from, from + 999),
      "les mesures de la page",
    ) as { clicks: number; impressions: number; position: number }[] | null
    const list = page ?? []
    // Position de la ligne pondérée par ses impressions, comme seo_gsc_by_page
    list.forEach((r) => rows.push({ clicks: r.clicks, impressions: r.impressions, avg_position: r.position }))
    if (list.length < 1000) break
  }
  return totalsOf(rows)
}

/** Courbe jour par jour (un jour sans ligne vaut 0), tous appareils et pays confondus. */
export function buildSeries(days: string[], rows: { date: string; clicks: number | string; impressions: number | string }[]): { day: string; clicks: number; impressions: number }[] {
  const byDay = new Map<string, { clicks: number; impressions: number }>()
  rows.forEach((r) => {
    const day = String(r.date).slice(0, 10)
    const cur = byDay.get(day) ?? { clicks: 0, impressions: 0 }
    cur.clicks += Number(r.clicks) || 0
    cur.impressions += Number(r.impressions) || 0
    byDay.set(day, cur)
  })
  return days.map((day) => ({ day, ...(byDay.get(day) ?? { clicks: 0, impressions: 0 }) }))
}

export async function readPageSeries(db: SeoDb, path: string, range: DateRange): Promise<{ day: string; clicks: number; impressions: number }[]> {
  const rows: { date: string; clicks: number; impressions: number }[] = []
  for (let from = 0; from < 20_000; from += 1000) {
    const page = must(
      await db
        .from("seo_gsc_pages")
        .select("date, clicks, impressions")
        .filter("page", "in", pgrstInList(pathVariants(path)))
        .gte("date", range.from)
        .lte("date", range.to)
        .order("date", { ascending: true })
        .order("device", { ascending: true })
        .order("country", { ascending: true })
        .range(from, from + 999),
      "la courbe de la page",
    ) as { date: string; clicks: number; impressions: number }[] | null
    const list = page ?? []
    list.forEach((r) => rows.push(r))
    if (list.length < 1000) break
  }
  return buildSeries(daysOf(range), rows)
}

/** Requêtes qui affichent la page (fusionnées à la forme canonique), les plus vues d'abord. */
export function mergeQueries(rows: (AggRow & { query: string })[], limit: number): PageQuery[] {
  const acc = new Map<string, { clicks: number; impressions: number; weighted: number; weight: number }>()
  rows.forEach((r) => {
    const q = canonicalKeyword(String(r.query ?? ""))
    if (!q) return
    const cur = acc.get(q) ?? { clicks: 0, impressions: 0, weighted: 0, weight: 0 }
    const i = Number(r.impressions) || 0
    cur.clicks += Number(r.clicks) || 0
    cur.impressions += i
    const p = r.avg_position === null || r.avg_position === undefined ? NaN : Number(r.avg_position)
    if (Number.isFinite(p) && i > 0) {
      cur.weighted += p * i
      cur.weight += i
    }
    acc.set(q, cur)
  })
  return Array.from(acc.entries())
    .map(([query, v]) => ({ query, clicks: v.clicks, impressions: v.impressions, position: v.weight > 0 ? Math.round((v.weighted / v.weight) * 10) / 10 : null }))
    .sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks || a.query.localeCompare(b.query, "fr"))
    .slice(0, limit)
}

export async function readPageQueries(db: SeoDb, path: string, range: DateRange, limit = 10): Promise<PageQuery[]> {
  const rows: (AggRow & { query: string })[] = []
  for (let from = 0; from < 10_000; from += 1000) {
    const page = must(
      await db
        .rpc("seo_gsc_query_pages_agg", { p_from: range.from, p_to: range.to })
        .filter("page", "in", pgrstInList(pathVariants(path)))
        .range(from, from + 999),
      "les requêtes de la page",
    ) as (AggRow & { query: string })[] | null
    const list = page ?? []
    list.forEach((r) => rows.push(r))
    if (list.length < 1000) break
  }
  return mergeQueries(rows, limit)
}
