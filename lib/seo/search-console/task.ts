/**
 * Tâche planifiée : synchronisation quotidienne de Search Console, avec la
 * reprise de 16 mois d'historique au premier lancement (lib/seo/search-console/sync.ts).
 *
 * - Due à chaque passage du cron tant que la reprise n'est pas finie, puis
 *   une fois par jour après 06:00 (heure de Paris).
 * - Sans compte de service (GOOGLE_SERVICE_ACCOUNT_JSON), jamais due ; lancée à
 *   la main, elle rend { skipped: "not_configured" } sans erreur.
 */
import type { SeoTask } from "@/lib/seo/cron"
import { isConfigured } from "@/lib/seo/connections"
import { runSearchConsoleSync, searchConsoleDue } from "@/lib/seo/search-console/sync"

export const searchConsoleTask: SeoTask = {
  name: "search-console",
  label: "SEO · Search Console",
  isDue: ({ now, job }) => searchConsoleDue(job, now, isConfigured("search_console")),
  run: (ctx) => runSearchConsoleSync(ctx, { configured: isConfigured("search_console") }),
}
