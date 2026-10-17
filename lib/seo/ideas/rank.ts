/**
 * Contrôle, rapprochement et classement des idées de la « Proposition IA ».
 *
 * - `shapeIdea` : ce que le modèle a proposé devient une idée propre (forme
 *   canonique, accents, type et moment valides, titre qui passe le contrôle des
 *   titres) ou est refusé avec sa raison : concurrent, marque, adresse web,
 *   valeur périmée, trop court ou trop long ;
 * - `overlapsOf` : articles, sujets, mots-clés suivis et requêtes de Search
 *   Console qui couvrent déjà la phrase (risque de doublon, concurrence entre
 *   pages) ;
 * - `scoreIdea` : ordre d'affichage, de 0 à 100 : preuve que la phrase existe,
 *   volume, difficulté, moment de la personne, moins les doublons.
 *
 * Module pur : serveur et tests.
 */
import { auditArticle } from "@/lib/blog-audit"
import { findCompetitorMentions } from "@/lib/seo/competitors"
import { findMissingAccents, matchKeyword } from "@/lib/seo/articles/onpage"
import { cleanSuggestion, rejectReason } from "@/lib/seo/articles/suggest"
import { inferArticleType, keywordArticleMismatch, keywordForm } from "@/lib/seo/articles/search-language"
import { canonicalKeyword, foldAccents, looksLikeUrl } from "@/lib/seo/keywords/normalize"
import { topicTitleFor } from "@/lib/seo/keywords/input"
import type { RawIdea } from "@/lib/seo/ideas/prompt"
import type { ArticleType } from "@/lib/seo/types"
import type { Idea, IdeaOverlap, IdeaStage } from "@/lib/seo/ideas/types"

const ARTICLE_TYPES: ArticleType[] = ["howto", "guide", "news", "faq"]
const STAGES: IdeaStage[] = ["learn", "do", "buy"]

export const IDEA_MIN_WORDS = 2
export const IDEA_MAX_WORDS = 9
export const IDEA_MAX_LENGTH = 80

export interface ShapeContext {
  competitors: string[]
  /** Termes de marque (Paramètres › Ciblage) : une requête de marque n'est pas un sujet d'article. */
  brandTerms: string[]
}

export type Shaped = { ok: true; idea: Pick<Idea, "keyword" | "title" | "articleType" | "stage" | "why" | "warnings"> } | { ok: false; reason: string }

/** Moment par défaut d'après le type et la forme de la requête. */
function defaultStage(keyword: string, type: ArticleType): IdeaStage {
  if (keywordForm(keyword) === "buy") return "buy"
  return type === "howto" ? "do" : "learn"
}

/** Phrase du modèle rendue propre, ou refusée. */
export function shapeIdea(raw: RawIdea, ctx: ShapeContext): Shaped {
  let keyword = canonicalKeyword(String(raw.keyword ?? ""))
  if (!keyword) return { ok: false, reason: "vide" }
  if (looksLikeUrl(keyword)) return { ok: false, reason: "adresse" }
  // Accents rétablis (« batiment » → « bâtiment ») : Google rapproche les deux formes, le site s'écrit avec
  for (const miss of findMissingAccents(keyword)) keyword = keyword.split(miss.word).join(miss.suggestion)
  const words = keyword.split(" ").filter(Boolean).length
  if (words < IDEA_MIN_WORDS || words > IDEA_MAX_WORDS || keyword.length > IDEA_MAX_LENGTH) return { ok: false, reason: "forme" }
  if (/[<>{}[\]|\\]/.test(keyword)) return { ok: false, reason: "forme" }
  if (findCompetitorMentions(keyword, ctx.competitors).length > 0) return { ok: false, reason: "concurrent" }
  if (ctx.brandTerms.some((t) => t.trim().length >= 3 && foldAccents(keyword).includes(foldAccents(t)))) return { ok: false, reason: "marque" }
  // « PDP » reste une recherche réelle : seules les valeurs périmées et les affirmations interdites refusent
  if (auditArticle(keyword).some((issue) => issue.rule.id !== "pdp")) return { ok: false, reason: "affirmation" }

  const type: ArticleType = ARTICLE_TYPES.includes(raw.articleType as ArticleType) ? (raw.articleType as ArticleType) : inferArticleType(keyword, raw.title)
  const stage: IdeaStage = STAGES.includes(raw.stage as IdeaStage) ? (raw.stage as IdeaStage) : defaultStage(keyword, type)

  let title = cleanSuggestion("title", raw.title ?? "")
  if (!title || rejectReason("title", title, ctx.competitors, { keyword, articleType: type })) title = topicTitleFor(keyword)
  // Le titre de repli est la requête : jamais un concurrent
  if (findCompetitorMentions(title, ctx.competitors).length > 0) return { ok: false, reason: "concurrent" }

  const why = String(raw.why ?? "").replace(/[<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 220)
  const warnings: string[] = []
  if (/\bgratuit(?:e|es|ement)?\b/i.test(keyword) && /factur|logiciel|application|appli/i.test(keyword)) {
    warnings.push("« Gratuit » : seuls les devis, le générateur et les modèles le sont. L'article ne doit pas promettre la facturation gratuite avec Qonforme.")
  }
  const mismatch = keywordArticleMismatch(keyword, type)
  if (mismatch) warnings.push(mismatch)
  return { ok: true, idea: { keyword, title, articleType: type, stage, why: why || "—", warnings } }
}

/* ------------------------------------------------------------------ */
/* Rapprochement avec l'existant                                       */
/* ------------------------------------------------------------------ */

export interface ExistingPost {
  title: string
  slug: string
  target_keyword?: string | null
}

export interface ExistingTopic {
  title: string
  keyword: string | null
}

export interface TrackedKeyword {
  keyword: string
  status: string
  target_path: string | null
}

export interface RankingEntry {
  impressions: number
  position: number | null
}

export interface ExistingSources {
  posts: ExistingPost[]
  topics: ExistingTopic[]
  /** Mots-clés suivis par forme canonique. */
  tracked: Map<string, TrackedKeyword>
  /** Requêtes de Search Console par forme canonique. */
  ranking: Map<string, RankingEntry>
}

/** Seuil d'une page « déjà bien placée » : assez vue et dans les 15 premières places. */
export const RANKING_MIN_IMPRESSIONS = 20
export const RANKING_MAX_POSITION = 15

export function overlapsOf(keyword: string, src: ExistingSources): { overlaps: IdeaOverlap[]; ranking: RankingEntry | null; tracked: boolean } {
  const overlaps: IdeaOverlap[] = []
  for (const post of src.posts) {
    if (post.target_keyword && canonicalKeyword(post.target_keyword) === keyword) {
      overlaps.push({ kind: "article", label: post.title, detail: "Un article vise déjà cette requête", path: `/blog/${post.slug}` })
    } else if (matchKeyword(post.title, keyword) === "exact") {
      overlaps.push({ kind: "article", label: post.title, detail: "Le titre d'un article contient déjà cette requête", path: `/blog/${post.slug}` })
    }
  }
  for (const topic of src.topics) {
    if (topic.keyword && canonicalKeyword(topic.keyword) === keyword) overlaps.push({ kind: "topic", label: topic.title, detail: "Un sujet vise déjà cette requête" })
    else if (matchKeyword(topic.title, keyword) === "exact") overlaps.push({ kind: "topic", label: topic.title, detail: "Le titre d'un sujet contient déjà cette requête" })
  }
  const tracked = src.tracked.get(keyword)
  if (tracked) {
    overlaps.push({
      kind: "keyword",
      label: "Déjà suivi dans Mots-clés",
      detail: tracked.target_path ? `Page cible : ${tracked.target_path}` : undefined,
      path: tracked.target_path ?? undefined,
    })
  }
  const ranking = src.ranking.get(keyword) ?? null
  if (ranking && ranking.impressions >= RANKING_MIN_IMPRESSIONS && ranking.position !== null && ranking.position <= RANKING_MAX_POSITION) {
    overlaps.push({
      kind: "ranking",
      label: `Google affiche déjà le site (position ${ranking.position.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}, ${ranking.impressions.toLocaleString("fr-FR")} affichages)`,
      detail: "Améliorer la page qui ressort plutôt qu'écrire un nouvel article",
    })
  }
  return { overlaps, ranking, tracked: Boolean(tracked) }
}

/* ------------------------------------------------------------------ */
/* Score                                                               */
/* ------------------------------------------------------------------ */

type Scored = Pick<Idea, "verified" | "volume" | "difficulty" | "stage" | "overlaps" | "warnings">

/**
 * Score de 0 à 100 :
 * - 35 points si Google propose la phrase (elle existe) ;
 * - jusqu'à 30 points de volume (échelle logarithmique : 10/mois ≈ 10 points,
 *   1 000/mois = 30) ;
 * - jusqu'à 15 points de facilité (difficulté < 30 : 15, < 60 : 8) ;
 * - le moment : « do » 12, « buy » 12, « learn » 6 ;
 * - moins 30 si un article vise déjà la phrase, 20 pour un sujet, 10 pour un
 *   mot-clé déjà suivi, 25 si Google affiche déjà le site dessus ; 5 par avertissement.
 */
export function scoreIdea(idea: Scored): number {
  let score = 0
  if (idea.verified) score += 35
  if (idea.volume !== null && idea.volume > 0) score += Math.min(30, Math.round(Math.log10(idea.volume + 1) * 10))
  if (idea.difficulty !== null) score += idea.difficulty < 30 ? 15 : idea.difficulty < 60 ? 8 : 0
  score += idea.stage === "learn" ? 6 : 12
  for (const o of idea.overlaps) score -= o.kind === "article" ? 30 : o.kind === "topic" ? 20 : o.kind === "ranking" ? 25 : 10
  score -= idea.warnings.length * 5
  return Math.max(0, Math.min(100, score))
}
