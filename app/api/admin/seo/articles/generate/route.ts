/**
 * POST /api/admin/seo/articles/generate — fenêtre « Générer un article ».
 *
 * Corps : { topicId? | title, keyword?, articleType, angle?, lengthMin,
 * lengthMax, publication: "draft" | "schedule" | "after_check", day?, time? }.
 * Crée le sujet s'il est saisi, fixe son mode de publication (et sa date pour
 * « Planifier »), puis crée la rédaction. Réponse : { jobId, topicId }.
 * L'écran joue ensuite les passes une à une
 * (POST /api/admin/seo/articles/jobs/<id>/step) ; fermer la fenêtre n'annule
 * rien, la tâche planifiée termine la rédaction.
 */
import { NextRequest, NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { errorPayload, must, seoDb } from "@/lib/seo/db"
import { generateSchema, zodError } from "@/lib/seo/articles/input"
import { createJob, JobRefusedError, loadGenerationContext, readTopic } from "@/lib/seo/articles/generate"
import { createTopic, scheduleInstant, TopicActionError } from "@/lib/seo/articles/topics"
import { canApplyTopicAction, TOPIC_COLUMNS, type TopicRow } from "@/lib/seo/articles/status"
import type { PublishMode } from "@/lib/seo/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })

  const parsed = generateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json(zodError(parsed.error), { status: 400 })
  const input = parsed.data
  const now = new Date()

  try {
    const db = seoDb()
    const ctx = await loadGenerationContext(db)
    const mode: PublishMode = input.publication === "draft" ? "draft" : "after_check"
    const scheduledAt = input.publication === "schedule" ? scheduleInstant(input.day!, input.time!, now) : null

    let topic = input.topicId ? await readTopic(db, input.topicId) : null
    if (input.topicId && !topic) return NextResponse.json({ error: "Sujet introuvable." }, { status: 404 })
    if (!topic) {
      topic = await createTopic(db, { title: input.title!, keyword: input.keyword ?? null, articleType: input.articleType, angle: input.angle }, ctx.competitors, now)
    }
    if (!canApplyTopicAction(topic.status, "draft")) {
      return NextResponse.json({ error: "Ce sujet est déjà rédigé ou en cours de rédaction." }, { status: 409 })
    }

    // Le type et le mot-clé choisis dans la fenêtre l'emportent ; la date et le mode suivent le choix « Publication »
    const updated = must(
      await db
        .from("seo_topics")
        .update({
          article_type: input.articleType,
          ...(input.keyword !== undefined ? { keyword: input.keyword || null } : {}),
          publish_mode: mode,
          scheduled_at: scheduledAt,
          updated_at: now.toISOString(),
        })
        .eq("id", topic.id)
        .select(TOPIC_COLUMNS)
        .single(),
      "le sujet",
    ) as TopicRow

    const { job } = await createJob(db, updated, ctx, {
      now,
      overrides: { lengthMin: input.lengthMin, lengthMax: input.lengthMax, angle: input.angle ?? "varied" },
    })
    return NextResponse.json({ jobId: job.id, topicId: topic.id, step: job.step, status: job.status })
  } catch (error) {
    if (error instanceof TopicActionError) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof JobRefusedError) return NextResponse.json({ error: error.message }, { status: 400 })
    const { status, body } = errorPayload(error)
    return NextResponse.json(body, { status })
  }
}
