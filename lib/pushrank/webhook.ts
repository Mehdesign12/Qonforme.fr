/**
 * Webhook CMS de PushRank (contrat « 2026-07 ») : PushRank publie ses articles
 * sur le blog en appelant POST /api/pushrank/webhook.
 *
 * Ce module ne touche pas à la base : signature, lecture des événements,
 * conversion en article du blog et décision de publication. La route
 * (app/api/pushrank/webhook/route.ts) s'occupe du stockage.
 *
 * Décision du fondateur (06/10/2026) : les articles sont publiés directement,
 * PushRank les ayant déjà relus. Exception, la même que pour le générateur
 * d'articles du blog : un article qui cite une valeur périmée ou une
 * affirmation interdite (lib/blog-audit.ts) reste en brouillon, à relire dans
 * /admin/blog/verification.
 */
import crypto from "node:crypto"
import { auditArticle } from "@/lib/blog-audit"
import { htmlToMarkdown, plainText, stripLeadingTitle } from "@/lib/pushrank/html-to-markdown"

export const PUSHRANK_CONTRACT_VERSION = "2026-07"
/** Âge maximal d'une requête signée (rejeu), en secondes. */
export const MAX_REQUEST_AGE_SECONDS = 300

/** Signature `sha256=<hex>` de « horodatage + "." + corps brut », comparée en temps constant. */
export function verifyPushrankSignature(input: {
  rawBody: Buffer | string
  timestamp: string | null | undefined
  signature: string | null | undefined
  secret: string
  nowSeconds: number
}): boolean {
  const { rawBody, timestamp, signature, secret, nowSeconds } = input
  if (!timestamp || !signature || !secret || !/^\d+$/.test(timestamp)) return false
  if (Math.abs(nowSeconds - Number(timestamp)) > MAX_REQUEST_AGE_SECONDS) return false
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(`${timestamp}.`).update(rawBody).digest("hex")
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export interface PushrankRobots {
  index?: boolean
  follow?: boolean
  noSnippet?: boolean
  noArchive?: boolean
}

export interface PushrankArticle {
  title: string
  /** HTML. */
  content: string
  excerpt?: string
  slug: string
  status: string
  meta_title?: string
  meta_description?: string
  focus_keyword?: string
  featured_image_url?: string
  featured_image_alt?: string
  robots_config?: PushrankRobots
}

export type PushrankEvent =
  | { kind: "test" }
  | { kind: "create"; article: PushrankArticle }
  | { kind: "update"; remotePostId: string; article: PushrankArticle }
  | { kind: "unpublish" | "delete"; remotePostId: string }

type Parsed = { ok: true; event: PushrankEvent } | { ok: false; error: string }

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined)

function readArticle(b: Record<string, unknown>): PushrankArticle | string {
  const title = str(b.title)
  const content = str(b.content)
  const slug = str(b.slug)
  const status = str(b.status)
  if (!title?.trim()) return "missing_title"
  if (content === undefined) return "missing_content"
  if (slug === undefined) return "missing_slug"
  if (status === undefined) return "missing_status"
  const robots = b.robots_config && typeof b.robots_config === "object" ? (b.robots_config as Record<string, unknown>) : {}
  const bool = (v: unknown) => (typeof v === "boolean" ? v : undefined)
  return {
    title,
    content,
    slug,
    status,
    excerpt: str(b.excerpt),
    meta_title: str(b.meta_title),
    meta_description: str(b.meta_description),
    focus_keyword: str(b.focus_keyword),
    featured_image_url: str(b.featured_image_url),
    featured_image_alt: str(b.featured_image_alt),
    robots_config: { index: bool(robots.index), follow: bool(robots.follow), noSnippet: bool(robots.noSnippet), noArchive: bool(robots.noArchive) },
  }
}

/** Lit un événement. Une version de contrat inconnue est une erreur (consigne de PushRank). */
export function parsePushrankEvent(body: unknown): Parsed {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "invalid_body" }
  const b = body as Record<string, unknown>
  if (b.version !== PUSHRANK_CONTRACT_VERSION) return { ok: false, error: "unsupported_version" }
  if (b.test === true) return { ok: true, event: { kind: "test" } }

  const action = b.action
  if (action === "create") {
    const article = readArticle(b)
    return typeof article === "string" ? { ok: false, error: article } : { ok: true, event: { kind: "create", article } }
  }
  if (action === "update" || action === "unpublish" || action === "delete") {
    const remotePostId = str(b.remote_post_id)?.trim()
    if (!remotePostId) return { ok: false, error: "missing_remote_post_id" }
    if (action !== "update") return { ok: true, event: { kind: action, remotePostId } }
    const article = readArticle(b)
    return typeof article === "string" ? { ok: false, error: article } : { ok: true, event: { kind: "update", remotePostId, article } }
  }
  return { ok: false, error: "unknown_action" }
}

/** Adresse d'article : minuscules, lettres, chiffres et tirets, 90 caractères au plus. */
export function blogSlug(slug: string, title: string): string {
  const make = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/œ/g, "oe")
      .replace(/æ/g, "ae")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 90)
      .replace(/-+$/, "")
  return make(slug) || make(title) || "article"
}

/** Directives d'indexation conservées : seulement les booléens fournis. */
export function robotsOf(r: PushrankRobots | undefined): PushrankRobots {
  const out: PushrankRobots = {}
  for (const k of ["index", "follow", "noSnippet", "noArchive"] as const) if (typeof r?.[k] === "boolean") out[k] = r[k]
  return out
}

export interface BlogPostFields {
  title: string
  slug: string
  excerpt: string | null
  content: string
  seo_title: string | null
  seo_description: string | null
  cover_alt: string | null
  robots: PushrankRobots
  ai_keywords: string[]
  ai_prompt: string
}

/** Article PushRank → colonnes de blog_posts (contenu converti en Markdown sûr). */
export function toBlogPost(a: PushrankArticle): BlogPostFields {
  const title = plainText(a.title, 200)
  const focus = plainText(a.focus_keyword, 120)
  const excerpt = plainText(a.excerpt, 400) || plainText(a.meta_description, 400) || null
  return {
    title,
    slug: blogSlug(a.slug, title),
    excerpt,
    content: stripLeadingTitle(htmlToMarkdown(a.content), title),
    seo_title: plainText(a.meta_title, 200) || null,
    seo_description: plainText(a.meta_description, 400) || null,
    cover_alt: plainText(a.featured_image_alt, 300) || null,
    robots: robotsOf(a.robots_config),
    ai_keywords: focus ? [focus] : [],
    ai_prompt: focus ? `PushRank | Mot-clé : ${focus}` : "PushRank",
  }
}

/** Règles de lib/blog-audit.ts qui retiennent un article en brouillon (« PDP » ne fait que signaler). */
const NON_BLOQUANTES = new Set(["pdp"])

/** Publié directement, sauf si le contrôle du blog trouve une valeur périmée ou une affirmation interdite. */
export function publicationDecision(post: Pick<BlogPostFields, "title" | "excerpt" | "content">): { publish: boolean; heldReason: string | null } {
  const findings = auditArticle([post.title, post.excerpt ?? "", post.content].join("\n\n")).filter((f) => !NON_BLOQUANTES.has(f.rule.id))
  if (findings.length === 0) return { publish: true, heldReason: null }
  const labels = Array.from(new Set(findings.map((f) => f.rule.label)))
  return { publish: false, heldReason: `Retenu en brouillon : ${labels.join(" ; ")}` }
}

export function articleUrl(slug: string): string {
  return `https://qonforme.fr/blog/${slug}`
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function isUuid(s: string): boolean {
  return UUID.test(s)
}
