/**
 * « Proposition IA » : idées de sujets et de mots-clés exacts, pensées comme
 * l'artisan qui cherche, puis vérifiées (saisie semi-automatique de Google,
 * volumes DataForSEO, pages et articles déjà en place).
 *
 * Module pur : serveur, navigateur et tests.
 */
import type { ArticleType, KeywordIntent } from "@/lib/seo/types"

/** Où en est la personne : comprendre une règle, faire quelque chose, choisir un logiciel. */
export type IdeaStage = "learn" | "do" | "buy"

export const IDEA_STAGE_LABELS: Record<IdeaStage, string> = {
  learn: "Comprendre",
  do: "Faire",
  buy: "Choisir un logiciel",
}

export const IDEA_MAX_COUNT = 15
export const IDEA_DEFAULT_COUNT = 10

/** Situations proposées dans la fenêtre : un clic remplit l'angle demandé au modèle. */
export const IDEA_SITUATIONS: { id: string; label: string; focus: string }[] = [
  { id: "lancer", label: "Je me lance", focus: "L'artisan qui démarre son activité : premier devis, première facture, mentions obligatoires, TVA des travaux." },
  { id: "gagner-du-temps", label: "Je gagne du temps", focus: "L'artisan installé qui cherche un modèle, un exemple ou un outil pour faire ses devis plus vite." },
  { id: "se-faire-payer", label: "Je me fais payer", focus: "Facture impayée, relance, pénalités de retard, acompte, retenue de garantie." },
  { id: "en-regle", label: "Je veux être en règle", focus: "Taux de TVA (20, 10 et 5,5 %), mentions obligatoires, assurance décennale, facture électronique et plateforme agréée." },
  { id: "chiffrer", label: "Je chiffre un chantier", focus: "Exemple de devis pour un ouvrage précis : tableau électrique, salle de bains, dalle, ravalement." },
]

export interface IdeaRequest {
  /** « topics » : des sujets d'articles ; « article » : des requêtes exactes pour un article déjà écrit. */
  mode: "topics" | "article"
  /** Profil ou consigne libre (300 caractères au plus) : « je démarre mon activité », « me faire payer »… */
  focus?: string
  /** Métier (identifiant de lib/blog-images/trades.ts). */
  trade?: string
  count?: number
  /** Mode « article » : l'article dont on cherche la requête exacte. */
  article?: { title: string; content: string; keyword?: string | null; articleType?: ArticleType }
}

export type IdeaOverlapKind = "article" | "topic" | "keyword" | "ranking"

/** Ce qui existe déjà sur le sujet (risque de doublon ou de concurrence entre pages). */
export interface IdeaOverlap {
  kind: IdeaOverlapKind
  label: string
  detail?: string
  /** Chemin du site (page ou article). */
  path?: string
}

export interface Idea {
  /** La phrase exacte tapée dans Google : minuscules, accents, forme canonique. */
  keyword: string
  /** Titre de l'article qui répond (dans les mots de la recherche). */
  title: string
  articleType: ArticleType
  stage: IdeaStage
  /** Ce que la personne veut, en une phrase. */
  why: string
  /** Vue dans la saisie semi-automatique de Google. */
  verified: boolean
  /** Prolongations réelles proposées par Google (longue traîne). */
  googleAlso: string[]
  volume: number | null
  difficulty: number | null
  cpc: number | null
  intent: KeywordIntent | null
  /** Search Console : cette requête affiche déjà le site. */
  ranking: { impressions: number; position: number | null } | null
  overlaps: IdeaOverlap[]
  warnings: string[]
  /** Déjà dans l'onglet Mots-clés. */
  tracked: boolean
  score: number
}

export type AutocompleteState = "ok" | "partial" | "unavailable"
export type MetricsState = "ok" | "unavailable" | "not_configured" | "skipped"

export interface IdeasResponse {
  ideas: Idea[]
  /** Remarques à afficher (service injoignable, volumes absents…). */
  notes: string[]
  /** Modèle qui a répondu, nommé comme dans les Préférences (« Claude Sonnet 5.5 »). */
  model: string
  autocomplete: AutocompleteState
  metrics: MetricsState
}

/** Idée adoptée : mot-clé suivi et sujet d'article (POST /api/admin/seo/ideas/adopt). */
export interface AdoptedIdea {
  keyword: string
  title: string
  articleType: ArticleType
  intent?: KeywordIntent | null
  volume?: number | null
  difficulty?: number | null
  cpc?: number | null
  note?: string | null
}

/** Résultat de l'adoption (POST /api/admin/seo/ideas/adopt). */
export interface AdoptResult {
  keywordId: string
  keyword: string
  /** Le mot-clé vient d'être ajouté au suivi (sinon il l'était déjà). */
  keywordAdded: boolean
  topicId: string | null
  /** Le sujet rendu existait déjà. */
  topicExisting: boolean
}
