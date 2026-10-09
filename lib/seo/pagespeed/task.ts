/**
 * Tâche planifiée : Mesure hebdomadaire des pages suivies.
 * À implémenter par le module (contrat : lib/seo/cron.ts).
 */
import type { SeoTask } from "@/lib/seo/cron"

export const pagespeedTask: SeoTask = {
  name: "pagespeed",
  label: "SEO · PageSpeed",
  isDue: () => false,
  run: async () => ({}),
}
