/**
 * Lectures transverses de la Vue d'ensemble de l'onglet SEO : les trois
 * priorités ouvertes (seo_findings), le dernier article publié et les
 * prochains sujets planifiés (blog_posts, seo_topics), le dernier relevé de
 * visibilité dans les IA (seo_geo_runs). Requêtes simples sur les tables de la
 * migration 20261009_seo_admin.sql ; une lecture en échec lève SeoDbError.
 */
import { must, type SeoDb } from "@/lib/seo/db"
import {
  GEO_ENGINES,
  type ArticleType,
  type FindingSeverity,
  type GeoEngine,
  type GeoRunSummary,
} from "@/lib/seo/types"

/* ------------------------------------------------------------------ */
/* Priorités                                                           */
/* ------------------------------------------------------------------ */

export interface PriorityItem {
  id: string
  title: string
  path: string
  severity: FindingSeverity
  detectedAt: string
}

const SEVERITY_RANK: Record<FindingSeverity, number> = { high: 0, medium: 1, low: 2 }

/** Gravité d'abord (haute, moyenne, faible), puis le plus récent. */
export function sortPriorities<T extends { severity: FindingSeverity; detectedAt: string }>(items: T[]): T[] {
  return items
    .slice()
    .sort(
      (a, b) =>
        (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3) || Date.parse(b.detectedAt) - Date.parse(a.detectedAt),
    )
}

export async function readPriorities(db: SeoDb, limit = 3): Promise<{ items: PriorityItem[]; total: number }> {
  // Gravité par gravité : un constat grave ancien passe avant des constats faibles
  // récents, quel que soit leur nombre (pas de fenêtre des N plus récents)
  const items: PriorityItem[] = []
  for (const severity of ["high", "medium", "low"] as const) {
    if (items.length >= limit) break
    const rows = (must(
      await db
        .from("seo_findings")
        .select("id, title, path, severity, detected_at")
        .eq("status", "open")
        .eq("severity", severity)
        .order("detected_at", { ascending: false })
        .order("id", { ascending: true })
        .limit(limit - items.length),
      "les actions SEO",
    ) ?? []) as { id: string; title: string; path: string; severity: FindingSeverity; detected_at: string }[]
    items.push(...rows.map((r) => ({ id: r.id, title: r.title, path: r.path, severity: r.severity, detectedAt: r.detected_at })))
  }
  const counted = await db.from("seo_findings").select("id", { count: "exact", head: true }).eq("status", "open")
  must(counted, "les actions SEO")
  return { items: sortPriorities(items), total: counted.count ?? items.length }
}

/* ------------------------------------------------------------------ */
/* Articles                                                            */
/* ------------------------------------------------------------------ */

export type ArticleOrigin = "pushrank" | "ai" | "manual"

/** Origine d'un article de blog (colonnes `source` et `ai_generated` de blog_posts). */
export const ARTICLE_ORIGIN_LABELS: Record<ArticleOrigin, string> = {
  pushrank: "PushRank",
  ai: "Génération IA",
  manual: "Manuel",
}

export function articleOrigin(row: { source?: string | null; ai_generated?: boolean | null }): ArticleOrigin {
  if (row.source === "pushrank") return "pushrank"
  if (row.ai_generated) return "ai"
  return "manual"
}

export interface RecentArticle {
  id: string
  title: string
  slug: string
  publishedAt: string | null
  origin: ArticleOrigin
  articleType: ArticleType | null
}

export interface UpcomingTopic {
  id: string
  title: string
  scheduledAt: string | null
  articleType: ArticleType | null
}

const ARTICLE_TYPES = new Set<string>(["howto", "guide", "news", "faq"])
const articleTypeOf = (v: unknown): ArticleType | null => (typeof v === "string" && ARTICLE_TYPES.has(v) ? (v as ArticleType) : null)

export async function readArticlesSummary(db: SeoDb, upcomingLimit = 2): Promise<{ lastPublished: RecentArticle | null; upcoming: UpcomingTopic[] }> {
  const [postsRes, topicsRes] = await Promise.all([
    db
      .from("blog_posts")
      .select("id, title, slug, published_at, source, ai_generated, article_type")
      .eq("is_published", true)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(1),
    db
      .from("seo_topics")
      .select("id, title, scheduled_at, article_type")
      .eq("status", "planned")
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .limit(upcomingLimit),
  ])
  const posts = (must(postsRes, "les articles du blog") ?? []) as {
    id: string
    title: string
    slug: string
    published_at: string | null
    source: string | null
    ai_generated: boolean | null
    article_type: string | null
  }[]
  const topics = (must(topicsRes, "les sujets planifiés") ?? []) as { id: string; title: string; scheduled_at: string | null; article_type: string | null }[]
  const p = posts[0]
  return {
    lastPublished: p
      ? { id: p.id, title: p.title, slug: p.slug, publishedAt: p.published_at, origin: articleOrigin(p), articleType: articleTypeOf(p.article_type) }
      : null,
    upcoming: topics.map((t) => ({ id: t.id, title: t.title, scheduledAt: t.scheduled_at, articleType: articleTypeOf(t.article_type) })),
  }
}

/* ------------------------------------------------------------------ */
/* Visibilité IA                                                       */
/* ------------------------------------------------------------------ */

export interface GeoEngineLine {
  key: GeoEngine
  label: string
  /** null : moteur absent de ce relevé, ou interrogé sans aucune réponse aboutie. */
  mentions: number | null
  answers: number | null
  rate: number | null
  /** Vrai si le moteur a été interrogé sans qu'aucune réponse n'aboutisse (jamais affiché « 0 / 0 »). */
  noAnswer?: boolean
}

export interface GeoSnapshot {
  runId: string
  date: string
  imported: boolean
  /** Taux de mention global (0 à 1). */
  mentionRate: number | null
  /** Moteurs présents dans le relevé. */
  engineCount: number
  engines: GeoEngineLine[]
}

const rate = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null)
const count = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null)

/** Lignes par moteur (ordre de GEO_ENGINES) à partir du résumé d'un relevé. */
export function geoLines(summary: GeoRunSummary | null | undefined): GeoEngineLine[] {
  return GEO_ENGINES.map((e) => {
    const s = summary?.engines?.[e.key]
    if (!s) return { key: e.key, label: e.label, mentions: null, answers: null, rate: null }
    const answers = count(s.answers)
    // Aucune réponse aboutie : rien de mesuré, ni « 0 / 0 » ni moteur compté dans la moyenne
    if (answers === 0) return { key: e.key, label: e.label, mentions: null, answers: null, rate: null, noAnswer: true }
    const r = rate(s.mention_rate)
    const mentions = count(s.mentions) ?? (r !== null && answers !== null ? Math.round(r * answers) : null)
    return { key: e.key, label: e.label, mentions, answers, rate: r ?? (mentions !== null && answers ? mentions / answers : null) }
  })
}

export async function readGeoSnapshot(db: SeoDb): Promise<GeoSnapshot | null> {
  const rows = (must(
    await db
      .from("seo_geo_runs")
      .select("id, kind, created_at, finished_at, summary")
      .eq("status", "done")
      .order("created_at", { ascending: false })
      .limit(1),
    "les relevés de visibilité IA",
  ) ?? []) as { id: string; kind: string; created_at: string; finished_at: string | null; summary: GeoRunSummary | null }[]
  const run = rows[0]
  if (!run) return null
  const engines = geoLines(run.summary)
  return {
    runId: run.id,
    date: run.finished_at ?? run.created_at,
    imported: run.kind === "import",
    mentionRate: rate(run.summary?.overall?.mention_rate),
    engineCount: engines.filter((e) => e.answers !== null || e.rate !== null).length,
    engines,
  }
}
