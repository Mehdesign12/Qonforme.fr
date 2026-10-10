/**
 * Écritures sur les sujets d'articles (seo_topics) : création, modification,
 * planification, rédaction, archivage. Transitions contrôlées ici (côté
 * serveur), quelle que soit l'interface (lib/seo/articles/status.ts).
 */
import { must, type SeoDb } from "@/lib/seo/db"
import { isIsoDay } from "@/lib/utils/paris-date"
import type { ArticleType, PublishMode } from "@/lib/seo/types"
import { findCompetitorMentions } from "@/lib/seo/competitors"
import { parisInstant, nextSlots, parisDayTime, type Slot } from "@/lib/seo/articles/schedule"
import { canApplyTopicAction, topicActionError, TOPIC_COLUMNS, type TopicAction, type TopicRow } from "@/lib/seo/articles/status"
import { createJob, loadGenerationContext, retryFailedJob, readTopic, JobRefusedError, type GenerationContext, type JobOverrides, type JobRow } from "@/lib/seo/articles/generate"
import type { ArticleSettings } from "@/lib/seo/settings"
import { findAngle } from "@/lib/seo/articles/prompt"

/** Erreur de transition ou de saisie : réponse 409 ou 400 avec un message en français. */
export class TopicActionError extends Error {
  constructor(message: string, readonly status: 400 | 404 | 409 = 409) {
    super(message)
    this.name = "TopicActionError"
  }
}

/** Instant d'une date et heure de Paris, refusé s'il est passé. */
export function scheduleInstant(day: string, time: string, now: Date): string {
  if (!isIsoDay(day)) throw new TopicActionError("Cette date n'existe pas.", 400)
  const at = parisInstant(day, time)
  if (Number.isNaN(at.getTime())) throw new TopicActionError("Date ou heure invalide.", 400)
  if (at.getTime() <= now.getTime() + 5 * 60_000) throw new TopicActionError("Choisissez une date et une heure à venir.", 400)
  return at.toISOString()
}

/** Mot-clé suivi qui correspond ; une lecture en échec lève (jamais un rattachement perdu en silence). */
async function keywordIdOf(db: SeoDb, keyword: string | null | undefined): Promise<string | null> {
  if (!keyword) return null
  const row = must(await db.from("seo_keywords").select("id").eq("keyword", keyword).maybeSingle(), "les mots-clés suivis") as { id: string } | null
  return row?.id ?? null
}

function cleanAngle(angle: string | null | undefined): string | null {
  return angle && findAngle(angle) ? angle : null
}

export interface NewTopic {
  title: string
  keyword?: string | null
  articleType: ArticleType
  angle?: string | null
  notes?: string | null
  schedule?: { at: string; publishMode: PublishMode }
}

export async function createTopic(db: SeoDb, input: NewTopic, competitors: string[], now = new Date()): Promise<TopicRow> {
  if (findCompetitorMentions(`${input.title}\n${input.keyword ?? ""}\n${input.notes ?? ""}`, competitors).length > 0) {
    throw new TopicActionError("Ce sujet nomme un concurrent suivi (usage interne) : reformulez-le sans ce nom.", 400)
  }
  const nowIso = now.toISOString()
  const row = must(
    await db
      .from("seo_topics")
      .insert({
        title: input.title,
        keyword: input.keyword || null,
        article_type: input.articleType,
        angle: cleanAngle(input.angle),
        notes: input.notes || null,
        source: "manual",
        keyword_id: await keywordIdOf(db, input.keyword),
        status: input.schedule ? "planned" : "unplanned",
        scheduled_at: input.schedule?.at ?? null,
        publish_mode: input.schedule?.publishMode ?? "draft",
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select(TOPIC_COLUMNS)
      .single(),
    "la création du sujet",
  ) as TopicRow
  return row
}

async function requireTopic(db: SeoDb, id: string): Promise<TopicRow> {
  const topic = await readTopic(db, id)
  if (!topic) throw new TopicActionError("Sujet introuvable.", 404)
  return topic
}

function guard(topic: TopicRow, action: TopicAction): void {
  if (!canApplyTopicAction(topic.status, action)) throw new TopicActionError(topicActionError(action))
}

export type TopicPatch =
  | { action: "update"; title: string; keyword?: string | null; articleType: ArticleType; angle?: string | null; notes?: string | null }
  | { action: "schedule"; at: string; publishMode?: PublishMode }
  | { action: "unschedule" }
  | { action: "draft" }
  | { action: "retry" }
  | { action: "archive" }
  | { action: "restore" }

export interface TopicPatchResult {
  topic: TopicRow | null
  job?: JobRow | null
}

/** Applique une action à un sujet, transitions vérifiées. */
export async function patchTopic(
  db: SeoDb,
  id: string,
  patch: TopicPatch,
  opts: { now?: Date; ctx?: GenerationContext; overrides?: JobOverrides } = {},
): Promise<TopicPatchResult> {
  const now = opts.now ?? new Date()
  const nowIso = now.toISOString()
  const topic = await requireTopic(db, id)
  guard(topic, patch.action)

  const update = async (values: Record<string, unknown>) =>
    (must(await db.from("seo_topics").update({ ...values, updated_at: nowIso }).eq("id", id).select(TOPIC_COLUMNS), "le sujet") as TopicRow[])[0] ?? null

  switch (patch.action) {
    case "update": {
      const ctx = opts.ctx ?? (await loadGenerationContext(db))
      if (findCompetitorMentions(`${patch.title}\n${patch.keyword ?? ""}\n${patch.notes ?? ""}`, ctx.competitors).length > 0) {
        throw new TopicActionError("Ce sujet nomme un concurrent suivi (usage interne) : reformulez-le sans ce nom.", 400)
      }
      return {
        topic: await update({
          title: patch.title,
          keyword: patch.keyword || null,
          keyword_id: await keywordIdOf(db, patch.keyword),
          article_type: patch.articleType,
          angle: cleanAngle(patch.angle),
          notes: patch.notes || null,
        }),
      }
    }
    case "schedule": {
      const values: Record<string, unknown> = { scheduled_at: patch.at }
      if (patch.publishMode) values.publish_mode = patch.publishMode
      // Un sujet sans article passe « Planifié » ; un sujet déjà rédigé garde son statut, son article prend la date
      if (topic.status === "unplanned" || topic.status === "failed") {
        values.status = topic.post_id ? "drafted" : "planned"
        values.last_error = null
      }
      if (topic.post_id) {
        // Article déjà rédigé : il prend la date. En mode brouillon il reste à relire ; dans les autres
        // modes, il n'attend l'heure prévue que si le contrôle ne l'a pas retenu (motif conservé)
        const mode = patch.publishMode ?? topic.publish_mode
        const post = must(await db.from("blog_posts").select("held_reason").eq("id", topic.post_id).maybeSingle(), "l'article") as { held_reason: string | null } | null
        const held = Boolean(post?.held_reason)
        must(
          await db
            .from("blog_posts")
            .update({ scheduled_at: patch.at, review_status: mode === "draft" || held ? "to_review" : null, updated_at: nowIso })
            .eq("id", topic.post_id)
            .eq("is_published", false),
          "la date de l'article",
        )
      }
      return { topic: await update(values) }
    }
    case "unschedule": {
      if (topic.post_id) {
        must(
          await db.from("blog_posts").update({ scheduled_at: null, updated_at: nowIso }).eq("id", topic.post_id).eq("is_published", false),
          "la date de l'article",
        )
      }
      return { topic: await update({ scheduled_at: null, ...(topic.status === "planned" ? { status: "unplanned" } : {}) }) }
    }
    case "draft": {
      const ctx = opts.ctx ?? (await loadGenerationContext(db))
      try {
        const { job } = await createJob(db, topic, ctx, { now, overrides: opts.overrides })
        return { topic: await readTopic(db, id), job }
      } catch (error) {
        if (error instanceof JobRefusedError) throw new TopicActionError(error.message, 400)
        throw error
      }
    }
    case "retry": {
      const ctx = opts.ctx ?? (await loadGenerationContext(db))
      try {
        const job = await retryFailedJob(db, topic, ctx, now)
        if (job) return { topic: await readTopic(db, id), job }
      } catch (error) {
        if (error instanceof JobRefusedError) throw new TopicActionError(error.message, 400)
        throw error
      }
      // Échec avant toute rédaction (sujet refusé à la préparation) : nouvelle rédaction
      try {
        const created = await createJob(db, { ...topic, status: "unplanned" }, ctx, { now })
        return { topic: await readTopic(db, id), job: created.job }
      } catch (error) {
        if (error instanceof JobRefusedError) throw new TopicActionError(error.message, 400)
        throw error
      }
    }
    case "archive":
      return { topic: await update({ status: "archived" }) }
    case "restore":
      return { topic: await update({ status: topic.post_id ? "drafted" : topic.scheduled_at ? "planned" : "unplanned" }) }
  }
}

/* ------------------------------------------------------------------ */
/* Créneaux                                                            */
/* ------------------------------------------------------------------ */

/** Jours de Paris déjà occupés : sujets planifiés et articles programmés à venir. */
export async function takenDays(db: SeoDb, now: Date): Promise<Set<string>> {
  const nowIso = now.toISOString()
  const [topics, posts] = await Promise.all([
    db.from("seo_topics").select("scheduled_at").in("status", ["planned", "generating", "drafted"]).gte("scheduled_at", nowIso).limit(500),
    db.from("blog_posts").select("scheduled_at").eq("is_published", false).gte("scheduled_at", nowIso).limit(500),
  ])
  const rows = (must(topics, "les sujets planifiés") as { scheduled_at: string | null }[]).concat(
    must(posts, "les articles programmés") as { scheduled_at: string | null }[],
  )
  const days = new Set<string>()
  rows.forEach((r) => {
    if (r.scheduled_at) days.add(parisDayTime(r.scheduled_at).day)
  })
  return days
}

/** Prochains créneaux libres du rythme des Préférences. */
export async function freeSlots(db: SeoDb, prefs: ArticleSettings, now: Date, count: number): Promise<Slot[]> {
  return nextSlots({ now, perWeek: prefs.perWeek, weekday: prefs.weekday, time: prefs.time, takenDays: await takenDays(db, now), count })
}

export interface BulkResult {
  updated: number
  skipped: { id: string; reason: string }[]
  jobs: string[]
}

/** Actions groupées de l'écran Sujets : planifier aux créneaux suivants, ou rédiger un brouillon. */
export async function bulkTopics(db: SeoDb, ids: string[], action: "schedule" | "draft", now = new Date()): Promise<BulkResult> {
  const unique = Array.from(new Set(ids))
  const rows = must(await db.from("seo_topics").select(TOPIC_COLUMNS).in("id", unique), "les sujets") as TopicRow[]
  const byId = new Map(rows.map((r) => [r.id, r]))
  const ctx = await loadGenerationContext(db)
  const out: BulkResult = { updated: 0, skipped: [], jobs: [] }

  if (action === "schedule") {
    const eligible = unique.map((id) => byId.get(id)).filter((t): t is TopicRow => Boolean(t && (t.status === "unplanned" || t.status === "failed") && !t.post_id))
    if (ctx.prefs.perWeek <= 0) {
      unique.forEach((id) => out.skipped.push({ id, reason: "Aucun créneau automatique : planifiez à la main" }))
      return out
    }
    const slots = await freeSlots(db, ctx.prefs, now, eligible.length)
    for (const id of unique) {
      const topic = byId.get(id)
      if (!topic) {
        out.skipped.push({ id, reason: "Sujet introuvable" })
        continue
      }
      const index = eligible.indexOf(topic)
      if (index < 0) {
        out.skipped.push({ id, reason: topicActionError("schedule") })
        continue
      }
      const slot = slots[index]
      if (!slot) {
        out.skipped.push({ id, reason: "Aucun créneau libre trouvé" })
        continue
      }
      await patchTopic(db, id, { action: "schedule", at: slot.at, publishMode: ctx.prefs.publishMode }, { now, ctx })
      out.updated++
    }
    return out
  }

  for (const id of unique) {
    const topic = byId.get(id)
    if (!topic) {
      out.skipped.push({ id, reason: "Sujet introuvable" })
      continue
    }
    if (!canApplyTopicAction(topic.status, "draft")) {
      out.skipped.push({ id, reason: topicActionError("draft") })
      continue
    }
    try {
      const { job } = await createJob(db, topic, ctx, { now })
      out.jobs.push(job.id)
      out.updated++
    } catch (error) {
      if (!(error instanceof JobRefusedError)) throw error
      out.skipped.push({ id, reason: error.message })
    }
  }
  return out
}
