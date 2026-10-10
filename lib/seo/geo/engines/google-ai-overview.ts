/**
 * Aperçu IA de Google : aucune API officielle ; lecture de la page de résultats par
 * DataForSEO, API SERP Google organique « live advanced ».
 *
 * Documentation (https://docs.dataforseo.com/v3/serp/google/organic/live/advanced/, vérifiée le
 * 9 oct. 2026) :
 * - POST https://api.dataforseo.com/v3/serp/google/organic/live/advanced, authentification Basic
 *   (identifiant et mot de passe d'API), corps = tableau d'une seule tâche : `keyword`,
 *   `location_code` (2250 = France), `language_code` (« fr »), `device`, `depth`,
 *   `load_async_ai_overview: true` (charge l'Aperçu IA même s'il arrive en différé ; 0,002 $ de
 *   plus, rendus si l'élément est absent) ;
 * - réponse : `status_code` (20000 = succès), `tasks[0].status_code`, `tasks[0].result[0].items[]` ;
 *   élément `type: "ai_overview"` : `markdown`, `items[]` (`ai_overview_element` : `text`,
 *   `markdown`, `references[]`), `references[]` (`ai_overview_reference` : `source`, `domain`,
 *   `url`, `title`, `text`).
 * Tarif relevé (https://dataforseo.com/pricing/serp/google-organic-serp-api) : 0,002 $ la page en
 * mode « live », plus 0,002 $ pour l'Aperçu IA différé.
 *
 * Sans Aperçu IA pour la requête : réponse null (comptée comme absente, pas comme une erreur).
 */
import { dedupeSources, domainOf } from "@/lib/seo/geo/detect"
import { languageCodeOf, marketOf } from "@/lib/seo/geo/engines/context"
import { ENGINE_TIMEOUT_MS, GeoEngineError, env, postJson, redact } from "@/lib/seo/geo/engines/http"
import type { GeoAskOptions, GeoEngineAnswer, GeoEngineClient, GeoSource } from "@/lib/seo/geo/types"

const API = "https://api.dataforseo.com/v3/serp/google/organic/live/advanced"
const SECRETS = ["DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD"]
const LABEL = "Aperçu IA Google"
export const DATAFORSEO_MODEL = "dataforseo:google-organic-live-advanced"
/** Codes de tâche « aucun résultat » : pas d'Aperçu IA, pas une erreur. */
const NO_RESULT_CODES = new Set([40102])

export function aiOverviewRequest(question: string, opts: Pick<GeoAskOptions, "market" | "language">) {
  return [
    {
      keyword: question.slice(0, 700),
      location_code: marketOf(opts.market).dataforseoLocation,
      language_code: languageCodeOf(opts.language),
      device: "desktop",
      depth: 10,
      load_async_ai_overview: true,
    },
  ]
}

type Reference = { url?: string; domain?: string; title?: string; source?: string }
type OverviewItem = { type?: string; markdown?: string; text?: string; references?: Reference[] | null }

/** Analyse d'une réponse DataForSEO (fonction pure). */
export function parseAiOverviewResponse(json: unknown): GeoEngineAnswer {
  const body = (json ?? {}) as {
    status_code?: number
    status_message?: string
    tasks?: { status_code?: number; status_message?: string; result?: { items?: (OverviewItem & { items?: OverviewItem[] | null })[] | null }[] | null }[]
  }
  if (body.status_code !== 20000) {
    const code = body.status_code ?? 0
    throw new GeoEngineError(
      `${LABEL} : DataForSEO a refusé la requête (${code} ${redact(body.status_message ?? "", SECRETS).slice(0, 200)})`,
      code === 40100 ? "auth" : "http",
      { retryable: code >= 50000 },
    )
  }
  const task = body.tasks?.[0]
  if (!task) throw new GeoEngineError(`${LABEL} : réponse sans tâche`, "format")
  if (task.status_code !== 20000) {
    if (task.status_code !== undefined && NO_RESULT_CODES.has(task.status_code)) {
      return { answer: null, sources: [], model: DATAFORSEO_MODEL }
    }
    const code = task.status_code ?? 0
    throw new GeoEngineError(
      `${LABEL} : tâche en échec (${code} ${redact(task.status_message ?? "", SECRETS).slice(0, 200)})`,
      "http",
      // 50000 et plus : erreur interne passagère chez DataForSEO
      { retryable: code >= 50000 },
    )
  }
  const items = task.result?.[0]?.items ?? []
  const overview = items.find((i) => i.type === "ai_overview")
  if (!overview) return { answer: null, sources: [], model: DATAFORSEO_MODEL }

  const elements = overview.items ?? []
  const answer = (overview.markdown?.trim() || elements.map((e) => (e.markdown ?? e.text ?? "").trim()).filter(Boolean).join("\n\n")).trim()
  const refs: Reference[] = [...(overview.references ?? []), ...elements.flatMap((e) => e.references ?? [])]
  const sources: GeoSource[] = refs
    .filter((r) => r.url)
    .map((r) => ({
      url: r.url as string,
      domain: (r.domain ?? "").toLowerCase().replace(/^www\./, "") || domainOf(r.url),
      title: r.title || r.source || "",
    }))
  return { answer: answer || null, sources: dedupeSources(sources), model: DATAFORSEO_MODEL }
}

export const googleAiOverviewEngine: GeoEngineClient = {
  key: "google_ai_overview",
  isConfigured: () => Boolean(env("DATAFORSEO_LOGIN") && env("DATAFORSEO_PASSWORD")),
  async ask(question, opts) {
    const login = env("DATAFORSEO_LOGIN")
    const password = env("DATAFORSEO_PASSWORD")
    if (!login || !password) {
      throw new GeoEngineError(`${LABEL} : identifiants manquants (DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD)`, "config", { retryable: false })
    }
    const json = await postJson(API, {
      headers: { authorization: `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}` },
      body: aiOverviewRequest(question, opts),
      timeoutMs: opts.timeoutMs ?? ENGINE_TIMEOUT_MS,
      label: LABEL,
      secretNames: SECRETS,
    })
    return parseAiOverviewResponse(json)
  },
}
