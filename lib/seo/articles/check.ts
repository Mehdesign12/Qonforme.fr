/**
 * Contrôle automatique d'un article et décision de publication.
 *
 * Le contrôle reprend les règles de lib/blog-audit.ts (valeurs périmées,
 * affirmations interdites) et ajoute : concurrent nommé, longueur, titre de
 * niveau 1, liens non officiels, titres répétés, FAQ, description Google,
 * doublon avec un article existant.
 *
 * Deux gravités (règle de PLAN-SEO-INTERNE-2026-10.md : « le contrôle retient
 * toujours ») :
 * - bloquant : valeur périmée ou affirmation interdite (règles de blog-audit
 *   hors « PDP », qui ne fait que signaler) et concurrent nommé ;
 * - à relire : tout le reste.
 *
 * Module pur.
 */
import { auditArticle } from "@/lib/blog-audit"
import { competitorTerms, findCompetitorMentions } from "@/lib/seo/competitors"
import { z } from "zod"
import { isOfficialUrl, REVIEW_CATEGORIES, type ReviewCategory } from "@/lib/seo/articles/prompt"
import type { PublishMode } from "@/lib/seo/types"

/** Règles de lib/blog-audit.ts qui signalent sans retenir (« PDP »). */
export const NON_BLOCKING_AUDIT_RULES = new Set(["pdp"])

export type IssueKind = "audit" | "competitor" | "review" | "review_missing" | "length" | "h1" | "link" | "heading" | "faq" | "meta" | "duplicate"

export interface CheckIssue {
  kind: IssueKind
  /** Libellé court (« Anciens seuils de franchise de TVA »). */
  label: string
  /** Précision (valeur juste, nombre de mots, article proche…). */
  detail?: string
  excerpt?: string
  /** Règle de blog-audit. */
  rule?: string
  /** Valeur périmée ou affirmation interdite : retient l'article dans tous les modes. */
  blocking: boolean
  /** Une passe de correction peut le régler. */
  fixable: boolean
}

/** Résultat enregistré dans blog_posts.audit_result. */
export interface AuditResult {
  version: 1
  checkedAt: string
  issues: CheckIssue[]
  blocking: number
  /** Corrections faites sans le modèle (titre de niveau 1 rétrogradé, lien non officiel retiré…). */
  autoFixes?: string[]
  /** Une passe de correction a eu lieu. */
  fixPass?: boolean
  /** Longueur et FAQ demandées à la rédaction : le contrôle à l'heure prévue les reprend. */
  brief?: { lengthMin: number; lengthMax: number; faq: { min: number; max: number } | null }
}

/* ------------------------------------------------------------------ */
/* Texte                                                               */
/* ------------------------------------------------------------------ */

const strip = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

export function slugify(text: string): string {
  return strip(text).replace(/\s+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/, "")
}

/** Nombre de mots du texte lisible (sans la syntaxe Markdown ni les adresses). */
export function wordCount(markdown: string): number {
  const text = markdown
    .replace(/\]\([^)]*\)/g, "]")
    .replace(/[#*_>`[\]]/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
  return (text.match(WORD) ?? []).length
}

// Constructeur plutôt que littéral : la cible ancienne du tsconfig refuse le drapeau « u » dans un littéral
const WORD = new RegExp("[\\p{L}\\p{N}][\\p{L}\\p{N}'’-]*", "gu")

function headingsOf(markdown: string): { level: number; text: string }[] {
  const out: { level: number; text: string }[] = []
  for (const m of Array.from(markdown.matchAll(/^(#{1,6})\s+(.+?)\s*#*\s*$/gm))) out.push({ level: m[1].length, text: m[2].trim() })
  return out
}

/** Même repérage des liens que le moteur Markdown du blog (lib/markdown.ts) : ce qu'il transformerait en <a href>. */
const MD_LINK = /\[([^\]]+)\]\(([^)]+)\)/g

function linksOf(markdown: string): { text: string; url: string }[] {
  return Array.from(markdown.matchAll(MD_LINK)).map((m) => ({ text: m[1], url: m[2] }))
}

/**
 * Liste blanche des adresses d'un article : https officielle (.gouv.fr,
 * service-public.fr), qonforme.fr, chemin interne « /… » ou ancre. Jamais
 * d'espace, de guillemet, de chevron ni de barre oblique inverse (le moteur
 * du blog insère l'adresse telle quelle dans href), jamais « //hôte ».
 */
export function isAllowedLink(url: string): boolean {
  if (/[\s"'<>`\\]/.test(url)) return false
  if (url.startsWith("#")) return /^#[\w-]+$/.test(url)
  if (url.startsWith("/")) return !url.startsWith("//")
  if (/^https:\/\/(www\.)?qonforme\.fr(\/|$)/i.test(url)) return true
  return isOfficialUrl(url)
}

/**
 * Nettoie le Markdown renvoyé par le modèle, sans rien inventer :
 * bloc de code englobant, images, titre répété en tête, titres de niveau 1
 * (rétrogradés en « ## »). Le moteur Markdown du blog laisse passer le HTML :
 * aucun HTML venant du modèle n'est gardé (chaque « < » devient « &lt; »), et
 * seuls les liens de la liste blanche (isAllowedLink) restent des liens ;
 * les autres gardent leur texte.
 */
export function normalizeContent(raw: string, title: string): { content: string; autoFixes: string[] } {
  const fixes: string[] = []
  let md = raw.replace(/\r\n?/g, "\n").trim()

  const fenced = md.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/i)
  if (fenced) md = fenced[1].trim()

  const withoutImages = md.replace(/!\[[^\]]*\]\([^)]*\)/g, "")
  if (withoutImages !== md) fixes.push("Images du texte retirées")
  md = withoutImages

  // Aucun HTML actif : neutralisé en une fois (pas de balise reconstituée après un retrait)
  const withoutHtml = md.replace(/</g, "&lt;")
  if (withoutHtml !== md) fixes.push("HTML neutralisé")
  md = withoutHtml

  // Premier titre identique au titre de l'article : la page l'affiche déjà
  const first = md.match(/^#{1,3}\s+(.+)\n+/)
  if (first && strip(first[1]) === strip(title)) {
    md = md.slice(first[0].length).trim()
    fixes.push("Titre répété en tête retiré")
  }

  const demoted = md.replace(/^#\s+(.+)$/gm, "## $1")
  if (demoted !== md) fixes.push("Titre de niveau 1 rétrogradé en section")
  md = demoted

  let removedLinks = 0
  md = md.replace(MD_LINK, (all, text: string, url: string) => {
    if (isAllowedLink(url)) return all
    removedLinks++
    return text
  })
  if (removedLinks > 0) fixes.push(`${removedLinks} lien${removedLinks > 1 ? "s" : ""} non officiel${removedLinks > 1 ? "s" : ""} retiré${removedLinks > 1 ? "s" : ""}`)

  return { content: md.replace(/\n{3,}/g, "\n\n").trim(), autoFixes: fixes }
}

/* ------------------------------------------------------------------ */
/* Concurrents masqués                                                 */
/* ------------------------------------------------------------------ */

export const REDACTED = "[nom retiré]"

const unaccent = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()

/**
 * Remplace chaque nom de concurrent par « [nom retiré] » avant d'envoyer un
 * texte au modèle (relecture, correction). Même recherche que
 * findCompetitorMentions (lib/seo/competitors.ts) : texte sans accents ni
 * casse, mot entier ; le remplacement se fait aux mêmes positions dans le
 * texte d'origine. Un texte sans concurrent est rendu tel quel.
 */
export function redactCompetitors(text: string, domains: string[]): string {
  let norm = ""
  const origin: number[] = []
  for (let i = 0; i < text.length; i++) {
    const folded = unaccent(text[i])
    for (let k = 0; k < folded.length; k++) {
      norm += folded[k]
      origin.push(i)
    }
  }
  const spans: [number, number][] = []
  const terms = competitorTerms(domains).map(unaccent).sort((a, b) => b.length - a.length)
  for (const term of terms) {
    const re = new RegExp(`(^|[^a-z0-9])(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?=[^a-z0-9]|$)`, "g")
    let m: RegExpExecArray | null
    while ((m = re.exec(norm))) {
      const start = m.index + m[1].length
      const end = start + m[2].length
      spans.push([origin[start], origin[end - 1] + 1])
      re.lastIndex = end
    }
  }
  if (spans.length === 0) return text
  spans.sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []
  for (const span of spans) {
    const last = merged[merged.length - 1]
    if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1])
    else merged.push([span[0], span[1]])
  }
  let out = text
  for (let i = merged.length - 1; i >= 0; i--) out = out.slice(0, merged[i][0]) + REDACTED + out.slice(merged[i][1])
  return out
}

/* ------------------------------------------------------------------ */
/* Doublons                                                            */
/* ------------------------------------------------------------------ */

const STOPWORDS = new Set(
  "les des une un le la du de et en au aux pour par sur dans avec sans vos votre nos notre est sont ce cette ces qui que quoi comment quel quelle quels quelles faire tout tous plus".split(" "),
)

function tokens(text: string): Set<string> {
  return new Set(strip(text).split(" ").filter((w) => w.length >= 3 && !STOPWORDS.has(w)))
}

/** Similarité de deux titres (0 à 1) : mots significatifs en commun. */
export function titleSimilarity(a: string, b: string): number {
  const A = tokens(a)
  const B = tokens(b)
  if (A.size === 0 || B.size === 0) return 0
  let common = 0
  A.forEach((w) => {
    if (B.has(w)) common++
  })
  return common / (A.size + B.size - common)
}

export interface ExistingArticle {
  id: string
  title: string
  slug: string
}

export const DUPLICATE_THRESHOLD = 0.6

export function findDuplicate(input: { title: string; slug?: string | null; selfId?: string | null }, existing: ExistingArticle[]): ExistingArticle | null {
  const base = input.slug ? slugify(input.slug) : null
  for (const a of existing) {
    if (input.selfId && a.id === input.selfId) continue
    if (base && slugify(a.slug).replace(/-\d+$/, "") === base.replace(/-\d+$/, "")) return a
    if (titleSimilarity(input.title, a.title) >= DUPLICATE_THRESHOLD) return a
  }
  return null
}

/* ------------------------------------------------------------------ */
/* Contrôle                                                            */
/* ------------------------------------------------------------------ */

export interface CheckInput {
  title: string
  content: string
  metaDescription?: string | null
  slug?: string | null
  /** Mots-clés publiés avec l'article (étiquettes et données structurées de la page). */
  keywords?: string[] | null
  /** Identifiant de l'article contrôlé (exclu de la recherche de doublons). */
  selfId?: string | null
  /** Domaines concurrents (Paramètres › Ciblage) : usage interne, jamais envoyés au générateur. */
  competitors: string[]
  existing: ExistingArticle[]
  /** Préférences (longueur et FAQ) ; absentes : ces contrôles sont sautés. */
  lengthMin?: number
  lengthMax?: number
  faq?: { min: number; max: number } | null
}

export function checkArticle(input: CheckInput): CheckIssue[] {
  const issues: CheckIssue[] = []
  const fullText = [input.title, input.metaDescription ?? "", (input.keywords ?? []).join(", "), input.content].join("\n\n")

  for (const f of auditArticle(fullText)) {
    const blocking = !NON_BLOCKING_AUDIT_RULES.has(f.rule.id)
    issues.push({
      kind: "audit",
      rule: f.rule.id,
      label: f.rule.label,
      detail: f.rule.correction,
      excerpt: f.excerpt,
      blocking,
      fixable: true,
    })
  }

  // L'adresse devient l'URL publique : elle est contrôlée aussi
  const competitors = findCompetitorMentions(`${fullText}\n${(input.slug ?? "").replace(/-/g, " ")}`, input.competitors)
  if (competitors.length > 0) {
    issues.push({
      kind: "competitor",
      label: "Concurrent nommé",
      detail: `Usage interne : ${competitors.join(", ")}`,
      blocking: true,
      fixable: true,
    })
  }

  if (input.content.includes(REDACTED)) {
    issues.push({
      kind: "competitor",
      label: "Repère « [nom retiré] » resté dans le texte",
      detail: "Un nom de logiciel retiré avant la correction n'a pas été réécrit.",
      blocking: true,
      fixable: true,
    })
  }

  // Titre, description et mots-clés vont dans les balises de la page et ses données
  // structurées : aucun chevron (« </script> ») n'y passe, même à la publication manuelle
  const tagged = [
    ["le titre", input.title],
    ["la description", input.metaDescription ?? ""],
    ["les mots-clés", (input.keywords ?? []).join(" ")],
  ].filter(([, value]) => /[<>]/.test(value))
  if (tagged.length > 0) {
    issues.push({
      kind: "meta",
      label: "Chevron « < » ou « > » dans le titre, la description ou les mots-clés",
      detail: `À retirer dans ${tagged.map(([where]) => where).join(", ")}.`,
      blocking: true,
      fixable: false,
    })
  }

  if (input.lengthMin && input.lengthMax) {
    const words = wordCount(input.content)
    if (words < Math.round(input.lengthMin * 0.9)) {
      issues.push({ kind: "length", label: "Article trop court", detail: `${words} mots pour ${input.lengthMin} à ${input.lengthMax} attendus`, blocking: false, fixable: true })
    } else if (words > Math.round(input.lengthMax * 1.2)) {
      issues.push({ kind: "length", label: "Article trop long", detail: `${words} mots pour ${input.lengthMin} à ${input.lengthMax} attendus`, blocking: false, fixable: true })
    }
  }

  const headings = headingsOf(input.content)
  if (headings.some((h) => h.level === 1)) {
    issues.push({ kind: "h1", label: "Titre de niveau 1 dans le texte", detail: "Le titre de l'article est déjà affiché par la page.", blocking: false, fixable: true })
  }

  const forbidden = linksOf(input.content).filter((l) => !isAllowedLink(l.url))
  if (forbidden.length > 0) {
    issues.push({
      kind: "link",
      label: "Lien vers un site non officiel",
      detail: forbidden.slice(0, 3).map((l) => l.url).join(", "),
      blocking: false,
      fixable: true,
    })
  }

  const seen = new Map<string, number>()
  const repeated: string[] = []
  const titleKey = strip(input.title)
  for (const h of headings) {
    const key = strip(h.text)
    if (!key) continue
    if (key === titleKey && !repeated.includes(h.text)) repeated.push(h.text)
    seen.set(key, (seen.get(key) ?? 0) + 1)
    if (seen.get(key) === 2 && !repeated.includes(h.text)) repeated.push(h.text)
  }
  if (repeated.length > 0) {
    issues.push({ kind: "heading", label: "Titres répétés", detail: repeated.slice(0, 3).map((t) => `« ${t} »`).join(", "), blocking: false, fixable: true })
  }

  if (input.faq) {
    const questions = headings.filter((h) => h.level >= 2 && h.level <= 3 && /\?\s*$/.test(h.text)).length
    if (questions < input.faq.min) {
      issues.push({ kind: "faq", label: "FAQ incomplète", detail: `${questions} question${questions > 1 ? "s" : ""} pour ${input.faq.min} à ${input.faq.max} attendues`, blocking: false, fixable: true })
    }
  }

  if (input.metaDescription !== undefined) {
    const n = (input.metaDescription ?? "").trim().length
    if (n < 120 || n > 155) {
      issues.push({ kind: "meta", label: "Description Google hors longueur", detail: `${n} caractères pour 120 à 155 attendus`, blocking: false, fixable: false })
    }
  }

  const duplicate = findDuplicate({ title: input.title, slug: input.slug, selfId: input.selfId }, input.existing)
  if (duplicate) {
    issues.push({ kind: "duplicate", label: "Sujet proche d'un article existant", detail: `« ${duplicate.title} »`, blocking: false, fixable: false })
  }

  return issues
}

export function auditResultOf(issues: CheckIssue[], now: Date, extra?: Pick<AuditResult, "autoFixes" | "fixPass" | "brief">): AuditResult {
  return {
    version: 1,
    checkedAt: now.toISOString(),
    issues,
    blocking: issues.filter((i) => i.blocking).length,
    ...(extra?.autoFixes && extra.autoFixes.length > 0 ? { autoFixes: extra.autoFixes } : {}),
    ...(extra?.fixPass ? { fixPass: true } : {}),
    ...(extra?.brief ? { brief: extra.brief } : {}),
  }
}

/** Lit blog_posts.audit_result (null si absent ou d'un autre format). */
export function readAuditResult(value: unknown): AuditResult | null {
  if (!value || typeof value !== "object") return null
  const v = value as Partial<AuditResult>
  if (!Array.isArray(v.issues)) return null
  return {
    version: 1,
    checkedAt: typeof v.checkedAt === "string" ? v.checkedAt : "",
    issues: v.issues as CheckIssue[],
    blocking: typeof v.blocking === "number" ? v.blocking : (v.issues as CheckIssue[]).filter((i) => i?.blocking).length,
    autoFixes: Array.isArray(v.autoFixes) ? v.autoFixes : undefined,
    fixPass: v.fixPass === true,
    brief: v.brief && typeof v.brief === "object" && typeof v.brief.lengthMin === "number" ? v.brief : undefined,
  }
}

/**
 * Problèmes du contrôle factuel gardés dans audit_result et toujours
 * d'actualité : un passage repéré par le relecteur dont l'extrait est encore
 * dans le texte, et « Contrôle factuel non fait ». Ils comptent à l'heure
 * prévue et pour « Publier maintenant » comme le jour de la rédaction.
 */
export function storedReviewIssues(auditResult: unknown, content: string): CheckIssue[] {
  const stored = readAuditResult(auditResult)
  if (!stored) return []
  const haystack = comparable(content)
  return stored.issues.filter(
    (i) => i?.kind === "review_missing" || (i?.kind === "review" && typeof i.excerpt === "string" && haystack.includes(comparable(i.excerpt))),
  )
}

/* ------------------------------------------------------------------ */
/* Contrôle factuel (modèle de relecture)                              */
/* ------------------------------------------------------------------ */

const REVIEW_LABELS: Record<ReviewCategory, { label: string; blocking: boolean }> = {
  // Valeur périmée ou affirmation interdite : retient l'article (règle « le contrôle retient toujours »)
  stale_value: { label: "Valeur périmée (contrôle factuel)", blocking: true },
  forbidden_claim: { label: "Affirmation interdite (contrôle factuel)", blocking: true },
  unverifiable_claim: { label: "Affirmation invérifiable (contrôle factuel)", blocking: false },
  factual_error: { label: "Erreur factuelle possible (contrôle factuel)", blocking: false },
  instruction: { label: "Consigne non respectée (contrôle factuel)", blocking: false },
}

const reviewSchema = z.object({
  problems: z
    .array(
      z.object({
        category: z.string(),
        excerpt: z.string(),
        explanation: z.string().default(""),
        fix: z.string().default(""),
      }),
    )
    .default([]),
})

/** Texte comparable : sans syntaxe Markdown, guillemets ni espaces en trop. */
function comparable(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`#>«»"“”]/g, " ")
    .replace(/[’]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

export class ReviewInvalidError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ReviewInvalidError"
  }
}

/**
 * Lit la réponse du relecteur. Un problème dont la citation ne se retrouve pas
 * dans l'article est écarté (citation inventée par le modèle).
 */
export function parseReview(text: string, content: string): CheckIssue[] {
  const raw = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new ReviewInvalidError("La réponse du contrôle factuel n'est pas un JSON lisible")
  }
  const parsed = reviewSchema.safeParse(data)
  if (!parsed.success) throw new ReviewInvalidError("Réponse du contrôle factuel invalide")
  const haystack = comparable(content)
  const issues: CheckIssue[] = []
  for (const p of parsed.data.problems) {
    const category = p.category.trim().toLowerCase() as ReviewCategory
    if (!REVIEW_CATEGORIES.includes(category)) continue
    const excerpt = p.excerpt.trim()
    const needle = comparable(excerpt)
    if (needle.length < 8 || !haystack.includes(needle)) continue
    const def = REVIEW_LABELS[category]
    issues.push({
      kind: "review",
      rule: category,
      label: def.label,
      detail: [p.explanation.trim(), p.fix.trim() ? `À écrire : ${p.fix.trim()}` : ""].filter(Boolean).join(" "),
      excerpt: excerpt.slice(0, 300),
      blocking: def.blocking,
      fixable: true,
    })
  }
  return issues.slice(0, 15)
}

/** Contrôle factuel impossible (modèle indisponible) : signalé, jamais passé sous silence. */
export function reviewMissingIssue(reason: string): CheckIssue {
  return { kind: "review_missing", label: "Contrôle factuel non fait", detail: reason, blocking: false, fixable: false }
}

/* ------------------------------------------------------------------ */
/* Décision de publication                                             */
/* ------------------------------------------------------------------ */

export interface PublicationDecision {
  publish: boolean
  /** Pourquoi l'article reste en brouillon (null : rien à signaler). */
  heldReason: string | null
  /** « to_review » : l'article attend une relecture. */
  reviewStatus: "to_review" | null
}

function labels(issues: CheckIssue[]): string {
  return Array.from(new Set(issues.map((i) => i.label))).join(" ; ")
}

/**
 * - draft : jamais publié automatiquement, toujours « À relire » ;
 * - after_check : publié seulement si le contrôle ne repère rien du tout ;
 * - direct : publié, sauf valeur périmée ou affirmation interdite (le contrôle retient toujours).
 */
export function decidePublication(mode: PublishMode, issues: CheckIssue[]): PublicationDecision {
  const blocking = issues.filter((i) => i.blocking)
  if (mode === "draft") {
    return { publish: false, heldReason: issues.length > 0 ? `Passages à relire : ${labels(issues)}` : null, reviewStatus: "to_review" }
  }
  if (mode === "after_check") {
    return issues.length === 0
      ? { publish: true, heldReason: null, reviewStatus: null }
      : { publish: false, heldReason: `Retenu par le contrôle : ${labels(issues)}`, reviewStatus: "to_review" }
  }
  return blocking.length === 0
    ? { publish: true, heldReason: null, reviewStatus: null }
    : { publish: false, heldReason: `Retenu par le contrôle : ${labels(blocking)}`, reviewStatus: "to_review" }
}

/** Publication manuelle (« Publier maintenant ») : refusée si une valeur périmée ou une affirmation interdite reste. */
export function manualPublishBlockers(issues: CheckIssue[]): CheckIssue[] {
  return issues.filter((i) => i.blocking)
}
