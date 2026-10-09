/**
 * Tâches de /api/cron/seo, dans l'ordre d'exécution d'un passage : la
 * synchronisation de Search Console d'abord (les mots-clés et les constats
 * s'en servent), la publication des articles avant les travaux longs
 * (exploration, relevés des IA, mesures PageSpeed).
 */
import type { SeoTask } from "@/lib/seo/cron"
import { searchConsoleTask } from "@/lib/seo/search-console/task"
import { keywordsTask } from "@/lib/seo/keywords/task"
import { findingsTask } from "@/lib/seo/actions/task"
import { articlesTask } from "@/lib/seo/articles/task"
import { digestTask } from "@/lib/seo/reports/task"
import { geoTask } from "@/lib/seo/geo/task"
import { crawlTask } from "@/lib/seo/audit/task"
import { pagespeedTask } from "@/lib/seo/pagespeed/task"

export const SEO_TASKS: SeoTask[] = [
  searchConsoleTask,
  keywordsTask,
  findingsTask,
  articlesTask,
  digestTask,
  geoTask,
  crawlTask,
  pagespeedTask,
]
