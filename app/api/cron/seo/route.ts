/**
 * GET /api/cron/seo — tâches planifiées de l'onglet SEO (lib/seo/cron.ts).
 *
 * À appeler toutes les 15 minutes par cron-job.org avec
 * « Authorization: Bearer {CRON_SECRET} ». Chaque tâche décide elle-même si
 * elle est due ; `?task=<nom>` force une seule tâche (essai, rattrapage).
 *
 * cron-job.org coupe la connexion au bout de 30 secondes, alors qu'une
 * rédaction d'article ou une exploration du site dure plusieurs minutes : la
 * route répond aussitôt (202) et poursuit le travail après la réponse
 * (`waitUntil`, même durée maximale que la fonction). Le résultat de chaque
 * tâche est dans cron_logs (Santé du système). `?wait=1` attend la fin et rend
 * le détail (essai à la main avec curl).
 *
 * Tant que la migration 20261009_seo_admin.sql n'est pas appliquée, répond
 * 200 « migration_pending » sans rien faire (pas d'alerte en boucle).
 */
import { NextRequest, NextResponse } from "next/server"
import { waitUntil } from "@vercel/functions"
import { seoDb, failureOf } from "@/lib/seo/db"
import { readJob, runDueTasks } from "@/lib/seo/cron"
import { SEO_TASKS } from "@/lib/seo/tasks"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

/** Marge laissée à Vercel avant maxDuration. */
const BUDGET_MS = 270_000

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error("[cron/seo] CRON_SECRET non défini")
    return NextResponse.json({ error: "Configuration manquante" }, { status: 500 })
  }
  if (request.headers.get("Authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const only = request.nextUrl.searchParams.get("task") ?? undefined
  if (only && !SEO_TASKS.some((t) => t.name === only)) {
    return NextResponse.json({ error: `Tâche inconnue : ${only}` }, { status: 400 })
  }

  const db = seoDb()
  try {
    // Lecture d'essai : migration absente → rien à faire
    await readJob(db, "search-console")
  } catch (error) {
    if (failureOf(error) === "migration_pending") {
      return NextResponse.json({ ok: true, skipped: true, reason: "migration_pending" })
    }
    return NextResponse.json({ error: "Base injoignable" }, { status: 503 })
  }

  const run = runDueTasks(db, SEO_TASKS, { budgetMs: BUDGET_MS, only })

  if (request.nextUrl.searchParams.get("wait") === "1") {
    const results = await run
    const failed = results.filter((r) => r.status === "error")
    return NextResponse.json({ ok: failed.length === 0, results }, { status: failed.length > 0 ? 207 : 200 })
  }

  waitUntil(
    run.catch((error) => {
      console.error("[cron/seo] passage en échec", error)
    }),
  )
  return NextResponse.json({ ok: true, accepted: true, only: only ?? null }, { status: 202 })
}
