/**
 * POST /api/admin/seo/geo/runs → 201 { run, progress }
 *
 * « Analyse immédiate » : crée un relevé (kind « immediate ») ; l'écran appelle ensuite
 * /api/admin/seo/geo/runs/<id>/step en boucle. 409 si un relevé est déjà en cours,
 * 400 si aucun moteur n'est à interroger ou aucune question n'est active.
 */
import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { errorPayload, seoDb } from "@/lib/seo/db"
import { createRun, GeoRunConflictError, GeoRunUnavailableError } from "@/lib/seo/geo/runner"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  try {
    const { run, total } = await createRun(seoDb(), "immediate")
    return NextResponse.json({ run, progress: { runId: run.id, done: 0, total, status: run.status } }, { status: 201 })
  } catch (error) {
    if (error instanceof GeoRunConflictError) {
      return NextResponse.json({ error: error.message, code: "run_in_progress", runId: error.runId }, { status: 409 })
    }
    if (error instanceof GeoRunUnavailableError) {
      return NextResponse.json({ error: error.message, code: "nothing_to_run" }, { status: 400 })
    }
    const { status, body } = errorPayload(error)
    return NextResponse.json(body, { status })
  }
}
