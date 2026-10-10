/**
 * POST /api/admin/seo/geo/runs/<id>/step → { done, total, status }
 *
 * Traite les réponses en attente du relevé pendant environ 45 s (appels bornés à 50 s
 * pour tenir dans maxDuration), puis rend la progression. L'écran rappelle tant que le
 * relevé n'est pas terminé ; s'il est fermé, la tâche planifiée finit le reste.
 */
import { NextRequest, NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { errorPayload, seoDb } from "@/lib/seo/db"
import { isUuid } from "@/lib/seo/geo/questions"
import { processPending, runProgress } from "@/lib/seo/geo/runner"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

/** Fin des appels de moteur (ms après le début de la requête). */
const STEP_BUDGET_MS = 50_000

type Params = { params: Promise<{ id: string }> | { id: string } }

export async function POST(_request: NextRequest, { params }: Params) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: "Relevé introuvable" }, { status: 404 })
  const started = Date.now()
  try {
    const db = seoDb()
    const before = await runProgress(db, id)
    if (!before) return NextResponse.json({ error: "Relevé introuvable" }, { status: 404 })
    if (before.status === "queued" || before.status === "running") {
      await processPending(db, { stopAt: started + STEP_BUDGET_MS, runId: id })
    }
    const after = (await runProgress(db, id)) ?? before
    return NextResponse.json({ done: after.done, total: after.total, status: after.status })
  } catch (error) {
    const { status, body } = errorPayload(error)
    return NextResponse.json(body, { status })
  }
}
