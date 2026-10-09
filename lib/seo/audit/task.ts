/**
 * Tâche planifiée : Exploration du plan du site par paquets.
 * À implémenter par le module (contrat : lib/seo/cron.ts).
 */
import type { SeoTask } from "@/lib/seo/cron"

export const crawlTask: SeoTask = {
  name: "crawl",
  label: "SEO · Audit du site",
  isDue: () => false,
  run: async () => ({}),
}
