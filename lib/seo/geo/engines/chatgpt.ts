/**
 * ChatGPT : API Responses d'OpenAI avec l'outil de recherche web.
 *
 * Documentation (vérifiée le 9 oct. 2026) :
 * - https://developers.openai.com/api/docs/guides/tools-web-search : outil `{ type: "web_search" }`
 *   (« web_search_preview » est l'ancienne version), `user_location` approximative, `tool_choice:
 *   "required"` pour imposer la recherche ; sortie : élément `web_search_call`, puis élément
 *   `message` dont `content[]` de type `output_text` porte `text` et des `annotations` de type
 *   `url_citation` (`url`, `title`, `start_index`, `end_index`) ;
 * - https://developers.openai.com/api/reference/resources/responses/methods/create : `status`,
 *   `error.message`, contenu `refusal`.
 *
 * Modèle par défaut : gpt-4.1-mini, cité par le guide parmi les modèles qui acceptent l'outil,
 * et peu coûteux : la recherche y est facturée 10 $ le millier d'appels plus un bloc fixe de
 * 8 000 jetons d'entrée (https://developers.openai.com/api/docs/pricing, relevé le 9 oct. 2026).
 * Variable facultative OPENAI_GEO_MODEL pour en changer.
 */
import { dedupeSources, domainOf } from "@/lib/seo/geo/detect"
import { marketOf, systemContext } from "@/lib/seo/geo/engines/context"
import { ENGINE_TIMEOUT_MS, GeoEngineError, env, postJson } from "@/lib/seo/geo/engines/http"
import type { GeoAskOptions, GeoEngineAnswer, GeoEngineClient, GeoSource } from "@/lib/seo/geo/types"

export const OPENAI_DEFAULT_MODEL = "gpt-4.1-mini"
const API = "https://api.openai.com/v1/responses"
const SECRETS = ["OPENAI_API_KEY"]
const LABEL = "ChatGPT"

export function openaiModel(): string {
  const m = env("OPENAI_GEO_MODEL")
  return /^[a-z0-9][a-z0-9.\-:_]{1,80}$/i.test(m) ? m : OPENAI_DEFAULT_MODEL
}

/** Corps de la requête Responses (recherche imposée : sans elle la réponse ne reflète pas le web). */
export function chatgptRequest(question: string, opts: Pick<GeoAskOptions, "market" | "language">, model: string) {
  const market = marketOf(opts.market)
  return {
    model,
    instructions: systemContext(opts),
    input: question,
    tools: [{ type: "web_search", user_location: { type: "approximate", country: market.country, timezone: market.timezone } }],
    tool_choice: "required",
    // Rien n'est conservé chez OpenAI pour ce relevé
    store: false,
  }
}

/** Retire le marqueur de suivi ajouté par OpenAI aux liens cités (« ?utm_source=openai »). */
export function cleanOpenAiUrl(url: string): string {
  try {
    const u = new URL(url)
    if (u.searchParams.get("utm_source") === "openai") u.searchParams.delete("utm_source")
    return u.toString()
  } catch {
    return url
  }
}

/** Analyse d'une réponse de l'API Responses (fonction pure). */
export function parseChatgptResponse(json: unknown, requestedModel: string): GeoEngineAnswer {
  const body = (json ?? {}) as {
    status?: string
    model?: string
    error?: { message?: string } | null
    incomplete_details?: { reason?: string } | null
    output?: {
      type?: string
      content?: { type?: string; text?: string; refusal?: string; annotations?: { type?: string; url?: string; title?: string }[] }[]
    }[]
  }
  if (body.status === "failed") {
    throw new GeoEngineError(`${LABEL} : échec de la réponse${body.error?.message ? ` (${body.error.message.slice(0, 200)})` : ""}`, "http")
  }
  const texts: string[] = []
  const sources: GeoSource[] = []
  let refusal = ""
  ;(body.output ?? []).forEach((item) => {
    if (item.type !== "message") return
    ;(item.content ?? []).forEach((part) => {
      if (part.type === "refusal" && part.refusal) refusal = part.refusal
      if (part.type !== "output_text" || typeof part.text !== "string") return
      texts.push(part.text)
      ;(part.annotations ?? []).forEach((a) => {
        if (a.type !== "url_citation" || !a.url) return
        const url = cleanOpenAiUrl(a.url)
        sources.push({ url, domain: domainOf(url), title: a.title ?? "" })
      })
    })
  })
  const answer = texts.join("\n\n").trim()
  if (!answer) {
    if (refusal) throw new GeoEngineError(`${LABEL} : question refusée (${refusal.slice(0, 160)})`, "refused", { retryable: false })
    const reason = body.incomplete_details?.reason
    throw new GeoEngineError(`${LABEL} : réponse vide${reason ? ` (${reason})` : ""}`, "format", { retryable: true })
  }
  return { answer, sources: dedupeSources(sources), model: body.model || requestedModel }
}

export const chatgptEngine: GeoEngineClient = {
  key: "chatgpt",
  isConfigured: () => Boolean(env("OPENAI_API_KEY")),
  async ask(question, opts) {
    const key = env("OPENAI_API_KEY")
    if (!key) throw new GeoEngineError(`${LABEL} : clé manquante (OPENAI_API_KEY)`, "config", { retryable: false })
    const model = openaiModel()
    const json = await postJson(API, {
      headers: { authorization: `Bearer ${key}` },
      body: chatgptRequest(question, opts, model),
      timeoutMs: opts.timeoutMs ?? ENGINE_TIMEOUT_MS,
      label: LABEL,
      secretNames: SECRETS,
    })
    return parseChatgptResponse(json, model)
  },
}
