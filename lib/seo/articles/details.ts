/**
 * Fenêtre d'un article (admin › SEO › Articles : calendrier et liste) :
 * l'article, ses performances dans Google, son mot-clé principal et la
 * qualité de son texte, en une lecture (GET /api/admin/seo/articles/posts/<id>).
 *
 * Search Console a 2 à 3 jours de retard : chaque période se termine au
 * dernier jour enregistré (seo_gsc_bounds), jamais à aujourd'hui, sinon les
 * derniers jours paraîtraient vides. Le jour de publication se compte à
 * l'heure de Paris (un article publié à 23 h 30 le 7 l'est le 7, pas le 8 UTC).
 *
 * Une lecture de Search Console en échec ne fait jamais échouer la fenêtre :
 * les performances passent à « non reliée » avec un message, le reste
 * (article, mot-clé, qualité) s'affiche quand même. Une erreur de lecture
 * n'est jamais présentée comme une absence de données (règle « erreur
 * réseau et pas de données » de CLAUDE.md).
 *
 * Position du mot-clé principal : celle de CET article sur la requête (90
 * jours, ou depuis la publication), pas celle du site, que l'onglet
 * Mots-clés donne déjà : une autre page bien classée ne doit pas faire
 * croire que l'article l'est.
 *
 * Fonctions pures exportées (plages, mot-clé) : testées dans
 * __tests__/seo-article-details.test.ts. Module serveur (clé service_role) :
 * jamais importé par un composant client.
 */
import { must, type SeoDb } from "@/lib/seo/db"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import { readGscBounds } from "@/lib/seo/actions/gsc"
import type { DateRange } from "@/lib/seo/period"
import { readPageQueries, readPageSeries, readPageTotals } from "@/lib/seo/search-console/page"
import { listAllKeywords } from "@/lib/seo/keywords/data"
import { canonicalKeyword, foldAccents } from "@/lib/seo/keywords/normalize"
import { PLAN_KEYWORDS, type PlanKeyword } from "@/lib/seo/keywords/plan"
import type { KeywordRow } from "@/lib/seo/keywords/types"
import { analyzeOnPage, sortChecks } from "@/lib/seo/articles/onpage"
import { inferArticleType } from "@/lib/seo/articles/search-language"
import { loadCheckContext } from "@/lib/seo/articles/publish"
import { articleDisplayStatus, articleSource, POST_COLUMNS, type PostRow } from "@/lib/seo/articles/status"
import type { ArticleType } from "@/lib/seo/types"
import type { ArticleDetails, EditorKeyword, GscTotalsLite, PageQuery } from "@/lib/seo/articles/editor-types"
import { addDays, parisDayOf, todayInParis } from "@/lib/utils/paris-date"

/* ------------------------------------------------------------------ */
/* Contrat de la route                                                 */
/* ------------------------------------------------------------------ */

/**
 * Réponse de la route : ArticleDetails, plus le message d'une lecture de
 * Search Console en échec (distincte d'une connexion absente).
 */
export interface ArticleDetailsPayload extends Omit<ArticleDetails, "performance"> {
  performance: ArticleDetails["performance"] & {
    /** Search Console illisible pour le moment (connected vaut alors false) ; null sinon. */
    error: string | null
  }
}

/** Requêtes affichées dans la fenêtre (les plus vues). */
export const DETAILS_QUERY_LIMIT = 8
/** Points de la liste « Qualité » (les plus graves d'abord). */
export const DETAILS_ISSUE_LIMIT = 6
/** Requêtes lues pour retrouver le mot-clé principal parmi elles. */
const QUERY_SCAN_LIMIT = 250

export const GSC_READ_ERROR = "Search Console n'a pas pu être lue pour le moment. Réessayez dans un instant ; le reste de la fiche est à jour."

const ARTICLE_TYPES: ArticleType[] = ["howto", "guide", "news", "faq"]

const ZERO: GscTotalsLite = { clicks: 0, impressions: 0, ctr: null, position: null }

/* ------------------------------------------------------------------ */
/* Plages de jours                                                     */
/* ------------------------------------------------------------------ */

export interface DetailsRanges {
  /** Dernier jour disponible ; null : Search Console n'a encore rien transmis. */
  last: string | null
  /** 28 jours finissant au dernier jour disponible. */
  last28: DateRange | null
  /**
   * Du jour de publication (heure de Paris) au dernier jour disponible.
   * null : article non publié ; « empty » : publié après le dernier jour
   * disponible (totaux à 0, aucune lecture).
   */
  sincePublished: DateRange | "empty" | null
  /** Courbe : 28 derniers jours, ou depuis la publication si elle est plus récente (7 jours au moins). */
  series: DateRange | null
  /** Requêtes : 90 jours, ou depuis la publication ; null : rien à lire. */
  queries: DateRange | null
}

const maxDay = (a: string, b: string) => (a > b ? a : b)
const minDay = (a: string, b: string) => (a < b ? a : b)

/**
 * Plages de la fenêtre d'après les bornes de Search Console et la date de
 * publication (instant ISO ; null pour un article qui n'est pas en ligne).
 */
export function detailsRanges(bounds: { first: string | null; last: string | null }, publishedAt: string | null, now: Date): DetailsRanges {
  if (!bounds.last) return { last: null, last28: null, sincePublished: null, series: null, queries: null }
  // Garde-fou : un dernier jour « dans le futur » (horloge, fuseau) est ramené à aujourd'hui
  const last = minDay(bounds.last, todayInParis(now))
  const last28: DateRange = { from: addDays(last, -27), to: last }
  const published = publishedAt ? parisDayOf(publishedAt) : null

  const sincePublished: DetailsRanges["sincePublished"] = published === null ? null : published > last ? "empty" : { from: published, to: last }

  // Courbe : depuis la publication si elle est plus récente que 28 jours, en gardant 7 jours au moins
  let seriesFrom = last28.from
  if (published && published > last28.from) seriesFrom = minDay(published, addDays(last, -6))
  // Pas de jours « à zéro » avant le premier jour enregistré : ce ne serait pas une mesure
  if (bounds.first && bounds.first > seriesFrom && bounds.first <= last) seriesFrom = bounds.first
  const series: DateRange = { from: seriesFrom, to: last }

  const from90 = addDays(last, -89)
  const queries: DateRange | null = published && published > last ? null : { from: published ? maxDay(published, from90) : from90, to: last }

  return { last, last28, sincePublished, series, queries }
}

/* ------------------------------------------------------------------ */
/* Mot-clé principal                                                   */
/* ------------------------------------------------------------------ */

/** Clé de comparaison : forme canonique, sans accents ni casse (« bâtiment » = « batiment »). */
export function keywordMatchKey(keyword: string): string {
  return foldAccents(canonicalKeyword(keyword))
}

/** Ligne de seo_keywords → mot-clé de l'éditeur, complété par le plan s'il y figure. */
export function editorKeywordFromRow(row: KeywordRow, plan: PlanKeyword | null = null): EditorKeyword {
  return {
    id: row.id,
    keyword: row.keyword,
    status: row.status,
    intent: row.intent ?? plan?.intent ?? null,
    volume: row.volume ?? plan?.volume ?? null,
    difficulty: row.difficulty,
    position: row.position,
    clicks: row.clicks,
    impressions: row.impressions,
    targetPath: row.target_path ?? plan?.targetPath ?? null,
    fromPlan: plan !== null,
  }
}

/** Mot-clé du plan pas encore suivi (aucune mesure de Search Console ni de DataForSEO). */
export function editorKeywordFromPlan(plan: PlanKeyword): EditorKeyword {
  return {
    id: null,
    keyword: canonicalKeyword(plan.keyword),
    status: null,
    intent: plan.intent,
    volume: plan.volume,
    difficulty: null,
    position: null,
    clicks: null,
    impressions: null,
    targetPath: plan.targetPath,
    fromPlan: true,
  }
}

/**
 * Mot-clé principal d'un article (`target_keyword`) : la ligne de l'onglet
 * Mots-clés (comparaison sans accents ; à égalité, l'orthographe exacte puis
 * la ligne la plus mesurée), sinon l'entrée du plan, sinon le mot-clé seul,
 * sans mesure (l'article a bien un mot-clé, simplement pas suivi).
 * null : aucun mot-clé principal.
 */
export function findArticleKeyword(target: string | null | undefined, rows: KeywordRow[], plan: PlanKeyword[] = PLAN_KEYWORDS): EditorKeyword | null {
  const canonical = canonicalKeyword(target ?? "")
  if (!canonical) return null
  const key = keywordMatchKey(canonical)
  const planEntry = plan.find((p) => keywordMatchKey(p.keyword) === key) ?? null
  const matches = rows.filter((r) => keywordMatchKey(r.keyword) === key)
  if (matches.length > 0) {
    const best = matches.slice().sort((a, b) => {
      const exact = Number(canonicalKeyword(b.keyword) === canonical) - Number(canonicalKeyword(a.keyword) === canonical)
      return exact || (b.volume ?? -1) - (a.volume ?? -1) || (b.impressions ?? -1) - (a.impressions ?? -1)
    })[0]
    return editorKeywordFromRow(best, planEntry)
  }
  if (planEntry) return editorKeywordFromPlan(planEntry)
  return {
    id: null,
    keyword: canonical,
    status: null,
    intent: null,
    volume: null,
    difficulty: null,
    position: null,
    clicks: null,
    impressions: null,
    targetPath: null,
    fromPlan: false,
  }
}

/**
 * Mesures du mot-clé pour CET article : la requête correspondante parmi
 * celles qui affichent la page (position, clics, impressions). Sans
 * correspondance, l'article n'est pas encore classé sur ce mot-clé.
 */
export function withPageMetrics(keyword: EditorKeyword, pageQueries: PageQuery[]): EditorKeyword {
  const key = keywordMatchKey(keyword.keyword)
  const hit = pageQueries.find((q) => keywordMatchKey(q.query) === key)
  return { ...keyword, position: hit?.position ?? null, clicks: hit?.clicks ?? null, impressions: hit?.impressions ?? null }
}

/* ------------------------------------------------------------------ */
/* Lecture                                                             */
/* ------------------------------------------------------------------ */

type DetailsRow = PostRow & {
  content: string | null
  cover_url: string | null
  ai_keywords: string[] | null
  cover_alt: string | null
  seo_title: string | null
  seo_description: string | null
}

const BASE_COLUMNS = `${POST_COLUMNS}, content, cover_url, ai_keywords`
/** Colonnes de la migration 20261006 : absentes avant elle, relues sans. */
const OPTIONAL_COLUMNS = "cover_alt, seo_title, seo_description"

async function readDetailsRow(db: SeoDb, id: string): Promise<DetailsRow | null> {
  const full = await db.from("blog_posts").select(`${BASE_COLUMNS}, ${OPTIONAL_COLUMNS}`).eq("id", id).maybeSingle()
  if (full.error && isMissingSchemaError(full.error)) {
    const row = must(await db.from("blog_posts").select(BASE_COLUMNS).eq("id", id).maybeSingle(), "l'article") as Omit<
      DetailsRow,
      "cover_alt" | "seo_title" | "seo_description"
    > | null
    return row ? { ...row, cover_alt: null, seo_title: null, seo_description: null } : null
  }
  return must(full, "l'article") as DetailsRow | null
}

interface PerformanceRead {
  performance: ArticleDetailsPayload["performance"]
  /** Toutes les requêtes lues (recherche du mot-clé principal). */
  allQueries: PageQuery[]
}

function offline(error: string | null): PerformanceRead {
  return { performance: { connected: false, lastDate: null, last28: ZERO, sincePublished: null, series: [], queries: [], error }, allQueries: [] }
}

async function readPerformance(db: SeoDb, slug: string, publishedAt: string | null, now: Date): Promise<PerformanceRead> {
  try {
    const bounds = await readGscBounds(db)
    const ranges = detailsRanges(bounds, publishedAt, now)
    if (!ranges.last || !ranges.last28 || !ranges.series) return offline(null)
    const path = `/blog/${slug}`
    const since = ranges.sincePublished
    const [last28, sincePublished, series, queries] = await Promise.all([
      readPageTotals(db, path, ranges.last28),
      since === null ? Promise.resolve(null) : since === "empty" ? Promise.resolve(ZERO) : readPageTotals(db, path, since),
      readPageSeries(db, path, ranges.series),
      ranges.queries ? readPageQueries(db, path, ranges.queries, QUERY_SCAN_LIMIT) : Promise.resolve([] as PageQuery[]),
    ])
    return {
      performance: { connected: true, lastDate: ranges.last, last28, sincePublished, series, queries: queries.slice(0, DETAILS_QUERY_LIMIT), error: null },
      allQueries: queries,
    }
  } catch (error) {
    console.error("[seo-articles] Search Console illisible pour la fiche d'un article", error)
    return offline(GSC_READ_ERROR)
  }
}

/**
 * Fiche d'un article ; null s'il n'existe pas. Lève SeoDbError si l'article,
 * le contexte du contrôle ou les mots-clés ne peuvent pas être lus.
 */
export async function loadArticleDetails(db: SeoDb, id: string, now: Date = new Date()): Promise<ArticleDetailsPayload | null> {
  const row = await readDetailsRow(db, id)
  if (!row) return null

  const target = row.target_keyword?.trim() || null
  const [ctx, keywordRows, perf] = await Promise.all([
    loadCheckContext(db),
    target ? listAllKeywords(db) : Promise.resolve([] as KeywordRow[]),
    readPerformance(db, row.slug, row.is_published ? row.published_at : null, now),
  ])

  const found = findArticleKeyword(target, keywordRows)
  const keyword = found && perf.performance.connected ? withPageMetrics(found, perf.allQueries) : found

  const content = row.content ?? ""
  const onPage = analyzeOnPage({
    title: row.title,
    seoTitle: row.seo_title ?? "",
    seoDescription: row.seo_description ?? "",
    slug: row.slug,
    excerpt: row.excerpt ?? "",
    content,
    keyword: target,
    articleType: ARTICLE_TYPES.includes(row.article_type as ArticleType) ? (row.article_type as ArticleType) : inferArticleType(target, row.title),
    coverUrl: row.cover_url,
    coverAlt: row.cover_alt,
    otherTitles: ctx.existing,
    selfId: row.id,
    lengthMin: ctx.prefs.lengthMin,
    lengthMax: ctx.prefs.lengthMax,
    competitors: ctx.competitors,
  })
  const issues = sortChecks(onPage.checks)
    .filter((c) => c.status !== "ok")
    .slice(0, DETAILS_ISSUE_LIMIT)
    .map((c) => ({
      label: c.label,
      status: c.status as "warn" | "error",
      ...(c.detail ? { detail: c.detail } : {}),
      ...(c.blocking ? { blocking: true } : {}),
    }))

  return {
    post: {
      id: row.id,
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      coverUrl: row.cover_url?.trim() || null,
      coverAlt: row.cover_alt?.trim() || null,
      status: articleDisplayStatus(row),
      type: ARTICLE_TYPES.includes(row.article_type as ArticleType) ? (row.article_type as ArticleType) : null,
      source: articleSource(row),
      publishedAt: row.published_at,
      scheduledAt: row.scheduled_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      targetKeyword: target,
      seoTitle: row.seo_title?.trim() || null,
      seoDescription: row.seo_description?.trim() || null,
      keywords: Array.isArray(row.ai_keywords) ? row.ai_keywords.filter((k): k is string => typeof k === "string") : [],
      heldReason: row.held_reason,
    },
    performance: perf.performance,
    keyword,
    quality: {
      score: onPage.score,
      words: onPage.stats.words,
      readingMinutes: onPage.stats.readingMinutes,
      h2: onPage.stats.h2,
      internalLinks: onPage.stats.internalLinks,
      images: onPage.stats.images,
      issues,
    },
  }
}
