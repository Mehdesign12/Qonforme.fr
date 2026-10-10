/**
 * Analyse DataForSEO des mots-clés (« Lancer l'analyse ») : volume mensuel,
 * CPC, difficulté et intention des mots-clés non ignorés sans mesures ou
 * mesurés il y a plus de 30 jours.
 *
 * Lancée par POST /api/admin/seo/keywords/analyze à travers runTask (verrou,
 * état « keywords-metrics » dans seo_jobs, journal cron_logs), jamais par le
 * cron (isDue rend toujours faux).
 *
 * Règles d'écriture :
 * - une valeur nouvelle remplace l'ancienne ; une valeur absente de la réponse
 *   ne l'efface pas (rien n'est remplacé par « inconnu ») ;
 * - l'intention n'est écrite que si le mot-clé n'en a pas : un choix de
 *   l'admin n'est jamais écrasé ;
 * - le CPC de Google Ads est en dollars US : cpc_currency = « USD » ;
 * - metrics_checked_at est posé sur chaque mot-clé interrogé, même sans
 *   valeur, et sur ceux que Google Ads refuse (trop longs, symboles) ;
 * - un paquet en échec arrête l'analyse (état « échouée », relançable) ; les
 *   paquets déjà écrits restent acquis ;
 * - l'intention est un complément : si son appel échoue, volume, CPC et
 *   difficulté (déjà facturés) sont quand même écrits (lib/seo/keywords/dataforseo.ts).
 *
 * Quand aucun mot-clé en attente n'est accepté par Google Ads, la route marque
 * les refusés sans lancer la tâche (markRefused) : une analyse qui
 * n'interroge rien ne déclenche pas le délai de 30 jours.
 */
import { must, type SeoDb } from "@/lib/seo/db"
import type { SeoTask } from "@/lib/seo/cron"
import { listAllKeywords } from "@/lib/seo/keywords/data"
import { DFS_MAX_KEYWORDS, fetchKeywordMetrics, isSendableKeyword, type KeywordMetrics } from "@/lib/seo/keywords/dataforseo"
import { METRICS_JOB, needsMetrics } from "@/lib/seo/keywords/analysis"
import type { KeywordRow } from "@/lib/seo/keywords/types"

const PARALLEL = 10
/**
 * Temps minimal pour lancer un paquet : les appels « live » (au plus
 * DFS_CALL_TIMEOUT_MS) puis l'écriture (DFS_WRITE_RESERVE_MS).
 */
const BATCH_BUDGET_MS = 25_000

/**
 * cpc_currency (section 12 de la migration) est lue AVANT tout appel payant :
 * colonne absente → 503 « migration_pending » dans la route, rien n'est facturé.
 */
const COLUMNS = "id, keyword, status, intent, metrics_checked_at, cpc_currency"

/** Mots-clés à interroger, dans l'ordre alphabétique. */
export async function keywordsToAnalyze(db: SeoDb, now: Date = new Date()): Promise<KeywordRow[]> {
  return (await listAllKeywords(db, COLUMNS)).filter((k) => needsMetrics(k, now))
}

/** Écriture d'un mot-clé d'après les mesures reçues (fonction pure, testée). */
export function metricsPatch(row: Pick<KeywordRow, "intent">, m: KeywordMetrics | null, nowIso: string): Record<string, unknown> {
  const patch: Record<string, unknown> = { metrics_checked_at: nowIso, updated_at: nowIso }
  if (!m) return patch
  if (m.volume !== null) patch.volume = m.volume
  if (m.difficulty !== null) patch.difficulty = m.difficulty
  if (m.cpc !== null) {
    patch.cpc = m.cpc
    patch.cpc_currency = "USD"
  }
  if (m.intent !== null && row.intent === null) patch.intent = m.intent
  return patch
}

async function writePatches(db: SeoDb, patches: { id: string; patch: Record<string, unknown> }[]): Promise<void> {
  for (let i = 0; i < patches.length; i += PARALLEL) {
    const chunk = patches.slice(i, i + PARALLEL)
    const results = await Promise.all(chunk.map((p) => db.from("seo_keywords").update(p.patch).eq("id", p.id)))
    results.forEach((res) => must(res, "l'enregistrement des volumes"))
  }
}

export interface MetricsResult {
  [key: string]: unknown
  requested: number
  measured: number
  withVolume: number
  skipped: number
}

/** Mots-clés en attente acceptés par Google Ads, et ceux qu'il refuse (trop longs, symboles). */
export function splitPending<T extends Pick<KeywordRow, "keyword">>(pending: T[]): { sendable: T[]; refused: T[] } {
  return {
    sendable: pending.filter((k) => isSendableKeyword(k.keyword)),
    refused: pending.filter((k) => !isSendableKeyword(k.keyword)),
  }
}

/** Refusés par Google Ads : marqués comme vérifiés, sans valeur (affichés « — »). */
export async function markRefused(db: SeoDb, refused: Pick<KeywordRow, "id" | "intent">[], now: Date): Promise<void> {
  const nowIso = now.toISOString()
  await writePatches(db, refused.map((k) => ({ id: k.id, patch: metricsPatch(k, null, nowIso) })))
}

export async function analyzeKeywords(db: SeoDb, opts: { now: Date; deadline: number }): Promise<MetricsResult> {
  const nowIso = opts.now.toISOString()
  const pending = await keywordsToAnalyze(db, opts.now)
  const { sendable, refused } = splitPending(pending)

  await markRefused(db, refused, opts.now)

  let measured = 0
  let withVolume = 0
  for (let i = 0; i < sendable.length; i += DFS_MAX_KEYWORDS) {
    if (opts.deadline - Date.now() < BATCH_BUDGET_MS) {
      throw new Error(
        `L'analyse s'est interrompue avant la fin (${measured} mots-clés sur ${sendable.length} mesurés) : relancez-la pour terminer.`,
      )
    }
    const batch = sendable.slice(i, i + DFS_MAX_KEYWORDS)
    const metrics = await fetchKeywordMetrics(
      batch.map((k) => k.keyword),
      { deadline: opts.deadline },
    )
    await writePatches(
      db,
      batch.map((k) => {
        const m = metrics.get(k.keyword) ?? null
        if (m?.volume !== null && m?.volume !== undefined) withVolume++
        return { id: k.id, patch: metricsPatch(k, m, nowIso) }
      }),
    )
    measured += batch.length
  }
  return { requested: pending.length, measured, withVolume, skipped: refused.length }
}

/**
 * Tâche lancée à la main seulement (bouton « Lancer l'analyse »). Verrou à
 * peine plus long que la durée maximale de la route (60 s) : une analyse coupée
 * par l'hébergeur est vite montrée comme interrompue et relançable.
 */
export const keywordsMetricsTask: SeoTask = {
  name: METRICS_JOB,
  label: "SEO · Volumes des mots-clés",
  isDue: () => false,
  lockMs: 65_000,
  minBudgetMs: 0,
  run: (ctx) => analyzeKeywords(ctx.db, { now: ctx.now, deadline: ctx.deadline }),
}
