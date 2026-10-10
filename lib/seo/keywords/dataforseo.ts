/**
 * Client DataForSEO de l'écran Mots-clés : volume de recherche mensuel et CPC
 * (Google Ads), difficulté et intention (DataForSEO Labs), pour la France en
 * français.
 *
 * Points d'accès (documentation officielle, vérifiée le 9 oct. 2026) :
 * - https://docs.dataforseo.com/v3/keywords_data/google_ads/search_volume/live/
 *   POST /v3/keywords_data/google_ads/search_volume/live
 *   [{ keywords (1 000 au plus, 80 caractères et 10 mots chacun), location_code, language_code }]
 *   → tasks[0].result[] = { keyword, search_volume, cpc (en dollars US), competition… }
 * - https://docs.dataforseo.com/v3/dataforseo_labs/google/bulk_keyword_difficulty/live/
 *   POST /v3/dataforseo_labs/google/bulk_keyword_difficulty/live
 *   [{ keywords (1 000 au plus), location_code, language_code }]
 *   → tasks[0].result[0].items[] = { keyword, keyword_difficulty (0-100) }
 * - https://docs.dataforseo.com/v3/dataforseo_labs/google/search_intent/live/
 *   POST /v3/dataforseo_labs/google/search_intent/live
 *   [{ keywords (1 000 au plus) }] : ce point d'accès ne prend ni lieu ni langue
 *   (champs absents de sa documentation) ;
 *   → tasks[0].result[0].items[] = { keyword, keyword_intent: { label, probability }, secondary_keyword_intents }
 * - Codes d'état : https://docs.dataforseo.com/v3/appendix/errors/ (20000 = succès ;
 *   le code HTTP vaut 200 la plupart du temps : il faut lire `status_code` de
 *   l'enveloppe ET de la tâche).
 *
 * Authentification Basic (DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD), lues dans
 * process.env et jamais rendues, journalisées ni recopiées dans un message.
 * L'analyse des réponses est faite par des fonctions pures, testées
 * (__tests__/seo-keywords-dataforseo.test.ts).
 */
import type { KeywordIntent } from "@/lib/seo/types"
import { canonicalKeyword } from "@/lib/seo/keywords/normalize"
import { isKeywordIntent } from "@/lib/seo/keywords/types"

export const DATAFORSEO_API = "https://api.dataforseo.com/v3"
/** France (liste des lieux de DataForSEO). */
export const DFS_LOCATION_FRANCE = 2250
export const DFS_LANGUAGE_FR = "fr"
/** Mots-clés au plus par appel (les trois points d'accès). */
export const DFS_MAX_KEYWORDS = 1000
/** Limites de Google Ads sur chaque mot-clé. */
export const DFS_MAX_KEYWORD_LENGTH = 80
export const DFS_MAX_KEYWORD_WORDS = 10

export const DFS_OK = 20000

/** Échec d'un appel à DataForSEO (message en français, sans secret). */
export class DataForSeoError extends Error {
  readonly code: number | null
  constructor(message: string, code: number | null = null) {
    super(message)
    this.name = "DataForSeoError"
    this.code = code
  }
}

/** Message en français pour un code d'état de DataForSEO. */
export function dataForSeoMessage(code: number | null, message?: string | null): string {
  switch (code) {
    case 40100:
    case 40101:
      return "DataForSEO a refusé les identifiants : vérifiez DATAFORSEO_LOGIN et DATAFORSEO_PASSWORD."
    case 40200:
    case 40210:
      return "Le solde du compte DataForSEO est insuffisant."
    case 40202:
    case 40209:
      return "Trop de requêtes vers DataForSEO pour le moment : réessayez dans une minute."
    case 40501:
      return "DataForSEO a refusé la requête (champ invalide)."
    default: {
      const detail = (message ?? "").replace(/\s+/g, " ").trim().slice(0, 160)
      return `DataForSEO n'a pas pu répondre${code ? ` (code ${code})` : ""}${detail ? ` : « ${detail} »` : ""}.`
    }
  }
}

/* ------------------------------------------------------------------ */
/* Analyse des réponses (fonctions pures)                               */
/* ------------------------------------------------------------------ */

type Json = Record<string, unknown>

function obj(value: unknown): Json | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null
}

function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function finite(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * Résultat de la (seule) tâche d'une réponse « live » ; lève DataForSeoError
 * si l'enveloppe ou la tâche n'est pas en succès (20000).
 */
export function taskResult(json: unknown): unknown[] {
  const env = obj(json)
  if (!env) throw new DataForSeoError("Réponse de DataForSEO illisible.")
  const envCode = finite(env.status_code)
  if (envCode !== DFS_OK) throw new DataForSeoError(dataForSeoMessage(envCode, String(env.status_message ?? "")), envCode)
  const task = obj(arr(env.tasks)[0])
  if (!task) throw new DataForSeoError("Réponse de DataForSEO sans tâche.")
  const taskCode = finite(task.status_code)
  if (taskCode !== DFS_OK) throw new DataForSeoError(dataForSeoMessage(taskCode, String(task.status_message ?? "")), taskCode)
  return arr(task.result)
}

export interface VolumeMetrics {
  volume: number | null
  /** En dollars US (Google Ads via DataForSEO), arrondi au centime. */
  cpc: number | null
}

/** search_volume/live → volume et CPC par mot-clé (forme canonique). */
export function parseSearchVolume(json: unknown): Map<string, VolumeMetrics> {
  const out = new Map<string, VolumeMetrics>()
  taskResult(json).forEach((item) => {
    const row = obj(item)
    if (!row || typeof row.keyword !== "string") return
    const volume = finite(row.search_volume)
    const cpc = finite(row.cpc)
    out.set(canonicalKeyword(row.keyword), {
      volume: volume === null ? null : Math.max(0, Math.round(volume)),
      cpc: cpc === null ? null : Math.round(cpc * 100) / 100,
    })
  })
  return out
}

/** Éléments `items` de toutes les entrées de `result` (Labs). */
function labsItems(json: unknown): Json[] {
  const items: Json[] = []
  taskResult(json).forEach((entry) => {
    arr(obj(entry)?.items).forEach((item) => {
      const row = obj(item)
      if (row) items.push(row)
    })
  })
  return items
}

/** bulk_keyword_difficulty/live → difficulté (0-100) par mot-clé. */
export function parseKeywordDifficulty(json: unknown): Map<string, number | null> {
  const out = new Map<string, number | null>()
  labsItems(json).forEach((row) => {
    if (typeof row.keyword !== "string") return
    const d = finite(row.keyword_difficulty)
    out.set(canonicalKeyword(row.keyword), d === null ? null : Math.min(100, Math.max(0, Math.round(d))))
  })
  return out
}

/** search_intent/live → intention principale par mot-clé (une des quatre de la base, sinon null). */
export function parseSearchIntent(json: unknown): Map<string, KeywordIntent | null> {
  const out = new Map<string, KeywordIntent | null>()
  labsItems(json).forEach((row) => {
    if (typeof row.keyword !== "string") return
    const label = obj(row.keyword_intent)?.label
    out.set(canonicalKeyword(row.keyword), isKeywordIntent(label) ? label : null)
  })
  return out
}

/** Caractères refusés par Google Ads dans un mot-clé. */
const FORBIDDEN = /[!@%^*()={};~`<>?\\|,"[\]]/

/** Vrai si DataForSEO (Google Ads) accepte ce mot-clé : 80 caractères, 10 mots, sans symbole refusé. */
export function isSendableKeyword(keyword: string): boolean {
  if (!keyword || keyword.length > DFS_MAX_KEYWORD_LENGTH) return false
  if (keyword.split(" ").length > DFS_MAX_KEYWORD_WORDS) return false
  return !FORBIDDEN.test(keyword)
}

/* ------------------------------------------------------------------ */
/* Appels                                                              */
/* ------------------------------------------------------------------ */

export function dataForSeoCredentials(): { login: string; password: string } | null {
  const login = process.env.DATAFORSEO_LOGIN?.trim()
  const password = process.env.DATAFORSEO_PASSWORD?.trim()
  return login && password ? { login, password } : null
}

async function post(path: string, task: Record<string, unknown>, timeoutMs: number): Promise<unknown> {
  const creds = dataForSeoCredentials()
  if (!creds) throw new DataForSeoError("DataForSEO n'est pas configuré : Paramètres › Connexions.")
  let res: Response
  try {
    res = await fetch(`${DATAFORSEO_API}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${creds.login}:${creds.password}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([task]),
      cache: "no-store",
      signal: AbortSignal.timeout(Math.max(1000, timeoutMs)),
    })
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
    throw new DataForSeoError(timedOut ? "DataForSEO n'a pas répondu à temps." : "DataForSEO est injoignable pour le moment.")
  }
  const json = await res.json().catch(() => null)
  if (!json) throw new DataForSeoError(dataForSeoMessage(null, `HTTP ${res.status}`))
  return json
}

export interface KeywordMetrics extends VolumeMetrics {
  difficulty: number | null
  intent: KeywordIntent | null
}

/** Délai maximal d'un appel « live ». */
export const DFS_CALL_TIMEOUT_MS = 30_000
/** Temps gardé après les appels pour écrire les mesures déjà facturées avant l'heure limite. */
export const DFS_WRITE_RESERVE_MS = 12_000

/**
 * Volume, CPC, difficulté et intention d'au plus 1 000 mots-clés (formes
 * canoniques). Volume et difficulté doivent réussir ; l'intention est un
 * complément : si son appel échoue, elle reste inconnue (null) et les mesures
 * déjà facturées ne sont pas perdues. Un mot-clé absent d'une réponse a des
 * valeurs nulles. Chaque appel s'arrête assez tôt pour laisser le temps
 * d'écrire avant `deadline`.
 */
export async function fetchKeywordMetrics(keywords: string[], opts: { deadline: number }): Promise<Map<string, KeywordMetrics>> {
  if (keywords.length === 0) return new Map()
  if (keywords.length > DFS_MAX_KEYWORDS) throw new DataForSeoError(`${DFS_MAX_KEYWORDS} mots-clés au plus par appel.`)
  const timeout = () => Math.min(DFS_CALL_TIMEOUT_MS, opts.deadline - Date.now() - DFS_WRITE_RESERVE_MS)

  const [volumeJson, difficultyJson, intents] = await Promise.all([
    post("/keywords_data/google_ads/search_volume/live", { keywords, location_code: DFS_LOCATION_FRANCE, language_code: DFS_LANGUAGE_FR }, timeout()),
    post("/dataforseo_labs/google/bulk_keyword_difficulty/live", { keywords, location_code: DFS_LOCATION_FRANCE, language_code: DFS_LANGUAGE_FR }, timeout()),
    post("/dataforseo_labs/google/search_intent/live", { keywords }, timeout())
      .then(parseSearchIntent)
      .catch(() => new Map<string, KeywordIntent | null>()),
  ])
  const volumes = parseSearchVolume(volumeJson)
  const difficulties = parseKeywordDifficulty(difficultyJson)

  const out = new Map<string, KeywordMetrics>()
  keywords.forEach((keyword) => {
    const v = volumes.get(keyword)
    out.set(keyword, {
      volume: v?.volume ?? null,
      cpc: v?.cpc ?? null,
      difficulty: difficulties.get(keyword) ?? null,
      intent: intents.get(keyword) ?? null,
    })
  })
  return out
}
