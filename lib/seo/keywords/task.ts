/**
 * Tâche planifiée « keywords » (contrat : lib/seo/cron.ts) : mesures Search
 * Console des mots-clés suivis et découverte de nouvelles requêtes
 * (lib/seo/keywords/sync.ts).
 *
 * Une fois par jour (heure de Paris), après la synchronisation de Search
 * Console : dès que la tâche « search-console » a réussi aujourd'hui, ou à
 * partir de 10 h si elle n'a pas réussi (les données de la veille suffisent).
 * Un passage interrompu par l'heure limite est repris au passage suivant.
 */
import { isDailyDue, minutesOf, parisClock, readJob, type SeoJobRow, type SeoTask } from "@/lib/seo/cron"
import { syncKeywordsFromSearchConsole } from "@/lib/seo/keywords/sync"

/** Heure à partir de laquelle la tâche tourne même si Search Console n'a pas réussi aujourd'hui. */
export const KEYWORDS_FALLBACK_TIME = "10:00"

/** Vrai si la tâche doit tourner (fonction pure, testée). */
export function keywordsDue(job: SeoJobRow | null, searchConsoleJob: SeoJobRow | null, now: Date): boolean {
  if (job?.cursor && (job.cursor as { incomplete?: unknown }).incomplete === true) return true
  if (!isDailyDue(job, now, 0)) return false
  const today = parisClock(now).day
  const gscToday = Boolean(searchConsoleJob?.last_ok_at && parisClock(new Date(searchConsoleJob.last_ok_at)).day === today)
  return gscToday || parisClock(now).minutes >= minutesOf(KEYWORDS_FALLBACK_TIME)
}

export const keywordsTask: SeoTask = {
  name: "keywords",
  label: "SEO · Mots-clés",
  async isDue({ db, now, job }) {
    const searchConsoleJob = await readJob(db, "search-console")
    return keywordsDue(job, searchConsoleJob, now)
  },
  async run(ctx) {
    const result = await syncKeywordsFromSearchConsole(ctx.db, { now: ctx.now, deadline: ctx.deadline })
    await ctx.saveCursor({ incomplete: !result.complete, day: parisClock(ctx.now).day })
    return result
  },
}
