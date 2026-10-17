/**
 * Types partagés de l'éditeur d'articles (admin › Blog) et de la fenêtre d'un
 * article du calendrier (admin › SEO › Articles). Échangés entre les routes
 * et les composants : aucun import serveur ici.
 *
 * Routes :
 * - GET  /api/admin/blog/seo-context?id=&keyword=   → SeoContext
 * - POST /api/admin/blog/suggest                     → SuggestResponse
 * - POST /api/admin/blog/assist                      → AssistResponse
 * - GET  /api/admin/blog/link-targets                → LinkTargetsResponse
 * - POST /api/admin/blog/auto-links                  → AutoLinksResponse
 * - POST /api/admin/blog/images/generate             → StoredImage & { model, notice }
 * - POST /api/admin/blog/images/upload               → StoredImage
 * - GET  /api/admin/seo/articles/posts/<id>          → ArticleDetails
 * - POST /api/admin/seo/keywords/plan                → PlanImportResult
 */
import type { ArticleDisplayStatus, ArticleType, KeywordIntent, KeywordStatus } from "@/lib/seo/types"
import type { ArticleSource } from "@/lib/seo/articles/status"

/* ------------------------------------------------------------------ */
/* Mots-clés et contexte de l'éditeur                                  */
/* ------------------------------------------------------------------ */

/** Mot-clé proposé dans l'éditeur : onglet Mots-clés (seo_keywords) et plan d'octobre fusionnés. */
export interface EditorKeyword {
  /** Identifiant dans seo_keywords ; null : mot-clé du plan pas encore suivi. */
  id: string | null
  /** Forme canonique (minuscules) ; accents conservés quand ils existent. */
  keyword: string
  status: KeywordStatus | null
  intent: KeywordIntent | null
  /** Recherches mensuelles (DataForSEO ou plan d'octobre) ; null : inconnu. */
  volume: number | null
  /** 0 à 100 (DataForSEO) ; null : inconnue. */
  difficulty: number | null
  /** Position moyenne dans Google (Search Console, 28 jours) ; null : aucune impression. */
  position: number | null
  clicks: number | null
  impressions: number | null
  /** Page choisie pour ce mot-clé dans l'onglet Mots-clés (« /modele »). */
  targetPath: string | null
  /** Présent dans le plan mots-clés du 16/10/2026 (MOTS-CLES-COMPACTS-2026-10.md § 0). */
  fromPlan: boolean
}

export interface PageQuery {
  query: string
  clicks: number
  impressions: number
  position: number | null
}

/** Pages qui ressortent déjà dans Google sur le mot-clé choisi (risque de cannibalisation). */
export interface KeywordPages {
  keyword: string
  /** Page du site la plus vue sur ce mot-clé (Search Console, 90 jours). */
  topPage: { page: string; clicks: number; impressions: number; position: number | null } | null
  /** Page choisie dans l'onglet Mots-clés. */
  targetPath: string | null
  /** Autres articles du blog qui visent ce mot-clé (target_keyword). */
  posts: { id: string; title: string; slug: string }[]
}

export interface OtherPost {
  id: string
  title: string
  slug: string
  targetKeyword: string | null
  seoTitle: string | null
}

export interface SeoContext {
  keywords: EditorKeyword[]
  /** Requêtes Search Console de /blog/<adresse> (90 jours) ; vide pour un article non publié. */
  pageQueries: PageQuery[]
  gsc: { connected: boolean; lastDate: string | null }
  /** Autres articles (titre unique, cannibalisation). */
  others: OtherPost[]
  /** Pour le paramètre `keyword` ; null sans paramètre. */
  keywordPages: KeywordPages | null
  /** Domaines concurrents (usage interne, contrôle en direct). */
  competitors: string[]
  prefs: { lengthMin: number; lengthMax: number; publishTime: string }
}

/* ------------------------------------------------------------------ */
/* Suggestions                                                         */
/* ------------------------------------------------------------------ */

export type SuggestField = "seoTitle" | "seoDescription" | "slug" | "excerpt" | "title"

export interface SuggestRequest {
  field: SuggestField
  keyword: string
  /** Type de l'article (how-to, guide, actualité, FAQ) : les titres parlent comme la recherche de ce type. */
  articleType?: "howto" | "guide" | "news" | "faq"
  secondary?: string[]
  title: string
  excerpt?: string
  /** Markdown, tronqué côté client à 12 000 caractères. */
  content: string
  current?: string
}

export interface Suggestion {
  text: string
  length: number
  hasKeyword: boolean
}

export interface SuggestResponse {
  suggestions: Suggestion[]
  /** Propositions écartées par le contrôle (longueur, affirmation interdite, concurrent). */
  rejected: number
}

/* ------------------------------------------------------------------ */
/* Assistant de rédaction                                              */
/* ------------------------------------------------------------------ */

export type AssistAction = "rephrase" | "shorten" | "expand" | "simplify" | "fix" | "keyword"

export interface AssistRequest {
  action: AssistAction
  /** Passage sélectionné, en Markdown (1 à 4 000 caractères). */
  text: string
  keyword?: string | null
  title?: string
  /** Contexte autour de la sélection (500 caractères au plus chacun). */
  before?: string
  after?: string
}

export interface AssistResponse {
  /** Passage réécrit, en Markdown (mêmes possibilités que l'éditeur). */
  text: string
  /** Ce que le contrôle signale dans la réécriture (valeur périmée, « PDP »…). */
  warnings: string[]
}

/* ------------------------------------------------------------------ */
/* Liens internes                                                      */
/* ------------------------------------------------------------------ */

export type LinkTargetKind = "article" | "guide" | "modele" | "metier" | "outil" | "installation" | "glossaire" | "page"

export interface LinkTarget {
  title: string
  /** Chemin du site (« /guide/tva-travaux »). */
  path: string
  kind: LinkTargetKind
}

export interface LinkTargetsResponse {
  targets: LinkTarget[]
}

/** Lien interne proposé par le maillage automatique (lib/seo/links/engine.ts). */
export interface AutoLinkProposal {
  path: string
  title: string
  kind: LinkTargetKind
  /** Texte de l'article qui devient le lien. */
  anchor: string
  /** Jusqu'à 40 caractères de texte brut qui précèdent l'ancre. */
  before: string
  /** Section « ## » de l'ancre (0 : introduction). */
  section: number
}

export interface AutoLinksResponse {
  /** Liens internes avant, et après la pose des propositions. */
  before: number
  after: number
  /** Combien de liens conviennent à la longueur : minimum, objectif, maximum. */
  goal: { min: number; goal: number; max: number }
  words: number
  proposals: AutoLinkProposal[]
  /** Le texte avec les liens posés (mode Markdown). */
  markdown: string
  /** Bloc « Pour aller plus loin » à ajouter quand le texte ne se prête pas à assez de liens ; null sinon. */
  relatedBlock: string | null
}

/* ------------------------------------------------------------------ */
/* Images                                                              */
/* ------------------------------------------------------------------ */

export interface StoredImage {
  /** Adresse publique, dimensions dans le fragment (#w=1600&h=900, lib/blog-images/policy.ts). */
  url: string
  width: number
  height: number
}

export interface GeneratedImageResponse extends StoredImage {
  /** Modèle qui a produit l'image. */
  model: string
  /** Repli utilisé (« Image par Nano Banana 2 au lieu de… »). */
  notice: string | null
}

/**
 * Ce que montre la photo d'un passage (POST /api/admin/blog/images/describe) :
 * sujet repéré, scène, puces de style, texte alternatif. `source` dit si la
 * proposition vient du modèle ou du repli sans modèle (clé absente, panne, quota).
 */
export interface DescribePassageResponse {
  subject: string
  scene: string
  styles: string[]
  alt: string
  source: "model" | "heuristic"
  /** Pourquoi le repli a servi (clé absente, quota…), sinon null. */
  notice: string | null
}

/** Image insérée dans le texte ou choisie en couverture. */
export interface PickedImage extends StoredImage {
  alt: string
  /** Légende (images du texte seulement). */
  caption?: string
}

/* ------------------------------------------------------------------ */
/* Fenêtre d'un article (calendrier, liste)                            */
/* ------------------------------------------------------------------ */

export interface GscTotalsLite {
  clicks: number
  impressions: number
  /** 0 à 1 ; null sans impression. */
  ctr: number | null
  position: number | null
}

export interface ArticleDetails {
  post: {
    id: string
    slug: string
    title: string
    excerpt: string | null
    coverUrl: string | null
    coverAlt: string | null
    status: ArticleDisplayStatus
    type: ArticleType | null
    source: ArticleSource
    publishedAt: string | null
    scheduledAt: string | null
    createdAt: string
    updatedAt: string | null
    targetKeyword: string | null
    seoTitle: string | null
    seoDescription: string | null
    keywords: string[]
    heldReason: string | null
  }
  /** Search Console pour /blog/<adresse>. */
  performance: {
    connected: boolean
    /** Dernier jour disponible (Search Console a 2 à 3 jours de retard). */
    lastDate: string | null
    last28: GscTotalsLite
    /** Depuis la publication ; null pour un article non publié. */
    sincePublished: GscTotalsLite | null
    /** Jours (AAAA-MM-JJ) de la courbe, du plus ancien au plus récent (28 au plus récents, ou depuis la publication). */
    series: { day: string; clicks: number; impressions: number }[]
    queries: PageQuery[]
  }
  keyword: EditorKeyword | null
  quality: {
    score: number
    words: number
    readingMinutes: number
    h2: number
    internalLinks: number
    images: number
    /** Contrôles à corriger ou à améliorer (libellés), les plus graves d'abord. */
    issues: { label: string; status: "warn" | "error"; detail?: string; blocking?: boolean }[]
  }
}

/* ------------------------------------------------------------------ */
/* Plan mots-clés                                                      */
/* ------------------------------------------------------------------ */

export interface PlanImportResult {
  added: number
  updated: number
  total: number
}
