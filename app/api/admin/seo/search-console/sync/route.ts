/**
 * POST /api/admin/seo/search-console/sync — « Lancer l'analyse » de la Vue
 * d'ensemble : synchronisation de Search Console (lib/seo/search-console),
 * puis recalcul des actions SEO (tâche « findings ») avec le temps restant.
 *
 * Même verrou que le cron (lib/seo/cron.ts) : si une synchronisation tourne
 * déjà, 409 « Une analyse est déjà en cours ». Sans compte de service, la
 * synchronisation est sautée sans erreur ({ skipped: "not_configured" }).
 */
import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { errorPayload, seoDb } from "@/lib/seo/db"
import { runTask, type TaskRunResult } from "@/lib/seo/cron"
import { searchConsoleTask } from "@/lib/seo/search-console/task"
import { findingsTask } from "@/lib/seo/actions/task"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

/** Temps accordé aux deux tâches (marge de 10 s avant maxDuration). */
const BUDGET_MS = 50_000
/** En dessous, le calcul des actions attend le prochain passage du cron. */
const FINDINGS_MIN_MS = 10_000

export async function POST() {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })

  const deadline = Date.now() + BUDGET_MS
  try {
    const db = seoDb()
    const sc = await runTask(db, searchConsoleTask, { trigger: "manual", deadline })
    if (sc.status === "locked") {
      return NextResponse.json({ error: "Une analyse est déjà en cours", code: "locked" }, { status: 409 })
    }

    const results: TaskRunResult[] = [sc]
    if (findingsTask && deadline - Date.now() >= FINDINGS_MIN_MS) {
      results.push(await runTask(db, findingsTask, { trigger: "manual", deadline }))
    } else if (findingsTask) {
      results.push({ task: findingsTask.name, status: "skipped" })
    }

    const ok = results.every((r) => r.status !== "error")
    if (sc.status === "error") {
      return NextResponse.json(
        { ok: false, error: sc.error ?? "La synchronisation de Search Console a échoué.", results },
        { status: 502 },
      )
    }
    return NextResponse.json({ ok, results })
  } catch (error) {
    const { status, body } = errorPayload(error)
    return NextResponse.json(body, { status })
  }
}
