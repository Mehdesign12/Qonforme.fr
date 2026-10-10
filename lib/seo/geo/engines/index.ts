/**
 * Moteurs suivis par la visibilité IA, dans l'ordre de GEO_ENGINES (lib/seo/types.ts).
 * Un moteur est « configuré » quand toutes ses variables d'environnement sont présentes
 * (noms dans GEO_ENGINES ; jamais leur valeur).
 */
import { GEO_ENGINES, type GeoEngine } from "@/lib/seo/types"
import type { GeoEngineClient } from "@/lib/seo/geo/types"
import { geminiEngine } from "@/lib/seo/geo/engines/gemini"
import { chatgptEngine } from "@/lib/seo/geo/engines/chatgpt"
import { perplexityEngine } from "@/lib/seo/geo/engines/perplexity"
import { claudeEngine } from "@/lib/seo/geo/engines/claude"
import { googleAiOverviewEngine } from "@/lib/seo/geo/engines/google-ai-overview"

export const ENGINE_CLIENTS: Record<GeoEngine, GeoEngineClient> = {
  gemini: geminiEngine,
  chatgpt: chatgptEngine,
  perplexity: perplexityEngine,
  claude: claudeEngine,
  google_ai_overview: googleAiOverviewEngine,
}

export function isGeoEngine(key: string): key is GeoEngine {
  return GEO_ENGINES.some((e) => e.key === key)
}

/** Vrai si toutes les variables du moteur sont présentes. */
export function isEngineConfigured(engine: GeoEngine): boolean {
  const def = GEO_ENGINES.find((e) => e.key === engine)
  return Boolean(def && def.env.every((name) => Boolean(process.env[name]?.trim())))
}
