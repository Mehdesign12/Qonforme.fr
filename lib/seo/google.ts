/**
 * Accès aux API Google de l'onglet SEO, sans dépendance ajoutée :
 * - Search Console (lecture seule) par un compte de service : jeton OAuth 2.0
 *   obtenu par une assertion JWT signée en RS256 (node:crypto) ;
 * - PageSpeed Insights par une clé d'API (facultative : sans clé, le quota est faible).
 *
 * Variables (noms seulement, jamais les valeurs à l'écran) :
 * - GOOGLE_SERVICE_ACCOUNT_JSON : fichier JSON du compte de service, tel quel ou en base64 ;
 *   le compte doit être ajouté comme utilisateur de la propriété Search Console ;
 * - GSC_PROPERTY : propriété Search Console (par défaut « sc-domain:qonforme.fr ») ;
 * - PAGESPEED_API_KEY : clé d'API Google Cloud avec l'API PageSpeed Insights activée.
 *
 * Sources : https://developers.google.com/identity/protocols/oauth2/service-account#httprest
 * https://developers.google.com/webmaster-tools/v1/searchanalytics/query
 * https://developers.google.com/speed/docs/insights/v5/reference/pagespeedapi/runpagespeed
 */
import { createSign } from "node:crypto"

export const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly"
const TOKEN_URL = "https://oauth2.googleapis.com/token"
const FETCH_TIMEOUT_MS = 30_000

export function gscProperty(): string {
  return process.env.GSC_PROPERTY?.trim() || "sc-domain:qonforme.fr"
}

export interface ServiceAccount {
  client_email: string
  private_key: string
}

/** Compte de service lu dans GOOGLE_SERVICE_ACCOUNT_JSON (JSON ou base64) ; null si absent ou illisible. */
export function readServiceAccount(raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON): ServiceAccount | null {
  if (!raw?.trim()) return null
  const candidates = [raw.trim()]
  if (!raw.trim().startsWith("{")) {
    try {
      candidates.push(Buffer.from(raw.trim(), "base64").toString("utf8"))
    } catch {
      /* pas du base64 */
    }
  }
  for (const c of candidates) {
    try {
      const json = JSON.parse(c) as Partial<ServiceAccount>
      if (typeof json.client_email === "string" && typeof json.private_key === "string") {
        // Les variables d'environnement gardent parfois les retours à la ligne échappés
        return { client_email: json.client_email, private_key: json.private_key.replace(/\\n/g, "\n") }
      }
    } catch {
      /* candidat suivant */
    }
  }
  return null
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url")
}

/** Assertion JWT signée (RS256) pour l'échange de jeton du compte de service. */
export function signServiceAccountJwt(account: ServiceAccount, scope: string, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  const claims = base64url(
    JSON.stringify({ iss: account.client_email, scope, aud: TOKEN_URL, iat: nowSeconds, exp: nowSeconds + 3600 }),
  )
  const signer = createSign("RSA-SHA256")
  signer.update(`${header}.${claims}`)
  return `${header}.${claims}.${base64url(signer.sign(account.private_key))}`
}

/** Erreur d'une API Google, avec un message lisible en français. */
export class GoogleApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = "GoogleApiError"
    this.status = status
  }
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>()

/** Jeton d'accès du compte de service (gardé en mémoire jusqu'à une minute avant son expiration). */
export async function getGoogleAccessToken(scope = GSC_SCOPE): Promise<string> {
  const account = readServiceAccount()
  if (!account) throw new GoogleApiError(0, "Compte de service Google absent (GOOGLE_SERVICE_ACCOUNT_JSON).")
  const cached = tokenCache.get(scope)
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signServiceAccountJwt(account, scope),
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string }
  if (!res.ok || !json.access_token) {
    throw new GoogleApiError(res.status, `Connexion à Google refusée : ${json.error_description ?? `erreur ${res.status}`}`)
  }
  tokenCache.set(scope, { token: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 })
  return json.access_token
}

/* ------------------------------------------------------------------ */
/* Search Console                                                      */
/* ------------------------------------------------------------------ */

export type GscDimension = "date" | "query" | "page" | "device" | "country"

export interface GscQueryBody {
  startDate: string
  endDate: string
  dimensions: GscDimension[]
  type?: "web"
  /** « final » (défaut) ou « all » (données récentes encore provisoires). */
  dataState?: "final" | "all"
  dimensionFilterGroups?: { filters: { dimension: GscDimension; operator: "equals" | "contains" | "notEquals" | "notContains"; expression: string }[] }[]
  aggregationType?: "auto" | "byPage" | "byProperty"
}

export interface GscApiRow {
  keys: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

const GSC_PAGE_SIZE = 25_000

/**
 * Requête Search Analytics, toutes les pages de résultats (25 000 lignes par
 * appel, au plus `maxRows`). Les lignes sont rendues dans l'ordre de l'API.
 */
export async function gscQuery(body: GscQueryBody, maxRows = 200_000): Promise<GscApiRow[]> {
  const token = await getGoogleAccessToken(GSC_SCOPE)
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(gscProperty())}/searchAnalytics/query`
  const rows: GscApiRow[] = []
  for (let startRow = 0; startRow < maxRows; startRow += GSC_PAGE_SIZE) {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "web", ...body, rowLimit: GSC_PAGE_SIZE, startRow }),
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    const json = (await res.json().catch(() => ({}))) as { rows?: GscApiRow[]; error?: { message?: string } }
    if (!res.ok) {
      const hint =
        res.status === 403
          ? " Le compte de service doit être ajouté comme utilisateur de la propriété dans Search Console."
          : ""
      throw new GoogleApiError(res.status, `Search Console : ${json.error?.message ?? `erreur ${res.status}`}.${hint}`)
    }
    const page = json.rows ?? []
    rows.push(...page)
    if (page.length < GSC_PAGE_SIZE) break
  }
  return rows
}

/** Vérifie l'accès à la propriété (Paramètres › Connexions). */
export async function pingSearchConsole(): Promise<void> {
  const token = await getGoogleAccessToken(GSC_SCOPE)
  const res = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(gscProperty())}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
    throw new GoogleApiError(
      res.status,
      res.status === 403 || res.status === 404
        ? `Accès refusé à ${gscProperty()} : ajoutez l'adresse du compte de service comme utilisateur de la propriété dans Search Console.`
        : `Search Console : ${json.error?.message ?? `erreur ${res.status}`}`,
    )
  }
}

/* ------------------------------------------------------------------ */
/* PageSpeed Insights                                                  */
/* ------------------------------------------------------------------ */

export type PageSpeedStrategy = "mobile" | "desktop"

/**
 * Appel brut de PageSpeed Insights (catégorie performance), en français.
 * `url` doit déjà être une URL du site (lib/seo/site.ts : siteUrl) : la
 * fonction refuse toute autre origine.
 */
export async function runPageSpeed(
  url: string,
  strategy: PageSpeedStrategy,
  opts: { timeoutMs?: number } = {},
): Promise<Record<string, unknown>> {
  const target = new URL(url)
  if (target.hostname !== "qonforme.fr" || target.protocol !== "https:") {
    throw new GoogleApiError(400, "PageSpeed ne mesure que les pages de qonforme.fr.")
  }
  const params = new URLSearchParams({ url: target.toString(), strategy, category: "performance", locale: "fr" })
  const key = process.env.PAGESPEED_API_KEY?.trim()
  const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`, {
    // Clé en en-tête, jamais dans l'adresse (journaux des proxys)
    headers: key ? { "X-Goog-Api-Key": key } : undefined,
    cache: "no-store",
    // Une mesure Lighthouse prend souvent 20 à 40 s
    signal: AbortSignal.timeout(opts.timeoutMs ?? 90_000),
  })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: { message?: string } }
  if (!res.ok) throw new GoogleApiError(res.status, `PageSpeed : ${json.error?.message ?? `erreur ${res.status}`}`)
  return json
}
