/**
 * Perplexity : API Sonar, modèle « sonar » (format chat/completions).
 *
 * Documentation (vérifiée le 9 oct. 2026) :
 * - https://docs.perplexity.ai/api-reference/chat-completions-post : POST
 *   https://api.perplexity.ai/v1/sonar, `Authorization: Bearer`, corps `{ model: "sonar", messages }` ;
 *   réponse `choices[0].message.content`, `citations` (URL), `search_results` (`title`, `url`, `date`…).
 *   La page indique que l'ancienne interface « Sonar Chat Completions » n'est plus maintenue depuis
 *   le 27 sept. 2026 et que les requêtes synchrones continuent d'être servies (reformulées vers l'Agent API) ;
 * - https://docs.perplexity.ai/docs/agent-api/migrate-from-sonar/how-to : forme de l'Agent API
 *   (`output_text`, élément `search_results` de `output`), lue aussi par prudence.
 * Tarif relevé (https://docs.perplexity.ai/getting-started/pricing) : 1 $ le million de jetons en
 * entrée et en sortie, plus 5 à 12 $ le millier de requêtes selon le contexte de recherche.
 */
import { dedupeSources, domainOf } from "@/lib/seo/geo/detect"
import { systemContext } from "@/lib/seo/geo/engines/context"
import { ENGINE_TIMEOUT_MS, GeoEngineError, env, postJson } from "@/lib/seo/geo/engines/http"
import type { GeoAskOptions, GeoEngineAnswer, GeoEngineClient, GeoSource } from "@/lib/seo/geo/types"

export const PERPLEXITY_MODEL = "sonar"
const API = "https://api.perplexity.ai/v1/sonar"
const SECRETS = ["PERPLEXITY_API_KEY"]
const LABEL = "Perplexity"

export function perplexityRequest(question: string, opts: Pick<GeoAskOptions, "market" | "language">) {
  return {
    model: PERPLEXITY_MODEL,
    messages: [
      { role: "system", content: systemContext(opts) },
      { role: "user", content: question },
    ],
  }
}

type SearchResult = { url?: string; title?: string }

/** Analyse d'une réponse Sonar (fonction pure) : citations d'abord, titres repris des résultats de recherche. */
export function parsePerplexityResponse(json: unknown): GeoEngineAnswer {
  const body = (json ?? {}) as {
    model?: string
    choices?: { message?: { content?: string }; finish_reason?: string }[]
    citations?: unknown[]
    search_results?: SearchResult[]
    // Forme de l'Agent API
    output_text?: string
    output?: { type?: string; results?: SearchResult[] }[]
  }
  const answer = (body.choices?.[0]?.message?.content ?? body.output_text ?? "").trim()
  if (!answer) throw new GeoEngineError(`${LABEL} : réponse vide`, "format", { retryable: true })

  const results: SearchResult[] = [
    ...(body.search_results ?? []),
    ...(body.output ?? []).filter((o) => o.type === "search_results").flatMap((o) => o.results ?? []),
  ]
  const titleByUrl = new Map<string, string>()
  results.forEach((r) => {
    if (r.url && r.title) titleByUrl.set(r.url, r.title)
  })

  const cited = (body.citations ?? []).filter((c): c is string => typeof c === "string" && c.length > 0)
  const urls = cited.length > 0 ? cited : results.map((r) => r.url ?? "").filter(Boolean)
  const sources: GeoSource[] = urls.map((url) => ({ url, domain: domainOf(url), title: titleByUrl.get(url) ?? "" }))
  return { answer, sources: dedupeSources(sources), model: body.model || PERPLEXITY_MODEL }
}

export const perplexityEngine: GeoEngineClient = {
  key: "perplexity",
  isConfigured: () => Boolean(env("PERPLEXITY_API_KEY")),
  async ask(question, opts) {
    const key = env("PERPLEXITY_API_KEY")
    if (!key) throw new GeoEngineError(`${LABEL} : clé manquante (PERPLEXITY_API_KEY)`, "config", { retryable: false })
    const json = await postJson(API, {
      headers: { authorization: `Bearer ${key}` },
      body: perplexityRequest(question, opts),
      timeoutMs: opts.timeoutMs ?? ENGINE_TIMEOUT_MS,
      label: LABEL,
      secretNames: SECRETS,
    })
    return parsePerplexityResponse(json)
  },
}
