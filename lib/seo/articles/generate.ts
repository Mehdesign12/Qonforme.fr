/**
 * Rédaction d'un article en plusieurs passes, une passe par appel, avec reprise
 * (table seo_article_jobs) :
 *
 *   plan → rédaction → contrôle → [correction → contrôle] → maillage → couverture → enregistrement
 *
 * - plan : titre (70 caractères au plus), adresse, sections, questions de la FAQ,
 *   mots-clés, sources officielles ;
 * - rédaction : article complet en Markdown du blog ;
 * - contrôle : relecture factuelle par le modèle de contrôle (il relit
 *   l'article contre les faits de référence et rend une liste précise de
 *   problèmes ; un autre modèle que la rédaction), puis lib/seo/articles/check.ts
 *   (règles de lib/blog-audit.ts, concurrents, longueur, titres, liens, doublons) ;
 * - correction : une seule passe ciblée, par le modèle de rédaction (même
 *   auteur), sur la liste des problèmes, puis nouveau contrôle ;
 * - maillage : liens internes (lib/seo/links) : adresses inventées retirées,
 *   liens complétés jusqu'à l'objectif de la longueur de l'article ; sans
 *   modèle, un échec n'empêche pas l'article ;
 * - couverture : image dessinée par le code (lib/blog-images/cover), dans le
 *   stockage « blog-covers » ; un échec n'empêche pas l'article ;
 * - enregistrement : blog_posts (brouillon, « À relire » ou publication selon
 *   le mode du sujet) et sujet « Rédigé ».
 *
 * La fenêtre « Générer un article » appelle une passe à la fois
 * (POST /api/admin/seo/articles/jobs/<id>/step) ; la tâche planifiée
 * (lib/seo/articles/task.ts) termine les rédactions en attente. Un verrou
 * (lock_until) empêche deux passes simultanées sur le même travail.
 *
 * Modèles par passe (Préférences › Rédaction) : plan → planModel, rédaction et
 * correction → textModel, contrôle → reviewModel. Une clé absente fait passer
 * la passe sur le modèle du plan ; le repli est noté dans l'état du travail et
 * affiché (jamais d'échec silencieux).
 *
 * Les concurrents (Paramètres › Ciblage) ne sont jamais envoyés au modèle :
 * chaque consigne passe par assertNoCompetitorInPrompt.
 */
import { z } from "zod"
import { must, type SeoDb } from "@/lib/seo/db"
import { getAllSettings, type ArticleSettings, type BrandSettings, type StrategySettings } from "@/lib/seo/settings"
import { assertNoCompetitorInPrompt, CompetitorLeakError, findCompetitorMentions } from "@/lib/seo/competitors"
import { auditArticle } from "@/lib/blog-audit"
import { fitDescription } from "@/lib/seo/meta"
import { revalidateBlog } from "@/lib/blog-revalidate"
import { makeCover } from "@/lib/blog-images/cover/make"
import { describePassage } from "@/lib/blog-images/describe"
import { readImageSize } from "@/lib/blog-images/policy"
import { altFromDescription, buildImagePrompt } from "@/lib/blog-images/prompt"
import { descriptionFromSuggestion } from "@/lib/blog-images/passage"
import { BlogImageError, storeBlogImage } from "@/lib/blog-images/server"
import { MAX_INLINE_IMAGES, imageMarkdown, insertImageAfterParagraph, inlineImageCount, planImageSlots, type ImageSlot } from "@/lib/seo/articles/images"
import { wordCount } from "@/lib/seo/links/text"
import { loadLinkCandidates, validLinkPaths } from "@/lib/seo/links/catalog"
import { cleanInternalLinks, linkGoal, rankRelated, topUpLinks } from "@/lib/seo/links/engine"
import type { ArticleType, PublishMode } from "@/lib/seo/types"
import {
  findImageModel,
  generateImage,
  generateText,
  hasKey,
  modelLabel,
  ModelError,
  PASS_LABELS,
  resolvePassModel,
  type ModelPass,
  type PassModelChoice,
} from "@/lib/seo/articles/models"
import {
  PLAN_JSON_SCHEMA,
  REVIEW_JSON_SCHEMA,
  buildFixPrompt,
  buildPlanPrompt,
  buildReviewPrompt,
  buildSystemPrompt,
  buildWritePrompt,
  findAngle,
  isOfficialUrl,
  nextAngle,
  type ArticleBrief,
  type ArticlePlan,
  type FixInstruction,
  type LinkGuide,
} from "@/lib/seo/articles/prompt"
import {
  auditResultOf,
  checkArticle,
  decidePublication,
  normalizeContent,
  parseReview,
  redactCompetitors,
  ReviewInvalidError,
  reviewMissingIssue,
  slugify,
  type CheckIssue,
  type ExistingArticle,
} from "@/lib/seo/articles/check"
import { TOPIC_COLUMNS, type TopicRow } from "@/lib/seo/articles/status"

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type JobStep = "plan" | "write" | "check" | "fix" | "links" | "images" | "cover" | "save" | "done"
export type JobStatus = "queued" | "running" | "done" | "failed"

export const STEP_LABELS: Record<JobStep, string> = {
  plan: "Plan…",
  write: "Rédaction…",
  check: "Contrôle…",
  fix: "Correction…",
  links: "Maillage…",
  images: "Photos…",
  cover: "Image…",
  save: "Enregistrement…",
  done: "Article prêt",
}

/** Réglages figés à la création du travail : une préférence changée ensuite ne touche pas une rédaction en cours. */
export interface JobInput {
  title: string
  keyword: string | null
  articleType: ArticleType
  angle: string | null
  notes: string | null
  lengthMin: number
  lengthMax: number
  faq: { min: number; max: number } | null
  officialSources: boolean
  /** Modèle du plan (et de repli si la clé d'un autre modèle manque). */
  planModel: string
  /** Modèle de la rédaction et de la correction. */
  textModel: string
  /** Modèle du contrôle factuel. */
  reviewModel: string
  coverImage: boolean
  imageModel: string
  /** Liens internes automatiques (Préférences) ; absent d'un travail créé avant : activé. */
  autoLinks?: boolean
  /** Plafond de photos dans le texte (Préférences) ; absent d'un travail créé avant : aucune. */
  inlineImages?: number
}

/** Une photo du texte : créée et insérée, ou le motif pour lequel elle ne l'a pas été. */
export interface InlineImageResult {
  headingIndex: number
  heading: string
  url?: string
  alt?: string
  model?: string
  error?: string
}

export interface JobState {
  input: JobInput
  plan?: ArticlePlan
  planError?: string | null
  content?: string
  issues?: CheckIssue[]
  autoFixes?: string[]
  fixed?: boolean
  /** Maillage interne : liens avant et après la passe, ajoutés par le code, adresses retirées. */
  links?: { before: number; after: number; added: { path: string; anchor: string }[]; related: number; removed: string[] }
  /** Photos du texte : sections choisies (figées à la première passe) et résultat de chacune, dans l'ordre. */
  imageSlots?: ImageSlot[]
  images?: InlineImageResult[]
  cover?: { url: string; alt: string; model: string } | null
  coverError?: string | null
  slug?: string
  usage?: { inputTokens: number; outputTokens: number }
  /** Modèle réellement utilisé par passe (repli compris). */
  models?: Partial<Record<ModelPass, PassModelChoice>>
  /** Replis et incidents à afficher (clé absente, image de repli, contrôle factuel non fait). */
  notices?: string[]
  /** Dernier échec : « fatal » (contenu, refus, clé) fait repartir « Réessayer » du plan. */
  lastFailure?: { step: JobStep; fatal: boolean; message: string }
  /** Passes jouées depuis la création ou le dernier « Réessayer » (plafond MAX_PASSES). */
  passes?: number
}

export interface JobRow {
  id: string
  topic_id: string | null
  status: JobStatus
  step: JobStep
  state: JobState
  model: string | null
  attempts: number
  error: string | null
  post_id: string | null
  lock_until: string | null
  created_at: string
  updated_at: string
}

export const JOB_COLUMNS = "id, topic_id, status, step, state, model, attempts, error, post_id, lock_until, created_at, updated_at"

/** Essais d'une passe avant l'échec du travail. */
export const MAX_ATTEMPTS = 3
/**
 * Passes jouées au plus par une rédaction (réussies ou non) : le parcours le
 * plus long avec tous ses nouveaux essais en compte 22 (plan, rédaction,
 * contrôle, correction, contrôle, maillage et enregistrement à 3 essais, image à 1),
 * plus une passe par photo du texte (6 au plus, chacune à 1 essai : un échec de photo n'empêche jamais l'article).
 * Au-delà, la rédaction s'arrête : aucune boucle d'appels payants.
 */
export const MAX_PASSES = 24 + MAX_INLINE_IMAGES
/** Verrou d'une passe (une passe dure au plus 300 s dans la route). */
const STEP_LOCK_MS = 5 * 60_000

/** Temps minimal pour lancer une passe, et délai maximal de l'appel au modèle. */
export const STEP_BUDGET_MS: Record<Exclude<JobStep, "done">, { min: number; max: number }> = {
  plan: { min: 45_000, max: 100_000 },
  write: { min: 120_000, max: 250_000 },
  check: { min: 40_000, max: 120_000 },
  fix: { min: 120_000, max: 250_000 },
  links: { min: 8_000, max: 25_000 },
  images: { min: 60_000, max: 110_000 },
  cover: { min: 15_000, max: 45_000 },
  save: { min: 5_000, max: 20_000 },
}

/* ------------------------------------------------------------------ */
/* Contexte                                                            */
/* ------------------------------------------------------------------ */

export interface GenerationContext {
  brand: BrandSettings
  strategy: StrategySettings
  prefs: ArticleSettings
  /** Usage interne : contrôle et garde-fou de consigne seulement. */
  competitors: string[]
}

export async function loadGenerationContext(db: SeoDb): Promise<GenerationContext> {
  const all = await getAllSettings(db)
  return {
    brand: all.brand.value,
    strategy: all.strategy.value,
    prefs: all.articles.value,
    competitors: all.targeting.value.competitors,
  }
}

/** Articles du blog (publiés ou non) : doublons et titres à ne pas reprendre. */
async function existingArticles(db: SeoDb): Promise<ExistingArticle[]> {
  const rows = must(
    await db.from("blog_posts").select("id, title, slug").order("created_at", { ascending: false }).limit(500),
    "les articles du blog",
  ) as ExistingArticle[]
  return rows
}

export async function readTopic(db: SeoDb, id: string): Promise<TopicRow | null> {
  return must(await db.from("seo_topics").select(TOPIC_COLUMNS).eq("id", id).maybeSingle(), "le sujet") as TopicRow | null
}

export async function readJob(db: SeoDb, id: string): Promise<JobRow | null> {
  return must(await db.from("seo_article_jobs").select(JOB_COLUMNS).eq("id", id).maybeSingle(), "la rédaction") as JobRow | null
}

/* ------------------------------------------------------------------ */
/* Création                                                            */
/* ------------------------------------------------------------------ */

export interface JobOverrides {
  lengthMin?: number
  lengthMax?: number
  /** Clé d'angle ; « varied » : rotation selon les préférences. */
  angle?: string | null
}

/** Angles des dernières rédactions (la plus récente en tête). */
async function recentAngles(db: SeoDb): Promise<(string | null)[]> {
  const rows = must(
    await db.from("seo_article_jobs").select("state").order("created_at", { ascending: false }).limit(8),
    "les rédactions récentes",
  ) as { state: JobState | null }[]
  return rows.map((r) => r.state?.input?.angle ?? null)
}

export function buildJobInput(topic: Pick<TopicRow, "title" | "keyword" | "article_type" | "notes">, prefs: ArticleSettings, angle: string | null, overrides: JobOverrides = {}): JobInput {
  const lengthMin = overrides.lengthMin ?? prefs.lengthMin
  const lengthMax = Math.max(lengthMin, overrides.lengthMax ?? prefs.lengthMax)
  return {
    title: topic.title,
    keyword: topic.keyword,
    articleType: topic.article_type,
    angle,
    notes: topic.notes,
    lengthMin,
    lengthMax,
    faq: prefs.faq ? { min: prefs.faqMin, max: prefs.faqMax } : null,
    officialSources: prefs.officialSources,
    planModel: prefs.planModel,
    textModel: prefs.textModel,
    reviewModel: prefs.reviewModel,
    coverImage: prefs.coverImage,
    imageModel: prefs.imageModel,
    autoLinks: prefs.autoLinks,
    inlineImages: prefs.inlineImages,
  }
}

export class JobRefusedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "JobRefusedError"
  }
}

/**
 * Crée la rédaction d'un sujet (ou rend celle déjà en cours) et passe le sujet
 * « Rédaction en cours ». Refuse un sujet qui nomme un concurrent suivi.
 */
export async function createJob(
  db: SeoDb,
  topic: TopicRow,
  ctx: GenerationContext,
  opts: { overrides?: JobOverrides; now?: Date } = {},
): Promise<{ job: JobRow; created: boolean }> {
  const active = must(
    await db.from("seo_article_jobs").select(JOB_COLUMNS).eq("topic_id", topic.id).in("status", ["queued", "running"]).limit(1),
    "les rédactions",
  ) as JobRow[]
  if (active[0]) return { job: active[0], created: false }

  if (findCompetitorMentions(`${topic.title}\n${topic.keyword ?? ""}\n${topic.notes ?? ""}`, ctx.competitors).length > 0) {
    throw new JobRefusedError("Ce sujet nomme un concurrent suivi (usage interne) : il ne peut pas être rédigé. Reformulez-le sans ce nom.")
  }

  const requested = opts.overrides?.angle
  let angle: string | null
  if (requested && requested !== "varied" && findAngle(requested)) angle = requested
  else if (topic.angle && findAngle(topic.angle) && requested !== "varied") angle = topic.angle
  else angle = ctx.prefs.alternateAngles ? nextAngle(await recentAngles(db)).key : null

  const input = buildJobInput(topic, ctx.prefs, angle, opts.overrides)
  const nowIso = (opts.now ?? new Date()).toISOString()
  const inserted = await db
    .from("seo_article_jobs")
    .insert({ topic_id: topic.id, status: "queued", step: "plan", state: { input }, model: input.textModel, attempts: 0, created_at: nowIso, updated_at: nowIso })
    .select(JOB_COLUMNS)
    .single()
  if (inserted.error?.code === "23505") {
    // Rédaction créée au même moment par un autre passage (index unique des travaux actifs)
    const again = must(
      await db.from("seo_article_jobs").select(JOB_COLUMNS).eq("topic_id", topic.id).in("status", ["queued", "running"]).limit(1),
      "les rédactions",
    ) as JobRow[]
    if (again[0]) return { job: again[0], created: false }
  }
  const job = must(inserted, "la création de la rédaction") as JobRow
  must(
    await db.from("seo_topics").update({ status: "generating", last_error: null, updated_at: nowIso }).eq("id", topic.id),
    "le sujet",
  )
  return { job, created: true }
}

/** Le sujet a-t-il changé depuis la création de la rédaction (titre, mot-clé, type, angle, notes) ? */
export function topicChangedSince(topic: Pick<TopicRow, "title" | "keyword" | "article_type" | "notes" | "angle">, input: JobInput): boolean {
  return (
    topic.title !== input.title ||
    (topic.keyword ?? null) !== (input.keyword ?? null) ||
    topic.article_type !== input.articleType ||
    (topic.notes ?? null) !== (input.notes ?? null) ||
    (topic.angle !== null && topic.angle !== input.angle)
  )
}

/**
 * Relance une rédaction en échec. Un échec passager reprend à la passe où il
 * s'était arrêté ; un échec qui vient du contenu (concurrent, refus du modèle,
 * clé refusée) ou un sujet modifié depuis repart du plan, avec les réglages
 * recalculés depuis le sujet et les préférences.
 */
export async function retryFailedJob(db: SeoDb, topic: TopicRow, ctx: GenerationContext, now = new Date()): Promise<JobRow | null> {
  const rows = must(
    await db.from("seo_article_jobs").select(JOB_COLUMNS).eq("topic_id", topic.id).eq("status", "failed").order("created_at", { ascending: false }).limit(1),
    "les rédactions",
  ) as JobRow[]
  const job = rows[0]
  if (!job) return null
  const input = job.state?.input
  const restart = !input || Boolean(job.state?.lastFailure?.fatal) || topicChangedSince(topic, input)
  if (restart && findCompetitorMentions(`${topic.title}\n${topic.keyword ?? ""}\n${topic.notes ?? ""}`, ctx.competitors).length > 0) {
    throw new JobRefusedError("Ce sujet nomme un concurrent suivi (usage interne) : il ne peut pas être rédigé. Reformulez-le sans ce nom.")
  }
  const nowIso = now.toISOString()
  const reset = restart
    ? {
        step: "plan",
        state: {
          input: buildJobInput(topic, ctx.prefs, topic.angle && findAngle(topic.angle) ? topic.angle : (input?.angle ?? null), {
            lengthMin: input?.lengthMin,
            lengthMax: input?.lengthMax,
          }),
        },
        model: ctx.prefs.textModel,
      }
    : // Reprise de la passe : nouveau plafond de passes (décision de l'administrateur)
      { state: { ...job.state, passes: 0 } }
  const updated = must(
    await db
      .from("seo_article_jobs")
      .update({ status: "queued", attempts: 0, error: null, lock_until: null, updated_at: nowIso, ...reset })
      .eq("id", job.id)
      .select(JOB_COLUMNS),
    "la rédaction",
  ) as JobRow[]
  must(await db.from("seo_topics").update({ status: "generating", last_error: null, updated_at: nowIso }).eq("id", topic.id), "le sujet")
  return updated[0] ?? null
}

/* ------------------------------------------------------------------ */
/* Passes                                                              */
/* ------------------------------------------------------------------ */

/** Titre, description et mots-clés vont dans les balises de la page : aucun chevron (« </script> »). */
const noAngle = (s: string) => !/[<>]/.test(s)

const planSchema = z.object({
  title: z.string().trim().min(10, "Titre trop court").max(70, "Titre de plus de 70 caractères").refine(noAngle, "Titre avec un chevron « < » ou « > »"),
  slug: z.string().trim().max(120, "Adresse de plus de 120 caractères"),
  metaDescription: z
    .string()
    .trim()
    .min(90, "Description de moins de 90 caractères")
    .max(220, "Description de plus de 220 caractères")
    .refine(noAngle, "Description avec un chevron « < » ou « > »"),
  outline: z
    .array(z.object({ h2: z.string().trim().min(2, "Titre de section vide"), h3: z.array(z.string().trim()).default([]) }))
    .min(3, "Plan de moins de 3 sections")
    .max(12, "Plan de plus de 12 sections"),
  faq: z.array(z.string().trim()).default([]),
  keywords: z.array(z.string().trim().refine(noAngle, "Mot-clé avec un chevron « < » ou « > »")).default([]),
  sources: z.array(z.object({ title: z.string().trim(), url: z.string().trim() })).default([]),
})

export class PlanInvalidError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PlanInvalidError"
  }
}

/** Lit le JSON du plan (avec ou sans bloc de code autour) et le valide. */
export function parsePlan(text: string, brief: Pick<ArticleBrief, "faq">): ArticlePlan {
  const raw = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new PlanInvalidError("Le plan renvoyé n'est pas un JSON lisible")
  }
  const parsed = planSchema.safeParse(data)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    // Messages de zod en anglais (type inattendu, champ absent) : on nomme le champ en français
    const ours = issue && !/^(Invalid|Too|Expected|Required|Unrecognized)/.test(issue.message)
    throw new PlanInvalidError(ours ? issue.message : `Champ « ${issue?.path.join(".") || "plan"} » absent ou invalide`)
  }
  const p = parsed.data
  return {
    title: p.title.replace(/\s+/g, " "),
    slug: slugify(p.slug || p.title) || slugify(p.title),
    metaDescription: fitDescription(p.metaDescription),
    outline: p.outline.map((s) => ({ h2: s.h2, h3: s.h3.filter(Boolean) })),
    faq: brief.faq ? p.faq.filter((q) => q.length > 3).map((q) => (q.endsWith("?") ? q : `${q} ?`)).slice(0, brief.faq.max) : [],
    keywords: Array.from(new Set(p.keywords.map((k) => k.toLowerCase()).filter(Boolean))).slice(0, 8),
    // Seules les adresses officielles passent (domaines .gouv.fr et service-public.fr)
    sources: p.sources.filter((s) => s.title && isOfficialUrl(s.url)).slice(0, 8),
  }
}

function briefOf(input: JobInput): ArticleBrief {
  return {
    title: input.title,
    keyword: input.keyword,
    articleType: input.articleType,
    angle: input.angle,
    notes: input.notes,
    lengthMin: input.lengthMin,
    lengthMax: input.lengthMax,
    faq: input.faq,
  }
}

/** Jetons de sortie : réflexion comprise (toujours active sur Opus 5.5), avec de la marge pour 2 500 mots et plus. */
function writeTokens(input: JobInput): number {
  return Math.max(32_000, Math.min(64_000, Math.round(input.lengthMax * 10)))
}

interface StepEnv {
  db: SeoDb
  ctx: GenerationContext
  job: JobRow
  now: Date
  /** Délai de l'appel au modèle pour cette passe (ms). */
  timeoutMs: number
}

type StepResult = { next: JobStep; state: Partial<JobState>; postId?: string }

function addUsage(state: JobState, usage: { inputTokens: number | null; outputTokens: number | null }): JobState["usage"] {
  return {
    inputTokens: (state.usage?.inputTokens ?? 0) + (usage.inputTokens ?? 0),
    outputTokens: (state.usage?.outputTokens ?? 0) + (usage.outputTokens ?? 0),
  }
}

const PASS_MODEL_FIELD: Record<ModelPass, "planModel" | "textModel" | "reviewModel"> = {
  plan: "planModel",
  write: "textModel",
  review: "reviewModel",
}

/** Modèle d'une passe et, en cas de repli, la phrase à afficher. */
export function passModel(input: JobInput, pass: ModelPass, keyPresent: (env: "GEMINI_API_KEY" | "ANTHROPIC_API_KEY") => boolean = hasKey): { choice: PassModelChoice; notice: string | null } {
  const choice = resolvePassModel(input[PASS_MODEL_FIELD[pass]], input.planModel, keyPresent)
  const notice = choice.fallbackReason
    ? `${PASS_LABELS[pass]} par ${modelLabel(choice.model)} au lieu de ${modelLabel(choice.requested)} : ${choice.fallbackReason}.`
    : null
  return { choice, notice }
}

function withNotice(state: JobState, notice: string | null): string[] | undefined {
  if (!notice) return state.notices
  const list = state.notices ?? []
  return list.includes(notice) ? list : [...list, notice]
}

interface TextCall {
  text: string
  usage: { inputTokens: number | null; outputTokens: number | null }
  choice: PassModelChoice
  notice: string | null
}

/** Appel au modèle d'une passe, après le garde-fou des concurrents. */
async function callText(env: StepEnv, pass: ModelPass, prompt: string, opts: { schema?: Record<string, unknown>; maxOutputTokens: number }): Promise<TextCall> {
  const input = env.job.state.input
  const system = buildSystemPrompt(
    { brand: env.ctx.brand, strategy: env.ctx.strategy, prefs: { ...env.ctx.prefs, officialSources: input.officialSources } },
    pass === "review" ? "reviewer" : "writer",
  )
  assertNoCompetitorInPrompt(`${system}\n${prompt}`, env.ctx.competitors)
  const { choice, notice } = passModel(input, pass)
  const res = await generateText({
    model: choice.model,
    system,
    prompt,
    maxOutputTokens: opts.maxOutputTokens,
    json: opts.schema ? { schema: opts.schema } : undefined,
    timeoutMs: env.timeoutMs,
  })
  if (res.fallbackFrom) {
    // Fournisseur indisponible (surcharge, 5xx) malgré les nouveaux essais : la passe a tourné sur le modèle de repli
    const outage = `${PASS_LABELS[pass]} par ${modelLabel(res.model)} au lieu de ${modelLabel(res.fallbackFrom.model)} : ${res.fallbackFrom.reason}.`
    return {
      text: res.text,
      usage: res.usage,
      choice: { model: res.model, requested: choice.requested, fallbackReason: res.fallbackFrom.reason },
      notice: [notice, outage].filter(Boolean).join(" "),
    }
  }
  return { text: res.text, usage: res.usage, choice, notice }
}

function trace(state: JobState, pass: ModelPass, call: TextCall): Pick<JobState, "models" | "notices" | "usage"> {
  return {
    models: { ...(state.models ?? {}), [pass]: call.choice },
    notices: withNotice(state, call.notice),
    usage: addUsage(state, call.usage),
  }
}

async function stepPlan(env: StepEnv): Promise<StepResult> {
  const { input } = env.job.state
  const existing = await existingArticles(env.db)
  const titles = existing
    .map((a) => a.title)
    .filter((t) => t && findCompetitorMentions(t, env.ctx.competitors).length === 0)
    .slice(0, 40)
  const prompt = buildPlanPrompt(briefOf(input), { existingTitles: titles, previousError: env.job.state.planError ?? null })
  const res = await callText(env, "plan", prompt, { schema: PLAN_JSON_SCHEMA, maxOutputTokens: 16_000 })
  let plan: ArticlePlan
  try {
    plan = parsePlan(res.text, briefOf(input))
  } catch (error) {
    if (error instanceof PlanInvalidError) {
      // Le prochain essai reçoit le motif du refus
      await saveState(env.db, env.job.id, { ...env.job.state, ...trace(env.job.state, "plan", res), planError: error.message })
    }
    throw error
  }
  // Tout le plan est contrôlé (l'adresse devient l'URL publique, les mots-clés sont publiés) :
  // un concurrent relance le plan avec son motif, il ne fait pas échouer la rédaction
  const planText = [
    plan.title,
    plan.metaDescription,
    plan.slug.replace(/-/g, " "),
    ...plan.outline.flatMap((sec) => [sec.h2, ...sec.h3]),
    ...plan.faq,
    ...plan.keywords,
    ...plan.sources.map((src) => src.title),
  ].join("\n")
  if (findCompetitorMentions(planText, env.ctx.competitors).length > 0) {
    const reason = "Le plan nommait un autre logiciel (titre, adresse, sections, FAQ ou mots-clés)"
    await saveState(env.db, env.job.id, { ...env.job.state, ...trace(env.job.state, "plan", res), planError: reason })
    throw new PlanInvalidError(reason)
  }
  // Un mot-clé qui cite une valeur périmée ou une affirmation interdite n'est pas publié
  plan.keywords = plan.keywords.filter((k) => auditArticle(k).length === 0)
  return { next: "write", state: { plan, planError: null, ...trace(env.job.state, "plan", res) } }
}

/** Sujet d'un article pour le maillage : titre, mot-clé, sections et mots-clés du plan. */
function topicOf(state: JobState): string {
  const { input, plan } = state
  return [plan?.title ?? input.title, input.keyword, ...(plan?.outline.map((s) => s.h2) ?? []), ...(plan?.keywords ?? [])].filter(Boolean).join(" ")
}

/** Pages que le rédacteur peut lier et nombre de liens attendu ; null sans liens automatiques ou si le catalogue est illisible. */
async function linkGuideFor(env: StepEnv): Promise<LinkGuide | null> {
  const { state } = env.job
  if (state.input.autoLinks === false || !state.plan) return null
  try {
    const candidates = await loadLinkCandidates(env.db)
    const words = Math.round((state.input.lengthMin + state.input.lengthMax) / 2)
    const goal = linkGoal(words)
    const pages = rankRelated(topicOf(state), candidates, { limit: 14, keyword: state.input.keyword, exclude: [`/blog/${state.plan.slug}`] })
    if (pages.length === 0) return null
    return {
      min: goal.min,
      max: goal.max,
      pages: pages.map((c) => ({ path: c.path, title: c.title, anchors: c.phrases.filter((p): p is string => typeof p === "string").slice(0, 2) })),
    }
  } catch (error) {
    console.error("[seo-articles] liste de pages à lier indisponible", error instanceof Error ? error.message.slice(0, 160) : "")
    return null
  }
}

async function stepWrite(env: StepEnv): Promise<StepResult> {
  const { input, plan } = env.job.state
  if (!plan) return { next: "plan", state: {} }
  const prompt = buildWritePrompt(briefOf(input), plan, env.ctx.brand.name || "Qonforme", await linkGuideFor(env))
  const res = await callText(env, "write", prompt, { maxOutputTokens: writeTokens(input) })
  const { content, autoFixes } = normalizeContent(res.text, plan.title)
  // Texte vide une fois nettoyé (bloc vide, images seules) : un essai de plus, jamais une boucle
  if (!content.trim()) throw new ModelError("empty", "Texte vide après nettoyage (bloc vide ou images seules).")
  return { next: "check", state: { content, autoFixes, ...trace(env.job.state, "write", res) } }
}

function runChecks(state: JobState, ctx: GenerationContext, existing: ExistingArticle[]): CheckIssue[] {
  const { input, plan, content } = state
  return checkArticle({
    title: plan?.title ?? input.title,
    content: content ?? "",
    metaDescription: plan?.metaDescription ?? null,
    slug: plan?.slug ?? null,
    keywords: [input.keyword, ...(plan?.keywords ?? [])].filter((k): k is string => Boolean(k)),
    competitors: ctx.competitors,
    existing,
    lengthMin: input.lengthMin,
    lengthMax: input.lengthMax,
    faq: input.faq,
  })
}

/**
 * Contrôle factuel par le modèle de relecture. Une erreur passagère fait
 * rejouer la passe ; au dernier essai, ou si le modèle refuse, l'article
 * continue avec le problème « Contrôle factuel non fait » (jamais en silence).
 */
async function factualReview(env: StepEnv): Promise<{ issues: CheckIssue[]; patch: Partial<JobState> }> {
  const { state } = env.job
  const plan = state.plan
  const content = redactCompetitors(state.content ?? "", env.ctx.competitors)
  try {
    const res = await callText(
      env,
      "review",
      buildReviewPrompt({ title: plan?.title ?? state.input.title, content, lengthMin: state.input.lengthMin, lengthMax: state.input.lengthMax, faq: state.input.faq }),
      { schema: REVIEW_JSON_SCHEMA, maxOutputTokens: 16_000 },
    )
    return { issues: parseReview(res.text, content), patch: trace(state, "review", res) }
  } catch (error) {
    const transient = (error instanceof ModelError && error.retryable) || error instanceof ReviewInvalidError
    if (error instanceof CompetitorLeakError) throw error
    if (transient && (env.job.attempts ?? 0) + 1 < MAX_ATTEMPTS) throw error
    const reason = error instanceof Error ? error.message : "Modèle de contrôle indisponible"
    return {
      issues: [reviewMissingIssue(reason)],
      patch: { notices: withNotice(state, `Contrôle factuel non fait : ${reason}`) },
    }
  }
}

async function stepCheck(env: StepEnv): Promise<StepResult> {
  const { state } = env.job
  if (!state.content) return { next: "write", state: {} }
  const review = await factualReview(env)
  const issues = [...review.issues, ...runChecks(state, env.ctx, await existingArticles(env.db))]
  const fixable = issues.some((i) => i.fixable)
  const next: JobStep = fixable && !state.fixed ? "fix" : afterCheck(state)
  return { next, state: { ...review.patch, issues } }
}

/** Passe qui suit le contrôle définitif : maillage, photos du texte, couverture, puis enregistrement. */
function afterCheck(state: JobState): JobStep {
  if (state.input.autoLinks !== false) return "links"
  return afterLinks(state)
}

function afterLinks(state: JobState): JobStep {
  if ((state.input.inlineImages ?? 0) > 0) return "images"
  return afterImages(state)
}

function afterImages(state: JobState): JobStep {
  return state.input.coverImage ? "cover" : "save"
}

/**
 * Maillage interne : les adresses inventées par le modèle sont retirées (le
 * texte reste), les liens sont complétés jusqu'à l'objectif de la longueur,
 * puis, s'il en manque encore, un bloc « Pour aller plus loin » les ajoute.
 * Sans modèle ni appel payant ; une erreur n'empêche pas l'article.
 */
async function stepLinks(env: StepEnv): Promise<StepResult> {
  const { state } = env.job
  const plan = state.plan
  if (!state.content || !plan) return { next: "write", state: {} }
  try {
    const candidates = await loadLinkCandidates(env.db)
    const cleaned = cleanInternalLinks(state.content, validLinkPaths(candidates))
    const result = topUpLinks(cleaned.markdown, candidates, {
      selfPath: `/blog/${plan.slug}`,
      keyword: state.input.keyword,
      topic: topicOf(state),
      allowRelatedBlock: true,
    })
    const notice = cleaned.removed.length > 0 ? `${cleaned.removed.length} lien${cleaned.removed.length > 1 ? "s" : ""} vers des pages qui n'existent pas retiré${cleaned.removed.length > 1 ? "s" : ""}.` : null
    return {
      next: afterLinks(state),
      state: {
        content: result.markdown,
        links: {
          before: result.before,
          after: result.after,
          added: result.added.map((p) => ({ path: p.path, anchor: p.anchor })),
          related: result.relatedAdded,
          removed: cleaned.removed,
        },
        notices: withNotice(state, notice),
      },
    }
  } catch (error) {
    // Un échec de maillage n'empêche jamais l'article
    const message = error instanceof Error ? error.message : "Maillage indisponible"
    console.error("[seo-articles] maillage non fait", message)
    return { next: afterLinks(state), state: { notices: withNotice(state, `Maillage interne non fait : ${message.slice(0, 160)}`) } }
  }
}

export function fixInstructions(issues: CheckIssue[]): FixInstruction[] {
  const out: FixInstruction[] = []
  for (const i of issues.filter((x) => x.fixable)) {
    switch (i.kind) {
      case "audit":
        out.push({ problem: `${i.label} (valeur périmée ou affirmation interdite)`, excerpt: i.excerpt, fix: i.detail ?? "Supprimez ou corrigez ce passage." })
        break
      case "competitor":
        out.push({ problem: "Un autre logiciel est nommé aux endroits marqués [nom retiré]", fix: "Réécrivez ces phrases sans nommer aucun logiciel, éditeur ni marque, et sans comparaison." })
        break
      case "review":
        out.push({ problem: i.label, excerpt: i.excerpt, fix: i.detail ?? "Corrigez ou supprimez ce passage." })
        break
      case "length":
        out.push({ problem: i.label, fix: `${i.detail}. Ajustez en développant ou en resserrant les sections existantes, sans remplissage.` })
        break
      case "h1":
        out.push({ problem: i.label, fix: "Remplacez tout titre « # » par un titre « ## »." })
        break
      case "link":
        out.push({ problem: i.label, fix: "Retirez ces liens (gardez le texte) ou remplacez-les par une source officielle en .gouv.fr." })
        break
      case "heading":
        out.push({ problem: `${i.label} : ${i.detail}`, fix: "Donnez à chaque section un titre unique, différent du titre de l'article." })
        break
      case "faq":
        out.push({ problem: `${i.label} : ${i.detail}`, fix: "Complétez la section « ## Questions fréquentes » avec des questions en « ### … ? » suivies de leur réponse." })
        break
      default:
        break
    }
  }
  return out
}

async function stepFix(env: StepEnv): Promise<StepResult> {
  const { state } = env.job
  const plan = state.plan
  if (!state.content || !plan) return { next: "write", state: {} }
  const instructions = fixInstructions(state.issues ?? [])
  if (instructions.length === 0) return { next: "check", state: { fixed: true } }
  const redact = (t: string) => redactCompetitors(t, env.ctx.competitors)
  const content = redact(state.content)
  const safe = instructions.map((i) => ({ problem: redact(i.problem), fix: redact(i.fix), ...(i.excerpt ? { excerpt: redact(i.excerpt) } : {}) }))
  // Même auteur que la rédaction
  const res = await callText(env, "write", buildFixPrompt(content, safe), { maxOutputTokens: writeTokens(state.input) })
  const normalized = normalizeContent(res.text, plan.title)
  if (!normalized.content.trim()) throw new ModelError("empty", "Texte corrigé vide après nettoyage (bloc vide ou images seules).")
  return {
    next: "check",
    state: {
      content: normalized.content,
      autoFixes: Array.from(new Set((state.autoFixes ?? []).concat(normalized.autoFixes))),
      fixed: true,
      ...trace(state, "write", res),
    },
  }
}

/** Format des photos du texte : paysage, comme la couverture. */
const INLINE_ASPECT = "16:9"
/** Lecture du passage (modèle du plan) : au-delà, la proposition vient des mots du passage. */
const DESCRIBE_TIMEOUT_MS = 15_000
/** Marge gardée pour l'enregistrement de la photo après sa génération. */
const STORE_MARGIN_MS = 8_000

/** Motif court d'un échec de photo (jamais un secret : les erreurs de modèle sont rédigées pour l'écran). */
function imageFailure(error: unknown): { message: string; stop: boolean } {
  if (error instanceof ModelError) return { message: error.message, stop: error.kind === "not_configured" || error.kind === "quota" || error.kind === "unknown_model" }
  if (error instanceof BlogImageError) return { message: error.message, stop: error.code === "upload" }
  return { message: error instanceof Error ? error.message : "Image indisponible", stop: false }
}

/**
 * Photos du texte, une par passe (20 à 40 secondes chacune) : le modèle lit le
 * premier paragraphe de la section et décrit la photo (sujet, scène, style),
 * le modèle d'image la crée, elle est enregistrée en WebP sans métadonnées
 * inutiles (stockage du blog, « Illustration générée par IA » sur la page) puis
 * insérée juste après ce paragraphe (lib/seo/articles/images.ts : nombre et
 * places). Les sections sont choisies à la première passe et gardées dans l'état.
 *
 * Une photo qui échoue est notée et passée : l'article sort avec les autres.
 * Clé absente ou quota épuisé : les photos restantes sont abandonnées d'un coup
 * (rien ne sert de réessayer), et l'écran le dit. Chaque photo est facturée par
 * Google : jamais de nouvel essai automatique.
 */
async function stepImages(env: StepEnv): Promise<StepResult> {
  const { state } = env.job
  const plan = state.plan
  if (!state.content || !plan) return { next: "write", state: {} }
  const cap = state.input.inlineImages ?? 0
  if (cap <= 0) return { next: afterImages(state), state: {} }

  const wanted = inlineImageCount(wordCount(state.content), cap)
  // Créneaux gardés d'une rédaction commencée avec l'ancien plan (sans rang de titre) : refaits
  const kept = state.imageSlots?.every((s) => typeof s.headingIndex === "number" && typeof s.paragraphIndex === "number") ? state.imageSlots : undefined
  const slots = kept ?? planImageSlots(state.content, wanted)
  const results = kept ? (state.images ?? []) : []
  // Moins de photos que prévu : le texte n'offre pas assez de places espacées (dit une fois, à la première passe)
  const shortNote =
    !kept && slots.length > 0 && slots.length < wanted ? `${slots.length} photo${slots.length > 1 ? "s" : ""} au lieu de ${wanted} : le texte n'offre pas assez de places espacées d'au moins 250 mots.` : null
  const base: JobState = shortNote ? { ...state, notices: withNotice(state, shortNote) } : state
  if (results.length >= slots.length) {
    const none = slots.length === 0 && wanted > 0 ? "Aucune photo dans le texte : aucune section ne s'y prête (FAQ et conclusion exclues)." : null
    return { next: afterImages(state), state: { imageSlots: slots, images: results, notices: withNotice(base, none) } }
  }
  const slot = slots[results.length]
  // Clé du modèle d'image absente : rien n'est lu ni payé, les photos sont abandonnées d'un coup
  const keyEnv = findImageModel(state.input.imageModel)?.envKey
  if (keyEnv && !hasKey(keyEnv)) {
    const skipped = slots.slice(results.length).map((s): InlineImageResult => ({ headingIndex: s.headingIndex, heading: s.heading, error: "Abandonnée." }))
    return {
      next: afterImages(state),
      state: {
        imageSlots: slots,
        images: [...results, ...skipped],
        notices: withNotice(base, `Photos du texte non créées : clé ${keyEnv} absente (Paramètres › Connexions).`),
      },
    }
  }
  const done = (result: InlineImageResult, extra: Partial<JobState> = {}): StepResult => {
    const images = [...results, result]
    return { next: images.length >= slots.length ? afterImages(state) : "images", state: { imageSlots: slots, images, notices: base.notices, ...extra } }
  }

  try {
    const startedAt = Date.now()
    // Le titre de l'article et le mot-clé nomment le fichier public et ses métadonnées : jamais un concurrent
    assertNoCompetitorInPrompt(`${plan.title}\n${state.input.keyword ?? ""}`, env.ctx.competitors)
    const described = await describePassage({
      passage: slot.passage,
      title: plan.title,
      keyword: state.input.keyword,
      competitors: env.ctx.competitors,
      model: state.input.planModel,
      fallbackModel: state.input.textModel,
      timeoutMs: Math.min(DESCRIBE_TIMEOUT_MS, env.timeoutMs),
    })
    const description = descriptionFromSuggestion(described)
    const generated = await generateImage({
      model: state.input.imageModel,
      prompt: buildImagePrompt({ description, aspect: INLINE_ASPECT, purpose: "inline" }),
      aspect: INLINE_ASPECT,
      timeoutMs: Math.max(20_000, env.timeoutMs - (Date.now() - startedAt) - STORE_MARGIN_MS),
    })
    const alt = described.alt || altFromDescription(description)
    const hint = [slot.heading, state.input.keyword].filter(Boolean).join(" ")
    const stored = await storeBlogImage({
      data: generated.data,
      hint,
      // Rangée sous editor/ia/ : le blog affiche « Illustration générée par IA » sous elle
      generated: true,
      meta: { title: slot.heading, description: alt, keywords: [state.input.keyword], creator: "Qonforme", source: "ai" },
      maxBytes: 15 * 1024 * 1024,
    })
    // Le texte a pu changer depuis le choix des sections (jamais pendant une passe, mais après un « Réessayer ») :
    // la section est retrouvée par son rang et son titre
    const inserted = insertImageAfterParagraph(state.content, slot, imageMarkdown(alt, stored.url))
    if (!inserted) return done({ headingIndex: slot.headingIndex, heading: slot.heading, error: "Section introuvable ou déjà illustrée." })
    const notice = generated.fallbackFrom ? `Photo par ${modelLabel(generated.model)} au lieu de ${modelLabel(generated.fallbackFrom.model)} : ${generated.fallbackFrom.reason}` : null
    return done(
      { headingIndex: slot.headingIndex, heading: slot.heading, url: readImageSize(stored.url).src, alt, model: modelLabel(generated.model) },
      { content: inserted, notices: withNotice(base, notice) },
    )
  } catch (error) {
    // Un échec de photo n'empêche jamais l'article
    const { message, stop } = imageFailure(error)
    console.error("[seo-articles] photo du texte non créée", message)
    const failed: InlineImageResult = { headingIndex: slot.headingIndex, heading: slot.heading, error: message.slice(0, 300) }
    if (!stop) return done(failed, { notices: withNotice(base, `Photo de « ${slot.heading.slice(0, 60)} » non créée : ${message.slice(0, 140)}`) })
    // Clé absente, quota épuisé, stockage en panne : les photos restantes sont abandonnées
    const skipped = slots.slice(results.length + 1).map((s): InlineImageResult => ({ headingIndex: s.headingIndex, heading: s.heading, error: "Abandonnée." }))
    return {
      next: afterImages(state),
      state: {
        imageSlots: slots,
        images: [...results, failed, ...skipped],
        notices: withNotice(base, `Photos du texte non créées : ${message.slice(0, 160)}`),
      },
    }
  }
}

/** Nom du « modèle » d'une couverture dessinée par le code (colonne ai_model) : aucun modèle d'IA, aucun coût. */
export const COVER_MODEL = "couverture Qonforme"

async function stepCover(env: StepEnv): Promise<StepResult> {
  const { state } = env.job
  const plan = state.plan
  if (!state.input.coverImage || !plan) return { next: "save", state: { cover: null } }
  try {
    // Le titre est écrit sur l'image publique : jamais un concurrent
    assertNoCompetitorInPrompt(`${plan.title}\n${state.input.keyword ?? ""}`, env.ctx.competitors)
    const cover = await makeCover({ title: plan.title, keyword: state.input.keyword })
    return {
      next: "save",
      // Adresse sans le fragment des dimensions : la couverture est toujours affichée en 16:9
      state: { cover: { url: readImageSize(cover.url).src, alt: cover.alt, model: COVER_MODEL }, coverError: null },
    }
  } catch (error) {
    // Un échec d'image n'empêche jamais l'article
    const message = error instanceof Error ? error.message : "Image indisponible"
    console.error("[seo-articles] couverture non créée", message)
    return { next: "save", state: { cover: null, coverError: message.slice(0, 300), notices: withNotice(state, `Article sans image de couverture : ${message.slice(0, 160)}`) } }
  }
}

/** Adresse libre : « mon-article », sinon « mon-article-2 », « -3 »… */
async function uniqueSlug(db: SeoDb, base: string): Promise<string> {
  const root = (base || "article").slice(0, 80)
  const rows = must(await db.from("blog_posts").select("slug").like("slug", `${root}%`), "les adresses du blog") as { slug: string }[]
  const taken = new Set(rows.map((r) => r.slug))
  if (!taken.has(root)) return root
  for (let i = 2; i < 200; i++) if (!taken.has(`${root}-${i}`)) return `${root}-${i}`
  return `${root}-${Date.now().toString(36)}`
}

/** Modèles réellement utilisés, passe par passe (colonne ai_model). */
export function aiModelOf(state: Pick<JobState, "models" | "input" | "cover" | "images">): string {
  const used = (pass: ModelPass, fallback: string) => state.models?.[pass]?.model ?? fallback
  const parts = [
    `plan ${used("plan", state.input.planModel)}`,
    `rédaction ${used("write", state.input.textModel)}`,
    `contrôle ${used("review", state.input.reviewModel)}`,
  ]
  if (state.cover?.model) parts.push(`image ${state.cover.model}`)
  const photos = Array.from(new Set((state.images ?? []).filter((i) => i.url && i.model).map((i) => i.model as string)))
  if (photos.length > 0) parts.push(`photos ${photos.join(", ")}`)
  return parts.join(" · ")
}

async function stepSave(env: StepEnv): Promise<StepResult> {
  const { db, job, now } = env
  const { state } = job
  const plan = state.plan
  if (!plan || !state.content) return { next: "write", state: {} }
  const topic = job.topic_id ? await readTopic(db, job.topic_id) : null
  const mode: PublishMode = topic?.publish_mode ?? "draft"
  const scheduledAt = topic?.scheduled_at ?? null
  const issues = state.issues ?? []

  // Adresse retenue avant l'insertion : une passe reprise retrouve l'article déjà enregistré
  let slug = state.slug
  let postId: string | null = job.post_id
  if (!postId && slug) {
    const existing = must(await db.from("blog_posts").select("id, title, ai_generated").eq("slug", slug).maybeSingle(), "l'article") as
      | { id: string; title: string; ai_generated: boolean | null }
      | null
    if (existing && existing.ai_generated && existing.title === plan.title) postId = existing.id
    else if (existing) slug = undefined
  }
  if (!slug) {
    slug = await uniqueSlug(db, plan.slug || slugify(plan.title))
    await saveState(db, job.id, { ...state, slug })
  }

  const future = scheduledAt !== null && Date.parse(scheduledAt) > now.getTime()
  // Décision prise dès l'enregistrement, même pour une date à venir : un article retenu par le
  // contrôle reste « À relire » ; seul un article accepté attend son heure (review_status null),
  // et la tâche refait alors le contrôle sur le texte du moment
  const decision = decidePublication(mode, issues)
  const publishNow = !future && decision.publish
  const nowIso = now.toISOString()
  const reviewStatus: string | null = publishNow ? "approved" : decision.reviewStatus
  const heldReason = decision.heldReason

  const keywords = Array.from(new Set([state.input.keyword, ...plan.keywords].filter((k): k is string => Boolean(k)).map((k) => k.toLowerCase())))
  const row = {
    slug,
    title: plan.title,
    excerpt: plan.metaDescription,
    content: state.content,
    cover_url: state.cover?.url ?? null,
    cover_alt: state.cover?.alt ?? null,
    is_published: publishNow,
    published_at: publishNow ? nowIso : null,
    ai_generated: true,
    ai_model: aiModelOf(state),
    ai_prompt: `Sujet: ${state.input.title} | Mots-clés: ${keywords.join(", ")}`,
    ai_keywords: keywords,
    article_type: state.input.articleType,
    target_keyword: state.input.keyword,
    scheduled_at: scheduledAt,
    review_status: reviewStatus,
    audit_result: auditResultOf(issues, now, {
      autoFixes: state.autoFixes,
      fixPass: state.fixed,
      brief: { lengthMin: state.input.lengthMin, lengthMax: state.input.lengthMax, faq: state.input.faq },
    }),
    held_reason: heldReason,
    source: "seo",
    seo_title: plan.title,
    seo_description: plan.metaDescription,
    updated_at: nowIso,
  }

  if (postId) {
    must(await db.from("blog_posts").update(row).eq("id", postId), "l'enregistrement de l'article")
  } else {
    const inserted = must(await db.from("blog_posts").insert({ ...row, created_at: nowIso }).select("id").single(), "l'enregistrement de l'article") as { id: string }
    postId = inserted.id
  }

  if (topic) {
    must(
      await db
        .from("seo_topics")
        .update({ status: publishNow ? "published" : "drafted", post_id: postId, last_error: null, updated_at: nowIso })
        .eq("id", topic.id),
      "le sujet",
    )
  }
  if (publishNow) revalidateBlog(slug)
  return { next: "done", state: { slug }, postId }
}

const STEP_FNS: Record<Exclude<JobStep, "done">, (env: StepEnv) => Promise<StepResult>> = {
  plan: stepPlan,
  write: stepWrite,
  check: stepCheck,
  fix: stepFix,
  links: stepLinks,
  images: stepImages,
  cover: stepCover,
  save: stepSave,
}

async function saveState(db: SeoDb, id: string, state: JobState): Promise<void> {
  must(await db.from("seo_article_jobs").update({ state }).eq("id", id), "la rédaction")
}

/* ------------------------------------------------------------------ */
/* Exécution d'une passe                                               */
/* ------------------------------------------------------------------ */

export interface StepOutcome {
  jobId: string
  status: JobStatus
  step: JobStep
  /** Passe jouée par cet appel (null : rien joué). */
  ran: JobStep | null
  postId: string | null
  error: string | null
  /** Un autre passage tient le verrou. */
  locked?: boolean
  /** Pas assez de temps pour lancer la passe. */
  deferred?: boolean
  /** Replis et incidents (clé absente, image de repli, contrôle factuel non fait). */
  notices: string[]
}

function outcomeOf(job: JobRow, ran: JobStep | null, extra: Partial<StepOutcome> = {}): StepOutcome {
  return { jobId: job.id, status: job.status, step: job.step, ran, postId: job.post_id, error: job.error, notices: job.state?.notices ?? [], ...extra }
}

/** Pose le verrou d'une passe ; null si un autre passage le tient ou si le travail est terminé. */
async function acquireJobLock(db: SeoDb, id: string, now: Date): Promise<JobRow | null> {
  const nowIso = now.toISOString()
  const rows = must(
    await db
      .from("seo_article_jobs")
      .update({ status: "running", lock_until: new Date(now.getTime() + STEP_LOCK_MS).toISOString(), updated_at: nowIso })
      .eq("id", id)
      .in("status", ["queued", "running"])
      .or(`lock_until.is.null,lock_until.lt."${nowIso}"`)
      .select(JOB_COLUMNS),
    "le verrou de la rédaction",
  ) as JobRow[]
  return rows[0] ?? null
}

/** Message d'un échec définitif après plusieurs essais : sans « Nouvel essai au prochain passage », qui ne serait plus vrai. */
export function exhaustedMessage(message: string): string {
  const base = message.replace(/\s*Nouvel essai au prochain passage\.?\s*$/i, "").replace(/\s+$/, "")
  if (base === message.trim()) return message
  return `${base.replace(/\.$/, "")}. Plusieurs essais ont échoué : « Réessayer » relance la rédaction, dans quelques minutes si le fournisseur reste surchargé.`
}

/** Message d'échec affiché (jamais de secret : les erreurs de modèle sont déjà rédigées pour l'écran). */
function failureMessage(error: unknown): { message: string; fatal: boolean } {
  if (error instanceof CompetitorLeakError) {
    return { message: "Un concurrent suivi figurait dans la consigne (sujet, mot-clé ou contexte de marque) : rédaction bloquée. Retirez ce nom puis réessayez.", fatal: true }
  }
  if (error instanceof ModelError) return { message: error.message, fatal: !error.retryable }
  if (error instanceof PlanInvalidError) return { message: `Plan refusé : ${error.message}.`, fatal: false }
  if (error instanceof JobRefusedError) return { message: error.message, fatal: true }
  if (error instanceof Error && error.name === "SeoDbError") return { message: error.message, fatal: false }
  return { message: "Une erreur est survenue pendant la rédaction.", fatal: false }
}

/**
 * Joue la passe suivante d'une rédaction. `deadline` (ms depuis l'époque) borne
 * l'appel au modèle ; sous le minimum de la passe, rien n'est lancé (« deferred »).
 */
export async function runJobStep(db: SeoDb, jobId: string, opts: { now?: Date; deadline: number; ctx?: GenerationContext }): Promise<StepOutcome> {
  const now = opts.now ?? new Date()
  const current = await readJob(db, jobId)
  if (!current) throw new JobRefusedError("Rédaction introuvable.")
  if (current.status === "done" || current.status === "failed") return outcomeOf(current, null)
  if (current.step === "done") return outcomeOf(current, null)

  const budget = STEP_BUDGET_MS[current.step as Exclude<JobStep, "done">] ?? STEP_BUDGET_MS.write
  const remaining = opts.deadline - Date.now()
  if (remaining < budget.min) return outcomeOf(current, null, { deferred: true })

  const job = await acquireJobLock(db, jobId, now)
  if (!job) return outcomeOf(current, null, { locked: true })
  const step = job.step as Exclude<JobStep, "done">
  const timeoutMs = Math.max(5_000, Math.min(budget.max, opts.deadline - Date.now() - 10_000))

  try {
    if ((job.state?.passes ?? 0) >= MAX_PASSES) {
      throw new JobRefusedError(`Rédaction arrêtée après ${MAX_PASSES} passes sans aboutir. « Réessayer » la reprend depuis le plan.`)
    }
    const ctx = opts.ctx ?? (await loadGenerationContext(db))
    const result = await STEP_FNS[step]({ db, ctx, job, now, timeoutMs })
    const latest = (await readJob(db, jobId)) ?? job
    const state: JobState = { ...latest.state, ...result.state, passes: (latest.state?.passes ?? 0) + 1 }
    const done = result.next === "done"
    const patch = {
      status: done ? "done" : "queued",
      step: result.next,
      state,
      attempts: 0,
      error: null,
      lock_until: null,
      updated_at: new Date().toISOString(),
      ...(result.postId ? { post_id: result.postId } : {}),
    }
    const rows = must(await db.from("seo_article_jobs").update(patch).eq("id", jobId).select(JOB_COLUMNS), "la rédaction") as JobRow[]
    return outcomeOf(rows[0] ?? { ...job, ...patch, status: patch.status as JobStatus, step: patch.step }, step)
  } catch (error) {
    const { message, fatal } = failureMessage(error)
    if (!(error instanceof ModelError) && !(error instanceof PlanInvalidError) && !(error instanceof CompetitorLeakError) && !(error instanceof JobRefusedError)) {
      console.error(`[seo-articles] passe « ${step} » en échec`, error)
    }
    const attempts = (job.attempts ?? 0) + 1
    const failed = fatal || attempts >= MAX_ATTEMPTS
    const nowIso = new Date().toISOString()
    // Trois essais échoués : la rédaction ne reprend plus toute seule, le message ne promet donc plus de nouvel essai
    const shown = failed && !fatal ? exhaustedMessage(message) : message
    // État relu : une passe a pu y noter son motif (plan refusé) avant d'échouer
    const latest = (await readJob(db, jobId)) ?? job
    const rows = must(
      await db
        .from("seo_article_jobs")
        .update({
          status: failed ? "failed" : "queued",
          attempts,
          error: shown,
          lock_until: null,
          updated_at: nowIso,
          state: { ...latest.state, passes: (latest.state?.passes ?? 0) + 1, lastFailure: { step, fatal, message } },
        })
        .eq("id", jobId)
        .select(JOB_COLUMNS),
      "la rédaction",
    ) as JobRow[]
    if (failed && job.topic_id) {
      const { error: topicError } = await db
        .from("seo_topics")
        .update({ status: "failed", last_error: shown, updated_at: nowIso })
        .eq("id", job.topic_id)
      if (topicError) console.error("[seo-articles] sujet non passé en échec", topicError.message)
    }
    return outcomeOf(rows[0] ?? { ...job, status: failed ? "failed" : "queued", error: shown, attempts }, step)
  }
}
