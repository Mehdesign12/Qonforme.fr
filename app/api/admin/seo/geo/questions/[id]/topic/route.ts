/**
 * POST /api/admin/seo/geo/questions/<id>/topic → 201 { topic } (ou 200 { topic, existed: true })
 *
 * « Créer un sujet » depuis le détail d'une question : un sujet d'article à planifier
 * (seo_topics, source « visibility », type FAQ), titré par la question. Un sujet déjà
 * créé pour la question (archivé compris : il se restaure dans Articles › Sujets) est
 * rendu tel quel, sans doublon, même pour deux demandes simultanées.
 * Le sujet ne contient que la question : aucun concurrent n'est transmis.
 */
import { NextRequest, NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { errorPayload, must, seoDb } from "@/lib/seo/db"
import { readTopicForQuestion } from "@/lib/seo/geo/data"
import { competitorInQuestion, isUuid } from "@/lib/seo/geo/questions"
import { getSettings } from "@/lib/seo/settings"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> | { id: string } }

export async function POST(_request: NextRequest, { params }: Params) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: "Question introuvable" }, { status: 404 })
  try {
    const db = seoDb()
    const question = must(await db.from("seo_geo_questions").select("id, question").eq("id", id).maybeSingle(), "la question") as {
      id: string
      question: string
    } | null
    if (!question) return NextResponse.json({ error: "Question introuvable" }, { status: 404 })

    // Un sujet d'article ne contient jamais un concurrent (lib/seo/competitors.ts)
    const competitor = competitorInQuestion(question.question, (await getSettings(db, "targeting")).value.competitors)
    if (competitor) return NextResponse.json({ error: competitor }, { status: 400 })

    const existing = await readTopicForQuestion(db, id)
    if (existing) return NextResponse.json({ topic: existing, existed: true })

    const inserted = await db
      .from("seo_topics")
      .insert({ title: question.question, source: "visibility", geo_question_id: id, article_type: "faq", status: "unplanned" })
      .select("id, title, status")
      .single()
    // Index unique seo_topics_one_per_geo_question (section 12 de la migration) : deux
    // demandes simultanées ne créent qu'un sujet, la seconde reçoit celui de la première.
    if (inserted.error?.code === "23505") {
      const winner = await readTopicForQuestion(db, id)
      if (winner) return NextResponse.json({ topic: winner, existed: true })
    }
    const topic = must(inserted, "la création du sujet")
    return NextResponse.json({ topic }, { status: 201 })
  } catch (error) {
    const { status, body } = errorPayload(error)
    return NextResponse.json(body, { status })
  }
}
