/**
 * Lecture des mesures PageSpeed enregistrées (table seo_pagespeed) : pour
 * chaque page suivie et une stratégie (mobile ou ordinateur), la dernière
 * mesure réussie, la précédente (« Avant ») et le dernier essai (qui peut être
 * un échec plus récent que la dernière mesure réussie).
 */
import { must, type SeoDb } from "@/lib/seo/db"
import { toSitePath } from "@/lib/seo/site"
import type { FieldData, PageSpeedStrategy } from "@/lib/seo/pagespeed/parse"

export const PAGESPEED_COLUMNS =
  "id, path, strategy, measured_at, source, note, performance_score, lcp_ms, cls, tbt_ms, fcp_ms, si_ms, unused_js_bytes, field, error"

export interface PageSpeedRow {
  id: string
  path: string
  strategy: PageSpeedStrategy
  measured_at: string
  source: "api" | "import"
  note: string | null
  performance_score: number | null
  lcp_ms: number | null
  cls: number | null
  tbt_ms: number | null
  fcp_ms: number | null
  si_ms: number | null
  unused_js_bytes: number | null
  field: FieldData | null
  error: string | null
}

export interface PageHistory {
  path: string
  /** Dernière mesure réussie. */
  current: PageSpeedRow | null
  /** Mesure réussie précédente (« Avant »). */
  previous: PageSpeedRow | null
  /** Dernier essai, réussi ou non. */
  lastAttempt: PageSpeedRow | null
}

/** Dernière, précédente et dernier essai d'une liste de mesures (doublons d'identifiant ignorés). */
export function summarizeHistory(path: string, rows: PageSpeedRow[]): PageHistory {
  const seen = new Set<string>()
  const unique = rows.filter((r) => {
    if (seen.has(r.id)) return false
    seen.add(r.id)
    return true
  })
  const sorted = unique.sort((a, b) => Date.parse(b.measured_at) - Date.parse(a.measured_at))
  const ok = sorted.filter((r) => !r.error)
  return { path, current: ok[0] ?? null, previous: ok[1] ?? null, lastAttempt: sorted[0] ?? null }
}

/** Chemin tel qu'il est enregistré par la mesure (« /modele/ » → « /modele »). */
export function storedPath(path: string): string {
  return toSitePath(path) ?? path
}

/**
 * Historique de chaque page : les deux dernières mesures réussies et le dernier
 * essai, lus séparément (des essais en échec répétés, quota atteint par
 * exemple, ne font jamais disparaître la dernière mesure réussie). La clé du
 * résultat reste le chemin des réglages ; la lecture se fait sur le chemin
 * normalisé, celui qu'enregistre measurePage.
 */
export async function readPageSpeedHistory(db: SeoDb, paths: string[], strategy: PageSpeedStrategy): Promise<Record<string, PageHistory>> {
  const query = (path: string) =>
    db.from("seo_pagespeed").select(PAGESPEED_COLUMNS).eq("path", storedPath(path)).eq("strategy", strategy)
  const entries = await Promise.all(
    paths.map(async (path) => {
      const [ok, last] = await Promise.all([
        query(path).is("error", null).order("measured_at", { ascending: false }).limit(2),
        query(path).order("measured_at", { ascending: false }).limit(1),
      ])
      const rows = [
        ...((must(ok, "les mesures PageSpeed") as unknown as PageSpeedRow[] | null) ?? []),
        ...((must(last, "les mesures PageSpeed") as unknown as PageSpeedRow[] | null) ?? []),
      ]
      return [path, summarizeHistory(path, rows)] as const
    }),
  )
  const out: Record<string, PageHistory> = {}
  entries.forEach(([path, history]) => {
    out[path] = history
  })
  return out
}
