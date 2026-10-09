/**
 * Tâche planifiée : Constats tirés de Search Console et de l'exploration, vérification à 14 jours.
 * À implémenter par le module (contrat : lib/seo/cron.ts).
 */
import type { SeoTask } from "@/lib/seo/cron"

export const findingsTask: SeoTask = {
  name: "findings",
  label: "SEO · Actions",
  isDue: () => false,
  run: async () => ({}),
}
