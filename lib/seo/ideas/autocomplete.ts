/**
 * Saisie semi-automatique de Google : ce que les gens tapent vraiment.
 *
 * Une phrase que Google propose quand on tape son début est une requête réelle ;
 * c'est la preuve la plus simple qu'un mot-clé imaginé par un modèle existe
 * (le 16/10/2026, c'est ainsi que les 109 formulations exactes du plan mots-clés
 * ont été trouvées). Aucun volume ici : DataForSEO le mesure à part.
 *
 * Point d'accès non officiel et gratuit
 * (https://suggestqueries.google.com/complete/search, `client=firefox`, réponse
 * JSON en UTF-8). Google peut le limiter ou le fermer : toute panne rend
 * « non vérifié », jamais une erreur, et les idées restent proposées. Un cache
 * en mémoire de 6 h évite de redemander la même phrase.
 *
 * Serveur seulement.
 */
import type { AutocompleteState } from "@/lib/seo/ideas/types"

const ENDPOINT = "https://suggestqueries.google.com/complete/search"
const TTL_MS = 6 * 3_600_000
const CACHE_MAX = 500

/** Sans accents ni casse, espaces réduits : comparaison d'une phrase et d'une suggestion. */
export function foldPhrase(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’‘`´]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

/** Suggestions d'une réponse (`["requête", ["s1", "s2"], …]`) ; null si la forme n'est pas celle-là. */
export function parseSuggestResponse(json: unknown): string[] | null {
  if (!Array.isArray(json) || !Array.isArray(json[1])) return null
  return json[1].filter((s): s is string => typeof s === "string" && s.trim().length > 0).map((s) => s.trim())
}

const cache = new Map<string, { at: number; list: string[] }>()

/** Vide le cache (tests). */
export function clearSuggestCache(): void {
  cache.clear()
}

/** Suggestions de Google pour le début d'une requête ; null si Google n'a pas répondu comme prévu. */
export async function googleSuggest(query: string, timeoutMs = 4_000, now = Date.now()): Promise<string[] | null> {
  const key = foldPhrase(query)
  if (!key) return []
  const hit = cache.get(key)
  if (hit && now - hit.at < TTL_MS) return hit.list
  try {
    const url = `${ENDPOINT}?client=firefox&hl=fr&gl=fr&q=${encodeURIComponent(query)}`
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(timeoutMs), headers: { Accept: "application/json" } })
    if (!res.ok) return null
    const list = parseSuggestResponse(await res.json())
    if (!list) return null
    if (cache.size >= CACHE_MAX) cache.clear()
    cache.set(key, { at: now, list })
    return list
  } catch {
    return null
  }
}

export interface VerifyResult {
  /** Google propose cette phrase (ou une phrase qui la prolonge). */
  verified: boolean
  /** Prolongations réelles (longue traîne), trois au plus. */
  also: string[]
  /** Google a répondu. */
  reached: boolean
}

export type SuggestFn = (query: string) => Promise<string[] | null>

/**
 * Vérifie une phrase : Google la propose-t-il quand on la tape ? Sinon, quand
 * on tape la phrase sans son dernier mot (« comment facturer un » → « …
 * chantier ») ? Une phrase de moins de trois mots n'a pas de second essai.
 */
export async function verifyKeyword(keyword: string, suggest: SuggestFn): Promise<VerifyResult> {
  const target = foldPhrase(keyword)
  const matches = (list: string[]) => list.filter((s) => {
    const f = foldPhrase(s)
    return f === target || f.startsWith(`${target} `)
  })
  const first = await suggest(keyword)
  if (first === null) return { verified: false, also: [], reached: false }
  let hits = matches(first)
  const words = keyword.trim().split(/\s+/)
  if (hits.length === 0 && words.length >= 3) {
    const second = await suggest(words.slice(0, -1).join(" "))
    if (second !== null) hits = matches(second)
  }
  const also = hits.filter((s) => foldPhrase(s) !== target).slice(0, 3)
  return { verified: hits.length > 0, also, reached: true }
}

/**
 * Vérifie plusieurs phrases, `concurrency` à la fois, jusqu'à `deadline`
 * (ms depuis l'époque) ; une phrase non atteinte à temps reste « non vérifiée ».
 * État : « ok » (Google a répondu partout), « partial » (une partie), « unavailable ».
 */
export async function verifyKeywords(
  keywords: string[],
  opts: { suggest?: SuggestFn; concurrency?: number; deadline?: number } = {},
): Promise<{ results: Map<string, VerifyResult>; state: AutocompleteState }> {
  const suggest = opts.suggest ?? ((q: string) => googleSuggest(q))
  const concurrency = Math.max(1, opts.concurrency ?? 6)
  const results = new Map<string, VerifyResult>()
  const queue = keywords.slice()
  let reached = 0

  async function worker(): Promise<void> {
    for (;;) {
      if (opts.deadline !== undefined && Date.now() > opts.deadline) return
      const keyword = queue.shift()
      if (keyword === undefined) return
      const result = await verifyKeyword(keyword, suggest)
      if (result.reached) reached++
      results.set(keyword, result)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, keywords.length) }, worker))

  const state: AutocompleteState = keywords.length === 0 || reached === keywords.length ? "ok" : reached === 0 ? "unavailable" : "partial"
  return { results, state }
}
