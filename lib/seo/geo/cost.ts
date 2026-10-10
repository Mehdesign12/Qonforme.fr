/**
 * Coût estimé d'un relevé (« Gérer le suivi ») : questions actives × moteurs allumés et
 * configurés × répétitions × coût unitaire. Estimation en dollars, présentée comme
 * telle (« environ ») : les fournisseurs facturent en dollars et le coût réel dépend de
 * la longueur des réponses et du nombre de recherches. Module pur.
 *
 * Coûts unitaires relevés le 9 oct. 2026 sur les pages officielles de tarifs :
 */
import type { GeoEngine } from "@/lib/seo/types"

export const GEO_COST_PER_CALL_USD: Record<GeoEngine, number> = {
  // gemini-2.5-flash : 0,30 $ / 2,50 $ le million de jetons (entrée / sortie, réflexion comprise) ;
  // recherche Google gratuite jusqu'à 1 500 requêtes par jour, puis 35 $ le millier
  // (https://ai.google.dev/gemini-api/docs/pricing). Environ 1 000 jetons en entrée et 1 500 en sortie.
  gemini: 0.004,
  // gpt-4.1-mini : recherche web 10 $ le millier d'appels + bloc fixe de 8 000 jetons d'entrée à 0,40 $
  // le million, sortie 1,60 $ le million (https://developers.openai.com/api/docs/pricing).
  chatgpt: 0.015,
  // sonar : 5 à 12 $ le millier de requêtes selon le contexte de recherche + 1 $ le million de jetons
  // (https://docs.perplexity.ai/getting-started/pricing). Estimation haute.
  perplexity: 0.01,
  // claude-opus-5-5 : 10 $ le millier de recherches (3 au plus) + 4 $ / 20 $ le million de jetons ;
  // les résultats de recherche comptent en entrée (environ 20 000 jetons).
  claude: 0.15,
  // DataForSEO « live » : 0,002 $ la page + 0,002 $ pour l'Aperçu IA différé
  // (https://dataforseo.com/pricing/serp/google-organic-serp-api).
  google_ai_overview: 0.004,
}

export interface CostEstimate {
  /** Nombre d'appels (questions × moteurs × répétitions). */
  calls: number
  /** Coût estimé en dollars. */
  usd: number
}

export function estimateRunCost(input: { questions: number; engines: GeoEngine[]; repetitions: number }): CostEstimate {
  const perQuestion = input.engines.reduce((sum, e) => sum + GEO_COST_PER_CALL_USD[e], 0)
  return {
    calls: input.questions * input.engines.length * input.repetitions,
    usd: input.questions * input.repetitions * perQuestion,
  }
}

/** « environ 0,57 $ » (deux décimales, un centime au moins s'il y a un coût). */
export function fmtUsd(usd: number): string {
  const v = usd > 0 && usd < 0.01 ? 0.01 : usd
  return `${v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`
}
