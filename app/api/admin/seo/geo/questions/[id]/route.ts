/**
 * PATCH  /api/admin/seo/geo/questions/<id> { question?, active? } → { question }
 * DELETE /api/admin/seo/geo/questions/<id>                         → { ok }
 *
 * Les réponses déjà relevées gardent une copie de la question : modifier ou supprimer
 * une question ne change pas l'historique des relevés.
 */
import { NextRequest, NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { errorPayload, must, seoDb } from "@/lib/seo/db"
import { competitorInQuestion, isUuid, parseInput, updateQuestionSchema } from "@/lib/seo/geo/questions"
import { getSettings } from "@/lib/seo/settings"
import type { GeoQuestionRow } from "@/lib/seo/geo/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> | { id: string } }

const COLUMNS = "id, question, position, active, created_at, updated_at"
const notFound = () => NextResponse.json({ error: "Question introuvable" }, { status: 404 })

export async function PATCH(request: NextRequest, { params }: Params) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  const { id } = await params
  if (!isUuid(id)) return notFound()
  const parsed = parseInput(updateQuestionSchema, await request.json().catch(() => null))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  try {
    const db = seoDb()
    if (parsed.value.question === undefined && parsed.value.active === true) {
      // Réactivation : la question repart chez les moteurs, elle ne doit nommer aucun
      // concurrent suivi (un concurrent a pu être ajouté depuis sa saisie)
      const current = must(await db.from("seo_geo_questions").select("id, question").eq("id", id).maybeSingle(), "la question") as Pick<
        GeoQuestionRow,
        "id" | "question"
      > | null
      if (!current) return notFound()
      const competitor = competitorInQuestion(current.question, (await getSettings(db, "targeting")).value.competitors)
      if (competitor) return NextResponse.json({ error: competitor }, { status: 400 })
    }
    if (parsed.value.question !== undefined) {
      const competitor = competitorInQuestion(parsed.value.question, (await getSettings(db, "targeting")).value.competitors)
      if (competitor) return NextResponse.json({ error: competitor }, { status: 400 })
      const others = (must(await db.from("seo_geo_questions").select("id, question"), "les questions suivies") ?? []) as Pick<GeoQuestionRow, "id" | "question">[]
      const text = parsed.value.question
      if (others.some((q) => q.id !== id && q.question.localeCompare(text, "fr", { sensitivity: "base" }) === 0)) {
        return NextResponse.json({ error: "Cette question est déjà suivie." }, { status: 409 })
      }
    }
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (parsed.value.question !== undefined) patch.question = parsed.value.question
    if (parsed.value.active !== undefined) patch.active = parsed.value.active
    const rows = (must(await db.from("seo_geo_questions").update(patch).eq("id", id).select(COLUMNS), "la modification de la question") ?? []) as GeoQuestionRow[]
    if (rows.length === 0) return notFound()
    return NextResponse.json({ question: rows[0] })
  } catch (error) {
    const { status, body } = errorPayload(error)
    return NextResponse.json(body, { status })
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  const { id } = await params
  if (!isUuid(id)) return notFound()
  try {
    const rows = (must(await seoDb().from("seo_geo_questions").delete().eq("id", id).select("id"), "la suppression de la question") ?? []) as { id: string }[]
    if (rows.length === 0) return notFound()
    return NextResponse.json({ ok: true })
  } catch (error) {
    const { status, body } = errorPayload(error)
    return NextResponse.json(body, { status })
  }
}
