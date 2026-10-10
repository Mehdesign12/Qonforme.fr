/**
 * Mesure d'une page du site par PageSpeed Insights et enregistrement dans
 * seo_pagespeed : une ligne par mesure, avec `error` quand la mesure échoue
 * (l'échec reste visible dans l'historique au lieu de disparaître).
 *
 * Seules les pages de qonforme.fr se mesurent : le chemin passe par
 * lib/seo/site.ts (siteUrl) et runPageSpeed refuse toute autre origine.
 */
import { must, type SeoDb } from "@/lib/seo/db"
import { GoogleApiError, runPageSpeed } from "@/lib/seo/google"
import { siteUrl, toSitePath } from "@/lib/seo/site"
import { parsePageSpeed, type PageSpeedStrategy } from "@/lib/seo/pagespeed/parse"
import { PAGESPEED_COLUMNS, type PageSpeedRow } from "@/lib/seo/pagespeed/read"
import { redact } from "@/lib/seo/redact"

export interface MeasureOutcome {
  ok: boolean
  row: PageSpeedRow
  /** Message en français (mesure en échec). */
  error?: string
  /** Statut HTTP renvoyé par Google, s'il y en a un. */
  status?: number
}

export type PageSpeedRunner = (url: string, strategy: PageSpeedStrategy) => Promise<Record<string, unknown>>

/** Message lisible d'un échec d'appel (jamais de clé ni d'adresse d'API). */
export function measureErrorMessage(error: unknown): { message: string; status?: number } {
  if (error instanceof GoogleApiError) {
    if (error.status === 429) {
      return { message: "Quota de PageSpeed atteint. Réessayez plus tard, ou ajoutez une clé PAGESPEED_API_KEY.", status: 429 }
    }
    return { message: redact(error.message), status: error.status }
  }
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return { message: "PageSpeed n'a pas répondu à temps. Réessayez dans un instant." }
  }
  return { message: "La mesure n'a pas pu aboutir. Réessayez dans un instant." }
}

/** Mesure une page et enregistre le résultat (réussite ou échec). */
export async function measurePage(
  db: SeoDb,
  path: string,
  strategy: PageSpeedStrategy,
  deps: { run?: PageSpeedRunner; now?: Date } = {},
): Promise<MeasureOutcome> {
  const clean = toSitePath(path)
  if (!clean) throw new GoogleApiError(400, "PageSpeed ne mesure que les pages de qonforme.fr.")
  const run = deps.run ?? runPageSpeed
  const base = { path: clean, strategy, source: "api", measured_at: (deps.now ?? new Date()).toISOString() }

  let values: Record<string, unknown>
  let failure: { message: string; status?: number } | null = null
  try {
    const parsed = parsePageSpeed(await run(siteUrl(clean), strategy))
    values = { ...base, ...parsed }
    if (parsed.error) failure = { message: parsed.error }
  } catch (error) {
    failure = measureErrorMessage(error)
    values = { ...base, error: failure.message }
  }

  const row = must(
    await db.from("seo_pagespeed").insert(values).select(PAGESPEED_COLUMNS).single(),
    "l'enregistrement de la mesure PageSpeed",
  ) as unknown as PageSpeedRow
  return failure ? { ok: false, row, error: failure.message, status: failure.status } : { ok: true, row }
}
