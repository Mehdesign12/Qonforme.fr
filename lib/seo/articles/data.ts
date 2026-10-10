/**
 * Lectures des écrans Articles (calendrier, liste, sujets, préférences, fenêtre
 * « Générer un article »). Chaque fonction lève SeoDbError en cas d'échec :
 * la page l'enveloppe dans load() et affiche « Données indisponibles » ou
 * « Section en attente de mise à jour », jamais une liste vide à la place.
 */
import { must, type SeoDb } from "@/lib/seo/db"
import { getAllSettings, getSettings, type ArticleSettings } from "@/lib/seo/settings"
import { KEYWORD_STATUS, type ArticleDisplayStatus, type ArticleType, type KeywordStatus, type PublishMode, type TopicSource, type TopicStatus } from "@/lib/seo/types"
import { AUDIT_RULES } from "@/lib/blog-audit"
import { checkArticle, storedReviewIssues } from "@/lib/seo/articles/check"
import { EDITORIAL_ANGLES } from "@/lib/seo/articles/prompt"
import {
  articleDate,
  articleDisplayStatus,
  articleSource,
  POST_COLUMNS,
  TOPIC_COLUMNS,
  topicDisplayStatus,
  type ArticleSource,
  type PostRow,
  type TopicRow,
} from "@/lib/seo/articles/status"
import { currentMonth, dayRangeUtc, monthGrid, monthLabel, parisDayTime, shiftMonth, type Slot } from "@/lib/seo/articles/schedule"
import { freeSlots } from "@/lib/seo/articles/topics"
import {
  findImageModel,
  imageModelOptions,
  modelLabel,
  passesSummary,
  resolvePassModel,
  hasKey,
  textModelOptions,
  type ModelOption,
} from "@/lib/seo/articles/models"
import { todayInParis } from "@/lib/utils/paris-date"

/* ------------------------------------------------------------------ */
/* Sujet allégé (fenêtres)                                             */
/* ------------------------------------------------------------------ */

export interface TopicLite {
  id: string
  title: string
  keyword: string | null
  articleType: ArticleType
  angle: string | null
  status: TopicStatus
  scheduledAt: string | null
  publishMode: PublishMode
  lastError: string | null
  postId: string | null
}

function liteOf(t: TopicRow): TopicLite {
  return {
    id: t.id,
    title: t.title,
    keyword: t.keyword,
    articleType: t.article_type,
    angle: t.angle,
    status: t.status,
    scheduledAt: t.scheduled_at,
    publishMode: t.publish_mode,
    lastError: t.last_error,
    postId: t.post_id,
  }
}

/* ------------------------------------------------------------------ */
/* Fenêtre « Générer un article »                                      */
/* ------------------------------------------------------------------ */

export interface GenerateDialogData {
  topics: TopicLite[]
  keywords: { keyword: string; status: KeywordStatus; label: string }[]
  angles: { key: string; label: string }[]
  lengthMin: number
  lengthMax: number
  coverImage: boolean
  /** « Plan et contrôle par Gemini 3.8 Flash · rédaction par Claude Opus 5.5 » (modèles réellement utilisables). */
  summary: string
  /** Replis prévus (clé absente) : affichés sous le résumé. */
  fallbacks: string[]
  /** Aucune clé utilisable pour le plan : la rédaction ne peut pas démarrer. */
  blocked: string | null
  slot: Slot | null
}

/** Résumé des modèles d'après les réglages et les clés présentes (repli compris). */
export function modelsSummary(prefs: ArticleSettings): { summary: string; fallbacks: string[]; blocked: string | null } {
  const plan = resolvePassModel(prefs.planModel, prefs.planModel, hasKey)
  const write = resolvePassModel(prefs.textModel, prefs.planModel, hasKey)
  const review = resolvePassModel(prefs.reviewModel, prefs.planModel, hasKey)
  const fallbacks: string[] = []
  if (write.fallbackReason) fallbacks.push(`Rédaction par ${modelLabel(write.model)} au lieu de ${modelLabel(write.requested)} : ${write.fallbackReason}.`)
  if (review.fallbackReason) fallbacks.push(`Contrôle par ${modelLabel(review.model)} au lieu de ${modelLabel(review.requested)} : ${review.fallbackReason}.`)
  const planDef = textModelOptions().find((m) => m.id === plan.model)
  const blocked = planDef && !planDef.available ? `Clé ${planDef.envKey} absente : la rédaction ne peut pas démarrer (Paramètres › Connexions).` : null
  return { summary: passesSummary({ plan: plan.model, write: write.model, review: review.model }), fallbacks, blocked }
}

export async function loadGenerateDialog(db: SeoDb, now: Date): Promise<GenerateDialogData> {
  const [settings, topics, keywords] = await Promise.all([
    getSettings(db, "articles"),
    db.from("seo_topics").select(TOPIC_COLUMNS).eq("status", "unplanned").order("created_at", { ascending: true }).limit(200),
    db.from("seo_keywords").select("keyword, status").neq("status", "ignored").order("keyword", { ascending: true }).limit(500),
  ])
  const prefs = settings.value
  const order: Record<string, number> = { targeted: 0, candidate: 1, covered: 2 }
  const kw = (must(keywords, "les mots-clés suivis") as { keyword: string; status: KeywordStatus }[])
    .slice()
    .sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || a.keyword.localeCompare(b.keyword, "fr"))
  const slots = await freeSlots(db, prefs, now, 1)
  return {
    topics: (must(topics, "les sujets") as TopicRow[]).map(liteOf),
    keywords: kw.map((k) => ({ keyword: k.keyword, status: k.status, label: KEYWORD_STATUS[k.status]?.label ?? k.status })),
    angles: EDITORIAL_ANGLES.map((a) => ({ key: a.key, label: a.label })),
    lengthMin: prefs.lengthMin,
    lengthMax: prefs.lengthMax,
    coverImage: prefs.coverImage,
    ...modelsSummary(prefs),
    slot: slots[0] ?? null,
  }
}

/* ------------------------------------------------------------------ */
/* Calendrier                                                          */
/* ------------------------------------------------------------------ */

export interface CalendarEvent {
  key: string
  kind: "post" | "topic"
  id: string
  title: string
  type: ArticleType | null
  status: ArticleDisplayStatus
  /** Jour et heure de Paris. */
  day: string
  time: string
  keyword: string | null
  /** Étiquette « PushRank » des articles reçus avant l'abandon de PushRank. */
  sourceTag: string | null
  /** Article : fiche de l'article. */
  href: string | null
  topic: TopicLite | null
}

export interface CalendarDay {
  day: string
  inMonth: boolean
  isToday: boolean
  events: CalendarEvent[]
}

export interface CalendarData {
  month: string
  label: string
  prev: string
  next: string
  today: string
  weeks: { monday: string; days: CalendarDay[] }[]
  /** Sujets à planifier (fenêtre « Planifier un sujet »). */
  unplanned: TopicLite[]
  slots: Slot[]
  defaultMode: PublishMode
  /** Image de couverture prévue (suivi des passes dans la fiche d'un sujet). */
  coverImage: boolean
}

export function matchesFilter(status: ArticleDisplayStatus, filter: ArticleDisplayStatus | null): boolean {
  if (!filter) return true
  // Une rédaction en cours est un article planifié qui se prépare
  if (filter === "scheduled") return status === "scheduled" || status === "generating"
  return status === filter
}

export async function loadCalendar(db: SeoDb, month: string, now: Date, filter: ArticleDisplayStatus | null): Promise<CalendarData> {
  const weeks = monthGrid(month)
  const first = weeks[0][0]
  const last = weeks[weeks.length - 1][6]
  const range = dayRangeUtc(first, last)
  const [published, scheduled, topics, unplanned, settings] = await Promise.all([
    db.from("blog_posts").select(POST_COLUMNS).eq("is_published", true).gte("published_at", range.from).lt("published_at", range.to).limit(500),
    db.from("blog_posts").select(POST_COLUMNS).eq("is_published", false).gte("scheduled_at", range.from).lt("scheduled_at", range.to).limit(500),
    db
      .from("seo_topics")
      .select(TOPIC_COLUMNS)
      .in("status", ["planned", "generating", "failed"])
      .is("post_id", null)
      .gte("scheduled_at", range.from)
      .lt("scheduled_at", range.to)
      .limit(500),
    db.from("seo_topics").select(TOPIC_COLUMNS).in("status", ["unplanned", "failed"]).order("created_at", { ascending: true }).limit(200),
    getSettings(db, "articles"),
  ])

  const events: CalendarEvent[] = []
  const posts = (must(published, "les articles publiés") as PostRow[]).concat(must(scheduled, "les articles programmés") as PostRow[])
  for (const p of posts) {
    const at = p.is_published ? p.published_at : p.scheduled_at
    if (!at) continue
    const { day, time } = parisDayTime(at)
    events.push({
      key: `post-${p.id}`,
      kind: "post",
      id: p.id,
      title: p.title,
      type: (p.article_type as ArticleType | null) ?? null,
      status: articleDisplayStatus(p),
      day,
      time,
      keyword: p.target_keyword,
      sourceTag: articleSource(p) === "pushrank" ? "PushRank" : null,
      href: `/admin/blog/${p.id}`,
      topic: null,
    })
  }
  for (const t of must(topics, "les sujets planifiés") as TopicRow[]) {
    const status = topicDisplayStatus(t)
    if (!status || !t.scheduled_at) continue
    const { day, time } = parisDayTime(t.scheduled_at)
    events.push({
      key: `topic-${t.id}`,
      kind: "topic",
      id: t.id,
      title: t.title,
      type: t.article_type,
      status,
      day,
      time,
      keyword: t.keyword,
      sourceTag: null,
      href: null,
      topic: liteOf(t),
    })
  }
  events.sort((a, b) => (a.day + a.time).localeCompare(b.day + b.time))

  const today = todayInParis(now)
  const byDay = new Map<string, CalendarEvent[]>()
  events
    .filter((e) => matchesFilter(e.status, filter))
    .forEach((e) => {
      const list = byDay.get(e.day) ?? []
      list.push(e)
      byDay.set(e.day, list)
    })

  return {
    month,
    label: monthLabel(month),
    prev: shiftMonth(month, -1),
    next: shiftMonth(month, 1),
    today,
    weeks: weeks.map((days) => ({
      monday: days[0],
      days: days.map((day) => ({ day, inMonth: day.slice(0, 7) === month, isToday: day === today, events: byDay.get(day) ?? [] })),
    })),
    unplanned: (must(unplanned, "les sujets à planifier") as TopicRow[]).map(liteOf),
    slots: await freeSlots(db, settings.value, now, 3),
    defaultMode: settings.value.publishMode,
    coverImage: settings.value.coverImage,
  }
}

export { currentMonth }

/* ------------------------------------------------------------------ */
/* Liste des articles                                                  */
/* ------------------------------------------------------------------ */

export interface ArticleListItem {
  id: string
  slug: string
  title: string
  type: ArticleType | null
  keyword: string | null
  status: ArticleDisplayStatus
  source: ArticleSource
  date: string | null
  /** Passages repérés par le contrôle (texte actuel) ; blocking : valeur périmée ou affirmation interdite. */
  control: { count: number; blocking: number; labels: string[] }
  heldReason: string | null
  isPublished: boolean
}

export interface ArticleListData {
  items: ArticleListItem[]
  /** Sources présentes (« PushRank » seulement si un article l'a). */
  sources: ArticleSource[]
}

export async function loadArticleList(db: SeoDb): Promise<ArticleListData> {
  const [posts, settings] = await Promise.all([
    db.from("blog_posts").select(`${POST_COLUMNS}, content, seo_description`).order("created_at", { ascending: false }).limit(1000),
    getAllSettings(db),
  ])
  const rows = must(posts, "les articles du blog") as (PostRow & { content: string | null; seo_description: string | null })[]
  const competitors = settings.targeting.value.competitors
  const items = rows.map((p): ArticleListItem => {
    // Contrôle sur le texte actuel (l'article a pu être modifié depuis sa rédaction) : passages du texte seulement
    const issues = checkArticle({ title: p.title, content: p.content ?? "", competitors, existing: [] })
    // Passages du relecteur toujours présents dans le texte : mêmes règles que la publication
    const all = storedReviewIssues(p.audit_result, p.content ?? "").concat(issues)
    return {
      id: p.id,
      slug: p.slug,
      title: p.title,
      type: (p.article_type as ArticleType | null) ?? null,
      keyword: p.target_keyword,
      status: articleDisplayStatus(p),
      source: articleSource(p),
      date: articleDate(p),
      control: { count: all.length, blocking: all.filter((i) => i.blocking).length, labels: Array.from(new Set(all.map((i) => i.label))) },
      heldReason: p.held_reason,
      isPublished: p.is_published,
    }
  })
  const present = new Set(items.map((i) => i.source))
  const sources: ArticleSource[] = ["ai", "manual"]
  if (present.has("pushrank")) sources.push("pushrank")
  return { items, sources }
}

/* ------------------------------------------------------------------ */
/* Sujets                                                              */
/* ------------------------------------------------------------------ */

export interface TopicListItem extends TopicLite {
  source: TopicSource
  notes: string | null
  createdAt: string
  /** Date de parution : prévue, ou de publication de l'article. */
  date: string | null
  /** Statut affiché (un sujet rédigé dont l'article est publié s'affiche « Publié »). */
  displayStatus: TopicStatus
}

export interface TopicsData {
  topics: TopicListItem[]
  archived: number
  nextRelease: string | null
  keywords: { keyword: string; label: string }[]
  angles: { key: string; label: string }[]
  slots: Slot[]
  defaultMode: PublishMode
  coverImage: boolean
}

export async function loadTopics(db: SeoDb, now: Date, opts: { archived: boolean }): Promise<TopicsData> {
  const nowIso = now.toISOString()
  const [topics, archivedCount, nextTopic, nextPost, keywords, settings] = await Promise.all([
    opts.archived
      ? db.from("seo_topics").select(TOPIC_COLUMNS).eq("status", "archived").order("updated_at", { ascending: false }).limit(500)
      : db.from("seo_topics").select(TOPIC_COLUMNS).neq("status", "archived").order("created_at", { ascending: false }).limit(500),
    db.from("seo_topics").select("id", { count: "exact", head: true }).eq("status", "archived"),
    db.from("seo_topics").select("scheduled_at").in("status", ["planned", "generating"]).gte("scheduled_at", nowIso).order("scheduled_at", { ascending: true }).limit(1),
    db.from("blog_posts").select("scheduled_at").eq("is_published", false).is("review_status", null).gte("scheduled_at", nowIso).order("scheduled_at", { ascending: true }).limit(1),
    db.from("seo_keywords").select("keyword, status").neq("status", "ignored").order("keyword", { ascending: true }).limit(500),
    getSettings(db, "articles"),
  ])
  const rows = must(topics, "les sujets") as TopicRow[]
  must(archivedCount, "les sujets archivés")
  const archivedTotal = archivedCount.count ?? 0
  const postIds = rows.map((t) => t.post_id).filter((id): id is string => Boolean(id))
  const posts = postIds.length
    ? (must(await db.from("blog_posts").select("id, is_published, published_at").in("id", postIds), "les articles des sujets") as {
        id: string
        is_published: boolean
        published_at: string | null
      }[])
    : []
  const postById = new Map(posts.map((p) => [p.id, p]))

  const candidates = [
    ...((must(nextTopic, "la prochaine parution") as { scheduled_at: string }[]) ?? []),
    ...((must(nextPost, "la prochaine parution") as { scheduled_at: string }[]) ?? []),
  ]
    .map((r) => r.scheduled_at)
    .filter(Boolean)
    .sort()

  const kw = (must(keywords, "les mots-clés suivis") as { keyword: string; status: KeywordStatus }[]).map((k) => ({
    keyword: k.keyword,
    label: KEYWORD_STATUS[k.status]?.label ?? k.status,
  }))

  return {
    topics: rows.map((t) => {
      const post = t.post_id ? postById.get(t.post_id) : undefined
      const published = Boolean(post?.is_published)
      return {
        ...liteOf(t),
        source: t.source,
        notes: t.notes,
        createdAt: t.created_at,
        date: published ? post?.published_at ?? t.scheduled_at : t.scheduled_at,
        displayStatus: published && t.status !== "archived" ? "published" : t.status,
      }
    }),
    archived: archivedTotal,
    nextRelease: candidates[0] ?? null,
    keywords: kw,
    angles: EDITORIAL_ANGLES.map((a) => ({ key: a.key, label: a.label })),
    slots: await freeSlots(db, settings.value, now, 3),
    defaultMode: settings.value.publishMode,
    coverImage: settings.value.coverImage,
  }
}

/* ------------------------------------------------------------------ */
/* Préférences                                                         */
/* ------------------------------------------------------------------ */

export interface PreferencesData {
  value: ArticleSettings
  saved: boolean
  updatedAt: string | null
  textModels: ModelOption[]
  imageModels: ModelOption[]
  /** Libellé du modèle de repli de l'image choisie (« Nano Banana 2 »). */
  imageFallbackLabel: string | null
  auditRules: string[]
}

export async function loadPreferences(db: SeoDb): Promise<PreferencesData> {
  const stored = await getSettings(db, "articles")
  const image = findImageModel(stored.value.imageModel)
  return {
    value: stored.value,
    saved: stored.saved,
    updatedAt: stored.updatedAt,
    textModels: textModelOptions(),
    imageModels: imageModelOptions(),
    imageFallbackLabel: image?.fallback ? modelLabel(image.fallback) : null,
    auditRules: AUDIT_RULES.map((r) => r.label),
  }
}
