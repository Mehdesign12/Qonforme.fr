/**
 * Notes et tâches (par chantier, par client ou libres).
 *
 * GET  : `chantier_id` ou `client_id` pour une fiche ; `open=1` pour les tâches
 *        ouvertes de tout le compte (planning, tableau de bord) ; sans filtre,
 *        les notes et tâches libres les plus récentes. `available: false` tant
 *        que la migration 20261021_work_notes.sql n'est pas appliquée.
 * POST : ajoute une note ou une tâche.
 *
 * Ouvert à tous les comptes, gratuits compris : aucun mur de paiement.
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import { ownsClient } from "@/lib/artisan/server"
import { NOTE_COLUMNS, noteFromRow, parseNoteInput } from "@/lib/planning/notes"
import { todayInParis } from "@/lib/utils/paris-date"

export const dynamic = "force-dynamic"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const params = request.nextUrl.searchParams
  const chantier = params.get("chantier_id")
  const client = params.get("client_id")
  if ((chantier && !UUID.test(chantier)) || (client && !UUID.test(client))) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 })
  }

  let query = supabase.from("work_notes").select(NOTE_COLUMNS).eq("user_id", user.id)
  if (chantier) query = query.eq("chantier_id", chantier)
  else if (client) query = query.eq("client_id", client)
  if (params.get("open") === "1") query = query.eq("kind", "task").is("done_at", null)
  const { data, error } = await query.order("created_at", { ascending: false }).limit(params.get("open") === "1" ? 100 : 200)
  if (error) {
    if (isMissingSchemaError(error)) return NextResponse.json({ available: false, today: todayInParis(), notes: [] })
    console.error("[notes] liste :", error.message)
    return NextResponse.json({ error: "Impossible de charger les notes." }, { status: 500 })
  }
  return NextResponse.json(
    { available: true, today: todayInParis(), notes: (data ?? []).map((r) => noteFromRow(r as unknown as Record<string, unknown>)) },
    { headers: { "Cache-Control": "no-store" } },
  )
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const parsed = parseNoteInput(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  if (parsed.value.client_id && !(await ownsClient(supabase, user.id, parsed.value.client_id))) {
    return NextResponse.json({ error: "Client introuvable" }, { status: 404 })
  }

  const { data, error } = await supabase
    .from("work_notes")
    .insert({ ...parsed.value, user_id: user.id })
    .select(NOTE_COLUMNS)
    .single()
  if (error) {
    if (isMissingSchemaError(error)) return NextResponse.json({ error: "Les notes ne sont pas encore activées." }, { status: 503 })
    if (error.code === "23503") return NextResponse.json({ error: "Client ou chantier introuvable." }, { status: 404 })
    console.error("[notes] création :", error.message)
    return NextResponse.json({ error: "La note n'a pas pu être ajoutée. Réessayez." }, { status: 500 })
  }
  return NextResponse.json({ note: noteFromRow(data as unknown as Record<string, unknown>) }, { status: 201 })
}
