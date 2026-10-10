/**
 * Passage des Actions SEO : évalue les règles sur Search Console (28 derniers
 * jours disponibles et les 28 précédents) et sur la dernière exploration
 * terminée, met à jour les constats, puis mesure les actions faites depuis
 * 14 jours. Appelé par la tâche « findings » et à la fin d'une exploration
 * lancée depuis l'admin.
 */
import type { SeoDb } from "@/lib/seo/db"
import type { SeoJobRow } from "@/lib/seo/cron"
import { parisClock } from "@/lib/seo/cron"
import { resolvePeriod } from "@/lib/seo/period"
import { getSettings } from "@/lib/seo/settings"
import { readSummary } from "@/lib/seo/audit/checks"
import { latestDoneRun, readCrawlPages } from "@/lib/seo/audit/crawler"
import { readGscBounds, readPageStats, readQueriesByPage } from "@/lib/seo/actions/gsc"
import { evaluateRuleSet, evaluatedRules, type CrawlInput, type GscInput } from "@/lib/seo/actions/rules"
import { applyFindingSync, loadExistingFindings, planFindingSync } from "@/lib/seo/actions/sync"
import { verifyDueFindings } from "@/lib/seo/actions/verify"

/** Heure après laquelle le passage quotidien a lieu même sans nouvelle synchronisation de Search Console. */
export const FINDINGS_DAILY_AFTER_MINUTES = 9 * 60

/**
 * Vrai si les constats doivent être recalculés : une exploration a fini
 * depuis le dernier passage, Search Console a été synchronisée depuis, ou
 * aucun passage aujourd'hui (heure de Paris) et 09:00 est passé.
 */
export function isFindingsDue(input: {
  job: Pick<SeoJobRow, "last_ok_at"> | null
  now: Date
  searchConsoleOkAt: string | null
  crawlFinishedAt: string | null
}): boolean {
  const lastOk = input.job?.last_ok_at ? Date.parse(input.job.last_ok_at) : null
  const after = (iso: string | null) => Boolean(iso) && (lastOk === null || Date.parse(iso as string) > lastOk)
  if (after(input.crawlFinishedAt)) return true
  if (input.searchConsoleOkAt && after(input.searchConsoleOkAt)) return true
  const clock = parisClock(input.now)
  const ranToday = lastOk !== null && parisClock(new Date(lastOk)).day === clock.day
  return !ranToday && clock.minutes >= FINDINGS_DAILY_AFTER_MINUTES
}

export interface RefreshResult {
  [key: string]: unknown
  gsc: boolean
  crawlRunId: string | null
  candidates: number
  inserted: number
  updated: number
  resolved: number
  snoozed: number
  verified: number
}

export async function refreshFindings(db: SeoDb, opts: { now: Date; deadline?: number }): Promise<RefreshResult> {
  const { now } = opts
  const bounds = await readGscBounds(db)

  let gsc: GscInput | null = null
  if (bounds.last) {
    const period = resolvePeriod("28j", bounds.last, now)
    const [current, previous, queries] = await Promise.all([
      readPageStats(db, period.current.from, period.current.to),
      readPageStats(db, period.previous.from, period.previous.to),
      readQueriesByPage(db, period.current.from, period.current.to),
    ])
    gsc = { current, previous, queries, period: { current: period.current, previous: period.previous } }
  }

  let crawl: CrawlInput | null = null
  const run = await latestDoneRun(db)
  if (run) {
    const pages = await readCrawlPages(db, run.id, "path, status_code, redirect_to, title, description, h1_count, canonical, robots, noindex, issues, error")
    crawl = { runId: run.id, finishedAt: run.finished_at, pages, summary: readSummary(run.summary) }
  }

  const targeting = (await getSettings(db, "targeting")).value
  const evaluation = evaluateRuleSet({ gsc, crawl, brandTerms: targeting.brandTerms, competitors: targeting.competitors })
  const candidates = evaluation.chosen
  const existing = await loadExistingFindings(db, now)
  const plan = planFindingSync(existing, candidates, {
    now,
    evaluatedRules: evaluatedRules({ gsc: Boolean(gsc), crawl }),
    valid: evaluation.valid,
    isEvaluated: evaluation.isEvaluated,
    outOfScope: evaluation.outOfScope,
  })
  const applied = await applyFindingSync(db, plan, now)

  const verified = bounds.last ? await verifyDueFindings(db, { now, lastDataDay: bounds.last, deadline: opts.deadline }) : 0

  return { gsc: Boolean(gsc), crawlRunId: run?.id ?? null, candidates: candidates.length, ...applied, verified }
}
