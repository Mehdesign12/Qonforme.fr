/**
 * Appels HTTP des moteurs IA : délai, erreurs explicites en français, aucune clé
 * dans un message ni un journal. Côté serveur seulement.
 */

/** Délai maximal d'un appel de moteur (recherche web comprise). */
export const ENGINE_TIMEOUT_MS = 90_000

export type GeoEngineErrorCode = "timeout" | "http" | "auth" | "rate_limit" | "config" | "format" | "refused" | "network"

/**
 * Erreur d'un moteur. `retryable` : un nouvel essai a des chances d'aboutir
 * (délai, limite de débit, panne passagère).
 */
export class GeoEngineError extends Error {
  readonly code: GeoEngineErrorCode
  readonly status?: number
  readonly retryable: boolean
  constructor(message: string, code: GeoEngineErrorCode, opts: { status?: number; retryable?: boolean } = {}) {
    super(message)
    this.name = "GeoEngineError"
    this.code = code
    this.status = opts.status
    this.retryable = opts.retryable ?? (code === "timeout" || code === "rate_limit" || code === "network" || (code === "http" && (opts.status ?? 0) >= 500))
  }
}

/** Valeur d'une variable d'environnement (chaîne vide si absente). */
export function env(name: string): string {
  return process.env[name]?.trim() ?? ""
}

/**
 * Masque tout ce qui ressemble à une clé d'API dans un texte venu d'un fournisseur
 * (certains messages d'erreur en reprennent un morceau), ainsi que les valeurs
 * exactes des variables données.
 */
export function redact(text: string, secretNames: string[] = []): string {
  let out = text
  secretNames.forEach((name) => {
    const value = env(name)
    if (value.length >= 6) out = out.split(value).join("***")
  })
  return out
    .replace(/\b(sk|pk|rk|pplx|sk-ant|sk-proj)-[A-Za-z0-9_*\-]{6,}/g, "***")
    .replace(/\bAIza[0-9A-Za-z_\-]{10,}/g, "***")
    .replace(/(Bearer|Basic)\s+[A-Za-z0-9._~+/=\-]{6,}/gi, "$1 ***")
}

/** Message d'erreur lisible d'un corps de réponse JSON d'API (formats OpenAI, Google, Anthropic, Perplexity, DataForSEO). */
export function apiErrorDetail(body: unknown): string {
  if (!body || typeof body !== "object") return ""
  const b = body as Record<string, unknown>
  const err = b.error
  if (typeof err === "string") return err
  if (err && typeof err === "object") {
    const m = (err as Record<string, unknown>).message
    if (typeof m === "string") return m
  }
  if (typeof b.message === "string") return b.message
  if (typeof b.detail === "string") return b.detail
  if (typeof b.status_message === "string") return b.status_message
  return ""
}

/** Erreur d'un statut HTTP en échec. */
export function httpError(label: string, status: number, body: unknown, secretNames: string[]): GeoEngineError {
  const detail = redact(apiErrorDetail(body), secretNames).replace(/\s+/g, " ").trim().slice(0, 240)
  const suffix = detail ? ` (${detail})` : ""
  if (status === 401 || status === 403) {
    return new GeoEngineError(`${label} : clé refusée par le fournisseur, HTTP ${status}${suffix}`, "auth", { status, retryable: false })
  }
  if (status === 429) {
    return new GeoEngineError(`${label} : limite de requêtes atteinte, HTTP 429${suffix}`, "rate_limit", { status })
  }
  return new GeoEngineError(`${label} : réponse HTTP ${status}${suffix}`, "http", { status })
}

function isAbort(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const name = (error as { name?: string }).name
  return name === "TimeoutError" || name === "AbortError"
}

/**
 * POST JSON avec délai. Rend le corps JSON ; lève GeoEngineError (délai, HTTP, réseau,
 * corps illisible). Les en-têtes (clés) ne sont jamais repris dans un message.
 */
export async function postJson(
  url: string,
  init: { headers: Record<string, string>; body: unknown; timeoutMs?: number; label: string; secretNames: string[] },
): Promise<unknown> {
  const timeoutMs = Math.max(1_000, Math.min(init.timeoutMs ?? ENGINE_TIMEOUT_MS, ENGINE_TIMEOUT_MS))
  let res: Response
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", ...init.headers },
      body: JSON.stringify(init.body),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    if (isAbort(error)) {
      throw new GeoEngineError(`${init.label} : pas de réponse en ${Math.round(timeoutMs / 1000)} s`, "timeout")
    }
    const message = error instanceof Error ? redact(error.message, init.secretNames) : "erreur réseau"
    throw new GeoEngineError(`${init.label} : service injoignable (${message.slice(0, 160)})`, "network")
  }

  let text = ""
  try {
    text = await res.text()
  } catch (error) {
    if (isAbort(error)) throw new GeoEngineError(`${init.label} : pas de réponse en ${Math.round(timeoutMs / 1000)} s`, "timeout")
    throw new GeoEngineError(`${init.label} : réponse interrompue`, "network")
  }
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  if (!res.ok) throw httpError(init.label, res.status, json, init.secretNames)
  if (json === null) throw new GeoEngineError(`${init.label} : réponse illisible (JSON attendu)`, "format", { retryable: true })
  return json
}

/** Vrai si l'erreur est un dépassement de délai (d'un moteur ou de notre budget). */
export function isTimeout(error: unknown): boolean {
  return (error instanceof GeoEngineError && error.code === "timeout") || isAbort(error)
}
