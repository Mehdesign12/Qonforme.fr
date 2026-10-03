/**
 * Un chantier (formule Artisan).
 *
 * GET    : chantier, documents rattachés et synthèse (lecture toujours possible).
 * PATCH  : modification (formule Artisan) ; `retention_released_at` note la
 *          libération de la retenue de garantie (date, ou null pour l'annuler).
 * DELETE : supprime le chantier ; ses documents sont seulement détachés
 *          (ON DELETE SET NULL), jamais supprimés.
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { hasArtisanAccess, requireArtisanAccess } from "@/lib/artisan/access"
import { chantierFromRow, chantierSummary, parseChantierInput } from "@/lib/artisan/chantier"
import { CHANTIER_COLUMNS, documentsOfChantiers, getChantier, ownsClient } from "@/lib/artisan/server"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import { todayInParis } from "@/lib/utils/paris-date"

export const dynamic = "force-dynamic"

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  const { id } = await params

  try {
    const chantier = await getChantier(supabase, user.id, id)
    if (!chantier) return NextResponse.json({ error: "Chantier introuvable" }, { status: 404 })
    if ("unavailable" in chantier) return NextResponse.json({ available: false })
    const docs = await documentsOfChantiers(supabase, user.id, [id])
    if ("unavailable" in docs) return NextResponse.json({ available: false })
    const today = todayInParis()
    const documents = docs.get(id) ?? []
    const artisan = await hasArtisanAccess(supabase, user.id)
    return NextResponse.json({ available: true, artisan, today, chantier, documents, summary: chantierSummary(documents, chantier, today) })
  } catch (err) {
    console.error("[chantiers] lecture:", err)
    return NextResponse.json({ error: "Impossible de charger le chantier." }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const blocked = await requireArtisanAccess(supabase, user.id)
  if (blocked) return blocked

  const { id } = await params
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const parsed = parseChantierInput(body, true)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const update: Record<string, unknown> = { ...parsed.value }

  if (body.retention_released_at !== undefined) {
    const v = body.retention_released_at
    if (v !== null && !(typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v))) {
      return NextResponse.json({ error: "Date de libération invalide." }, { status: 400 })
    }
    update.retention_released_at = v
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "Rien à modifier" }, { status: 400 })
  if (typeof update.client_id === "string" && !(await ownsClient(supabase, user.id, update.client_id))) {
    return NextResponse.json({ error: "Client introuvable" }, { status: 404 })
  }

  const { data, error } = await supabase
    .from("chantiers")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id)
    .select(CHANTIER_COLUMNS)
    .maybeSingle()
  if (error) {
    if (isMissingSchemaError(error)) return NextResponse.json({ error: "Les chantiers ne sont pas encore activés." }, { status: 503 })
    if (error.code === "23514") return NextResponse.json({ error: "Valeurs incohérentes (dates ou taux de retenue)." }, { status: 400 })
    console.error("[chantiers] modification:", error.message)
    return NextResponse.json({ error: "Le chantier n'a pas pu être modifié. Réessayez." }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: "Chantier introuvable" }, { status: 404 })
  return NextResponse.json({ chantier: chantierFromRow(data as Record<string, unknown>) })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  const { id } = await params

  const { data, error } = await supabase.from("chantiers").delete().eq("id", id).eq("user_id", user.id).select("id").maybeSingle()
  if (error) {
    if (isMissingSchemaError(error)) return NextResponse.json({ error: "Les chantiers ne sont pas encore activés." }, { status: 503 })
    console.error("[chantiers] suppression:", error.message)
    return NextResponse.json({ error: "Le chantier n'a pas pu être supprimé. Réessayez." }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: "Chantier introuvable" }, { status: 404 })
  return NextResponse.json({ success: true })
}
