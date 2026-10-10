/**
 * POST /api/admin/seo/topics — « Ajouter un sujet » (écran Sujets) et
 * « Planifier un sujet » (calendrier, avec `schedule`).
 *
 * Corps : { title, keyword?, articleType, angle?, notes?, schedule?: { day,
 * time, publishMode } } (date et heure de Paris). Réponse 201 : { topic }.
 */
import { NextRequest, NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { errorPayload, seoDb } from "@/lib/seo/db"
import { getSettings } from "@/lib/seo/settings"
import { topicCreateSchema, zodError } from "@/lib/seo/articles/input"
import { createTopic, scheduleInstant, TopicActionError } from "@/lib/seo/articles/topics"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  const parsed = topicCreateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json(zodError(parsed.error), { status: 400 })
  const input = parsed.data
  const now = new Date()

  try {
    const db = seoDb()
    const targeting = await getSettings(db, "targeting")
    const schedule = input.schedule
      ? { at: scheduleInstant(input.schedule.day, input.schedule.time, now), publishMode: input.schedule.publishMode }
      : undefined
    const topic = await createTopic(
      db,
      { title: input.title, keyword: input.keyword ?? null, articleType: input.articleType, angle: input.angle, notes: input.notes, schedule },
      targeting.value.competitors,
      now,
    )
    return NextResponse.json({ topic }, { status: 201 })
  } catch (error) {
    if (error instanceof TopicActionError) return NextResponse.json({ error: error.message }, { status: error.status })
    const { status, body } = errorPayload(error)
    return NextResponse.json(body, { status })
  }
}
