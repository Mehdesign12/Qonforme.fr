/**
 * Claude : SDK officiel @anthropic-ai/sdk (0.128.0), `client.messages.create` avec
 * l'outil serveur de recherche web.
 *
 * Documentation (documentation TypeScript de l'API Claude fournie avec Claude Code, 9 oct. 2026 ;
 * types de node_modules/@anthropic-ai/sdk/resources/messages/messages.d.ts) :
 * - outil `{ type: "web_search_20260209", name: "web_search", max_uses, user_location }`
 *   (interface WebSearchTool20260209) ;
 * - `stop_reason: "pause_turn"` : la boucle de l'outil serveur s'est arrêtée ; on renvoie la
 *   conversation avec la réponse en tour « assistant », sans message « continue », et le serveur
 *   reprend où il en était (3 reprises au plus ici) ;
 * - réponse : blocs `text` (avec `citations` de type `web_search_result_location` : `url`, `title`)
 *   et blocs `web_search_tool_result` (`content` : tableau de `web_search_result` `url`, `title`,
 *   ou erreur `web_search_tool_result_error`) ; `stop_reason: "refusal"` à traiter avant le contenu ;
 * - claude-opus-5-5 : réflexion toujours active, profondeur réglée par `output_config.effort`
 *   (pas de `budget_tokens`) ; « low » suffit pour une réponse appuyée sur une recherche.
 * Tarif : 10 $ le millier de recherches, plus les jetons du modèle (4 $ / 20 $ le million).
 * Variable facultative ANTHROPIC_GEO_MODEL pour changer de modèle.
 */
import Anthropic from "@anthropic-ai/sdk"
import { dedupeSources, domainOf } from "@/lib/seo/geo/detect"
import { marketOf, systemContext } from "@/lib/seo/geo/engines/context"
import { ENGINE_TIMEOUT_MS, GeoEngineError, env, redact } from "@/lib/seo/geo/engines/http"
import type { GeoAskOptions, GeoEngineAnswer, GeoEngineClient, GeoSource } from "@/lib/seo/geo/types"

export const ANTHROPIC_DEFAULT_MODEL = "claude-opus-5-5"
const SECRETS = ["ANTHROPIC_API_KEY"]
const LABEL = "Claude"
/** Reprises après « pause_turn ». */
export const MAX_RESUMES = 3
export const WEB_SEARCH_MAX_USES = 3

export function anthropicModel(): string {
  const m = env("ANTHROPIC_GEO_MODEL")
  return /^[a-z0-9][a-z0-9.\-]{1,80}$/i.test(m) ? m : ANTHROPIC_DEFAULT_MODEL
}

export function claudeTools(opts: Pick<GeoAskOptions, "market">) {
  const market = marketOf(opts.market)
  return [
    {
      type: "web_search_20260209" as const,
      name: "web_search" as const,
      max_uses: WEB_SEARCH_MAX_USES,
      user_location: { type: "approximate" as const, country: market.country, timezone: market.timezone },
    },
  ]
}

/** Forme minimale d'un message de l'API (sous-ensemble lu par l'analyse). */
export interface ClaudeMessageLike {
  model?: string
  stop_reason?: string | null
  content: {
    type: string
    text?: string
    citations?: { type?: string; url?: string; title?: string | null }[] | null
    content?: unknown
  }[]
}

/**
 * Analyse des messages d'un échange (le premier et ses reprises), fonction pure :
 * texte = blocs text mis bout à bout ; sources = citations des blocs text seulement.
 * Les résultats de recherche (`web_search_tool_result`) que la réponse ne cite pas ne
 * sont pas des citations : lus par le modèle, pas montrés au lecteur.
 */
export function parseClaudeMessages(messages: ClaudeMessageLike[], requestedModel: string): GeoEngineAnswer {
  const last = messages[messages.length - 1]
  if (last?.stop_reason === "refusal") {
    throw new GeoEngineError(`${LABEL} : question refusée par le modèle`, "refused", { retryable: false })
  }
  const texts: string[] = []
  const cited: GeoSource[] = []
  messages.forEach((m) =>
    m.content.forEach((block) => {
      if (block.type !== "text" || typeof block.text !== "string") return
      texts.push(block.text)
      ;(block.citations ?? []).forEach((c) => {
        if (c.type === "web_search_result_location" && c.url) cited.push({ url: c.url, domain: domainOf(c.url), title: c.title ?? "" })
      })
    }),
  )
  const answer = texts.join("").trim()
  if (!answer) {
    const reason = last?.stop_reason
    throw new GeoEngineError(`${LABEL} : réponse vide${reason ? ` (${reason})` : ""}`, "format", { retryable: true })
  }
  return { answer, sources: dedupeSources(cited), model: last?.model || requestedModel }
}

export function toEngineError(error: unknown, timeoutMs: number): GeoEngineError {
  if (error instanceof GeoEngineError) return error
  // APIUserAbortError : la requête coupée par notre propre signal (AbortSignal.timeout) ;
  // c'est un délai, pas un service injoignable (elle hérite d'APIError, sans statut)
  if (
    error instanceof Anthropic.APIConnectionTimeoutError ||
    error instanceof Anthropic.APIUserAbortError ||
    (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError"))
  ) {
    return new GeoEngineError(`${LABEL} : pas de réponse en ${Math.round(timeoutMs / 1000)} s`, "timeout")
  }
  if (error instanceof Anthropic.APIError) {
    const status = error.status ?? 0
    const detail = redact(String(error.message ?? ""), SECRETS).replace(/\s+/g, " ").slice(0, 240)
    if (status === 401 || status === 403) return new GeoEngineError(`${LABEL} : clé refusée par le fournisseur, HTTP ${status}`, "auth", { status, retryable: false })
    if (status === 429) return new GeoEngineError(`${LABEL} : limite de requêtes atteinte, HTTP 429`, "rate_limit", { status })
    if (status === 0) return new GeoEngineError(`${LABEL} : service injoignable (${detail})`, "network")
    return new GeoEngineError(`${LABEL} : réponse HTTP ${status}${detail ? ` (${detail})` : ""}`, "http", { status })
  }
  const message = error instanceof Error ? redact(error.message, SECRETS).slice(0, 200) : "erreur inconnue"
  return new GeoEngineError(`${LABEL} : ${message}`, "network")
}

export const claudeEngine: GeoEngineClient = {
  key: "claude",
  isConfigured: () => Boolean(env("ANTHROPIC_API_KEY")),
  async ask(question, opts) {
    const apiKey = env("ANTHROPIC_API_KEY")
    if (!apiKey) throw new GeoEngineError(`${LABEL} : clé manquante (ANTHROPIC_API_KEY)`, "config", { retryable: false })
    const model = anthropicModel()
    const timeoutMs = Math.min(opts.timeoutMs ?? ENGINE_TIMEOUT_MS, ENGINE_TIMEOUT_MS)
    const deadline = Date.now() + timeoutMs
    // Pas de nouvel essai automatique du SDK : le relevé gère ses propres essais (2 au plus)
    const client = new Anthropic({ apiKey, maxRetries: 0, timeout: timeoutMs })
    const tools = claudeTools(opts)
    const system = systemContext(opts)

    const conversation: Anthropic.MessageParam[] = [{ role: "user", content: question }]
    const received: Anthropic.Message[] = []
    try {
      for (let turn = 0; turn <= MAX_RESUMES; turn++) {
        const left = deadline - Date.now()
        if (left < 1_000) throw new GeoEngineError(`${LABEL} : pas de réponse en ${Math.round(timeoutMs / 1000)} s`, "timeout")
        const message = await client.messages.create(
          { model, max_tokens: 8_000, system, tools, output_config: { effort: "low" }, messages: conversation },
          { signal: AbortSignal.timeout(left), timeout: left },
        )
        received.push(message)
        if (message.stop_reason !== "pause_turn") break
        // Reprise : la réponse interrompue repart en tour « assistant », sans message ajouté
        conversation.push({ role: "assistant", content: message.content })
      }
    } catch (error) {
      throw toEngineError(error, timeoutMs)
    }
    return parseClaudeMessages(received as unknown as ClaudeMessageLike[], model)
  },
}
