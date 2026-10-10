/**
 * PATCH /api/admin/seo/topics/<id> — actions sur un sujet, transitions
 * vérifiées côté serveur (lib/seo/articles/status.ts) :
 * - { action: "update", title, keyword?, articleType, angle?, notes? } ;
 * - { action: "schedule", day, time, publishMode? } (heure de Paris ; « Replanifier ») ;
 * - { action: "unschedule" } (« Retirer du calendrier ») ;
 * - { action: "draft" } (« Rédiger maintenant » : crée la rédaction, rend jobId) ;
 * - { action: "retry" } (« Réessayer » un sujet en échec) ;
 * - { action: "archive" } / { action: "restore" }.
 * Réponse : { topic, jobId? } ; 409 si l'action n'est pas permise dans l'état du sujet.
 */
import { NextRequest, NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { errorPayload, seoDb } from "@/lib/seo/db"
import { ID, topicPatchSchema, zodError } from "@/lib/seo/articles/input"
import { patchTopic, scheduleInstant, TopicActionError, type TopicPatch } from "@/lib/seo/articles/topics"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> | { id: string } }

export async function PATCH(request: NextRequest, { params }: Params) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  const { id } = await params
  if (!ID.safeParse(id).success) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 })
  const parsed = topicPatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json(zodError(parsed.error), { status: 400 })
  const input = parsed.data
  const now = new Date()

  try {
    let patch: TopicPatch
    switch (input.action) {
      case "update":
        patch = { action: "update", title: input.title, keyword: input.keyword ?? null, articleType: input.articleType, angle: input.angle, notes: input.notes }
        break
      case "schedule":
        patch = { action: "schedule", at: scheduleInstant(input.day, input.time, now), publishMode: input.publishMode }
        break
      default:
        patch = { action: input.action }
    }
    const result = await patchTopic(seoDb(), id, patch, { now })
    return NextResponse.json({ topic: result.topic, jobId: result.job?.id ?? null })
  } catch (error) {
    if (error instanceof TopicActionError) return NextResponse.json({ error: error.message }, { status: error.status })
    const { status, body } = errorPayload(error)
    return NextResponse.json(body, { status })
  }
}
