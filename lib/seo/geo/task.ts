/**
 * Tâche planifiée « geo » (contrat : lib/seo/cron.ts) : relevé mensuel de la visibilité IA
 * et suite d'une analyse immédiate.
 *
 * Due quand un relevé attend ou tourne (pour le finir), ou quand le relevé mensuel du mois
 * n'existe pas encore : à partir du jour `geo.dayOfMonth` après 06:00 (heure de Paris).
 * Un passage manqué ce jour-là (panne, clé ajoutée plus tard) est rattrapé les jours
 * suivants du même mois. Sans moteur allumé et configuré, ou sans question active, la
 * tâche ne se déclenche pas (aucune erreur répétée toutes les 15 minutes).
 */
import { must, type SeoDb } from "@/lib/seo/db"
import { parisClock, type SeoTask } from "@/lib/seo/cron"
import { getSettings } from "@/lib/seo/settings"
import { parisDayOf } from "@/lib/utils/paris-date"
import { activeRun, createRun, GeoRunConflictError, GeoRunUnavailableError, processPending, runnableEngines } from "@/lib/seo/geo/runner"

/** Heure du relevé mensuel (Paris). */
export const MONTHLY_AFTER_MINUTES = 6 * 60

/** Vrai si le relevé mensuel doit être créé maintenant (lecture seule). */
export async function monthlyDue(db: SeoDb, now: Date): Promise<boolean> {
  const geo = (await getSettings(db, "geo")).value
  const clock = parisClock(now)
  if (clock.dayOfMonth < geo.dayOfMonth) return false
  if (clock.dayOfMonth === geo.dayOfMonth && clock.minutes < MONTHLY_AFTER_MINUTES) return false

  const last = must(
    await db.from("seo_geo_runs").select("created_at").eq("kind", "monthly").order("created_at", { ascending: false }).limit(1),
    "les relevés mensuels",
  ) as { created_at: string }[] | null
  const lastMonth = last?.[0] ? parisDayOf(last[0].created_at).slice(0, 7) : null
  if (lastMonth === clock.day.slice(0, 7)) return false

  if (runnableEngines(geo.engines).length === 0) return false
  const questions = must(
    await db.from("seo_geo_questions").select("id").eq("active", true).limit(1),
    "les questions suivies",
  ) as { id: string }[] | null
  return (questions?.length ?? 0) > 0
}

export const geoTask: SeoTask = {
  name: "geo",
  label: "SEO · Visibilité IA",
  // Un appel de moteur peut durer 90 s : inutile de démarrer avec moins de 45 s
  minBudgetMs: 45_000,
  async isDue({ db, now }) {
    if (await activeRun(db)) return true
    return monthlyDue(db, now)
  },
  async run(ctx) {
    let created: string | null = null
    if (!(await activeRun(ctx.db)) && (await monthlyDue(ctx.db, ctx.now))) {
      try {
        created = (await createRun(ctx.db, "monthly", { now: ctx.now })).run.id
      } catch (error) {
        if (error instanceof GeoRunUnavailableError) return { skipped: error.message }
        // Une « Analyse immédiate » créée entre-temps : elle est traitée ci-dessous, le
        // relevé mensuel sera créé à un passage suivant, une fois celle-ci terminée.
        if (!(error instanceof GeoRunConflictError)) throw error
      }
    }
    const res = await processPending(ctx.db, { stopAt: ctx.deadline - 15_000 })
    return { created, ...res }
  },
}
