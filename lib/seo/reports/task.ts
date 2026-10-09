/**
 * Tâche planifiée : Envoi du résumé hebdomadaire par email.
 * À implémenter par le module (contrat : lib/seo/cron.ts).
 */
import type { SeoTask } from "@/lib/seo/cron"

export const digestTask: SeoTask = {
  name: "digest",
  label: "SEO · Résumé hebdomadaire",
  isDue: () => false,
  run: async () => ({}),
}
