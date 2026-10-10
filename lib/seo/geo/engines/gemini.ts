/**
 * Gemini avec « Grounding with Google Search ».
 *
 * Documentation (vérifiée le 9 oct. 2026) :
 * - requête : POST https://generativelanguage.googleapis.com/v1beta/models/<modèle>:generateContent,
 *   en-tête `x-goog-api-key`, outil `{ google_search: {} }`
 *   (https://ai.google.dev/gemini-api/docs/google-search) ;
 * - réponse : `candidates[].content.parts[].text`, `candidates[].finishReason`,
 *   `candidates[].groundingMetadata.groundingChunks[].web.{uri,title}`, `promptFeedback.blockReason`
 *   (https://ai.google.dev/api/generate-content#GroundingMetadata).
 *
 * Les `uri` des sources sont des liens de redirection Google
 * (vertexaisearch.cloud.google.com/grounding-api-redirect/…) ; le `title` est
 * souvent le domaine de la page. Pour connaître le site, une requête HEAD sans
 * suivre la redirection lit l'en-tête Location — seulement si l'hôte est exactement
 * vertexaisearch.cloud.google.com : la page de destination n'est jamais appelée.
 */
import { domainOf, dedupeSources } from "@/lib/seo/geo/detect"
import { systemContext } from "@/lib/seo/geo/engines/context"
import { ENGINE_TIMEOUT_MS, GeoEngineError, env, postJson } from "@/lib/seo/geo/engines/http"
import type { GeoAskOptions, GeoEngineAnswer, GeoEngineClient, GeoSource } from "@/lib/seo/geo/types"

export const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash"
const API = "https://generativelanguage.googleapis.com/v1beta"
const SECRETS = ["GEMINI_API_KEY"]
const LABEL = "Gemini"
export const GEMINI_REDIRECT_HOST = "vertexaisearch.cloud.google.com"

export function geminiModel(): string {
  const m = env("GEMINI_GEO_MODEL")
  // Le nom du modèle entre dans le chemin de l'URL : lettres, chiffres, points et tirets seulement
  return /^[a-z0-9][a-z0-9.\-]{1,80}$/i.test(m) ? m : GEMINI_DEFAULT_MODEL
}

export interface GeminiChunk {
  uri: string
  title: string
}

/** Corps de requête generateContent avec la recherche Google. */
export function geminiRequest(question: string, opts: Pick<GeoAskOptions, "market" | "language">) {
  return {
    systemInstruction: { parts: [{ text: systemContext(opts) }] },
    contents: [{ role: "user", parts: [{ text: question }] }],
    tools: [{ google_search: {} }],
  }
}

const looksLikeDomain = (s: string) => /^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(s.trim())

/**
 * Analyse d'une réponse generateContent (fonction pure) : texte des parties (hors
 * pensées), sources de groundingChunks. Lève si le moteur n'a rien rendu.
 */
export function parseGeminiResponse(json: unknown, requestedModel: string): { answer: string; chunks: GeminiChunk[]; model: string } {
  const body = (json ?? {}) as {
    candidates?: {
      content?: { parts?: { text?: string; thought?: boolean }[] }
      finishReason?: string
      groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[] }
    }[]
    promptFeedback?: { blockReason?: string }
    modelVersion?: string
  }
  const candidate = body.candidates?.[0]
  if (!candidate) {
    const reason = body.promptFeedback?.blockReason
    throw new GeoEngineError(
      reason ? `${LABEL} : question refusée (${reason})` : `${LABEL} : aucune réponse rendue`,
      reason ? "refused" : "format",
      { retryable: !reason },
    )
  }
  const answer = (candidate.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("")
    .trim()
  if (!answer) {
    const reason = candidate.finishReason
    const refused = reason === "SAFETY" || reason === "PROHIBITED_CONTENT" || reason === "BLOCKLIST" || reason === "RECITATION"
    throw new GeoEngineError(
      `${LABEL} : réponse vide${reason ? ` (${reason})` : ""}`,
      refused ? "refused" : "format",
      { retryable: !refused },
    )
  }
  const chunks = (candidate.groundingMetadata?.groundingChunks ?? [])
    .map((c) => ({ uri: (c.web?.uri ?? "").trim(), title: (c.web?.title ?? "").trim() }))
    .filter((c) => c.uri || c.title)
  return { answer, chunks, model: body.modelVersion || requestedModel }
}

/** Vrai si l'URI est un lien de redirection de la recherche Google (hôte exact). */
export function isGeminiRedirect(uri: string): boolean {
  try {
    const u = new URL(uri)
    return u.protocol === "https:" && u.hostname.toLowerCase() === GEMINI_REDIRECT_HOST
  } catch {
    return false
  }
}

/**
 * Source d'un fragment, une fois la destination connue (fonction pure) : l'URL de
 * destination si elle est valide, sinon le lien d'origine ; le domaine de la
 * destination, sinon le titre s'il a la forme d'un domaine.
 */
export function geminiSource(chunk: GeminiChunk, location: string | null): GeoSource {
  const target = location && domainOf(location) ? location : null
  const domain = target ? domainOf(target) : isGeminiRedirect(chunk.uri) ? "" : domainOf(chunk.uri)
  const titleDomain = looksLikeDomain(chunk.title) ? chunk.title.toLowerCase().replace(/^www\./, "") : ""
  return { url: target ?? chunk.uri, domain: domain || titleDomain, title: chunk.title }
}

/** Destination d'un lien de redirection (en-tête Location d'une requête HEAD), sans la suivre. */
async function resolveRedirect(uri: string, timeoutMs: number): Promise<string | null> {
  if (!isGeminiRedirect(uri)) return null
  try {
    const res = await fetch(uri, { method: "HEAD", redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(timeoutMs) })
    const location = res.headers.get("location")
    if (!location) return null
    const absolute = new URL(location, uri).toString()
    return /^https?:\/\//i.test(absolute) ? absolute : null
  } catch {
    return null
  }
}

export const geminiEngine: GeoEngineClient = {
  key: "gemini",
  isConfigured: () => Boolean(env("GEMINI_API_KEY")),
  async ask(question, opts): Promise<GeoEngineAnswer> {
    const key = env("GEMINI_API_KEY")
    if (!key) throw new GeoEngineError(`${LABEL} : clé manquante (GEMINI_API_KEY)`, "config", { retryable: false })
    const model = geminiModel()
    const started = Date.now()
    const timeoutMs = opts.timeoutMs ?? ENGINE_TIMEOUT_MS
    const json = await postJson(`${API}/models/${model}:generateContent`, {
      headers: { "x-goog-api-key": key },
      body: geminiRequest(question, opts),
      timeoutMs,
      label: LABEL,
      secretNames: SECRETS,
    })
    const parsed = parseGeminiResponse(json, model)

    // Destinations des liens de redirection, en parallèle, dans le temps qui reste
    const left = timeoutMs - (Date.now() - started)
    const perLink = Math.max(1_000, Math.min(8_000, left - 1_000))
    const locations = left > 2_000
      ? await Promise.all(parsed.chunks.slice(0, 20).map((c) => resolveRedirect(c.uri, perLink)))
      : parsed.chunks.map(() => null)
    const sources = dedupeSources(parsed.chunks.slice(0, 20).map((c, i) => geminiSource(c, locations[i] ?? null)))
    return { answer: parsed.answer, sources, model: parsed.model }
  },
}
