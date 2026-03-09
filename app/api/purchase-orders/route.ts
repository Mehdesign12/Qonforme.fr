import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET /api/purchase-orders — liste les bons de commande de l'utilisateur
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")

  let query = supabase
    .from("purchase_orders")
    .select(`*, client:clients(id, name, email, city, siren)`)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (status && status !== "all") {
    query = query.eq("status", status)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ purchase_orders: data })
}

// POST /api/purchase-orders — crée un bon de commande avec numérotation automatique
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const body = await request.json()

  // Validation minimale
  if (!body.client_id)  return NextResponse.json({ error: "Client requis" },          { status: 400 })
  if (!body.issue_date) return NextResponse.json({ error: "Date d'émission requise" }, { status: 400 })
  if (!body.lines?.length) return NextResponse.json({ error: "Au moins une ligne requise" }, { status: 400 })

  // ── Numérotation robuste : BC-YYYY-NNN ──
  const year   = new Date().getFullYear()
  const prefix = `BC-${year}-`

  const { data: existing } = await supabase
    .from("purchase_orders")
    .select("po_number")
    .eq("user_id", user.id)
    .like("po_number", `${prefix}%`)
    .order("po_number", { ascending: false })
    .limit(1)

  let nextSeq = 1
  if (existing && existing.length > 0) {
    const parts   = existing[0].po_number.split("-")
    const lastSeq = parseInt(parts[parts.length - 1], 10)
    if (!isNaN(lastSeq)) nextSeq = lastSeq + 1
  }

  const po_number = `${prefix}${String(nextSeq).padStart(3, "0")}`

  // Calcul des totaux
  const lines       = body.lines || []
  const subtotal_ht = lines.reduce((s: number, l: { total_ht: number }) => s + (l.total_ht || 0), 0)
  const total_vat   = lines.reduce((s: number, l: { total_vat: number }) => s + (l.total_vat || 0), 0)
  const total_ttc   = subtotal_ht + total_vat

  const { data: po, error } = await supabase
    .from("purchase_orders")
    .insert({
      user_id:       user.id,
      client_id:     body.client_id,
      po_number,
      status:        "draft",
      issue_date:    body.issue_date,
      delivery_date: body.delivery_date || null,
      reference:     body.reference?.trim() || null,
      lines:         body.lines,
      subtotal_ht,
      total_vat,
      total_ttc,
      notes:         body.notes || null,
    })
    .select(`*, client:clients(id, name, email)`)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ purchase_order: po }, { status: 201 })
}
