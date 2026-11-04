import { prepareLinesForSave } from "@/lib/documents/discounts"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { insertWithSequentialNumber } from "@/lib/utils/document-numbering"
import { requireArtisanAccess } from "@/lib/artisan/access"
import { hasReverseCharge } from "@/lib/artisan/reverse-charge"

// GET /api/quotes
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")

  let query = supabase
    .from("quotes")
    .select(`*, client:clients(id, name, email, city, siren)`)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (status && status !== "all") {
    query = query.eq("status", status)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ quotes: data })
}

// POST /api/quotes — crée un devis avec numérotation automatique
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const body = await request.json()

  // Autoliquidation en sous-traitance du BTP : fonction de la formule Artisan
  if (Array.isArray(body.lines) && hasReverseCharge(body.lines)) {
    const artisanBlocked = await requireArtisanAccess(supabase, user.id)
    if (artisanBlocked) return artisanBlocked
  }

  // Format attendu : "D-YYYY-NNN" — numérotation robuste (voir lib/utils/document-numbering.ts)
  const year   = new Date().getFullYear()
  const prefix = `D-${year}-`

  // Calcul totaux
  // Remises contrôlées et recalculées, totaux au centime (lib/documents/discounts.ts)
  const prepared = prepareLinesForSave(body.lines || [])
  if (!prepared.ok) return NextResponse.json({ error: prepared.error }, { status: 400 })
  const { subtotal_ht, total_vat, total_ttc } = prepared

  const { data: quote, error } = await insertWithSequentialNumber(supabase, {
    table: "quotes",
    numberColumn: "quote_number",
    userId: user.id,
    prefix,
    selectClause: `*, client:clients(id, name, email)`,
    buildRow: (quote_number) => ({
      user_id: user.id,
      client_id:   body.client_id || null,
      quote_number,
      status:      "draft",
      issue_date:  body.issue_date,
      valid_until: body.valid_until,
      lines:       prepared.lines,
      subtotal_ht,
      total_vat,
      total_ttc,
      notes: body.notes || null,
    }),
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ quote }, { status: 201 })
}
