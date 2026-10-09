/**
 * Types et libellés partagés de l'onglet SEO de l'admin (PLAN-SEO-INTERNE-2026-10.md).
 *
 * Un libellé ne s'écrit qu'ici : les pages, les emails et les tests le lisent.
 * Les valeurs (« covered », « howto »…) sont celles des contraintes CHECK de
 * supabase/migrations/20261009_seo_admin.sql.
 */
import type { Tone } from "@/components/app/kit"

type Labelled = { label: string; tone: Tone }

/* ------------------------------------------------------------------ */
/* Sections de l'onglet                                                */
/* ------------------------------------------------------------------ */

export type SeoSectionKey = "overview" | "performance" | "actions" | "keywords" | "articles" | "visibility" | "settings"

export interface SeoSection {
  key: SeoSectionKey
  label: string
  href: string
  hint: string
}

export const SEO_SECTIONS: SeoSection[] = [
  { key: "overview",    label: "Vue d'ensemble", href: "/admin/seo",                 hint: "Clics, impressions, priorités" },
  { key: "performance", label: "Performance",    href: "/admin/seo/performance",     hint: "Recherche Google, PageSpeed, audit" },
  { key: "actions",     label: "Actions SEO",    href: "/admin/seo/actions",         hint: "Pages à améliorer" },
  { key: "keywords",    label: "Mots-clés",      href: "/admin/seo/mots-cles",       hint: "Requêtes suivies et statuts" },
  { key: "articles",    label: "Articles",       href: "/admin/seo/articles",        hint: "Calendrier, sujets, préférences" },
  { key: "visibility",  label: "Visibilité IA",  href: "/admin/seo/visibilite-ia",   hint: "Mentions et citations par moteur" },
  { key: "settings",    label: "Paramètres",     href: "/admin/seo/parametres",      hint: "Marque, stratégie, ciblage, connexions" },
]

/** Libellés des tâches de /api/cron/seo dans Santé du système (cron_logs « seo:<tâche> »). */
export const SEO_JOB_LABELS: Record<string, string> = {
  "seo:search-console": "SEO · Search Console",
  "seo:keywords": "SEO · Mots-clés",
  "seo:findings": "SEO · Actions",
  "seo:articles": "SEO · Articles",
  "seo:digest": "SEO · Résumé hebdomadaire",
  "seo:geo": "SEO · Visibilité IA",
  "seo:crawl": "SEO · Audit du site",
  "seo:pagespeed": "SEO · PageSpeed",
}

/* ------------------------------------------------------------------ */
/* Search Console                                                      */
/* ------------------------------------------------------------------ */

/** Appareils au sens de Search Console. */
export type GscDevice = "DESKTOP" | "MOBILE" | "TABLET"

export const DEVICE_FILTERS = [
  { value: "all", label: "Tous", device: null },
  { value: "mobile", label: "Mobile", device: "MOBILE" },
  { value: "desktop", label: "Ordinateur", device: "DESKTOP" },
] as const satisfies readonly { value: string; label: string; device: GscDevice | null }[]

export type DeviceFilter = (typeof DEVICE_FILTERS)[number]["value"]

export interface GscTotals {
  clicks: number
  impressions: number
  /** Taux de clic de 0 à 1 ; null sans impression. */
  ctr: number | null
  /** Position moyenne pondérée par les impressions ; null sans impression. */
  position: number | null
}

export interface GscDay extends GscTotals {
  date: string
}

export interface GscPageRow extends GscTotals {
  page: string
}

export interface GscQueryRow extends GscTotals {
  query: string
}

/* ------------------------------------------------------------------ */
/* Types de pages du site (lib/seo/site.ts)                            */
/* ------------------------------------------------------------------ */

export type PageType = "accueil" | "guide" | "modele" | "metier" | "installation" | "blog" | "glossaire" | "outil" | "autre"

export const PAGE_TYPE_LABELS: Record<PageType, string> = {
  accueil: "Accueil",
  guide: "Guides",
  modele: "Modèles",
  metier: "Pages métier",
  installation: "S'installer à son compte",
  blog: "Blog",
  glossaire: "Glossaire",
  outil: "Outils",
  autre: "Autres pages",
}

/* ------------------------------------------------------------------ */
/* Actions SEO                                                         */
/* ------------------------------------------------------------------ */

export type FindingSeverity = "high" | "medium" | "low"
export type FindingSource = "search_console" | "crawl" | "ai" | "import"
export type FindingStatus = "open" | "done" | "ignored" | "resolved"

export const SEVERITY: Record<FindingSeverity, Labelled> = {
  high: { label: "Haute", tone: "danger" },
  medium: { label: "Moyenne", tone: "warn" },
  low: { label: "Faible", tone: "neutral" },
}

export const FINDING_SOURCE_LABELS: Record<FindingSource, string> = {
  search_console: "Search Console",
  crawl: "Exploration",
  ai: "Suggestion IA",
  import: "Journal",
}

export const FINDING_STATUS_LABELS: Record<FindingStatus, string> = {
  open: "À faire",
  done: "Faite",
  ignored: "Ignorée",
  resolved: "Résolue d'elle-même",
}

/** Délai avant de mesurer l'effet d'une action faite. */
export const VERIFY_AFTER_DAYS = 14

/* ------------------------------------------------------------------ */
/* Mots-clés                                                           */
/* ------------------------------------------------------------------ */

export type KeywordStatus = "candidate" | "targeted" | "covered" | "ignored"
export type KeywordIntent = "informational" | "transactional" | "navigational" | "commercial"
export type KeywordSource = "search_console" | "manual" | "suggestion" | "import"

export const KEYWORD_STATUS: Record<KeywordStatus, Labelled> = {
  candidate: { label: "Candidat", tone: "neutral" },
  targeted: { label: "Ciblé", tone: "info" },
  covered: { label: "Couvert", tone: "ok" },
  ignored: { label: "Ignoré", tone: "neutral" },
}

export const KEYWORD_INTENT_LABELS: Record<KeywordIntent, string> = {
  informational: "Informationnelle",
  transactional: "Transactionnelle",
  navigational: "Navigationnelle",
  commercial: "Commerciale",
}

export const KEYWORD_SOURCE_LABELS: Record<KeywordSource, string> = {
  search_console: "Search Console",
  manual: "Manuel",
  suggestion: "Suggestion",
  import: "Repris de PushRank",
}

/* ------------------------------------------------------------------ */
/* Articles                                                            */
/* ------------------------------------------------------------------ */

export type ArticleType = "howto" | "guide" | "news" | "faq"
export type TopicSource = "keyword" | "action" | "manual" | "pushrank" | "visibility"
export type TopicStatus = "unplanned" | "planned" | "generating" | "drafted" | "published" | "failed" | "archived"
export type PublishMode = "draft" | "after_check" | "direct"
/** Statut affiché d'un article (calendrier, liste). */
export type ArticleDisplayStatus = "published" | "scheduled" | "draft" | "to_review" | "failed" | "generating"

export const ARTICLE_TYPE_LABELS: Record<ArticleType, string> = {
  howto: "How-to",
  guide: "Guide",
  news: "Actualité",
  faq: "FAQ",
}

export const TOPIC_SOURCE_LABELS: Record<TopicSource, string> = {
  keyword: "Mot-clé",
  action: "Action SEO",
  manual: "Manuel",
  pushrank: "PushRank",
  visibility: "Visibilité IA",
}

export const TOPIC_STATUS: Record<TopicStatus, Labelled> = {
  unplanned: { label: "À planifier", tone: "neutral" },
  planned: { label: "Planifié", tone: "info" },
  generating: { label: "Rédaction en cours", tone: "info" },
  drafted: { label: "Rédigé", tone: "ok" },
  published: { label: "Publié", tone: "ok" },
  failed: { label: "Échec", tone: "danger" },
  archived: { label: "Archivé", tone: "neutral" },
}

export const ARTICLE_STATUS: Record<ArticleDisplayStatus, Labelled> = {
  published: { label: "Publié", tone: "ok" },
  scheduled: { label: "Planifié", tone: "info" },
  draft: { label: "Brouillon", tone: "neutral" },
  to_review: { label: "À relire", tone: "warn" },
  failed: { label: "Échec", tone: "danger" },
  generating: { label: "Rédaction en cours", tone: "info" },
}

export const PUBLISH_MODE_LABELS: Record<PublishMode, { label: string; hint: string }> = {
  draft: { label: "Brouillon à relire", hint: "L'article attend votre relecture ; rien ne part sans vous." },
  after_check: { label: "Publier après contrôle", hint: "Publié à l'heure prévue si le contrôle automatique ne repère rien." },
  direct: { label: "Publier directement", hint: "Publié à l'heure prévue sans relecture." },
}

/* ------------------------------------------------------------------ */
/* Visibilité IA                                                       */
/* ------------------------------------------------------------------ */

export type GeoEngine = "gemini" | "chatgpt" | "perplexity" | "claude" | "google_ai_overview"

export interface GeoEngineDef {
  key: GeoEngine
  label: string
  /** Variables d'environnement nécessaires (noms seulement, jamais les valeurs). */
  env: string[]
}

/** Ordre d'affichage : décision du fondateur, Gemini et ChatGPT d'abord. */
export const GEO_ENGINES: GeoEngineDef[] = [
  { key: "gemini", label: "Gemini", env: ["GEMINI_API_KEY"] },
  { key: "chatgpt", label: "ChatGPT", env: ["OPENAI_API_KEY"] },
  { key: "perplexity", label: "Perplexity", env: ["PERPLEXITY_API_KEY"] },
  { key: "claude", label: "Claude", env: ["ANTHROPIC_API_KEY"] },
  { key: "google_ai_overview", label: "Aperçu IA Google", env: ["DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD"] },
]

export interface GeoRateSummary {
  mention_rate: number | null
  citation_rate: number | null
  mentions?: number
  citations?: number
  answers?: number
}

/** Résumé d'un relevé (colonne `summary` de seo_geo_runs). */
export interface GeoRunSummary {
  questions?: number
  engines: Partial<Record<GeoEngine, GeoRateSummary>>
  overall: GeoRateSummary
  /** Taux par domaine : qonforme.fr et concurrents (usage interne). */
  domains: Record<string, GeoRateSummary>
}

/* ------------------------------------------------------------------ */
/* Connexions                                                          */
/* ------------------------------------------------------------------ */

export type ConnectionState = "connected" | "missing" | "not_configured" | "error"

export const CONNECTION_STATE: Record<ConnectionState, Labelled> = {
  connected: { label: "Connectée", tone: "ok" },
  missing: { label: "Clé manquante", tone: "warn" },
  not_configured: { label: "Non configurée", tone: "neutral" },
  error: { label: "Erreur", tone: "danger" },
}
