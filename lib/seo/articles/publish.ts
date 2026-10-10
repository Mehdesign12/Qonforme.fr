/**
 * Publication des articles : à la main (« Publier maintenant », « Repasser en
 * brouillon ») et à l'heure prévue (tâche planifiée).
 *
 * Le contrôle repasse toujours sur le texte du moment (l'article a pu être relu
 * et modifié depuis sa rédaction) :
 * - « Publier maintenant » est refusé tant qu'une valeur périmée ou une
 *   affirmation interdite reste ;
 * - à l'heure prévue, la décision suit le mode du sujet (lib/seo/articles/check.ts) :
 *   brouillon → jamais publié ; après contrôle → publié si rien n'est repéré ;
 *   directement → publié sauf valeur périmée ou affirmation interdite.
 *
 * Après chaque publication ou retrait : revalidateBlog(slug) (liste, article,
 * plans du site).
 */
import { must, type SeoDb } from "@/lib/seo/db"
import { getAllSettings, type ArticleSettings } from "@/lib/seo/settings"
import { revalidateBlog } from "@/lib/blog-revalidate"
import type { PublishMode } from "@/lib/seo/types"
import {
  auditResultOf,
  checkArticle,
  decidePublication,
  manualPublishBlockers,
  readAuditResult,
  storedReviewIssues,
  type CheckIssue,
  type ExistingArticle,
} from "@/lib/seo/articles/check"

export interface PublishablePost {
  id: string
  slug: string
  title: string
  excerpt: string | null
  content: string
  is_published: boolean
  published_at: string | null
  scheduled_at: string | null
  review_status: string | null
  seo_description: string | null
  ai_keywords?: string[] | null
  audit_result?: unknown
}

const PUBLISHABLE_COLUMNS =
  "id, slug, title, excerpt, content, is_published, published_at, scheduled_at, review_status, seo_description, ai_keywords, audit_result"

export interface CheckContext {
  competitors: string[]
  prefs: ArticleSettings
  existing: ExistingArticle[]
}

export async function loadCheckContext(db: SeoDb): Promise<CheckContext> {
  const [settings, existing] = await Promise.all([
    getAllSettings(db),
    db.from("blog_posts").select("id, title, slug").limit(1000),
  ])
  return {
    competitors: settings.targeting.value.competitors,
    prefs: settings.articles.value,
    existing: must(existing, "les articles du blog") as ExistingArticle[],
  }
}

/** Contrôle d'un article enregistré, sur son texte actuel. */
/**
 * Contrôle d'un article sur son texte actuel : les règles locales (avec la
 * longueur et la FAQ demandées à la rédaction, gardées dans audit_result), plus
 * les passages repérés par le relecteur qui sont toujours dans le texte et un
 * éventuel « Contrôle factuel non fait ».
 */
export function checkPost(post: PublishablePost, ctx: CheckContext): CheckIssue[] {
  const content = post.content ?? ""
  const brief = readAuditResult(post.audit_result)?.brief
  const local = checkArticle({
    title: post.title,
    content,
    metaDescription: post.seo_description ?? post.excerpt ?? null,
    slug: post.slug,
    keywords: post.ai_keywords ?? null,
    selfId: post.id,
    competitors: ctx.competitors,
    existing: ctx.existing,
    ...(brief ? { lengthMin: brief.lengthMin, lengthMax: brief.lengthMax, faq: brief.faq } : {}),
  })
  return storedReviewIssues(post.audit_result, content).concat(local)
}

/** Nouvel audit_result : les problèmes du moment (relecteur compris) et la consigne de rédaction conservée. */
function auditOf(post: PublishablePost, issues: CheckIssue[], now: Date) {
  const previous = readAuditResult(post.audit_result)
  return auditResultOf(issues, now, { autoFixes: previous?.autoFixes, fixPass: previous?.fixPass, brief: previous?.brief })
}

export async function readPublishablePost(db: SeoDb, id: string): Promise<PublishablePost | null> {
  return must(await db.from("blog_posts").select(PUBLISHABLE_COLUMNS).eq("id", id).maybeSingle(), "l'article") as PublishablePost | null
}

async function markTopic(db: SeoDb, postId: string, status: "published" | "drafted", nowIso: string): Promise<void> {
  const { error } = await db.from("seo_topics").update({ status, updated_at: nowIso }).eq("post_id", postId).in("status", ["drafted", "published", "generating"])
  if (error) console.error("[seo-articles] sujet non mis à jour", error.message)
}

export type ManualPublishResult = { ok: true } | { ok: false; blockers: CheckIssue[] }

/** « Publier maintenant » : refusé si une valeur périmée ou une affirmation interdite reste dans le texte. */
export async function publishNow(db: SeoDb, post: PublishablePost, ctx: CheckContext, now = new Date()): Promise<ManualPublishResult> {
  // Déjà publié : rien à écrire (un audit_result d'article publié est lisible par tous)
  if (post.is_published) return { ok: true }
  const issues = checkPost(post, ctx)
  const blockers = manualPublishBlockers(issues)
  const nowIso = now.toISOString()
  if (blockers.length > 0) {
    must(
      await db.from("blog_posts").update({ audit_result: auditOf(post, issues, now), updated_at: nowIso }).eq("id", post.id),
      "le contrôle de l'article",
    )
    return { ok: false, blockers }
  }
  must(
    await db
      .from("blog_posts")
      .update({
        is_published: true,
        published_at: nowIso,
        review_status: "approved",
        held_reason: null,
        audit_result: auditOf(post, issues, now),
        updated_at: nowIso,
      })
      .eq("id", post.id),
    "la publication de l'article",
  )
  await markTopic(db, post.id, "published", nowIso)
  revalidateBlog(post.slug)
  return { ok: true }
}

/** « Repasser en brouillon » : l'article quitte le blog et la date prévue est retirée (sinon la tâche le republierait). */
export async function unpublish(db: SeoDb, post: PublishablePost, now = new Date()): Promise<void> {
  const nowIso = now.toISOString()
  must(
    await db
      .from("blog_posts")
      .update({ is_published: false, scheduled_at: null, review_status: null, updated_at: nowIso })
      .eq("id", post.id),
    "le retrait de l'article",
  )
  await markTopic(db, post.id, "drafted", nowIso)
  revalidateBlog(post.slug)
}

/**
 * Articles arrivés à leur heure (non publiés, date prévue passée, aucune
 * décision encore prise) : publiés ou retenus selon le mode de leur sujet.
 */
export async function publishDuePosts(
  db: SeoDb,
  opts: { now: Date; deadline: number; ctx?: CheckContext; limit?: number },
): Promise<{ published: number; held: number }> {
  const nowIso = opts.now.toISOString()
  const due = must(
    await db
      .from("blog_posts")
      .select(PUBLISHABLE_COLUMNS)
      .eq("is_published", false)
      .lte("scheduled_at", nowIso)
      .is("review_status", null)
      .order("scheduled_at", { ascending: true })
      .limit(opts.limit ?? 20),
    "les articles à publier",
  ) as PublishablePost[]
  if (due.length === 0) return { published: 0, held: 0 }

  const ctx = opts.ctx ?? (await loadCheckContext(db))
  const topics = must(
    await db.from("seo_topics").select("post_id, publish_mode").in("post_id", due.map((p) => p.id)),
    "les sujets",
  ) as { post_id: string; publish_mode: PublishMode }[]
  const modeOf = new Map(topics.map((t) => [t.post_id, t.publish_mode]))

  let published = 0
  let held = 0
  for (const post of due) {
    if (Date.now() > opts.deadline - 5_000) break
    const mode = modeOf.get(post.id) ?? ctx.prefs.publishMode
    const issues = checkPost(post, ctx)
    const decision = decidePublication(mode, issues)
    const now = new Date().toISOString()
    if (decision.publish) {
      must(
        await db
          .from("blog_posts")
          // « approved » : un article repassé ensuite en brouillon depuis l'éditeur n'est pas republié par la tâche
          .update({ is_published: true, published_at: now, review_status: "approved", held_reason: null, audit_result: auditOf(post, issues, opts.now), updated_at: now })
          .eq("id", post.id)
          .eq("is_published", false),
        "la publication de l'article",
      )
      await markTopic(db, post.id, "published", now)
      revalidateBlog(post.slug)
      published++
    } else {
      must(
        await db
          .from("blog_posts")
          .update({ review_status: "to_review", held_reason: decision.heldReason, audit_result: auditOf(post, issues, opts.now), updated_at: now })
          .eq("id", post.id),
        "le contrôle de l'article",
      )
      held++
    }
  }
  return { published, held }
}
