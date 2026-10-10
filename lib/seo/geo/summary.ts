/**
 * Résumé d'un relevé (colonne `summary` de seo_geo_runs) : taux de mention et de
 * citation par moteur, au total, et par domaine (qonforme.fr et concurrents, usage
 * interne). Calculé sur les réponses obtenues seulement : une réponse en échec ne
 * compte ni comme présence ni comme absence. Module pur.
 */
import { GEO_ENGINES, type GeoEngine, type GeoRateSummary, type GeoRunSummary } from "@/lib/seo/types"
import { SITE_HOST } from "@/lib/seo/site"

export interface SummaryAnswer {
  question_id: string | null
  engine: string
  status: string
  brand_mentioned: boolean | null
  site_cited: boolean | null
  competitors_mentioned: string[] | null
  competitors_cited: string[] | null
}

function rates(mentions: number, citations: number, answers: number): GeoRateSummary {
  return {
    mention_rate: answers > 0 ? mentions / answers : null,
    citation_rate: answers > 0 ? citations / answers : null,
    mentions,
    citations,
    answers,
  }
}

const isEngine = (key: string): key is GeoEngine => GEO_ENGINES.some((e) => e.key === key)

/** Résumé d'un relevé à partir de ses réponses. `engines` : moteurs interrogés (ils figurent même sans réponse). */
export function computeSummary(answers: SummaryAnswer[], opts: { engines: string[]; competitors: string[] }): GeoRunSummary {
  const done = answers.filter((a) => a.status === "done")
  const questions = new Set(answers.map((a) => a.question_id ?? "").filter(Boolean)).size

  const engineKeys = Array.from(new Set([...opts.engines, ...answers.map((a) => a.engine)])).filter(isEngine)
  const engines: GeoRunSummary["engines"] = {}
  engineKeys.forEach((key) => {
    const list = done.filter((a) => a.engine === key)
    engines[key] = rates(
      list.filter((a) => a.brand_mentioned).length,
      list.filter((a) => a.site_cited).length,
      list.length,
    )
  })

  const overall = rates(done.filter((a) => a.brand_mentioned).length, done.filter((a) => a.site_cited).length, done.length)

  const domains: GeoRunSummary["domains"] = { [SITE_HOST]: { ...overall } }
  opts.competitors
    .map((c) => c.toLowerCase().trim())
    .filter(Boolean)
    .forEach((domain) => {
      domains[domain] = rates(
        done.filter((a) => (a.competitors_mentioned ?? []).includes(domain)).length,
        done.filter((a) => (a.competitors_cited ?? []).includes(domain)).length,
        done.length,
      )
    })

  return { questions, engines, overall, domains }
}

/** Taux lisible d'un résumé (le relevé importé n'a que des taux, sans compteurs). */
export function rateOf(summary: GeoRateSummary | undefined | null, kind: "mention" | "citation"): number | null {
  if (!summary) return null
  const v = kind === "mention" ? summary.mention_rate : summary.citation_rate
  return typeof v === "number" && Number.isFinite(v) ? v : null
}

/** État d'une question pour un moteur dans un relevé (cellule du tableau « Questions suivies »). */
export type CellState = "cited" | "mentioned" | "absent" | "unmeasured"

export const CELL_LABELS: Record<CellState, string> = {
  cited: "Cité",
  mentioned: "Mentionné",
  absent: "Absent",
  unmeasured: "Non mesuré",
}

/** Citée sur au moins une exécution > mentionnée > absente ; sans réponse obtenue : non mesurée. */
export function cellState(answers: Pick<SummaryAnswer, "status" | "brand_mentioned" | "site_cited">[]): CellState {
  const done = answers.filter((a) => a.status === "done")
  if (done.length === 0) return "unmeasured"
  if (done.some((a) => a.site_cited)) return "cited"
  if (done.some((a) => a.brand_mentioned)) return "mentioned"
  return "absent"
}
