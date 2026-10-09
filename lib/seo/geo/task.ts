/**
 * Tâche planifiée : Relevé mensuel et analyse immédiate.
 * À implémenter par le module (contrat : lib/seo/cron.ts).
 */
import type { SeoTask } from "@/lib/seo/cron"

export const geoTask: SeoTask = {
  name: "geo",
  label: "SEO · Visibilité IA",
  isDue: () => false,
  run: async () => ({}),
}
