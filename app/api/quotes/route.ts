import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

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

  // Lire ou créer la séquence
  const { data: seqRow } = await supabase
    .from("quote_sequences")
    .select("sequence")
    .eq("user_id", user.id)
    .single()

  const currentSeq = seqRow?.sequence ?? 1
  const year        = new Date().getFullYear()
  const quote_number = `D-${year}-${String(currentSeq).padStart(3, "0")}`

  // Incrémenter
  if (seqRow) {
    await supabase.from("quote_sequences").update({ sequence: currentSeq + 1 }).eq("user_id", user.id)
  } else {
    await supabase.from("quote_sequences").insert({ user_id: user.id, sequence: 2 })
  }

  // Calcul totaux
  const lines       = body.lines || []
  const subtotal_ht = lines.reduce((s: number, l: { total_ht: number }) => s + (l.total_ht || 0), 0)
  const total_vat   = lines.reduce((s: number, l: { total_vat: number }) => s + (l.total_vat || 0), 0)
  const total_ttc   = subtotal_ht + total_vat

  const { data: quote, error } = await supabase
    .from("quotes")
    .insert({
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
    })
    .select(`*, client:clients(id, name, email)`)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ quote }, { status: 201 })
}
