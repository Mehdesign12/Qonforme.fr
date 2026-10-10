/**
 * Test réel des connexions de l'onglet SEO (Paramètres › Connexions, bouton
 * « Tester ») : un appel léger par service, avec un délai de 15 s (90 s pour
 * PageSpeed, qui lance une vraie mesure de l'accueil sur mobile).
 *
 * - Search Console : accès à la propriété (pingSearchConsole) ;
 * - PageSpeed Insights : une mesure de https://qonforme.fr/ en mobile, si la clé est là ;
 * - Gemini : liste des modèles (GET /v1beta/models) ;
 * - OpenAI : liste des modèles (GET /v1/models) ;
 * - Perplexity : liste des requêtes asynchrones (GET /async/chat/completions,
 *   gratuite) ; une réponse inattendue autre qu'un refus vaut « unverified »
 *   (clé présente, non vérifiée), jamais « connected » ;
 * - Anthropic : liste des modèles par le SDK officiel (client.models.list) ;
 * - DataForSEO : données du compte (GET /v3/appendix/user_data, gratuite) ;
 * - Resend : liste des domaines (GET /domains) ; une clé limitée à l'envoi
 *   est acceptée telle quelle.
 *
 * Les messages sont en français et ne contiennent JAMAIS une clé ni un
 * en-tête d'autorisation : chaque message passe par `redact()`. Les résultats
 * sont gardés dans seo_settings, une ligne par connexion
 * (« connections_test:gemini »…) : « Tout tester » écrit en parallèle sans
 * qu'un résultat écrase l'autre.
 */
import Anthropic, { APIConnectionTimeoutError, APIError } from "@anthropic-ai/sdk"
import { CONNECTIONS, isConfigured, presenceState, type ConnectionKey } from "@/lib/seo/connections"
import { GoogleApiError, gscProperty, pingSearchConsole, runPageSpeed } from "@/lib/seo/google"
import { must, type SeoDb } from "@/lib/seo/db"
import { siteUrl } from "@/lib/seo/site"
import { redact } from "@/lib/seo/redact"
import type { ConnectionState } from "@/lib/seo/types"

/** Préfixe des lignes seo_settings des tests : « connections_test:<connexion> ». */
export const CONNECTIONS_TEST_PREFIX = "connections_test:"

export function connectionTestKey(key: ConnectionKey): string {
  return `${CONNECTIONS_TEST_PREFIX}${key}`
}
export const TEST_TIMEOUT_MS = 15_000
export const PAGESPEED_TEST_TIMEOUT_MS = 90_000

/**
 * Résultat d'un test : un état de connexion, ou « unverified » quand le
 * service n'a donné aucune réponse authentifiée (clé présente, non vérifiée :
 * on n'affirme pas qu'elle fonctionne).
 */
export type ConnectionTestState = ConnectionState | "unverified"

export interface ConnectionTestResult {
  state: ConnectionTestState
  message: string
  /** ISO 8601. */
  checkedAt: string
}

export type ConnectionTests = Partial<Record<ConnectionKey, ConnectionTestResult>>

const STATES: ConnectionTestState[] = ["connected", "missing", "not_configured", "error", "unverified"]

export function isConnectionKey(value: unknown): value is ConnectionKey {
  return typeof value === "string" && CONNECTIONS.some((c) => c.key === value)
}

function defOf(key: ConnectionKey) {
  return CONNECTIONS.find((c) => c.key === key)!
}

/* ------------------------------------------------------------------ */
/* Messages sans secret                                                */
/* ------------------------------------------------------------------ */

export { redact }

function varsOf(key: ConnectionKey): string {
  return defOf(key).env.join(" et ")
}

function absentResult(key: ConnectionKey): { state: ConnectionState; message: string } {
  const state = presenceState(key)
  const vars = varsOf(key)
  if (key === "search_console" && state === "error") {
    return { state, message: "GOOGLE_SERVICE_ACCOUNT_JSON est présente mais illisible : collez le fichier JSON du compte de service tel quel, ou encodé en base64." }
  }
  const several = defOf(key).env.length > 1
  return {
    state,
    message:
      state === "not_configured"
        ? `Non configurée : ${several ? "ajoutez les variables" : "ajoutez la variable"} ${vars} pour l'activer.`
        : `Clé manquante : ajoutez ${vars} dans les variables d'environnement de l'hébergeur.`,
  }
}

/** Échec HTTP d'un service, en français. */
export function httpFailure(name: string, status: number, vars: string): { state: ConnectionState; message: string } {
  if (status === 400 || status === 401 || status === 403) {
    return { state: "error", message: `${name} refuse la clé (erreur ${status}). Vérifiez ${vars}.` }
  }
  if (status === 402 || status === 429) {
    return { state: "error", message: `${name} répond que la limite ou le crédit du compte est atteint (erreur ${status}). Vérifiez le compte, puis réessayez.` }
  }
  if (status >= 500) return { state: "error", message: `${name} est indisponible pour le moment (erreur ${status}). Réessayez plus tard.` }
  return { state: "error", message: `${name} a répondu par une erreur ${status}.` }
}

class ProbeError extends Error {
  readonly kind: "timeout" | "network"
  constructor(kind: "timeout" | "network") {
    super(kind)
    this.kind = kind
  }
}

function isTimeout(error: unknown): boolean {
  const name = (error as { name?: string } | null)?.name
  return name === "TimeoutError" || name === "AbortError" || error instanceof APIConnectionTimeoutError
}

function probeFailure(name: string, error: ProbeError, timeoutMs: number): { state: ConnectionState; message: string } {
  return error.kind === "timeout"
    ? { state: "error", message: `${name} n'a pas répondu en ${Math.round(timeoutMs / 1000)} s. Réessayez plus tard.` }
    : { state: "error", message: `${name} est injoignable depuis le serveur. Réessayez plus tard.` }
}

async function probe(url: string, init: RequestInit, timeoutMs = TEST_TIMEOUT_MS): Promise<{ status: number; ok: boolean; json: unknown }> {
  let res: Response
  try {
    res = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(timeoutMs) })
  } catch (error) {
    throw new ProbeError(isTimeout(error) ? "timeout" : "network")
  }
  const json = await res.json().catch(() => null)
  return { status: res.status, ok: res.ok, json }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new ProbeError("timeout")), ms)
    promise.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}

/* ------------------------------------------------------------------ */
/* Un test par service                                                 */
/* ------------------------------------------------------------------ */

type Outcome = { state: ConnectionTestState; message: string }

async function testSearchConsole(): Promise<Outcome> {
  const name = "Search Console"
  try {
    await withTimeout(pingSearchConsole(), TEST_TIMEOUT_MS)
    return { state: "connected", message: `Accès vérifié à la propriété ${gscProperty()}.` }
  } catch (error) {
    if (error instanceof ProbeError) return probeFailure(name, error, TEST_TIMEOUT_MS)
    if (error instanceof GoogleApiError) return { state: "error", message: error.message }
    if (isTimeout(error)) return probeFailure(name, new ProbeError("timeout"), TEST_TIMEOUT_MS)
    return { state: "error", message: `${name} est injoignable depuis le serveur. Réessayez plus tard.` }
  }
}

async function testPageSpeed(): Promise<Outcome> {
  const name = "PageSpeed Insights"
  try {
    const json = (await withTimeout(runPageSpeed(siteUrl("/"), "mobile"), PAGESPEED_TEST_TIMEOUT_MS)) as {
      lighthouseResult?: { categories?: { performance?: { score?: number | null } } }
    }
    const score = json?.lighthouseResult?.categories?.performance?.score
    return {
      state: "connected",
      message:
        typeof score === "number"
          ? `Mesure réussie : accueil sur mobile, performance ${Math.round(score * 100)} / 100.`
          : "Mesure réussie : accueil sur mobile.",
    }
  } catch (error) {
    if (error instanceof ProbeError) return probeFailure(name, error, PAGESPEED_TEST_TIMEOUT_MS)
    if (isTimeout(error)) return probeFailure(name, new ProbeError("timeout"), PAGESPEED_TEST_TIMEOUT_MS)
    if (error instanceof GoogleApiError) {
      if (error.status === 400 || error.status === 401 || error.status === 403) {
        return { state: "error", message: `${name} refuse la clé (erreur ${error.status}). Vérifiez PAGESPEED_API_KEY et que l'API PageSpeed Insights est activée.` }
      }
      if (error.status === 429) return httpFailure(name, 429, "PAGESPEED_API_KEY")
      return { state: "error", message: error.message }
    }
    return { state: "error", message: `${name} est injoignable depuis le serveur. Réessayez plus tard.` }
  }
}

async function testGemini(): Promise<Outcome> {
  const name = "Gemini"
  try {
    const res = await probe("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", {
      headers: { "x-goog-api-key": process.env.GEMINI_API_KEY!.trim() },
    })
    if (res.ok) return { state: "connected", message: "Gemini répond : clé acceptée." }
    return httpFailure(name, res.status, "GEMINI_API_KEY")
  } catch (error) {
    if (error instanceof ProbeError) return probeFailure(name, error, TEST_TIMEOUT_MS)
    throw error
  }
}

async function testOpenAi(): Promise<Outcome> {
  const name = "OpenAI"
  try {
    const res = await probe("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY!.trim()}` },
    })
    if (res.ok) return { state: "connected", message: "OpenAI répond : clé acceptée." }
    return httpFailure(name, res.status, "OPENAI_API_KEY")
  } catch (error) {
    if (error instanceof ProbeError) return probeFailure(name, error, TEST_TIMEOUT_MS)
    throw error
  }
}

async function testPerplexity(): Promise<Outcome> {
  const name = "Perplexity"
  try {
    const res = await probe("https://api.perplexity.ai/async/chat/completions?limit=1", {
      headers: { Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY!.trim()}` },
    })
    if (res.ok) return { state: "connected", message: "Perplexity répond : clé acceptée." }
    if (res.status === 401 || res.status === 403 || res.status === 429 || res.status === 402) {
      return httpFailure(name, res.status, "PERPLEXITY_API_KEY")
    }
    // Ni succès ni refus : rien ne prouve que la clé fonctionne
    return {
      state: "unverified",
      message: `Clé présente, non vérifiée : le point de contrôle de Perplexity a répondu par une erreur ${res.status}.`,
    }
  } catch (error) {
    if (error instanceof ProbeError) return probeFailure(name, error, TEST_TIMEOUT_MS)
    throw error
  }
}

async function testAnthropic(): Promise<Outcome> {
  const name = "Anthropic"
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY!.trim(), timeout: TEST_TIMEOUT_MS, maxRetries: 0 })
    await client.models.list({ limit: 1 })
    return { state: "connected", message: "Anthropic répond : clé acceptée." }
  } catch (error) {
    if (isTimeout(error)) return probeFailure(name, new ProbeError("timeout"), TEST_TIMEOUT_MS)
    if (error instanceof APIError && typeof error.status === "number") return httpFailure(name, error.status, "ANTHROPIC_API_KEY")
    return probeFailure(name, new ProbeError("network"), TEST_TIMEOUT_MS)
  }
}

async function testDataForSeo(): Promise<Outcome> {
  const name = "DataForSEO"
  const vars = "DATAFORSEO_LOGIN et DATAFORSEO_PASSWORD"
  try {
    const credentials = Buffer.from(`${process.env.DATAFORSEO_LOGIN!.trim()}:${process.env.DATAFORSEO_PASSWORD!.trim()}`).toString("base64")
    const res = await probe("https://api.dataforseo.com/v3/appendix/user_data", {
      headers: { Authorization: `Basic ${credentials}` },
    })
    if (!res.ok) return httpFailure(name, res.status, vars)
    const json = res.json as {
      status_code?: number
      tasks?: { status_code?: number; result?: { money?: { balance?: number } }[] | null }[]
    } | null
    const code = json?.tasks?.[0]?.status_code ?? json?.status_code
    if (code === 40100 || code === 40101 || code === 40102 || code === 40104) {
      return { state: "error", message: `${name} refuse les identifiants (code ${code}). Vérifiez ${vars}.` }
    }
    if (typeof code === "number" && code !== 20000) {
      return { state: "error", message: `${name} a répondu par le code ${code}.` }
    }
    const balance = json?.tasks?.[0]?.result?.[0]?.money?.balance
    return {
      state: "connected",
      message:
        typeof balance === "number"
          ? `DataForSEO répond : identifiants acceptés, solde de ${balance.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $.`
          : "DataForSEO répond : identifiants acceptés.",
    }
  } catch (error) {
    if (error instanceof ProbeError) return probeFailure(name, error, TEST_TIMEOUT_MS)
    throw error
  }
}

const RESEND_DOMAIN_STATUS: Record<string, string> = { verified: "vérifié" }

async function testResend(): Promise<Outcome> {
  const name = "Resend"
  try {
    const res = await probe("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}` },
    })
    const json = res.json as { name?: string; data?: { name?: string; status?: string }[] } | null
    if (res.ok) {
      const domains = (json?.data ?? []).filter((d) => typeof d.name === "string")
      if (domains.length === 0) return { state: "connected", message: "Resend répond : clé acceptée, aucun domaine d'envoi enregistré." }
      const list = domains
        .slice(0, 4)
        .map((d) => `${d.name} (${RESEND_DOMAIN_STATUS[d.status ?? ""] ?? "non vérifié"})`)
        .join(", ")
      return { state: "connected", message: `Resend répond : clé acceptée. Domaines : ${list}.` }
    }
    if (json?.name === "restricted_api_key") {
      return { state: "connected", message: "Resend répond : clé acceptée, limitée à l'envoi (la liste des domaines n'est pas lisible avec elle)." }
    }
    return httpFailure(name, res.status, "RESEND_API_KEY")
  } catch (error) {
    if (error instanceof ProbeError) return probeFailure(name, error, TEST_TIMEOUT_MS)
    throw error
  }
}

const TESTS: Record<ConnectionKey, () => Promise<Outcome>> = {
  search_console: testSearchConsole,
  pagespeed: testPageSpeed,
  gemini: testGemini,
  openai: testOpenAi,
  perplexity: testPerplexity,
  anthropic: testAnthropic,
  dataforseo: testDataForSeo,
  resend: testResend,
}

/**
 * Teste une connexion. Une variable absente n'appelle rien (état de présence).
 * Ne lève jamais : un échec devient { state: "error", message }.
 */
export async function testConnection(key: ConnectionKey, now: () => Date = () => new Date()): Promise<ConnectionTestResult> {
  let outcome: Outcome
  if (!isConfigured(key)) {
    outcome = absentResult(key)
  } else {
    try {
      outcome = await TESTS[key]()
    } catch {
      outcome = { state: "error", message: `${defOf(key).name} : le test n'a pas pu aboutir. Réessayez dans un instant.` }
    }
  }
  return { state: outcome.state, message: redact(outcome.message), checkedAt: now().toISOString() }
}

/* ------------------------------------------------------------------ */
/* Résultats enregistrés                                               */
/* ------------------------------------------------------------------ */

/** Résultat bien formé ; null sinon. */
function sanitizeTest(value: unknown): ConnectionTestResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const v = value as Record<string, unknown>
  if (!STATES.includes(v.state as ConnectionTestState) || typeof v.message !== "string" || typeof v.checkedAt !== "string") return null
  return { state: v.state as ConnectionTestState, message: v.message, checkedAt: v.checkedAt }
}

/** Garde seulement les résultats bien formés des connexions connues. */
export function sanitizeTests(raw: unknown): ConnectionTests {
  const out: ConnectionTests = {}
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out
  Object.entries(raw as Record<string, unknown>).forEach(([key, value]) => {
    const test = sanitizeTest(value)
    if (isConnectionKey(key) && test) out[key] = test
  })
  return out
}

/** Derniers résultats des tests (lignes seo_settings « connections_test:<connexion> »). */
export async function readConnectionTests(db: SeoDb): Promise<ConnectionTests> {
  const rows = (must(
    await db.from("seo_settings").select("key, value").like("key", `${CONNECTIONS_TEST_PREFIX}%`),
    "les derniers tests de connexion",
  ) ?? []) as { key: string; value: unknown }[]
  const out: ConnectionTests = {}
  rows.forEach((row) => {
    if (typeof row.key !== "string" || !row.key.startsWith(CONNECTIONS_TEST_PREFIX)) return
    const key = row.key.slice(CONNECTIONS_TEST_PREFIX.length)
    const test = sanitizeTest(row.value)
    if (isConnectionKey(key) && test) out[key] = test
  })
  return out
}

/**
 * Enregistre le résultat d'une connexion dans sa propre ligne (upsert sur la
 * clé) : les tests lancés en parallèle par « Tout tester » n'écrivent jamais
 * la même ligne, aucun résultat n'est perdu.
 */
export async function storeConnectionTest(db: SeoDb, key: ConnectionKey, result: ConnectionTestResult): Promise<void> {
  must(
    await db
      .from("seo_settings")
      .upsert({ key: connectionTestKey(key), value: result, updated_at: new Date().toISOString() }, { onConflict: "key" }),
    "l'enregistrement du test de connexion",
  )
}
