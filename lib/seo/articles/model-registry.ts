/**
 * Registre des modèles de rédaction et d'image du module Articles, sans
 * dépendance réseau ni SDK : importable par les écrans (Préférences, fenêtre
 * « Générer un article ») comme par le serveur. Les appels vivent dans
 * lib/seo/articles/models.ts.
 *
 * Un identifiant (`id`) est ce que retiennent les réglages (`articles.planModel`,
 * `textModel`, `reviewModel`, `imageModel`) ; `apiModel` est le code envoyé au
 * fournisseur. Les deux diffèrent quand un fournisseur renomme un modèle : le
 * réglage enregistré reste valable.
 *
 * Choix par passe (09/10/2026, d'après l'analyse des benchmarks, valeurs par
 * défaut de lib/seo/settings.ts) : plan et contrôle par Gemini 3.8 Flash,
 * rédaction par Claude Opus 5.5 (relecture par une autre famille de modèles que
 * la rédaction), couverture par Nano Banana 2.1 avec repli sur Nano Banana 2.
 *
 * Prix indicatifs en dollars US, relevés le 9 octobre 2026 :
 * - Anthropic : https://platform.claude.com/docs/en/about-claude/pricing
 *   (tarif standard, hors cache et hors lots) ;
 * - Google : https://ai.google.dev/gemini-api/docs/pricing (palier payant ;
 *   réflexion comprise dans la sortie).
 * Ils servent d'ordre de grandeur dans Préférences ; la facture du fournisseur fait foi.
 *
 * Écartés après vérification (https://ai.google.dev/gemini-api/docs/deprecations,
 * 9 octobre 2026) : imagen-4.0-generate-001 (arrêté le 17 août 2026) et
 * gemini-3.1-flash-image-preview (arrêté le 25 juin 2026 ; l'identifiant reste
 * reconnu pour un ancien réglage et désigne le code stable gemini-3.1-flash-image).
 */

export type ModelProvider = "gemini" | "anthropic"

/** Variable d'environnement de la clé (nom seulement, jamais la valeur). */
export type ModelKeyEnv = "GEMINI_API_KEY" | "ANTHROPIC_API_KEY"

export interface TextModelDef {
  id: string
  /** Libellé affiché (« Gemini 3.8 Flash »). */
  label: string
  provider: ModelProvider
  envKey: ModelKeyEnv
  /** Code envoyé à l'API du fournisseur. */
  apiModel: string
  /** Prix indicatif par million de jetons d'entrée, en dollars US. */
  inputPerMTok: number
  /** Prix indicatif par million de jetons de sortie, en dollars US. */
  outputPerMTok: number
  /** Précision sur le prix (palier, date de changement…). */
  priceNote?: string
  /**
   * Réflexion du modèle :
   * - « dynamic » : réflexion de Gemini (comptée dans la sortie), réglage par défaut ;
   * - « adaptive » : réflexion adaptative de Claude (Haiku 5.5, Sonnet 5.5), activée explicitement ;
   * - « always » : toujours active (Claude Opus 5.5 : ni `thinking` désactivé ni `budget_tokens`).
   */
  thinking: "dynamic" | "adaptive" | "always"
  /** Sortie maximale acceptée par le modèle (jetons), réflexion comprise. */
  maxOutputTokens: number
  /** Température envoyée (Gemini 2.5) ; absente : valeur par défaut du modèle (conseillée pour Gemini 3). */
  temperature?: number
  /** Ancien modèle : gardé en option, pas pour un nouveau réglage. */
  legacy?: string
}

export type ImageApi = "interactions" | "generateContent"

export interface ImageModelDef {
  id: string
  label: string
  provider: "gemini"
  envKey: ModelKeyEnv
  apiModel: string
  /** API d'appel : Nano Banana 2.1 n'est documenté que dans l'API Interactions. */
  api: ImageApi
  /** Prix indicatif d'une image 2K (taille demandée), en dollars US. */
  perImage: number
  priceNote?: string
  /** Modèle de repli si l'appel échoue (erreur, format inattendu, pas d'image). */
  fallback?: string
  /** Identifiant d'un ancien réglage, absent des menus. */
  hidden?: boolean
}

/** Taille des couvertures (16:9). */
export const COVER_IMAGE_SIZE = "2K"

export const TEXT_MODELS: TextModelDef[] = [
  {
    id: "gemini-3.8-flash",
    label: "Gemini 3.8 Flash",
    provider: "gemini",
    envKey: "GEMINI_API_KEY",
    apiModel: "gemini-3.8-flash",
    inputPerMTok: 0.75,
    outputPerMTok: 3.75,
    priceNote: "Jusqu'au 31/12/2026, puis 1,50 $ / 7,50 $ dès le 01/01/2027",
    thinking: "dynamic",
    maxOutputTokens: 65_536,
  },
  {
    id: "claude-opus-5-5",
    label: "Claude Opus 5.5",
    provider: "anthropic",
    envKey: "ANTHROPIC_API_KEY",
    apiModel: "claude-opus-5-5",
    inputPerMTok: 4,
    outputPerMTok: 20,
    thinking: "always",
    maxOutputTokens: 128_000,
  },
  {
    id: "claude-sonnet-5-5",
    label: "Claude Sonnet 5.5",
    provider: "anthropic",
    envKey: "ANTHROPIC_API_KEY",
    apiModel: "claude-sonnet-5-5",
    inputPerMTok: 2,
    outputPerMTok: 10,
    thinking: "adaptive",
    maxOutputTokens: 128_000,
  },
  {
    id: "claude-haiku-5-5",
    label: "Claude Haiku 5.5",
    provider: "anthropic",
    envKey: "ANTHROPIC_API_KEY",
    apiModel: "claude-haiku-5-5",
    inputPerMTok: 0.1,
    outputPerMTok: 0.5,
    priceNote: "Jusqu'à 100 000 jetons de consigne",
    thinking: "adaptive",
    maxOutputTokens: 128_000,
  },
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    provider: "gemini",
    envKey: "GEMINI_API_KEY",
    apiModel: "gemini-2.5-flash",
    inputPerMTok: 0.3,
    outputPerMTok: 2.5,
    thinking: "dynamic",
    maxOutputTokens: 65_536,
    temperature: 0.7,
    legacy: "Ancien modèle, réservé par Google aux comptes qui l'utilisaient déjà",
  },
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    provider: "gemini",
    envKey: "GEMINI_API_KEY",
    apiModel: "gemini-2.5-pro",
    inputPerMTok: 1.25,
    outputPerMTok: 10,
    priceNote: "Jusqu'à 200 000 jetons de consigne",
    thinking: "dynamic",
    maxOutputTokens: 65_536,
    temperature: 0.7,
    legacy: "Ancien modèle : Google conseille Gemini 3.8 Flash pour un nouveau projet",
  },
]

export const IMAGE_MODELS: ImageModelDef[] = [
  {
    id: "gemini-nano-banana-2.1",
    label: "Nano Banana 2.1",
    provider: "gemini",
    envKey: "GEMINI_API_KEY",
    apiModel: "gemini-nano-banana-2.1",
    api: "interactions",
    perImage: 0.0504,
    priceNote: "Image 2K (0,0336 $ en 1K)",
    fallback: "gemini-3.1-flash-image",
  },
  {
    id: "gemini-3.1-flash-image",
    label: "Nano Banana 2",
    provider: "gemini",
    envKey: "GEMINI_API_KEY",
    apiModel: "gemini-3.1-flash-image",
    api: "generateContent",
    perImage: 0.101,
    priceNote: "Image 2K (0,067 $ en 1K)",
  },
  {
    // Ancien réglage (lib/ai/gemini.ts) : le code « -preview » est arrêté depuis le 25 juin 2026
    id: "gemini-3.1-flash-image-preview",
    label: "Nano Banana 2",
    provider: "gemini",
    envKey: "GEMINI_API_KEY",
    apiModel: "gemini-3.1-flash-image",
    api: "generateContent",
    perImage: 0.101,
    priceNote: "Image 2K (0,067 $ en 1K)",
    hidden: true,
  },
]

/**
 * Modèles par défaut, une constante par passe : mêmes valeurs que les réglages
 * par défaut (lib/seo/settings.ts). Un réglage enregistré garde son choix.
 */
export const DEFAULT_PLAN_MODEL = "gemini-3.8-flash"
export const DEFAULT_TEXT_MODEL = "claude-opus-5-5"
export const DEFAULT_REVIEW_MODEL = "gemini-3.8-flash"
export const DEFAULT_IMAGE_MODEL = "gemini-nano-banana-2.1"

export type ModelPass = "plan" | "write" | "review"

export const PASS_LABELS: Record<ModelPass, string> = { plan: "Plan", write: "Rédaction", review: "Contrôle" }

export function findTextModel(id: string | null | undefined): TextModelDef | null {
  return TEXT_MODELS.find((m) => m.id === id) ?? null
}

export function findImageModel(id: string | null | undefined): ImageModelDef | null {
  return IMAGE_MODELS.find((m) => m.id === id) ?? null
}

/** Libellé d'un modèle de texte ou d'image (l'identifiant brut s'il est inconnu). */
export function modelLabel(id: string | null | undefined): string {
  return findTextModel(id)?.label ?? findImageModel(id)?.label ?? id ?? "—"
}

const PROVIDER_LABELS: Record<ModelProvider, string> = { gemini: "Gemini", anthropic: "Anthropic" }

export function providerLabel(provider: ModelProvider): string {
  return PROVIDER_LABELS[provider]
}

function usd(n: number): string {
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} $`
}

/** « 0,75 $ en entrée · 3,75 $ en sortie, par million de jetons (…) ». */
export function textPriceLabel(m: TextModelDef): string {
  return `${usd(m.inputPerMTok)} en entrée · ${usd(m.outputPerMTok)} en sortie, par million de jetons${m.priceNote ? ` (${m.priceNote.charAt(0).toLowerCase()}${m.priceNote.slice(1)})` : ""}`
}

/** « 0,0504 $ par image (image 2K…) ». */
export function imagePriceLabel(m: ImageModelDef): string {
  return `${usd(m.perImage)} par image${m.priceNote ? ` (${m.priceNote.charAt(0).toLowerCase()}${m.priceNote.slice(1)})` : ""}`
}

/** « Plan et contrôle par Gemini 3.8 Flash · rédaction par Claude Opus 5.5 ». */
export function passesSummary(models: { plan: string; write: string; review: string }): string {
  const plan = modelLabel(models.plan)
  const write = modelLabel(models.write)
  const review = modelLabel(models.review)
  if (models.plan === models.review) return `Plan et contrôle par ${plan} · rédaction par ${write}`
  return `Plan par ${plan} · rédaction par ${write} · contrôle par ${review}`
}

export interface PassModelChoice {
  /** Modèle réellement utilisé. */
  model: string
  /** Modèle demandé par les réglages. */
  requested: string
  /** Pourquoi le modèle demandé n'est pas utilisé (null : pas de repli). */
  fallbackReason: string | null
}

/**
 * Modèle d'une passe : celui des réglages si sa clé est présente, sinon repli
 * sur le modèle du plan (jamais d'échec silencieux : le motif est rendu). Sans
 * aucune clé utilisable, rend le modèle demandé (l'appel échouera avec
 * « Clé … absente »).
 */
export function resolvePassModel(requested: string, planModel: string, hasKey: (env: ModelKeyEnv) => boolean): PassModelChoice {
  const def = findTextModel(requested) ?? findTextModel(planModel)
  if (def && hasKey(def.envKey)) return { model: def.id, requested, fallbackReason: def.id === requested ? null : `Modèle « ${requested} » inconnu` }
  const plan = findTextModel(planModel)
  if (plan && plan.id !== def?.id && hasKey(plan.envKey)) {
    return { model: plan.id, requested, fallbackReason: def ? `Clé ${def.envKey} absente` : `Modèle « ${requested} » inconnu` }
  }
  return { model: def?.id ?? requested, requested, fallbackReason: null }
}

/** Option d'un menu de modèle, sûre à envoyer au navigateur (présence de la clé seulement). */
export interface ModelOption {
  id: string
  label: string
  provider: ModelProvider
  envKey: ModelKeyEnv
  price: string
  available: boolean
  legacy?: string
  /** Modèle de repli (image). */
  fallback?: string
}
