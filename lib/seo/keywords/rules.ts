/**
 * Règles de l'écran Mots-clés et de la synchronisation avec Search Console.
 * Module pur (testé dans __tests__/seo-keywords-rules.test.ts).
 */
import type { KeywordStatus } from "@/lib/seo/types"
import { canonicalKeyword, foldAccents, normalizeKeyword } from "@/lib/seo/keywords/normalize"

/* ------------------------------------------------------------------ */
/* Gain rapide                                                          */
/* ------------------------------------------------------------------ */

/**
 * Gain rapide (« volume, facilité ») : un mot-clé non ignoré
 * - assez demandé : au moins 100 recherches par mois (volume connu) ;
 * - facile : difficulté connue de 20 ou moins (échelle 0-100 de DataForSEO) ;
 * - pas encore en première page de Google : aucune position (pas d'impression),
 *   ou une position moyenne au-delà de 10.
 * Un volume ou une difficulté inconnus ne font jamais un gain rapide : rien n'est supposé.
 */
export const QUICK_WIN = { minVolume: 100, maxDifficulty: 20, firstPage: 10 } as const

export interface QuickWinInput {
  status: KeywordStatus
  volume: number | null
  difficulty: number | null
  position: number | null
}

export function isQuickWin(k: QuickWinInput): boolean {
  if (k.status === "ignored") return false
  if (k.volume === null || k.volume < QUICK_WIN.minVolume) return false
  if (k.difficulty === null || k.difficulty > QUICK_WIN.maxDifficulty) return false
  return k.position === null || k.position > QUICK_WIN.firstPage
}

/** En première page : position moyenne de 10 ou mieux. */
export function isOnFirstPage(position: number | null): boolean {
  return position !== null && position <= QUICK_WIN.firstPage
}

/* ------------------------------------------------------------------ */
/* Tri et indicateurs                                                   */
/* ------------------------------------------------------------------ */

export interface SortableKeyword extends QuickWinInput {
  keyword: string
  impressions: number | null
}

/** Valeur absente toujours après une valeur connue. */
function desc(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return b - a
}

/**
 * Tri par défaut : gains rapides d'abord, puis impressions, puis volume
 * (décroissants), puis ordre alphabétique ; les mots-clés ignorés en dernier.
 */
export function compareKeywords(a: SortableKeyword, b: SortableKeyword): number {
  const rank = (k: SortableKeyword) => (isQuickWin(k) ? 0 : k.status === "ignored" ? 2 : 1)
  const ra = rank(a)
  const rb = rank(b)
  if (ra !== rb) return ra - rb
  return desc(a.impressions, b.impressions) || desc(a.volume, b.volume) || a.keyword.localeCompare(b.keyword, "fr")
}

export interface KeywordKpis {
  quickWins: number
  /** Premier gain rapide dans l'ordre de tri (« Volume, facilité : … »). */
  firstQuickWin: string | null
  /** Mots-clés suivis, tous statuts confondus (= onglet « Tous » sans filtre). */
  tracked: number
  /** Somme des volumes connus de la liste affichée ; null si aucun volume n'est connu. */
  volume: number | null
  /** Hors ignorés, position 10 ou mieux. */
  firstPage: number
}

/** Indicateurs : `all` = tous les mots-clés, `shown` = la liste filtrée (volume cumulé). */
export function keywordKpis(all: SortableKeyword[], shown: SortableKeyword[]): KeywordKpis {
  const quick = all.filter(isQuickWin).sort(compareKeywords)
  const known = shown.filter((k) => k.volume !== null)
  return {
    quickWins: quick.length,
    firstQuickWin: quick[0]?.keyword ?? null,
    tracked: all.length,
    volume: known.length ? known.reduce((sum, k) => sum + (k.volume ?? 0), 0) : null,
    firstPage: all.filter((k) => k.status !== "ignored" && isOnFirstPage(k.position)).length,
  }
}

/* ------------------------------------------------------------------ */
/* Requêtes de marque                                                   */
/* ------------------------------------------------------------------ */

/** Mots d'une chaîne sans accents ni casse, la ponctuation servant de séparateur (« qonforme.fr » → qonforme fr). */
function tokens(value: string): string[] {
  return foldAccents(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

/**
 * Vrai si la requête contient un terme de marque (targeting.brandTerms), mot
 * pour mot, sans accents ni casse : « Qonforme avis », « qonforme.fr » ; pas
 * « logiciel conforme ».
 */
export function isBrandQuery(query: string, brandTerms: string[]): boolean {
  const q = ` ${tokens(query).join(" ")} `
  return brandTerms.some((term) => {
    const t = tokens(term).join(" ")
    return t.length > 0 && q.includes(` ${t} `)
  })
}

/* ------------------------------------------------------------------ */
/* Search Console                                                       */
/* ------------------------------------------------------------------ */

/** Ligne de seo_gsc_by_query (colonne de sortie avg_position). */
export interface GscQueryRpcRow {
  query: string
  clicks: number | string | null
  impressions: number | string | null
  avg_position: number | string | null
}

export interface GscQueryAgg {
  keyword: string
  clicks: number
  impressions: number
  /** Position moyenne pondérée par les impressions ; null sans impression. */
  position: number | null
}

/**
 * Regroupe les requêtes de Search Console par forme canonique (deux requêtes
 * qui ne diffèrent que par une apostrophe ou un espace ne font qu'un mot-clé).
 */
export function aggregateQueries(rows: GscQueryRpcRow[]): Map<string, GscQueryAgg> {
  const acc = new Map<string, { clicks: number; impressions: number; weighted: number }>()
  rows.forEach((r) => {
    const keyword = canonicalKeyword(String(r.query ?? ""))
    if (!keyword) return
    const clicks = Number(r.clicks) || 0
    const impressions = Number(r.impressions) || 0
    const position = r.avg_position === null || r.avg_position === undefined ? null : Number(r.avg_position)
    const cur = acc.get(keyword) ?? { clicks: 0, impressions: 0, weighted: 0 }
    cur.clicks += clicks
    cur.impressions += impressions
    if (position !== null && Number.isFinite(position)) cur.weighted += position * impressions
    acc.set(keyword, cur)
  })
  const out = new Map<string, GscQueryAgg>()
  acc.forEach((v, keyword) => {
    out.set(keyword, {
      keyword,
      clicks: v.clicks,
      impressions: v.impressions,
      position: v.impressions > 0 ? Math.round((v.weighted / v.impressions) * 100) / 100 : null,
    })
  })
  return out
}

export const DISCOVERY = { minImpressions: 3, maxPerRun: 50 } as const

/**
 * Requêtes à ajouter en « candidat » : au moins 3 impressions sur la période,
 * absentes de la table, valides comme mot-clé, hors requêtes de marque quand
 * `includeBrandQueries` est faux ; les plus vues d'abord, 50 au plus par passage.
 */
export function planDiscoveries(
  queries: Map<string, GscQueryAgg>,
  existing: Set<string>,
  opts: { brandTerms: string[]; includeBrandQueries: boolean; minImpressions?: number; max?: number },
): GscQueryAgg[] {
  const min = opts.minImpressions ?? DISCOVERY.minImpressions
  const max = opts.max ?? DISCOVERY.maxPerRun
  const found: GscQueryAgg[] = []
  queries.forEach((q) => {
    if (q.impressions < min) return
    if (existing.has(q.keyword)) return
    const valid = normalizeKeyword(q.keyword)
    if (!valid.ok || valid.keyword !== q.keyword) return
    if (!opts.includeBrandQueries && isBrandQuery(q.keyword, opts.brandTerms)) return
    found.push(q)
  })
  found.sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks || a.keyword.localeCompare(b.keyword, "fr"))
  return found.slice(0, max)
}

export interface TrackedMetrics {
  id: string
  keyword: string
  position: number | null
  impressions: number | null
  clicks: number | null
}

export interface MetricsUpdate {
  id: string
  position: number | null
  impressions: number | null
  clicks: number | null
}

function samePosition(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return a === b
  return Math.abs(a - b) < 0.005
}

/**
 * Mesures de chaque mot-clé suivi sur la période : celles de la requête
 * identique (forme canonique). Un mot-clé absent de Search Console reçoit des
 * mesures nulles, jamais 0 inventé. Seules les lignes qui changent sont rendues.
 */
export function planMetricUpdates(tracked: TrackedMetrics[], queries: Map<string, GscQueryAgg>): MetricsUpdate[] {
  const updates: MetricsUpdate[] = []
  tracked.forEach((k) => {
    const q = queries.get(canonicalKeyword(k.keyword))
    const next: MetricsUpdate = q
      ? { id: k.id, position: q.position, impressions: q.impressions, clicks: q.clicks }
      : { id: k.id, position: null, impressions: null, clicks: null }
    if (samePosition(next.position, k.position) && next.impressions === k.impressions && next.clicks === k.clicks) return
    updates.push(next)
  })
  return updates
}
