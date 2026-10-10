/**
 * État des moteurs pour les écrans (Visibilité IA, « Gérer le suivi ») : allumé dans
 * les réglages, configuré (variables présentes), état de connexion affiché avec les
 * libellés de CONNECTION_STATE. Aucune valeur de variable n'est lue pour l'affichage.
 */
import { presenceState, type ConnectionKey } from "@/lib/seo/connections"
import { GEO_ENGINES, type ConnectionState, type GeoEngine } from "@/lib/seo/types"
import type { GeoSettings } from "@/lib/seo/settings-schema"
import { isEngineConfigured } from "@/lib/seo/geo/engines"

/** Connexion de Paramètres › Connexions qui porte chaque moteur. */
export const ENGINE_CONNECTION: Record<GeoEngine, ConnectionKey> = {
  gemini: "gemini",
  chatgpt: "openai",
  perplexity: "perplexity",
  claude: "anthropic",
  google_ai_overview: "dataforseo",
}

/** Initiales des avatars (planches du canevas). */
export const ENGINE_INITIALS: Record<GeoEngine, string> = {
  gemini: "GE",
  chatgpt: "CH",
  perplexity: "PE",
  claude: "CL",
  google_ai_overview: "AG",
}

/** Libellé court des colonnes du tableau « Questions suivies ». */
export const ENGINE_SHORT_LABEL: Record<GeoEngine, string> = {
  gemini: "Gemini",
  chatgpt: "ChatGPT",
  perplexity: "Perplexity",
  claude: "Claude",
  google_ai_overview: "Aperçu IA",
}

export interface EngineStatus {
  key: GeoEngine
  label: string
  initials: string
  env: string[]
  /** Allumé dans les réglages du suivi. */
  enabled: boolean
  /** Variables présentes. */
  configured: boolean
  /** Interrogé au prochain relevé : allumé et configuré. */
  active: boolean
  state: ConnectionState
}

export function engineStatuses(geo: GeoSettings): EngineStatus[] {
  return GEO_ENGINES.map((e) => {
    const configured = isEngineConfigured(e.key)
    const enabled = Boolean(geo.engines[e.key])
    return {
      key: e.key,
      label: e.label,
      initials: ENGINE_INITIALS[e.key],
      env: e.env,
      enabled,
      configured,
      active: enabled && configured,
      state: configured ? "connected" : presenceState(ENGINE_CONNECTION[e.key]),
    }
  })
}
