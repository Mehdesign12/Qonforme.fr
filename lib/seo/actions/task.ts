/**
 * Tâche planifiée : constats tirés de Search Console et de l'exploration,
 * vérification des actions faites à 14 jours (contrat : lib/seo/cron.ts).
 *
 * Due après chaque synchronisation de Search Console (tâche « search-console »)
 * et après chaque exploration terminée ; sinon une fois par jour à partir de
 * 09:00 (Paris). Sans données Search Console, seules les règles d'exploration
 * s'appliquent. Passage court (quelques lectures et écritures), sans curseur.
 */
import { readJob, type SeoTask } from "@/lib/seo/cron"
import { latestDoneRun } from "@/lib/seo/audit/crawler"
import { isFindingsDue, refreshFindings } from "@/lib/seo/actions/refresh"

export const findingsTask: SeoTask = {
  name: "findings",
  label: "SEO · Actions",
  isDue: async ({ db, now, job }) => {
    const [searchConsole, crawl] = await Promise.all([readJob(db, "search-console"), latestDoneRun(db)])
    return isFindingsDue({ job, now, searchConsoleOkAt: searchConsole?.last_ok_at ?? null, crawlFinishedAt: crawl?.finished_at ?? null })
  },
  run: async (ctx) => refreshFindings(ctx.db, { now: ctx.now, deadline: ctx.deadline - 15_000 }),
}
