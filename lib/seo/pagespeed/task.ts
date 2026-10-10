/**
 * Tâche planifiée : mesure hebdomadaire des pages suivies (réglages
 * « pagespeed » : liste des pages, interrupteur `weekly`).
 *
 * Le lundi à partir de 05:00 (heure de Paris), chaque page suivie est mesurée
 * sur mobile puis sur ordinateur, une mesure à la fois : une mesure Lighthouse
 * prend 20 à 40 s (jusqu'à 90 s), la tâche s'arrête avant la limite du passage
 * et reprend au suivant (curseur { week, next }). Une semaine déjà faite est
 * sautée ; une semaine manquée le lundi (cron arrêté) se rattrape dans la semaine.
 * Une mesure en échec propre à la page (erreur Lighthouse, chemin refusé) est
 * enregistrée ou notée avec son erreur et la tâche continue. Un quota atteint
 * (429) ou un service indisponible (503) arrête le passage sans avancer le
 * curseur : la tâche passe en erreur et reprend la même mesure une heure plus
 * tard, sans marquer la semaine faite.
 */
import { parisClock, type SeoJobRow, type SeoTask, type SeoTaskContext } from "@/lib/seo/cron"
import { SeoDbError } from "@/lib/seo/db"
import { getSettings, type PageSpeedSettings } from "@/lib/seo/settings"
import { measurePage, type PageSpeedRunner } from "@/lib/seo/pagespeed/measure"
import { STRATEGIES, type PageSpeedStrategy } from "@/lib/seo/pagespeed/parse"
import { addDays } from "@/lib/utils/paris-date"

/** Heure de départ du lundi (minutes après minuit, heure de Paris). */
export const WEEKLY_AFTER_MINUTES = 5 * 60
/** Temps à garder pour une mesure : délai d'attente de l'appel (90 s) et marge de 15 s. */
export const MEASURE_BUDGET_MS = 105_000
const RETRY_AFTER_ERROR_MS = 60 * 60_000

export interface PageSpeedCursor {
  /** Lundi de la semaine en cours de mesure (AAAA-MM-JJ). */
  week?: string
  /** Indice de la prochaine mesure de la liste. */
  next?: number
  /** Dernière semaine entièrement mesurée. */
  completedWeek?: string
}

export function parsePageSpeedCursor(raw: unknown): PageSpeedCursor {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const r = raw as Record<string, unknown>
  const out: PageSpeedCursor = {}
  if (typeof r.week === "string") out.week = r.week
  if (typeof r.next === "number" && Number.isInteger(r.next) && r.next >= 0) out.next = r.next
  if (typeof r.completedWeek === "string") out.completedWeek = r.completedWeek
  return out
}

/** Lundi de la semaine d'un instant (heure de Paris). */
export function weekOf(now: Date): string {
  const clock = parisClock(now)
  return addDays(clock.day, -(clock.weekday - 1))
}

/** Liste des mesures d'une semaine : chaque page sur mobile, puis sur ordinateur. */
export function weeklyItems(settings: Pick<PageSpeedSettings, "pages">): { path: string; strategy: PageSpeedStrategy }[] {
  return settings.pages.flatMap((p) => STRATEGIES.map((strategy) => ({ path: p.path, strategy })))
}

/** Vrai si la mesure de la semaine reste à faire (le lundi après 05:00, ou plus tard dans la semaine). */
export function pagespeedDue(job: SeoJobRow | null, now: Date, settings: Pick<PageSpeedSettings, "pages" | "weekly">): boolean {
  if (!settings.weekly || settings.pages.length === 0) return false
  if (job?.status === "error" && job.finished_at && now.getTime() - Date.parse(job.finished_at) < RETRY_AFTER_ERROR_MS) return false
  const clock = parisClock(now)
  if (clock.weekday === 1 && clock.minutes < WEEKLY_AFTER_MINUTES) return false
  return parsePageSpeedCursor(job?.cursor).completedWeek !== weekOf(now)
}

/** Statuts de PageSpeed qui visent le service et non la page : on réessaie plus tard. */
export function isTransientStatus(status: number | undefined): boolean {
  return status === 429 || status === 503
}

/** Passage arrêté sur quota atteint ou service indisponible (la tâche passe en erreur). */
export class PageSpeedUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PageSpeedUnavailableError"
  }
}

/** Un passage : mesures une par une jusqu'à la limite, curseur enregistré après chacune. */
export async function runWeeklyPageSpeed(ctx: SeoTaskContext, deps: { run?: PageSpeedRunner } = {}): Promise<Record<string, unknown>> {
  const settings = (await getSettings(ctx.db, "pagespeed")).value
  const week = weekOf(ctx.now)
  const items = weeklyItems(settings)
  const saved = parsePageSpeedCursor(ctx.job?.cursor)
  if (saved.completedWeek === week) return { week, skipped: "already_done" }
  const cursor: PageSpeedCursor = { ...saved, week, next: saved.week === week ? saved.next ?? 0 : 0 }

  let measured = 0
  const errors: string[] = []
  while ((cursor.next ?? 0) < items.length) {
    if (Date.now() + MEASURE_BUDGET_MS > ctx.deadline) break
    const item = items[cursor.next ?? 0]
    const label = `${item.path} (${item.strategy})`
    try {
      const outcome = await measurePage(ctx.db, item.path, item.strategy, { run: deps.run })
      measured++
      if (!outcome.ok && isTransientStatus(outcome.status)) {
        // Curseur laissé sur cette mesure : reprise dans une heure (pagespeedDue)
        throw new PageSpeedUnavailableError(`PageSpeed indisponible, nouvel essai dans une heure à partir de ${label} : ${outcome.error ?? "échec"}`)
      }
      if (!outcome.ok) errors.push(`${label} : ${outcome.error ?? "échec"}`)
    } catch (error) {
      if (error instanceof SeoDbError || error instanceof PageSpeedUnavailableError) throw error
      // Chemin refusé (hors du site) : noté, la liste continue
      errors.push(`${label} : ${error instanceof Error ? error.message : "échec"}`)
    }
    cursor.next = (cursor.next ?? 0) + 1
    await ctx.saveCursor({ ...cursor })
  }
  if ((cursor.next ?? 0) >= items.length) {
    cursor.completedWeek = week
    await ctx.saveCursor({ ...cursor })
  }
  return { week, measured, remaining: Math.max(0, items.length - (cursor.next ?? 0)), errors: errors.slice(0, 10) }
}

export const pagespeedTask: SeoTask = {
  name: "pagespeed",
  label: "SEO · PageSpeed",
  isDue: async ({ db, now, job }) => pagespeedDue(job, now, (await getSettings(db, "pagespeed")).value),
  run: (ctx) => runWeeklyPageSpeed(ctx),
  // Une mesure peut durer 90 s : pas de départ avec moins de temps devant soi
  minBudgetMs: MEASURE_BUDGET_MS,
}
