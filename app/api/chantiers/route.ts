/**
 * Chantiers (formule Artisan).
 *
 * GET  : liste avec la synthèse de chacun (signé, facturé, encaissé, reste à
 *        facturer, retenue) ; `available: false` tant que la migration
 *        20261003_artisan_chantiers.sql n'est pas appliquée. Toujours lisible,
 *        même sans la formule : jamais de coupure d'accès aux documents.
 * POST : crée un chantier (formule Artisan, 402 ARTISAN_REQUIRED sinon).
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { hasArtisanAccess, requireArtisanAccess } from "@/lib/artisan/access"
import { chantierSummary, parseChantierInput } from "@/lib/artisan/chantier"
import { CHANTIER_COLUMNS, documentsOfChantiers, listChantiers, ownsClient } from "@/lib/artisan/server"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import { chantierFromRow } from "@/lib/artisan/chantier"
import { todayInParis } from "@/lib/utils/paris-date"

export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  try {
    const artisan = await hasArtisanAccess(supabase, user.id)
    const list = await listChantiers(supabase, user.id)
    if ("unavailable" in list) return NextResponse.json({ available: false, artisan, chantiers: [] })
    const docs = await documentsOfChantiers(supabase, user.id, list.map((c) => c.id))
    if ("unavailable" in docs) return NextResponse.json({ available: false, artisan, chantiers: [] })
    const today = todayInParis()
    return NextResponse.json({
      available: true,
      artisan,
      today,
      chantiers: list.map((c) => ({ ...c, summary: chantierSummary(docs.get(c.id) ?? [], c, today) })),
    })
  } catch (err) {
    console.error("[chantiers] liste:", err)
    return NextResponse.json({ error: "Impossible de charger les chantiers." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const blocked = await requireArtisanAccess(supabase, user.id)
  if (blocked) return blocked

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const parsed = parseChantierInput(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  if (parsed.value.client_id && !(await ownsClient(supabase, user.id, parsed.value.client_id))) {
    return NextResponse.json({ error: "Client introuvable" }, { status: 404 })
  }

  const { data, error } = await supabase
    .from("chantiers")
    .insert({ ...parsed.value, user_id: user.id })
    .select(CHANTIER_COLUMNS)
    .single()
  if (error) {
    if (isMissingSchemaError(error)) return NextResponse.json({ error: "Les chantiers ne sont pas encore activés." }, { status: 503 })
    console.error("[chantiers] création:", error.message)
    return NextResponse.json({ error: "Le chantier n'a pas pu être créé. Réessayez." }, { status: 500 })
  }
  return NextResponse.json({ chantier: chantierFromRow(data as Record<string, unknown>) }, { status: 201 })
}
