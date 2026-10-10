/**
 * POST /api/admin/seo/geo/questions { question } → 201 { question }
 *
 * Ajoute une question suivie (« Gérer le suivi ») : 10 à 300 caractères, 20 questions
 * au plus, pas de doublon, aucun concurrent suivi nommé (la question part chez les
 * moteurs IA ; les concurrents restent dans l'admin). Active dès sa création, en
 * dernière position.
 */
import { NextRequest, NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { errorPayload, must, seoDb } from "@/lib/seo/db"
import { competitorInQuestion, createQuestionSchema, MAX_GEO_QUESTIONS, parseInput } from "@/lib/seo/geo/questions"
import { getSettings } from "@/lib/seo/settings"
import type { GeoQuestionRow } from "@/lib/seo/geo/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const sameText = (a: string, b: string) => a.localeCompare(b, "fr", { sensitivity: "base" }) === 0

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  const parsed = parseInput(createQuestionSchema, await request.json().catch(() => null))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  try {
    const db = seoDb()
    const competitor = competitorInQuestion(parsed.value.question, (await getSettings(db, "targeting")).value.competitors)
    if (competitor) return NextResponse.json({ error: competitor }, { status: 400 })
    const existing = (must(await db.from("seo_geo_questions").select("id, question, position"), "les questions suivies") ?? []) as Pick<
      GeoQuestionRow,
      "id" | "question" | "position"
    >[]
    if (existing.length >= MAX_GEO_QUESTIONS) {
      return NextResponse.json({ error: `${MAX_GEO_QUESTIONS} questions au plus : supprimez-en une avant d'en ajouter.` }, { status: 400 })
    }
    if (existing.some((q) => sameText(q.question, parsed.value.question))) {
      return NextResponse.json({ error: "Cette question est déjà suivie." }, { status: 409 })
    }
    const position = existing.reduce((max, q) => Math.max(max, q.position ?? 0), 0) + 1
    const row = must(
      await db
        .from("seo_geo_questions")
        .insert({ question: parsed.value.question, position, active: true })
        .select("id, question, position, active, created_at, updated_at")
        .single(),
      "l'ajout de la question",
    ) as GeoQuestionRow
    return NextResponse.json({ question: row }, { status: 201 })
  } catch (error) {
    const { status, body } = errorPayload(error)
    return NextResponse.json(body, { status })
  }
}
