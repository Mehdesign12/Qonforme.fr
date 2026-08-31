import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { insertWithSequentialNumber } from "@/lib/utils/document-numbering"

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

  // Format attendu : "D-YYYY-NNN" — numérotation robuste (voir lib/utils/document-numbering.ts)
  const year   = new Date().getFullYear()
  const prefix = `D-${year}-`

  // Calcul totaux
  const lines       = body.lines || []
  const subtotal_ht = lines.reduce((s: number, l: { total_ht: number }) => s + (l.total_ht || 0), 0)
  const total_vat   = lines.reduce((s: number, l: { total_vat: number }) => s + (l.total_vat || 0), 0)
  const total_ttc   = subtotal_ht + total_vat

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
      lines:       body.lines,
      subtotal_ht,
      total_vat,
      total_ttc,
      notes: body.notes || null,
    }),
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ quote }, { status: 201 })
}
