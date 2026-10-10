/**
 * Mesure des actions faites à 14 jours (tâche « findings ») : lit Search
 * Console avant et après, enregistre le verdict et l'ajoute à l'historique.
 * Calculs purs : lib/seo/actions/verdict.ts.
 */
import type { SeoDb } from "@/lib/seo/db"
import { must } from "@/lib/seo/db"
import type { DateRange } from "@/lib/seo/period"
import { ctrOf } from "@/lib/seo/format"
import { readPageStats } from "@/lib/seo/actions/gsc"
import { appendHistory, type FindingHistoryEntry } from "@/lib/seo/actions/history"
import { readAllRows } from "@/lib/seo/actions/paginate"
import {
  afterWindow,
  beforeWindow,
  readVerification,
  VERDICTS,
  verdictOf,
  windowLine,
  type Verification,
  type WindowMetrics,
} from "@/lib/seo/actions/verdict"

export * from "@/lib/seo/actions/verdict"

/** Mesures d'une page sur une fenêtre ; `cache` évite de relire la même fenêtre pour plusieurs constats. */
export async function measurePage(
  db: SeoDb,
  path: string,
  range: DateRange,
  cache: Map<string, Promise<Record<string, { clicks: number; impressions: number; position: number | null }>>> = new Map(),
): Promise<WindowMetrics> {
  const key = `${range.from}|${range.to}`
  let stats = cache.get(key)
  if (!stats) {
    stats = readPageStats(db, range.from, range.to)
    cache.set(key, stats)
  }
  const s = (await stats)[path]
  const clicks = s?.clicks ?? 0
  const impressions = s?.impressions ?? 0
  return { from: range.from, to: range.to, clicks, impressions, ctr: ctrOf(clicks, impressions), position: s?.position ?? null }
}

/**
 * Mesure les actions faites dont la date de vérification est passée et dont
 * Search Console couvre déjà les 14 jours suivants. Rend le nombre de constats vérifiés.
 */
export async function verifyDueFindings(db: SeoDb, opts: { now: Date; lastDataDay: string; deadline?: number }): Promise<number> {
  // Toutes les actions échues, sur un ordre unique : celles déjà mesurées sont sautées
  // plus bas ; une limite fixe les relirait seules et n'atteindrait jamais les suivantes.
  const rows = await readAllRows<{ id: string; path: string; done_at: string | null; verify_after: string | null; verification: unknown; history: unknown }>(
    (from, to) =>
      db
        .from("seo_findings")
        .select("id, path, done_at, verify_after, verification, history")
        .eq("status", "done")
        .lte("verify_after", opts.now.toISOString())
        .order("verify_after", { ascending: true })
        .order("id")
        .range(from, to),
    "les actions à vérifier",
  )

  const cache = new Map<string, Promise<Record<string, { clicks: number; impressions: number; position: number | null }>>>()
  let verified = 0
  for (const row of rows) {
    if (opts.deadline && Date.now() > opts.deadline) break
    if (!row.done_at) continue
    const current = readVerification(row.verification)
    if (current?.after) continue
    const after = afterWindow(row.done_at)
    if (opts.lastDataDay < after.to) continue // Search Console n'a pas encore les 14 jours suivants

    const before = current?.before ?? (await measurePage(db, row.path, beforeWindow(row.done_at, opts.lastDataDay), cache))
    const afterMetrics = await measurePage(db, row.path, after, cache)
    const verdict = verdictOf(before, afterMetrics)
    const at = opts.now.toISOString()
    const verification: Verification = { before, after: afterMetrics, verdict, measuredAt: at }
    const entry: FindingHistoryEntry = { at, event: "verified", note: `${VERDICTS[verdict].label} : ${windowLine(afterMetrics)} (avant : ${windowLine(before)})` }
    must(
      await db.from("seo_findings").update({ verification, history: appendHistory(row.history, entry) }).eq("id", row.id).eq("status", "done"),
      "la vérification d'une action",
    )
    verified++
  }
  return verified
}
