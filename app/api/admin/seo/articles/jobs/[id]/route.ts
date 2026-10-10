/**
 * GET /api/admin/seo/articles/jobs/<id> — état d'une rédaction (reprise de la
 * fenêtre « Générer un article ») : { jobId, status, step, label, postId,
 * error, notices }.
 */
import { NextRequest, NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { errorPayload, seoDb } from "@/lib/seo/db"
import { ID } from "@/lib/seo/articles/input"
import { readJob, STEP_LABELS } from "@/lib/seo/articles/generate"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> | { id: string } }

export async function GET(_request: NextRequest, { params }: Params) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  const { id } = await params
  if (!ID.safeParse(id).success) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 })
  try {
    const job = await readJob(seoDb(), id)
    if (!job) return NextResponse.json({ error: "Rédaction introuvable." }, { status: 404 })
    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      step: job.step,
      label: STEP_LABELS[job.step] ?? job.step,
      postId: job.post_id,
      error: job.error,
      notices: job.state?.notices ?? [],
    })
  } catch (error) {
    const { status, body } = errorPayload(error)
    return NextResponse.json(body, { status })
  }
}
