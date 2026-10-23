/** Une note ou une tâche : modification (texte, échéance, fait ou à faire) et suppression, limitées au compte. */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import { NOTE_COLUMNS, noteFromRow, parseNotePatch } from "@/lib/planning/notes"

export const dynamic = "force-dynamic"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: "Note introuvable" }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const parsed = parseNotePatch(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  let query = supabase.from("work_notes").update(parsed.value.update).eq("id", id).eq("user_id", user.id)
  // Cocher ou dater ne vaut que pour une tâche : une simple note n'est jamais « faite »
  if (parsed.value.taskOnly) query = query.eq("kind", "task")
  const { data, error } = await query.select(NOTE_COLUMNS).maybeSingle()
  if (error) {
    if (isMissingSchemaError(error)) return NextResponse.json({ error: "Les notes ne sont pas encore activées." }, { status: 503 })
    console.error("[notes] modification :", error.message)
    return NextResponse.json({ error: "La note n'a pas pu être modifiée. Réessayez." }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: "Note introuvable" }, { status: 404 })
  return NextResponse.json({ note: noteFromRow(data as unknown as Record<string, unknown>) })
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: "Note introuvable" }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { data, error } = await supabase.from("work_notes").delete().eq("id", id).eq("user_id", user.id).select("id")
  if (error) {
    if (isMissingSchemaError(error)) return NextResponse.json({ error: "Les notes ne sont pas encore activées." }, { status: 503 })
    console.error("[notes] suppression :", error.message)
    return NextResponse.json({ error: "La note n'a pas pu être supprimée. Réessayez." }, { status: 500 })
  }
  if (!data || data.length === 0) return NextResponse.json({ error: "Note introuvable" }, { status: 404 })
  return NextResponse.json({ ok: true })
}
