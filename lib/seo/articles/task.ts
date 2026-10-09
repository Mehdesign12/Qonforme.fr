/**
 * Tâche planifiée : Rédaction des sujets planifiés et publication à l'heure prévue.
 * À implémenter par le module (contrat : lib/seo/cron.ts).
 */
import type { SeoTask } from "@/lib/seo/cron"

export const articlesTask: SeoTask = {
  name: "articles",
  label: "SEO · Articles",
  isDue: () => false,
  run: async () => ({}),
}
