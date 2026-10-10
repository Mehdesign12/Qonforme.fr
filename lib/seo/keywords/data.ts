/**
 * Lectures de l'écran Mots-clés et de ses tâches (clé service_role, côté serveur).
 *
 * PostgREST rend au plus 1 000 lignes par requête : les listes (mots-clés,
 * requêtes de Search Console) sont lues par pages, jamais tronquées en silence
 * (au-delà du garde-fou, la lecture échoue : une liste incomplète effacerait
 * les mesures des mots-clés absents).
 * Toute erreur lève SeoDbError (must) : migration absente ou lecture impossible,
 * jamais confondue avec une liste vide.
 */
import { must, SeoDbError, type SeoDb } from "@/lib/seo/db"
import { resolvePeriod, type DateRange } from "@/lib/seo/period"
import { TYPO_APOSTROPHE_CHARS, canonicalKeyword } from "@/lib/seo/keywords/normalize"
import { KEYWORD_COLUMNS, toKeywordRow, type KeywordRow } from "@/lib/seo/keywords/types"
import type { GscQueryRpcRow } from "@/lib/seo/keywords/rules"

const PAGE = 1000
/** Garde-fou : 50 000 lignes au plus par lecture. */
const MAX_PAGES = 50

type PageResult = { data: unknown; error: { code?: string | null; message?: string | null } | null }

/**
 * Lit toutes les pages d'une requête (`fetchPage(from, to)`). Au-delà de
 * `maxPages` pages pleines, lève SeoDbError « read_failed » plutôt que de rendre
 * une liste tronquée.
 */
export async function readAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult>,
  what: string,
  maxPages: number = MAX_PAGES,
): Promise<T[]> {
  const out: T[] = []
  for (let page = 0; page < maxPages; page++) {
    const from = page * PAGE
    const rows = (must(await fetchPage(from, from + PAGE - 1), what) as T[] | null) ?? []
    rows.forEach((r) => out.push(r))
    if (rows.length < PAGE) return out
  }
  throw new SeoDbError("read_failed", `Lecture de ${what} interrompue : plus de ${maxPages * PAGE} lignes.`)
}

/** Tous les mots-clés suivis (ignorés compris). */
export async function listAllKeywords(db: SeoDb, columns = KEYWORD_COLUMNS): Promise<KeywordRow[]> {
  const rows = await readAllPages<Record<string, unknown>>(
    (from, to) => db.from("seo_keywords").select(columns).order("keyword", { ascending: true }).range(from, to),
    "les mots-clés",
  )
  return rows.map(toKeywordRow)
}

export async function getKeyword(db: SeoDb, id: string): Promise<KeywordRow | null> {
  const row = must(await db.from("seo_keywords").select(KEYWORD_COLUMNS).eq("id", id).maybeSingle(), "le mot-clé") as Record<
    string,
    unknown
  > | null
  return row ? toKeywordRow(row) : null
}

export interface GscBounds {
  first: string | null
  last: string | null
}

/** Premier et dernier jour enregistrés de Search Console (null : aucune donnée). */
export async function gscBounds(db: SeoDb): Promise<GscBounds> {
  const rows = must(await db.rpc("seo_gsc_bounds"), "les dates de Search Console") as { first_date: string | null; last_date: string | null }[] | null
  const row = Array.isArray(rows) ? rows[0] : (rows as { first_date: string | null; last_date: string | null } | null)
  return { first: row?.first_date ?? null, last: row?.last_date ?? null }
}

/** Les 28 derniers jours disponibles (null sans donnée de Search Console). */
export function keywordPeriod(bounds: GscBounds, now: Date = new Date()): DateRange | null {
  if (!bounds.last) return null
  return resolvePeriod("28j", bounds.last, now).current
}

/** Requêtes de Search Console sur la période, tous appareils et pays. */
export async function gscQueries(db: SeoDb, range: DateRange): Promise<GscQueryRpcRow[]> {
  return readAllPages<GscQueryRpcRow>(
    (from, to) => db.rpc("seo_gsc_by_query", { p_from: range.from, p_to: range.to, p_device: null, p_country: null }).range(from, to),
    "les requêtes de Search Console",
  )
}

/**
 * Formes sous lesquelles Search Console peut rendre la requête d'un mot-clé
 * (forme canonique, apostrophe droite) : la même avec chaque apostrophe
 * typographique que canonicalKeyword redresse. Search Console rend les
 * requêtes en minuscules ; le rapprochement final se fait par forme canonique.
 */
export function queryVariants(keyword: string): string[] {
  if (!keyword.includes("'")) return [keyword]
  return Array.from(new Set([keyword, ...TYPO_APOSTROPHE_CHARS.map((c) => keyword.split("'").join(c))]))
}

/**
 * Liste `in.(…)` de PostgREST dont chaque valeur est entre guillemets, `\` et
 * `"` échappés : un mot-clé qui contient une virgule, une parenthèse, un
 * guillemet ou une barre oblique inverse reste une seule valeur (postgrest-js
 * `.in()` n'échappe ni `"` ni `\`). À passer à `.filter(col, "in", …)`.
 */
export function pgrstInList(values: string[]): string {
  return `(${values.map((v) => `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",")})`
}

export interface TopPage {
  page: string
  clicks: number
  impressions: number
  position: number | null
}

/**
 * « Page qui ressort dans Google » : la page du site la plus vue sur la requête
 * du mot-clé pendant la période (calculée à l'affichage, jamais écrite dans
 * target_path, qui reste le choix de l'admin).
 */
export async function topPageFor(db: SeoDb, keyword: string, range: DateRange): Promise<TopPage | null> {
  const rows = must(
    await db.rpc("seo_gsc_query_pages_agg", { p_from: range.from, p_to: range.to }).filter("query", "in", pgrstInList(queryVariants(keyword))),
    "les pages de Search Console",
  ) as { query: string; page: string; clicks: number | string; impressions: number | string; avg_position: number | string | null }[] | null
  const byPage = new Map<string, { clicks: number; impressions: number; weighted: number }>()
  ;(rows ?? []).forEach((r) => {
    if (canonicalKeyword(r.query) !== keyword) return
    const cur = byPage.get(r.page) ?? { clicks: 0, impressions: 0, weighted: 0 }
    const impressions = Number(r.impressions) || 0
    cur.clicks += Number(r.clicks) || 0
    cur.impressions += impressions
    if (r.avg_position !== null && Number.isFinite(Number(r.avg_position))) cur.weighted += Number(r.avg_position) * impressions
    byPage.set(r.page, cur)
  })
  let best: TopPage | null = null
  byPage.forEach((v, page) => {
    if (v.impressions <= 0) return
    if (!best || v.impressions > best.impressions || (v.impressions === best.impressions && v.clicks > best.clicks)) {
      best = { page, clicks: v.clicks, impressions: v.impressions, position: Math.round((v.weighted / v.impressions) * 10) / 10 }
    }
  })
  return best
}
