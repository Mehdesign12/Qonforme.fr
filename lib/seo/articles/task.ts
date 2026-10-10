/**
 * Tâche planifiée « articles » (/api/cron/seo, toutes les 15 minutes), due à
 * chaque passage. Dans l'ordre, tant qu'il reste du temps :
 *
 * 1. publication à l'heure prévue : les articles dont la date est passée sont
 *    publiés ou retenus selon le mode de leur sujet (lib/seo/articles/publish.ts) ;
 *    en premier parce que c'est rapide et attendu à l'heure ;
 * 2. préparation : un sujet planifié dans les 24 heures et sans article reçoit
 *    sa rédaction (seo_article_jobs) ;
 * 3. rédaction : les passes en attente (ou dont le verrou a expiré) avancent,
 *    une à une, tant que le temps restant permet la passe suivante.
 *
 * Un sujet sans clé de modèle échoue avec un message clair (« Clé … absente ») ;
 * la tâche elle-même ne lève pas d'erreur pour autant.
 */
import type { SeoTask, SeoTaskContext } from "@/lib/seo/cron"
import { must, type SeoDb } from "@/lib/seo/db"
import { TOPIC_COLUMNS, type TopicRow } from "@/lib/seo/articles/status"
import { createJob, JobRefusedError, JOB_COLUMNS, loadGenerationContext, runJobStep, type JobRow } from "@/lib/seo/articles/generate"
import { publishDuePosts } from "@/lib/seo/articles/publish"

/** Délai de préparation avant l'heure prévue. */
export const PREPARE_AHEAD_MS = 24 * 60 * 60_000
/** Marge rendue au cron avant sa limite. */
const SAFETY_MS = 15_000

/** Sujets planifiés d'ici 24 h, sans article, qui reçoivent leur rédaction. */
export async function prepareScheduledTopics(db: SeoDb, now: Date): Promise<{ prepared: number; refused: number }> {
  const horizon = new Date(now.getTime() + PREPARE_AHEAD_MS).toISOString()
  const topics = must(
    await db
      .from("seo_topics")
      .select(TOPIC_COLUMNS)
      .eq("status", "planned")
      .is("post_id", null)
      .lte("scheduled_at", horizon)
      .order("scheduled_at", { ascending: true })
      .limit(10),
    "les sujets planifiés",
  ) as TopicRow[]
  if (topics.length === 0) return { prepared: 0, refused: 0 }
  const ctx = await loadGenerationContext(db)
  let prepared = 0
  let refused = 0
  for (const topic of topics) {
    try {
      const { created } = await createJob(db, topic, ctx, { now })
      if (created) prepared++
    } catch (error) {
      if (!(error instanceof JobRefusedError)) throw error
      refused++
      must(
        await db.from("seo_topics").update({ status: "failed", last_error: error.message, updated_at: now.toISOString() }).eq("id", topic.id),
        "le sujet",
      )
    }
  }
  return { prepared, refused }
}

/** Prochaine rédaction à faire avancer : en attente, ou bloquée (verrou expiré). */
async function nextJob(db: SeoDb, now: Date, skip: Set<string>): Promise<JobRow | null> {
  const nowIso = now.toISOString()
  const rows = must(
    await db
      .from("seo_article_jobs")
      .select(JOB_COLUMNS)
      .in("status", ["queued", "running"])
      .or(`lock_until.is.null,lock_until.lt."${nowIso}"`)
      .order("created_at", { ascending: true })
      .limit(20),
    "les rédactions en attente",
  ) as JobRow[]
  return rows.find((r) => !skip.has(r.id)) ?? null
}

export async function runArticlesTask(ctx: Pick<SeoTaskContext, "db" | "now" | "deadline">): Promise<Record<string, unknown>> {
  const { db } = ctx
  const deadline = ctx.deadline - SAFETY_MS
  const result = { published: 0, held: 0, prepared: 0, refused: 0, steps: 0, done: 0, failed: 0, deferred: false }

  const due = await publishDuePosts(db, { now: ctx.now, deadline })
  result.published = due.published
  result.held = due.held

  const prep = await prepareScheduledTopics(db, ctx.now)
  result.prepared = prep.prepared
  result.refused = prep.refused

  const genCtx = await loadGenerationContext(db)
  const skip = new Set<string>()
  // Garde-fou : jamais plus de 30 passes par passage
  for (let i = 0; i < 30 && Date.now() < deadline; i++) {
    const job = await nextJob(db, new Date(), skip)
    if (!job) break
    const outcome = await runJobStep(db, job.id, { now: new Date(), deadline, ctx: genCtx })
    if (outcome.deferred) {
      result.deferred = true
      break
    }
    if (outcome.locked || !outcome.ran) {
      skip.add(job.id)
      continue
    }
    result.steps++
    // Un article prêt dont l'heure est déjà passée est publié ou retenu par la passe d'enregistrement
    if (outcome.status === "done") result.done++
    if (outcome.status === "failed") {
      result.failed++
      skip.add(job.id)
    }
    if (outcome.status === "queued" && outcome.error) skip.add(job.id)
  }

  return result
}

/**
 * Y a-t-il quelque chose à faire ? Trois lectures légères : un article arrivé à
 * son heure, un sujet planifié d'ici 24 h sans article, une rédaction en
 * attente ou bloquée. Rien : la tâche ne tourne pas (pas de ligne de journal
 * toutes les 15 minutes). Une lecture en échec laisse tourner la tâche, qui
 * journalise l'erreur.
 */
export async function hasArticlesWork(db: SeoDb, now: Date): Promise<boolean> {
  const nowIso = now.toISOString()
  const horizon = new Date(now.getTime() + PREPARE_AHEAD_MS).toISOString()
  const [due, planned, jobs] = await Promise.all([
    db.from("blog_posts").select("id").eq("is_published", false).lte("scheduled_at", nowIso).is("review_status", null).limit(1),
    db.from("seo_topics").select("id").eq("status", "planned").is("post_id", null).lte("scheduled_at", horizon).limit(1),
    db.from("seo_article_jobs").select("id").in("status", ["queued", "running"]).or(`lock_until.is.null,lock_until.lt."${nowIso}"`).limit(1),
  ])
  if (due.error || planned.error || jobs.error) return true
  return [due.data, planned.data, jobs.data].some((rows) => Array.isArray(rows) && rows.length > 0)
}

export const articlesTask: SeoTask = {
  name: "articles",
  label: "SEO · Articles",
  // Due quand il y a une publication à faire, un sujet à préparer ou une rédaction en attente
  isDue: ({ db, now }) => hasArticlesWork(db, now),
  run: (ctx) => runArticlesTask(ctx),
  // Une passe de rédaction dure jusqu'à environ 4 minutes
  lockMs: 6 * 60_000,
  minBudgetMs: 20_000,
}
