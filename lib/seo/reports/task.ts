/**
 * Tâche planifiée « digest » : résumé hebdomadaire SEO par email
 * (Paramètres › Rapports). Contrat : lib/seo/cron.ts.
 *
 * Due si le résumé est activé et :
 * - le jour choisi à partir de l'heure choisie (Paris), si la semaine ISO en
 *   cours n'a encore aucun essai (seo_digests.period_key « 2026-W41 ») ;
 * - n'importe quel jour de la même semaine, si le dernier essai a échoué ou
 *   s'est interrompu (plus de 15 minutes en « sending »), 3 essais au plus.
 * L'envoi insère d'abord la ligne de l'essai (clé unique : anti-doublon),
 * puis envoie, puis note « sent » ou « failed » (lib/seo/reports/send.ts).
 * Un seul email par passage : bien sous le budget.
 */
import type { SeoTask } from "@/lib/seo/cron"
import { SeoDbError } from "@/lib/seo/db"
import { getSettings } from "@/lib/seo/settings"
import { currentWeekKey, isDigestDue } from "@/lib/seo/reports/schedule"
import { readWeekAttempts, sendWeeklyDigest, weekDigestState } from "@/lib/seo/reports/send"

export const digestTask: SeoTask = {
  name: "digest",
  label: "SEO · Résumé hebdomadaire",
  lockMs: 3 * 60_000,
  minBudgetMs: 30_000,

  async isDue({ db, now }) {
    try {
      const { value } = await getSettings(db, "reports")
      if (!value.weeklyDigest) return false
      const state = weekDigestState(await readWeekAttempts(db, currentWeekKey(now)), now)
      if (state.kind === "none") return isDigestDue(value, now)
      return state.kind === "retry"
    } catch (error) {
      // Migration pas encore appliquée : rien à faire, sans erreur à chaque passage
      if (error instanceof SeoDbError && error.kind === "migration_pending") return false
      throw error
    }
  },

  async run({ db, now, trigger }) {
    const { value } = await getSettings(db, "reports")
    // Le cron ne part que si le résumé est activé ; un lancement manuel de l'admin passe outre
    if (trigger === "cron" && !value.weeklyDigest) return { status: "disabled" }
    const outcome = await sendWeeklyDigest(db, now)
    if (outcome.status === "failed") throw new Error(`Résumé ${outcome.periodKey} non envoyé : ${outcome.error}`)
    return { ...outcome }
  },
}
