/**
 * Tâche planifiée : Mots-clés découverts dans Search Console, positions et impressions.
 * À implémenter par le module (contrat : lib/seo/cron.ts).
 */
import type { SeoTask } from "@/lib/seo/cron"

export const keywordsTask: SeoTask = {
  name: "keywords",
  label: "SEO · Mots-clés",
  isDue: () => false,
  run: async () => ({}),
}
