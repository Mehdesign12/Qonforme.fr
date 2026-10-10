/**
 * Légende des mesures du panneau de détail : d'où viennent volume, difficulté
 * et CPC, et pourquoi une valeur manque. Jamais « DataForSEO » pour une valeur
 * qui peut venir de PushRank : l'analyse garde une ancienne valeur que
 * DataForSEO ne fournit pas (metricsPatch), et marque comme vérifiés, sans les
 * envoyer, les mots-clés que Google Ads refuse.
 *
 * Calculée côté serveur (page) et passée au panneau. Module pur, testé dans
 * __tests__/seo-keywords-rules.test.ts.
 */
import { fmtLongDay } from "@/lib/seo/keywords/analysis"
import { isSendableKeyword } from "@/lib/seo/keywords/dataforseo"
import type { KeywordRow } from "@/lib/seo/keywords/types"
import { parisDayOf } from "@/lib/utils/paris-date"

type MetricsSource = Pick<KeywordRow, "keyword" | "source" | "volume" | "difficulty" | "cpc" | "cpc_currency" | "metrics_checked_at">

const NOT_CONFIGURED = "DataForSEO n'est pas configuré (Paramètres › Connexions)"

/**
 * @param analysisAvailable DataForSEO configuré : « Lancer l'analyse » peut relever les mesures.
 */
export function metricsNote(k: MetricsSource, analysisAvailable: boolean): string {
  const hasValues = k.volume !== null || k.difficulty !== null || k.cpc !== null
  const fromPushRank = k.source === "import" && hasValues

  if (!isSendableKeyword(k.keyword)) {
    return fromPushRank
      ? "Google Ads ne mesure pas cette requête (trop longue ou avec des symboles) : valeurs reprises de PushRank."
      : "Google Ads ne mesure pas cette requête (trop longue ou avec des symboles) : volume, difficulté et CPC restent inconnus."
  }

  if (!k.metrics_checked_at) {
    if (fromPushRank) {
      return analysisAvailable ? "Valeurs reprises de PushRank, en attente d'une analyse." : `Valeurs reprises de PushRank ; ${NOT_CONFIGURED}.`
    }
    return analysisAvailable
      ? "Pas encore mesuré : l'analyse des mots-clés (bouton « Lancer l'analyse », sur ordinateur) relève volume, difficulté et CPC."
      : `Pas encore mesuré : ${NOT_CONFIGURED}.`
  }

  const parts = [`Dernière analyse DataForSEO le ${fmtLongDay(parisDayOf(k.metrics_checked_at))}`]
  if (k.cpc !== null) parts.push(k.cpc_currency === "USD" ? "CPC en dollars US (Google Ads)" : "CPC repris de PushRank, en euros")
  if (k.source === "import" && (k.volume !== null || k.difficulty !== null)) {
    parts.push("un volume ou une difficulté que DataForSEO n'a pas fournis restent ceux de PushRank")
  }
  return `${parts.join(" ; ")}.`
}
