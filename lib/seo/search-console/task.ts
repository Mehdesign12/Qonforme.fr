/**
 * Tâche planifiée : Synchronisation quotidienne de Search Console (reprise de 16 mois au premier passage).
 * À implémenter par le module (contrat : lib/seo/cron.ts).
 */
import type { SeoTask } from "@/lib/seo/cron"

export const searchConsoleTask: SeoTask = {
  name: "search-console",
  label: "SEO · Search Console",
  isDue: () => false,
  run: async () => ({}),
}
