/**
 * Tâche planifiée : exploration du plan du site par paquets (contrat : lib/seo/cron.ts).
 *
 * - Cron : due le lundi à partir de 03:00 (Paris) si aucune exploration n'a fini
 *   cette semaine, ou tant qu'une exploration est en cours (elle la poursuit).
 * - Bouton « Ré-analyser le site » : `params.start` crée l'exploration si
 *   aucune n'est en cours ; sans `start`, ne fait que poursuivre.
 *
 * Rend la main 15 s avant `ctx.deadline` ; l'avancement vit dans le curseur
 * de l'exploration (seo_crawl_runs.cursor).
 */
import type { SeoTask } from "@/lib/seo/cron"
import { advanceCrawl, failRun, findRunningRun, isCrawlDue, isStale, listRuns, startCrawl } from "@/lib/seo/audit/crawler"

/** Marge avant `ctx.deadline` (contrat des tâches). */
export const CRAWL_SAFETY_MS = 15_000

export const crawlTask: SeoTask = {
  name: "crawl",
  label: "SEO · Audit du site",
  minBudgetMs: 25_000,
  isDue: async ({ db, now }) => isCrawlDue(await listRuns(db, 10), now),
  run: async (ctx) => {
    let run = await findRunningRun(ctx.db)
    if (run && isStale(run, ctx.now)) {
      await failRun(ctx.db, run.id, "Exploration interrompue : elle n'a pas pu finir en 24 h.")
      run = null
    }
    if (!run) {
      if (ctx.trigger === "manual" && ctx.params?.start !== true) {
        const last = (await listRuns(ctx.db, 1))[0]
        return { status: "idle", runId: last?.id ?? null }
      }
      run = await startCrawl(ctx.db, { trigger: ctx.trigger, now: ctx.now })
      if (run.status !== "running") return { status: run.status, runId: run.id, error: run.error }
    }
    await ctx.saveCursor({ runId: run.id })
    const progress = await advanceCrawl(ctx.db, run, { stopAt: ctx.deadline - CRAWL_SAFETY_MS })
    return { status: progress.status, runId: progress.id, pagesDone: progress.pagesDone, pagesTotal: progress.pagesTotal }
  },
}
