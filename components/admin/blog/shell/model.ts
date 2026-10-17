/**
 * Coque de l'éditeur d'articles (admin › Blog) : tout ce qui ne dépend ni de
 * React ni du navigateur. Testé dans __tests__/blog-editor-shell.test.ts.
 *
 * - État de l'article dans l'éditeur (`ArticleDraft`) et ce qui est
 *   enregistré (`SavedMeta`) : statut affiché, dates.
 * - Détection des modifications : comparaison sur les valeurs telles que le
 *   serveur les enregistre (espaces de bord retirés, adresse débarrassée de
 *   ses tirets en trop, mot-clé sous sa forme canonique). Le texte n'est
 *   envoyé que s'il a changé : ouvrir un article ne réécrit jamais son
 *   contenu enregistré.
 * - Requête d'enregistrement : POST /api/admin/blog (création, tous les
 *   champs) ou PATCH /api/admin/blog/<id> (seulement ce qui a changé), avec
 *   les mêmes contrôles que le serveur (lib/seo/articles/editor-input.ts) pour
 *   dire tout de suite ce qui n'ira pas, et le champ à montrer.
 * - Publication : brouillon, publié ou programmé ; heure proposée pour une
 *   programmation (heure des Préférences, ou la prochaine heure encore
 *   possible quand elle est passée pour aujourd'hui).
 * - Brouillon local (localStorage) : format, lecture prudente, proposition de
 *   restauration seulement s'il est plus récent que l'enregistrement et
 *   différent de lui. La copie garde aussi la version enregistrée dont elle
 *   part (`base`) : tant que le texte enregistré n'a pas bougé depuis, elle
 *   reste la plus récente, quelles que soient les horloges (celle de
 *   l'appareil peut avancer ou retarder) et même si l'article a été touché
 *   entre-temps sans que son texte change (publication à l'heure prévue).
 */
import { parseCoverAlt, parseCoverUrl, parseSlug, parseTargetKeyword, scheduledAtFromParis, scheduleProblem } from "@/lib/seo/articles/editor-input"
import { parisDayTime } from "@/lib/seo/articles/schedule"
import { articleDisplayStatus } from "@/lib/seo/articles/status"
import { canonicalKeyword, foldAccents } from "@/lib/seo/keywords/normalize"
import { addDays, isIsoDay, todayInParis } from "@/lib/utils/paris-date"
import type { OnPageTarget } from "@/lib/seo/articles/onpage"
import type { ArticleDisplayStatus } from "@/lib/seo/types"
import type { PublicationMode, PublicationValue } from "@/components/admin/blog/seo/PublicationPanel"

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/** Article tel que la page le lit (blog_posts, `select *`) : colonnes récentes facultatives. */
export interface EditorPost {
  id: string
  slug: string
  title: string
  excerpt?: string | null
  content: string
  cover_url?: string | null
  cover_alt?: string | null
  is_published: boolean
  published_at?: string | null
  scheduled_at?: string | null
  created_at?: string | null
  updated_at?: string | null
  ai_generated?: boolean | null
  ai_keywords?: string[] | null
  seo_title?: string | null
  seo_description?: string | null
  target_keyword?: string | null
  /** howto, guide, news ou faq (articles rédigés par le générateur) ; absent d'un article écrit à la main. */
  article_type?: string | null
  review_status?: string | null
  audit_result?: unknown
  held_reason?: string | null
}

/** Ce que l'éditeur modifie. */
export interface ArticleDraft {
  title: string
  slug: string
  excerpt: string
  /** Markdown (format enregistré). */
  content: string
  coverUrl: string
  coverAlt: string
  seoTitle: string
  seoDescription: string
  keyword: string | null
  publication: PublicationValue
}

export type DraftField = keyof ArticleDraft

/** État enregistré de la publication (statut affiché, dates). */
export interface SavedMeta {
  isPublished: boolean
  publishedAt: string | null
  scheduledAt: string | null
  reviewStatus: string | null
  heldReason: string | null
}

/** Champ que l'on peut montrer à l'admin (liste de contrôle, erreur d'enregistrement). */
export type FocusTarget = OnPageTarget | "publication"

/** Onglets de l'éditeur sous 1 280 px. */
export type EditorTab = "redaction" | "referencement" | "publication"

/* ------------------------------------------------------------------ */
/* Heures de publication                                               */
/* ------------------------------------------------------------------ */

export const DEFAULT_PUBLISH_TIME = "08:00"
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

/** Heures proposées par le panneau Publication (PUBLISH_TIMES) : 06:00 à 22:45, par quart d'heure. */
const SLOT_FIRST = 6 * 60
const SLOT_LAST = 22 * 60 + 45
const SLOT_STEP = 15

/** Avance laissée avant une heure proposée : le temps de relire et d'enregistrer. */
export const PROPOSAL_MARGIN_MS = 10 * 60_000

const pad = (n: number) => String(n).padStart(2, "0")

export type SlotAdjustment = "none" | "later_today" | "next_day"

export interface ScheduleSlot {
  day: string
  time: string
  /** « later_today » : l'heure des Préférences est passée, la prochaine heure du jour est proposée ; « next_day » : plus aucune heure aujourd'hui. */
  adjusted: SlotAdjustment
  /** Heure des Préférences. */
  preferred: string
}

/**
 * Jour et heure d'une programmation ouverte depuis le calendrier
 * (?programmer=AAAA-MM-JJ) : l'heure des Préférences ce jour-là ; pour
 * aujourd'hui, si elle est passée (ou trop proche), la prochaine heure du
 * panneau Publication à au moins 10 minutes ; s'il n'y en a plus, demain à
 * l'heure des Préférences. Un jour passé ou illisible vaut aujourd'hui.
 */
export function defaultScheduleSlot(day: string | null, preferred: string, now: Date): ScheduleSlot {
  const today = todayInParis(now)
  const pref = TIME.test(preferred) ? preferred : DEFAULT_PUBLISH_TIME
  const target = day && isIsoDay(day) && day >= today ? day : today
  const earliest = now.getTime() + PROPOSAL_MARGIN_MS
  const fits = (d: string, t: string) => {
    const iso = scheduledAtFromParis(d, t)
    return iso !== null && Date.parse(iso) >= earliest
  }
  if (target > today || fits(target, pref)) return { day: target, time: pref, adjusted: "none", preferred: pref }
  for (let m = SLOT_FIRST; m <= SLOT_LAST; m += SLOT_STEP) {
    const t = `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
    if (fits(today, t)) return { day: today, time: t, adjusted: "later_today", preferred: pref }
  }
  return { day: addDays(today, 1), time: pref, adjusted: "next_day", preferred: pref }
}

/**
 * Jour demandé par le calendrier (?programmer=AAAA-MM-JJ, admin › SEO ›
 * Articles, « + » d'un jour) : un vrai jour, aujourd'hui ou plus tard (heure
 * de Paris), au plus dans un an. Sinon null : l'article s'ouvre en brouillon.
 */
export function programmedDay(value: unknown, now: Date = new Date()): string | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== "string" || !isIsoDay(raw)) return null
  const today = todayInParis(now)
  return raw >= today && raw <= addDays(today, 365) ? raw : null
}

/* ------------------------------------------------------------------ */
/* État initial                                                        */
/* ------------------------------------------------------------------ */

/**
 * Publication d'un article enregistré : publié, programmé (date à venir) ou
 * brouillon. Une date programmée déjà passée (article retenu « À relire »)
 * se lit comme un brouillon : le panneau ne montre pas une date impossible.
 * Un article « À relire » (review_status « to_review » : sujet en mode
 * brouillon, ou retenu par le contrôle) se lit aussi comme un brouillon, même
 * avec une date à venir : la tâche planifiée ne le publiera pas. Le jour et
 * l'heure prévus sont gardés : choisir « Programmé », même sur ce créneau,
 * devient une modification qui renvoie la date (le serveur retire alors la
 * décision de relecture).
 */
export function publicationOfPost(post: Pick<EditorPost, "is_published" | "scheduled_at" | "review_status">, preferred: string, now: Date): PublicationValue {
  const fallback = { day: addDays(todayInParis(now), 1), time: TIME.test(preferred) ? preferred : DEFAULT_PUBLISH_TIME }
  if (post.is_published) return { mode: "publish", ...fallback }
  const at = post.scheduled_at ? Date.parse(post.scheduled_at) : Number.NaN
  if (!Number.isNaN(at)) {
    const { day, time } = parisDayTime(new Date(at))
    return { mode: at > now.getTime() && post.review_status !== "to_review" ? "schedule" : "draft", day, time }
  }
  return { mode: "draft", ...fallback }
}

export function draftOfPost(post: EditorPost, preferred: string, now: Date): ArticleDraft {
  return {
    title: post.title ?? "",
    slug: post.slug ?? "",
    excerpt: post.excerpt ?? "",
    content: post.content ?? "",
    coverUrl: post.cover_url ?? "",
    coverAlt: post.cover_alt ?? "",
    seoTitle: post.seo_title ?? "",
    seoDescription: post.seo_description ?? "",
    keyword: post.target_keyword?.trim() ? post.target_keyword : null,
    publication: publicationOfPost(post, preferred, now),
  }
}

/** Nouvel article : brouillon, ou programmé le jour demandé par le calendrier. */
export function newDraft(initialSchedule: string | null, preferred: string, now: Date): { draft: ArticleDraft; slot: ScheduleSlot | null } {
  const slot = initialSchedule ? defaultScheduleSlot(initialSchedule, preferred, now) : null
  const pref = TIME.test(preferred) ? preferred : DEFAULT_PUBLISH_TIME
  return {
    draft: {
      title: "",
      slug: "",
      excerpt: "",
      content: "",
      coverUrl: "",
      coverAlt: "",
      seoTitle: "",
      seoDescription: "",
      keyword: null,
      publication: slot ? { mode: "schedule", day: slot.day, time: slot.time } : { mode: "draft", day: addDays(todayInParis(now), 1), time: pref },
    },
    slot,
  }
}

export function metaOfPost(post: EditorPost | null | undefined): SavedMeta {
  return {
    isPublished: Boolean(post?.is_published),
    publishedAt: post?.published_at ?? null,
    scheduledAt: post?.scheduled_at ?? null,
    reviewStatus: post?.review_status ?? null,
    heldReason: post?.held_reason ?? null,
  }
}

/** Statut affiché de l'article enregistré (pastille de l'en-tête). */
export function statusOfMeta(meta: SavedMeta): ArticleDisplayStatus {
  return articleDisplayStatus({ is_published: meta.isPublished, review_status: meta.reviewStatus, scheduled_at: meta.scheduledAt, held_reason: meta.heldReason })
}

/* ------------------------------------------------------------------ */
/* Modifications                                                       */
/* ------------------------------------------------------------------ */

/** Adresse telle que le serveur l'enregistre (parseSlug : tirets en trop retirés). */
export function normalSlug(slug: string): string {
  return slug.trim().replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "")
}

/** Valeurs comparées : celles que le serveur enregistrerait. */
function comparable(d: ArticleDraft): Record<Exclude<DraftField, "publication">, string> {
  return {
    title: d.title.trim(),
    slug: normalSlug(d.slug),
    excerpt: d.excerpt.trim(),
    content: d.content.trim(),
    coverUrl: d.coverUrl.trim(),
    coverAlt: d.coverAlt.replace(/\s+/g, " ").trim(),
    seoTitle: d.seoTitle.trim(),
    seoDescription: d.seoDescription.trim(),
    keyword: d.keyword ? canonicalKeyword(d.keyword) : "",
  }
}

/** Même publication : même mode, et même jour et même heure pour une programmation. */
export function samePublication(a: PublicationValue, b: PublicationValue): boolean {
  if (a.mode !== b.mode) return false
  return a.mode !== "schedule" || (a.day === b.day && a.time === b.time)
}

const FIELD_ORDER: DraftField[] = ["title", "excerpt", "content", "coverUrl", "coverAlt", "keyword", "seoTitle", "seoDescription", "slug", "publication"]

/** Champs modifiés par rapport à l'enregistrement, dans l'ordre de la page. */
export function changedFields(current: ArticleDraft, saved: ArticleDraft): DraftField[] {
  const a = comparable(current)
  const b = comparable(saved)
  return FIELD_ORDER.filter((f) => (f === "publication" ? !samePublication(current.publication, saved.publication) : a[f] !== b[f]))
}

export function isDirty(current: ArticleDraft, saved: ArticleDraft): boolean {
  return changedFields(current, saved).length > 0
}

const FIELD_LABELS: Record<DraftField, string> = {
  title: "titre",
  excerpt: "chapeau",
  content: "texte",
  coverUrl: "couverture",
  coverAlt: "texte alternatif",
  keyword: "mot-clé",
  seoTitle: "titre Google",
  seoDescription: "description Google",
  slug: "adresse",
  publication: "publication",
}

/** « titre, texte et adresse » : ce qu'un brouillon local change. */
export function describeFields(fields: DraftField[]): string {
  const labels = Array.from(new Set(fields.map((f) => (f === "coverAlt" ? FIELD_LABELS.coverUrl : FIELD_LABELS[f]))))
  if (labels.length <= 1) return labels[0] ?? ""
  return `${labels.slice(0, -1).join(", ")} et ${labels[labels.length - 1]}`
}

/* ------------------------------------------------------------------ */
/* Enregistrement                                                      */
/* ------------------------------------------------------------------ */

/**
 * Effet de l'enregistrement sur la publication : « publish » (mise en
 * ligne), « schedule » (date posée ou changée), « unpublish » (article en
 * ligne repassé en brouillon), « unschedule » (programmation retirée),
 * « draft » (création d'un brouillon), « none ».
 */
export type PublicationChange = "none" | "draft" | "publish" | "schedule" | "unpublish" | "unschedule"

export type SaveRequest =
  | {
      kind: "request"
      method: "POST" | "PATCH"
      url: string
      body: Record<string, unknown>
      change: PublicationChange
      /** Instant ISO envoyé pour une programmation. */
      scheduledAt: string | null
      /** Champs envoyés (PATCH) ou tous (POST). */
      fields: DraftField[]
    }
  | { kind: "nothing" }
  | { kind: "invalid"; error: string; target: FocusTarget }

const invalid = (error: string, target: FocusTarget): SaveRequest => ({ kind: "invalid", error, target })

/**
 * Requête d'enregistrement. Création : tous les champs (titre, adresse et
 * texte obligatoires). Modification : seulement les champs changés ; le texte
 * n'est jamais renvoyé tel quel. Les contrôles sont ceux du serveur, avec le
 * champ à montrer en cas d'erreur.
 */
export function buildSaveRequest(input: {
  mode: "create" | "edit"
  id?: string | null
  current: ArticleDraft
  /** Dernier état enregistré ; null à la création. */
  saved: ArticleDraft | null
  meta: SavedMeta
  now?: Date
}): SaveRequest {
  const { mode, current, saved, meta } = input
  const now = input.now ?? new Date()
  const creating = mode === "create" || !saved || !input.id
  const fields: DraftField[] = creating ? FIELD_ORDER.slice() : changedFields(current, saved)
  if (fields.length === 0) return { kind: "nothing" }
  const has = (f: DraftField) => fields.includes(f)
  const c = comparable(current)

  // Contrôles, dans l'ordre de la page
  if (has("title") && !c.title) return invalid("Donnez un titre à l'article.", "title")
  if (has("content") && !c.content) return invalid("L'article est vide : écrivez son texte avant d'enregistrer.", "content")
  let slug = c.slug
  if (has("slug")) {
    const parsed = parseSlug(current.slug)
    if (!parsed.ok) return invalid(parsed.error, "slug")
    slug = parsed.value
  }
  let keyword: string | null = null
  if (has("keyword")) {
    const parsed = parseTargetKeyword(current.keyword)
    if (!parsed.ok) return invalid(parsed.error, "keyword")
    keyword = parsed.value
  }
  if (has("coverUrl")) {
    const parsed = parseCoverUrl(current.coverUrl)
    if (!parsed.ok) return invalid(parsed.error, "cover")
  }
  if (has("coverAlt")) {
    const parsed = parseCoverAlt(current.coverAlt)
    if (!parsed.ok) return invalid(parsed.error, "cover")
  }

  // Publication
  const pub = current.publication
  let change: PublicationChange = "none"
  let scheduledAt: string | null = null
  if (has("publication")) {
    if (pub.mode === "schedule") {
      const problem = scheduleProblem(pub.day, pub.time, now)
      if (problem) return invalid(problem, "publication")
      scheduledAt = scheduledAtFromParis(pub.day, pub.time)
      change = "schedule"
    } else if (pub.mode === "publish") {
      change = "publish"
    } else if (creating) {
      change = "draft"
    } else {
      change = saved?.publication.mode === "publish" || meta.isPublished ? "unpublish" : "unschedule"
    }
  }

  if (creating) {
    return {
      kind: "request",
      method: "POST",
      url: "/api/admin/blog",
      body: {
        title: c.title,
        slug,
        content: current.content,
        excerpt: c.excerpt,
        cover_url: c.coverUrl,
        cover_alt: c.coverAlt || null,
        seo_title: c.seoTitle,
        seo_description: c.seoDescription,
        target_keyword: keyword,
        is_published: pub.mode === "publish",
        ...(change === "schedule" ? { scheduled_at: scheduledAt } : {}),
      },
      change,
      scheduledAt,
      fields,
    }
  }

  const body: Record<string, unknown> = {}
  if (has("title")) body.title = c.title
  if (has("slug")) body.slug = slug
  if (has("excerpt")) body.excerpt = c.excerpt
  if (has("content")) body.content = current.content
  if (has("coverUrl")) body.cover_url = c.coverUrl
  if (has("coverAlt")) body.cover_alt = c.coverAlt || null
  if (has("seoTitle")) body.seo_title = c.seoTitle
  if (has("seoDescription")) body.seo_description = c.seoDescription
  if (has("keyword")) body.target_keyword = keyword
  if (change === "publish") body.is_published = true
  else if (change === "schedule") body.scheduled_at = scheduledAt
  else if (change === "unpublish" || change === "unschedule") {
    body.is_published = false
    body.scheduled_at = null
  }

  return { kind: "request", method: "PATCH", url: `/api/admin/blog/${input.id}`, body, change, scheduledAt, fields }
}

/** État enregistré après un enregistrement réussi. */
export function metaAfterSave(meta: SavedMeta, change: PublicationChange, scheduledAt: string | null, now: Date = new Date()): SavedMeta {
  switch (change) {
    case "publish":
      return { isPublished: true, publishedAt: meta.isPublished && meta.publishedAt ? meta.publishedAt : now.toISOString(), scheduledAt: null, reviewStatus: meta.reviewStatus, heldReason: null }
    case "schedule":
      return { isPublished: false, publishedAt: meta.publishedAt, scheduledAt, reviewStatus: null, heldReason: null }
    case "unpublish":
    case "unschedule":
    case "draft":
      return { ...meta, isPublished: false, scheduledAt: null }
    default:
      return meta
  }
}

/** Passage bloquant renvoyé par le contrôle (409 « check_failed »). */
export interface BlockingIssue {
  label: string
  excerpt: string | null
  detail: string | null
}

/** Passages d'une réponse 409 ; liste vide si la réponse n'en porte pas. */
export function issuesOf(json: unknown): BlockingIssue[] {
  const raw = json && typeof json === "object" ? (json as { issues?: unknown }).issues : null
  if (!Array.isArray(raw)) return []
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null)
  return raw
    .map((i) => (i && typeof i === "object" ? (i as Record<string, unknown>) : null))
    .filter((i): i is Record<string, unknown> => i !== null && typeof i.label === "string")
    .map((i) => ({ label: String(i.label), excerpt: str(i.excerpt), detail: str(i.detail) }))
}

/** Champ à montrer pour un message d'erreur du serveur (400, 409) ; null : aucun en particulier. */
export function targetOfError(message: string): FocusTarget | null {
  const m = foldAccents(message)
  if (/image de couverture|texte alternatif/.test(m)) return "cover"
  if (/mot-cle/.test(m)) return "keyword"
  if (/adresse/.test(m)) return "slug"
  if (/date|heure|programm/.test(m)) return "publication"
  if (/titre/.test(m)) return "title"
  if (/contenu|texte/.test(m)) return "content"
  return null
}

/** Onglet qui porte un champ (sous 1 280 px). */
export function tabOfTarget(target: FocusTarget): EditorTab {
  switch (target) {
    case "title":
    case "excerpt":
    case "content":
    case "cover":
      return "redaction"
    case "publication":
      return "publication"
    default:
      return "referencement"
  }
}

const LONG_DAY = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })

/** « jeudi 22 octobre », « mercredi 1er octobre ». */
export function dayLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number)
  if (!y || !m || !d) return day
  return LONG_DAY.format(new Date(Date.UTC(y, m - 1, d, 12))).replace(/(^|\s)1(\s)/, "$11er$2")
}

/** « aujourd'hui », « demain » ou « le jeudi 22 octobre ». */
export function relativeDay(day: string, now: Date = new Date()): string {
  const today = todayInParis(now)
  if (day === today) return "aujourd'hui"
  if (day === addDays(today, 1)) return "demain"
  return `le ${dayLabel(day)}`
}

/** Message de l'enregistrement réussi. */
export function successMessage(input: { created: boolean; change: PublicationChange; scheduledAt: string | null; now?: Date }): string {
  const when = input.scheduledAt ? parisDayTime(input.scheduledAt) : null
  const at = when ? `${relativeDay(when.day, input.now)} à ${when.time}` : ""
  switch (input.change) {
    case "publish":
      return input.created ? "Article créé et publié sur le blog" : "Article publié sur le blog"
    case "schedule":
      return input.created ? `Article créé : publication programmée ${at}` : `Publication programmée ${at}`
    case "unpublish":
      return "Article retiré du blog : il est repassé en brouillon"
    case "unschedule":
      return "Programmation retirée : l'article reste en brouillon"
    case "draft":
      return "Brouillon créé"
    default:
      return input.created ? "Article créé" : "Modifications enregistrées"
  }
}

/** Libellé du bouton de la carte Publication : ce que l'enregistrement va faire. */
export function saveActionLabel(mode: PublicationMode, meta: SavedMeta, publicationChanged: boolean): string {
  if (mode === "publish" && !meta.isPublished) return "Publier maintenant"
  if (mode === "schedule" && publicationChanged) return "Programmer la publication"
  if (mode === "draft" && meta.isPublished) return "Retirer du blog"
  return "Enregistrer"
}

/* ------------------------------------------------------------------ */
/* Brouillon local                                                     */
/* ------------------------------------------------------------------ */

export const LOCAL_DRAFT_VERSION = 1

export interface LocalDraft {
  v: typeof LOCAL_DRAFT_VERSION
  /** Instant de l'écriture (ms), horloge de l'appareil. */
  savedAt: number
  draft: ArticleDraft
  /** Version enregistrée dont la copie part (absente des copies plus anciennes). */
  base?: ArticleDraft
}

/** Clé du brouillon local d'un article (« nouveau » avant sa création). */
export function localDraftKey(id: string | null | undefined): string {
  return `q-blog-editor:${id || "nouveau"}`
}

export function serializeLocalDraft(draft: ArticleDraft, now: number, base?: ArticleDraft | null): string {
  const value: LocalDraft = base ? { v: LOCAL_DRAFT_VERSION, savedAt: now, draft, base } : { v: LOCAL_DRAFT_VERSION, savedAt: now, draft }
  return JSON.stringify(value)
}

const MODES: PublicationMode[] = ["draft", "publish", "schedule"]

/**
 * Brouillon local relu sans lui faire confiance (stockage modifiable, ancien
 * format) : null s'il manque un champ ou si un type ne correspond pas.
 */
export function parseLocalDraft(raw: string | null | undefined): LocalDraft | null {
  if (!raw) return null
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (!value || typeof value !== "object") return null
  const v = value as { v?: unknown; savedAt?: unknown; draft?: unknown; base?: unknown }
  if (v.v !== LOCAL_DRAFT_VERSION || typeof v.savedAt !== "number" || !Number.isFinite(v.savedAt)) return null
  const draft = readDraft(v.draft)
  if (!draft) return null
  // Version de départ abîmée : la copie reste lisible, comparée à l'enregistrement par la date seule
  const base = readDraft(v.base)
  return base ? { v: LOCAL_DRAFT_VERSION, savedAt: v.savedAt, draft, base } : { v: LOCAL_DRAFT_VERSION, savedAt: v.savedAt, draft }
}

function readDraft(value: unknown): ArticleDraft | null {
  const d = value && typeof value === "object" ? (value as Record<string, unknown>) : null
  if (!d) return null
  const strings = ["title", "slug", "excerpt", "content", "coverUrl", "coverAlt", "seoTitle", "seoDescription"] as const
  if (!strings.every((k) => typeof d[k] === "string")) return null
  if (d.keyword !== undefined && d.keyword !== null && typeof d.keyword !== "string") return null
  const p = d.publication && typeof d.publication === "object" ? (d.publication as Record<string, unknown>) : null
  if (!p || !MODES.includes(p.mode as PublicationMode) || typeof p.day !== "string" || typeof p.time !== "string") return null
  return {
    title: d.title as string,
    slug: d.slug as string,
    excerpt: d.excerpt as string,
    content: d.content as string,
    coverUrl: d.coverUrl as string,
    coverAlt: d.coverAlt as string,
    seoTitle: d.seoTitle as string,
    seoDescription: d.seoDescription as string,
    keyword: (d.keyword as string | null | undefined) ?? null,
    publication: { mode: p.mode as PublicationMode, day: p.day, time: p.time },
  }
}

/** Mêmes titre, texte, couverture, référencement et adresse (la publication mise à part). */
function sameText(a: ArticleDraft, b: ArticleDraft): boolean {
  return changedFields(a, b).every((f) => f === "publication")
}

/**
 * Brouillon local à proposer, sinon null (il peut être effacé) :
 * - différent de l'enregistrement ;
 * - parti du texte encore enregistré (`base`, la publication mise à part) et
 *   porteur de modifications du texte : proposé, quelle que soit l'heure de
 *   l'appareil (sinon une publication à l'heure prévue, qui date l'article
 *   sans toucher à son texte, ferait disparaître sans le dire les
 *   modifications non enregistrées) ;
 * - sinon, plus récent que le dernier enregistrement connu (`savedAt`, null
 *   pour un article jamais enregistré).
 */
export function draftToOffer(local: LocalDraft | null, saved: ArticleDraft, savedAt: number | null): LocalDraft | null {
  if (!local) return null
  if (!isDirty(local.draft, saved)) return null
  if (local.base && sameText(local.base, saved) && !sameText(local.draft, saved)) return local
  if (savedAt !== null && local.savedAt <= savedAt) return null
  return local
}

/**
 * Publication changée sur le serveur depuis la copie (publiée à l'heure
 * prévue, retirée ailleurs) : la restauration garde celle d'aujourd'hui.
 */
export function publicationMovedSince(local: LocalDraft, saved: ArticleDraft): boolean {
  return Boolean(local.base) && !samePublication(local.base!.publication, saved.publication)
}

/**
 * Brouillon restauré. `keepPublication` : la publication actuelle est gardée
 * (jour demandé par le calendrier, publication changée sur le serveur depuis
 * la copie).
 */
export function restoreDraft(local: LocalDraft, current: ArticleDraft, keepPublication: boolean): ArticleDraft {
  return keepPublication ? { ...local.draft, publication: current.publication } : local.draft
}
