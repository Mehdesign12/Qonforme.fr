/**
 * POST /api/admin/seo/articles/jobs/<id>/step — joue la passe suivante d'une
 * rédaction (plan, rédaction, contrôle, correction, image, enregistrement),
 * une seule par appel. Réponse : { jobId, status, step, ran, label, postId,
 * error, notices, locked?, deferred? }. 409 si une autre passe tient le verrou
 * (l'écran attend puis rappelle).
 */
import { NextRequest, NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { errorPayload, seoDb } from "@/lib/seo/db"
import { ID } from "@/lib/seo/articles/input"
import { JobRefusedError, runJobStep, STEP_LABELS } from "@/lib/seo/articles/generate"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
// Une passe de rédaction (Claude Opus 5.5, 2 500 mots) peut durer plusieurs minutes
export const maxDuration = 300

type Params = { params: Promise<{ id: string }> | { id: string } }

export async function POST(_request: NextRequest, { params }: Params) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  const { id } = await params
  if (!ID.safeParse(id).success) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 })

  const started = Date.now()
  try {
    const outcome = await runJobStep(seoDb(), id, { deadline: started + 285_000 })
    const body = { ...outcome, label: STEP_LABELS[outcome.step] }
    if (outcome.locked) return NextResponse.json({ ...body, error: "Une passe est déjà en cours pour cet article." }, { status: 409 })
    return NextResponse.json(body)
  } catch (error) {
    if (error instanceof JobRefusedError) return NextResponse.json({ error: error.message }, { status: 404 })
    const { status, body } = errorPayload(error)
    return NextResponse.json(body, { status })
  }
}
