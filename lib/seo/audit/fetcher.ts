/**
 * Requêtes de l'exploration : vers qonforme.fr SEULEMENT.
 *
 * Aucune adresse n'est appelée telle quelle (pas de SSRF) : chaque URL passe
 * par toSitePath (null hors du site → refus) puis siteUrl, qui reconstruit
 * l'adresse sur SITE_ORIGIN. Une redirection est enregistrée, jamais suivie
 * (`redirect: "manual"`), même vers une autre page du site. Délai de 15 s par
 * requête, corps lu jusqu'à 2 Mo, en-tête User-Agent propre à l'audit.
 */
import { SITE_ORIGIN, siteUrl, toSitePath } from "@/lib/seo/site"

export const AUDIT_USER_AGENT = "QonformeSEOAudit/1.0 (+https://qonforme.fr)"
export const PAGE_TIMEOUT_MS = 15_000
export const MAX_BODY_BYTES = 2 * 1024 * 1024

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>

/** Adresse hors de qonforme.fr : jamais appelée. */
export class OffSiteUrlError extends Error {
  constructor(readonly input: string) {
    super("Adresse hors de qonforme.fr : l'exploration ne l'appelle pas.")
    this.name = "OffSiteUrlError"
  }
}

export interface SiteResponse {
  path: string
  /** Code HTTP ; null si la requête n'a pas abouti. */
  status: number | null
  /** Cible d'une redirection : chemin du site, ou adresse externe enregistrée (jamais suivie). */
  redirectTo: string | null
  contentType: string | null
  xRobotsTag: string | null
  body: string | null
  truncated: boolean
  /** Raison d'un échec (délai, réseau), en français. */
  error: string | null
}

/** Adresse sûre d'un chemin du site ; lève OffSiteUrlError pour tout le reste. */
export function auditUrl(pathOrUrl: string): { path: string; url: string } {
  const path = toSitePath(pathOrUrl)
  if (!path) throw new OffSiteUrlError(pathOrUrl)
  const url = siteUrl(path)
  // Double garde : l'adresse reconstruite doit commencer par l'origine du site.
  if (url !== `${SITE_ORIGIN}/` && !url.startsWith(`${SITE_ORIGIN}/`)) throw new OffSiteUrlError(pathOrUrl)
  return { path, url }
}

/** Lit au plus `max` octets du corps puis coupe le flux. */
export async function readCapped(res: Response, max = MAX_BODY_BYTES): Promise<{ text: string; truncated: boolean }> {
  if (!res.body) return { text: "", truncated: false }
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  let truncated = false
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    if (size + value.byteLength > max) {
      chunks.push(value.subarray(0, max - size))
      size = max
      truncated = true
      await reader.cancel().catch(() => undefined)
      break
    }
    chunks.push(value)
    size += value.byteLength
  }
  const all = new Uint8Array(size)
  let offset = 0
  chunks.forEach((c) => {
    all.set(c, offset)
    offset += c.byteLength
  })
  return { text: new TextDecoder("utf-8").decode(all), truncated }
}

async function discard(res: Response): Promise<void> {
  try {
    await res.body?.cancel()
  } catch {
    /* flux déjà fermé */
  }
}

function failureText(error: unknown, timeoutMs: number): string {
  const name = error instanceof Error ? error.name : ""
  if (name === "TimeoutError" || name === "AbortError") return `Pas de réponse en ${Math.round(timeoutMs / 1000)} s`
  return "Requête impossible (réseau)"
}

/**
 * Appelle une page de qonforme.fr. `readBody` (GET seulement) lit le corps
 * jusqu'à 2 Mo ; sinon le corps est abandonné. Ne lève que pour une adresse
 * hors du site ; un échec réseau est rendu dans `error`.
 */
export async function fetchSitePath(
  pathOrUrl: string,
  opts: { method?: "GET" | "HEAD"; readBody?: boolean; timeoutMs?: number; fetchImpl?: FetchLike; accept?: string } = {},
): Promise<SiteResponse> {
  const { path, url } = auditUrl(pathOrUrl)
  const method = opts.method ?? "GET"
  const timeoutMs = Math.max(1000, Math.min(opts.timeoutMs ?? PAGE_TIMEOUT_MS, PAGE_TIMEOUT_MS))
  const out: SiteResponse = { path, status: null, redirectTo: null, contentType: null, xRobotsTag: null, body: null, truncated: false, error: null }
  const doFetch: FetchLike = opts.fetchImpl ?? ((u, init) => fetch(u, init))

  try {
    const res = await doFetch(url, {
      method,
      redirect: "manual",
      cache: "no-store",
      headers: {
        "User-Agent": AUDIT_USER_AGENT,
        Accept: opts.accept ?? "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
      },
      signal: AbortSignal.timeout(timeoutMs),
    })
    out.status = res.status
    out.contentType = res.headers.get("content-type")
    out.xRobotsTag = res.headers.get("x-robots-tag")

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location")
      if (location) {
        let absolute: string | null = null
        try {
          absolute = new URL(location, url).href
        } catch {
          absolute = null
        }
        // Enregistrée seulement : une adresse externe n'est jamais appelée.
        out.redirectTo = absolute ? toSitePath(absolute) ?? absolute.slice(0, 300) : location.slice(0, 300)
      }
      await discard(res)
      return out
    }
    if (method === "HEAD" || !opts.readBody) {
      await discard(res)
      return out
    }
    const { text, truncated } = await readCapped(res, MAX_BODY_BYTES)
    out.body = text
    out.truncated = truncated
    return out
  } catch (error) {
    out.error = failureText(error, timeoutMs)
    return out
  }
}

/** Vrai si la réponse est une page HTML. */
export function isHtml(contentType: string | null | undefined): boolean {
  return !contentType || /text\/html|application\/xhtml\+xml/i.test(contentType)
}

/** Exécute `fn` sur chaque élément, `limit` à la fois, en gardant l'ordre des résultats. */
export async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i], i)
    }
  }
  const workers: Promise<void>[] = []
  for (let w = 0; w < Math.min(limit, items.length); w++) workers.push(worker())
  await Promise.all(workers)
  return results
}
