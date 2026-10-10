/**
 * Exploration lancée depuis l'admin (« Ré-analyser le site ») : un paquet de
 * pages par requête, par la même tâche que le cron (verrou commun : jamais
 * deux passages en même temps). Quand l'exploration se termine dans la
 * requête, les constats sont recalculés aussitôt.
 */
import type { SeoDb } from "@/lib/seo/db"
import { runTask } from "@/lib/seo/cron"
import { crawlTask } from "@/lib/seo/audit/task"
import { getRun, listRuns, progressOf, type CrawlProgress } from "@/lib/seo/audit/crawler"
import { findingsTask } from "@/lib/seo/actions/task"

/** Budget d'une requête (maxDuration de la route : 60 s). */
export const MANUAL_BUDGET_MS = 50_000

export type ManualCrawlOutcome =
  | { ok: true; run: CrawlProgress | null; findings: { inserted: number; resolved: number } | null }
  | { ok: false; status: 409 | 503; error: string; code: string }

export async function runManualCrawl(db: SeoDb, opts: { start: boolean; startedAt?: number }): Promise<ManualCrawlOutcome> {
  const startedAt = opts.startedAt ?? Date.now()
  const result = await runTask(db, crawlTask, {
    trigger: "manual",
    deadline: startedAt + MANUAL_BUDGET_MS,
    params: { start: opts.start },
    // Un seul passage journalisé par analyse : le lancement (les suites seraient du bruit dans Santé du système).
    log: opts.start,
  })
  if (result.status === "locked") {
    return {
      ok: false,
      status: 409,
      code: "locked",
      error: "Une analyse du site est déjà en cours dans la tâche planifiée. Elle se poursuit seule : rouvrez la page dans quelques minutes.",
    }
  }
  if (result.status !== "ok") {
    return { ok: false, status: 503, code: "crawl_failed", error: "L'analyse du site n'a pas pu avancer. Réessayez dans un instant." }
  }

  const runId = typeof result.result?.runId === "string" ? result.result.runId : null
  const run = runId ? await getRun(db, runId) : (await listRuns(db, 1))[0] ?? null

  let findings: { inserted: number; resolved: number } | null = null
  if (run?.status === "done" && result.result?.status === "done" && Date.now() < startedAt + MANUAL_BUDGET_MS - 5_000) {
    const f = await runTask(db, findingsTask, { trigger: "manual", deadline: startedAt + MANUAL_BUDGET_MS + 5_000 })
    if (f.status === "ok" && f.result) findings = { inserted: Number(f.result.inserted) || 0, resolved: Number(f.result.resolved) || 0 }
  }
  return { ok: true, run: run ? progressOf(run) : null, findings }
}
