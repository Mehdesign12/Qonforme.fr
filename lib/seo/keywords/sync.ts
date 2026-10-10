/**
 * Synchronisation quotidienne des mots-clés avec Search Console (tâche
 * « keywords » de /api/cron/seo, après la tâche « search-console ») :
 *
 * 1. Mesures des mots-clés suivis sur les 28 derniers jours disponibles
 *    (seo_gsc_bounds + resolvePeriod("28j")) : position, impressions, clics de
 *    la requête identique après normalisation ; un mot-clé absent de Search
 *    Console a des mesures nulles (jamais 0 inventé).
 * 2. Découverte : une requête d'au moins 3 impressions, absente de la table,
 *    est ajoutée en « candidat » (source search_console), hors requêtes de
 *    marque sauf si le ciblage les inclut ; 50 ajouts au plus par passage.
 *
 * Le travail est rejouable : un passage interrompu par l'heure limite reprend
 * au suivant (seules les lignes qui changent sont réécrites).
 */
import { must, type SeoDb } from "@/lib/seo/db"
import { getSettings } from "@/lib/seo/settings"
import { gscBounds, gscQueries, keywordPeriod, listAllKeywords } from "@/lib/seo/keywords/data"
import { aggregateQueries, planDiscoveries, planMetricUpdates, type MetricsUpdate } from "@/lib/seo/keywords/rules"

/** Écritures en parallèle par paquets (une requête par mot-clé modifié). */
const PARALLEL = 10
/** Colonnes utiles à la synchronisation (indépendantes des ajouts de la section 12 de la migration). */
const SYNC_COLUMNS = "id, keyword, status, position, impressions, clicks"
/** Marge avant l'heure limite du passage. */
const SAFETY_MS = 15_000

export interface SyncResult {
  [key: string]: unknown
  period: { from: string; to: string } | null
  updated: number
  discovered: number
  complete: boolean
  skipped?: "no_gsc_data" | "no_query_data"
}

async function writeUpdates(db: SeoDb, updates: MetricsUpdate[], nowIso: string, deadline: number): Promise<{ written: number; complete: boolean }> {
  let written = 0
  for (let i = 0; i < updates.length; i += PARALLEL) {
    if (Date.now() > deadline - SAFETY_MS) return { written, complete: false }
    const chunk = updates.slice(i, i + PARALLEL)
    const results = await Promise.all(
      chunk.map((u) =>
        db
          .from("seo_keywords")
          .update({ position: u.position, impressions: u.impressions, clicks: u.clicks, gsc_updated_at: nowIso, updated_at: nowIso })
          .eq("id", u.id),
      ),
    )
    results.forEach((res) => must(res, "la mise à jour des mots-clés"))
    written += chunk.length
  }
  return { written, complete: true }
}

export async function syncKeywordsFromSearchConsole(db: SeoDb, opts: { now: Date; deadline: number }): Promise<SyncResult> {
  const bounds = await gscBounds(db)
  const range = keywordPeriod(bounds, opts.now)
  if (!range) return { period: null, updated: 0, discovered: 0, complete: true, skipped: "no_gsc_data" }

  const [rows, keywords, targeting] = await Promise.all([gscQueries(db, range), listAllKeywords(db, SYNC_COLUMNS), getSettings(db, "targeting")])
  const queries = aggregateQueries(rows)
  // Aucune requête sur la période (synchronisation des requêtes en panne) : ne rien remettre à zéro.
  if (queries.size === 0) return { period: range, updated: 0, discovered: 0, complete: true, skipped: "no_query_data" }

  const nowIso = opts.now.toISOString()
  const updates = planMetricUpdates(keywords, queries)
  const { written, complete } = await writeUpdates(db, updates, nowIso, opts.deadline)
  if (!complete) return { period: range, updated: written, discovered: 0, complete: false }

  const existing = new Set(keywords.map((k) => k.keyword))
  const found = planDiscoveries(queries, existing, {
    brandTerms: targeting.value.brandTerms,
    includeBrandQueries: targeting.value.includeBrandQueries,
  })
  if (found.length > 0) {
    must(
      await db.from("seo_keywords").upsert(
        found.map((q) => ({
          keyword: q.keyword,
          status: "candidate",
          source: "search_console",
          position: q.position,
          impressions: q.impressions,
          clicks: q.clicks,
          gsc_updated_at: nowIso,
        })),
        { onConflict: "keyword", ignoreDuplicates: true },
      ),
      "l'ajout des mots-clés découverts",
    )
  }
  return { period: range, updated: written, discovered: found.length, complete: true }
}
