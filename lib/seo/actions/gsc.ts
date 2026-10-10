/**
 * Lectures de Search Console pour les Actions SEO : bornes des données,
 * mesures par page et requêtes par page, sur une période (fonctions SQL
 * seo_gsc_* de la migration 20261009_seo_admin.sql, clé service_role).
 *
 * Les chemins sont normalisés (toSitePath) et fusionnés : « /modele/ » et
 * « /modele » font une seule page, position pondérée par les impressions.
 */
import { must, type SeoDb } from "@/lib/seo/db"
import { toSitePath } from "@/lib/seo/site"
import type { PageStat, QueryStat } from "@/lib/seo/actions/rules"

export interface GscBounds {
  first: string | null
  last: string | null
}

export async function readGscBounds(db: SeoDb): Promise<GscBounds> {
  const rows = must(await db.rpc("seo_gsc_bounds"), "les bornes de Search Console") as { first_date: string | null; last_date: string | null }[] | null
  const row = Array.isArray(rows) ? rows[0] : (rows as { first_date: string | null; last_date: string | null } | null)
  return { first: row?.first_date ?? null, last: row?.last_date ?? null }
}

type AggRow = { clicks: number | string; impressions: number | string; avg_position: number | null }

/** Lignes d'une fonction SQL, par tranches de 1 000 (limite de PostgREST). */
async function rpcAll<T>(db: SeoDb, fn: string, args: Record<string, unknown>, what: string): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; from < 50_000; from += 1000) {
    const rows = must(await db.rpc(fn, args).range(from, from + 999), what) as T[] | null
    const list = rows ?? []
    list.forEach((r) => out.push(r))
    if (list.length < 1000) break
  }
  return out
}

function merge(target: Map<string, PageStat>, key: string, row: AggRow) {
  const clicks = Number(row.clicks) || 0
  const impressions = Number(row.impressions) || 0
  const position = row.avg_position === null || row.avg_position === undefined ? null : Number(row.avg_position)
  const prev = target.get(key)
  if (!prev) {
    target.set(key, { clicks, impressions, position })
    return
  }
  const total = prev.impressions + impressions
  const weighted =
    prev.position === null ? position : position === null ? prev.position : total > 0 ? (prev.position * prev.impressions + position * impressions) / total : prev.position
  target.set(key, { clicks: prev.clicks + clicks, impressions: total, position: weighted })
}

/** Mesures par page sur une période (tous appareils, tous pays). */
export async function readPageStats(db: SeoDb, from: string, to: string): Promise<Record<string, PageStat>> {
  const rows = await rpcAll<AggRow & { page: string }>(
    db,
    "seo_gsc_by_page",
    { p_from: from, p_to: to, p_device: null, p_country: null },
    "les pages de Search Console",
  )
  const map = new Map<string, PageStat>()
  rows.forEach((r) => {
    const path = toSitePath(r.page)
    if (path) merge(map, path, r)
  })
  const out: Record<string, PageStat> = {}
  map.forEach((v, k) => {
    out[k] = v
  })
  return out
}

/**
 * Requêtes de chaque page sur une période, les plus vues d'abord. La fonction
 * SQL trie sur un ordre unique (requête, impressions, page : section 12 de la
 * migration) pour que les tranches ne se chevauchent pas ; une même requête sur
 * deux adresses d'une même page (« /modele/ » et « /modele ») est fusionnée.
 */
export async function readQueriesByPage(db: SeoDb, from: string, to: string): Promise<Record<string, QueryStat[]>> {
  const rows = await rpcAll<AggRow & { query: string; page: string }>(
    db,
    "seo_gsc_query_pages_agg",
    { p_from: from, p_to: to },
    "les requêtes de Search Console",
  )
  const byPage = new Map<string, Map<string, PageStat>>()
  rows.forEach((r) => {
    const path = toSitePath(r.page)
    if (!path || !r.query) return
    let queries = byPage.get(path)
    if (!queries) {
      queries = new Map<string, PageStat>()
      byPage.set(path, queries)
    }
    merge(queries, r.query, r)
  })
  const out: Record<string, QueryStat[]> = {}
  byPage.forEach((queries, path) => {
    const list: QueryStat[] = []
    queries.forEach((stat, query) => list.push({ query, ...stat }))
    out[path] = list.sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks || a.query.localeCompare(b.query))
  })
  return out
}

/** Totaux du site sur une période (carte « Vos statistiques »). */
export async function readTotals(db: SeoDb, from: string, to: string): Promise<{ clicks: number; impressions: number; position: number | null }> {
  const rows = must(
    await db.rpc("seo_gsc_totals", { p_from: from, p_to: to, p_device: null, p_country: null }),
    "les totaux de Search Console",
  ) as AggRow[] | null
  const row = Array.isArray(rows) ? rows[0] : (rows as AggRow | null)
  return {
    clicks: Number(row?.clicks ?? 0) || 0,
    impressions: Number(row?.impressions ?? 0) || 0,
    position: row?.avg_position === null || row?.avg_position === undefined ? null : Number(row.avg_position),
  }
}
