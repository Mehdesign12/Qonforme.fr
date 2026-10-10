/**
 * Statut affiché d'un article et d'un sujet, source d'un article, transitions
 * permises d'un sujet. Les libellés des pastilles sont ceux de lib/seo/types.ts
 * (ARTICLE_STATUS, TOPIC_STATUS) ; seule la source d'un article, absente de
 * types.ts, a ses libellés ici.
 *
 * Module pur.
 */
import type { ArticleDisplayStatus, ArticleType, PublishMode, TopicSource, TopicStatus } from "@/lib/seo/types"

/** Colonnes de blog_posts lues par le module. */
export interface PostRow {
  id: string
  slug: string
  title: string
  excerpt: string | null
  is_published: boolean
  published_at: string | null
  created_at: string
  updated_at: string | null
  ai_generated: boolean | null
  source: string | null
  article_type: string | null
  target_keyword: string | null
  scheduled_at: string | null
  review_status: string | null
  audit_result: unknown
  held_reason: string | null
}

export const POST_COLUMNS =
  "id, slug, title, excerpt, is_published, published_at, created_at, updated_at, ai_generated, source, article_type, target_keyword, scheduled_at, review_status, audit_result, held_reason"

export interface TopicRow {
  id: string
  title: string
  keyword: string | null
  article_type: ArticleType
  angle: string | null
  notes: string | null
  source: TopicSource
  keyword_id: string | null
  status: TopicStatus
  scheduled_at: string | null
  publish_mode: PublishMode
  post_id: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export const TOPIC_COLUMNS =
  "id, title, keyword, article_type, angle, notes, source, keyword_id, status, scheduled_at, publish_mode, post_id, last_error, created_at, updated_at"

/**
 * Statut affiché d'un article :
 * publié → Publié ; en attente de relecture (mode brouillon, ou retenu par le
 * contrôle) → À relire ; date de publication prévue → Planifié ; sinon Brouillon.
 */
export function articleDisplayStatus(post: Pick<PostRow, "is_published" | "review_status" | "scheduled_at" | "held_reason">): ArticleDisplayStatus {
  if (post.is_published) return "published"
  if (post.review_status === "to_review") return "to_review"
  if (post.scheduled_at) return "scheduled"
  if (post.held_reason) return "to_review"
  return "draft"
}

/** Statut affiché d'un sujet sans article (calendrier) ; null : rien à montrer. */
export function topicDisplayStatus(topic: Pick<TopicRow, "status">): ArticleDisplayStatus | null {
  switch (topic.status) {
    case "planned":
      return "scheduled"
    case "generating":
      return "generating"
    case "failed":
      return "failed"
    default:
      return null
  }
}

export type ArticleSource = "ai" | "pushrank" | "manual"

/** Libellés de la colonne « Source » de la liste des articles. */
export const ARTICLE_SOURCE_LABELS: Record<ArticleSource, string> = {
  ai: "Génération IA",
  manual: "Manuel",
  // Articles reçus avant l'abandon de PushRank : libellé gardé pour ces seuls articles
  pushrank: "PushRank",
}

export function articleSource(post: Pick<PostRow, "source" | "ai_generated">): ArticleSource {
  if (post.source === "pushrank") return "pushrank"
  if (post.ai_generated) return "ai"
  return "manual"
}

/** Date affichée : publication, date prévue, sinon création. */
export function articleDate(post: Pick<PostRow, "is_published" | "published_at" | "scheduled_at" | "created_at">): string | null {
  if (post.is_published) return post.published_at
  return post.scheduled_at ?? post.created_at ?? null
}

/* ------------------------------------------------------------------ */
/* Transitions d'un sujet (contrôlées côté serveur)                    */
/* ------------------------------------------------------------------ */

export type TopicAction = "update" | "schedule" | "unschedule" | "draft" | "retry" | "archive" | "restore"

const ALLOWED: Record<TopicAction, TopicStatus[]> = {
  update: ["unplanned", "planned", "failed", "archived"],
  schedule: ["unplanned", "planned", "failed", "drafted"],
  unschedule: ["planned", "drafted", "failed"],
  draft: ["unplanned", "planned", "failed"],
  retry: ["failed"],
  archive: ["unplanned", "planned", "failed", "drafted", "published"],
  restore: ["archived"],
}

export function canApplyTopicAction(status: TopicStatus, action: TopicAction): boolean {
  return ALLOWED[action].includes(status)
}

const ACTION_ERRORS: Record<TopicAction, string> = {
  update: "Ce sujet ne se modifie plus : son article est rédigé ou en cours de rédaction.",
  schedule: "Ce sujet ne peut pas être planifié dans son état actuel.",
  unschedule: "Ce sujet n'est pas au calendrier.",
  draft: "Ce sujet est déjà rédigé ou en cours de rédaction.",
  retry: "Seul un sujet en échec peut être relancé.",
  archive: "Un sujet en cours de rédaction ne s'archive pas.",
  restore: "Ce sujet n'est pas archivé.",
}

export function topicActionError(action: TopicAction): string {
  return ACTION_ERRORS[action]
}
