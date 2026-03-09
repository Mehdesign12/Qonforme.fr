import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET /api/products — liste tous les produits actifs de l'utilisateur
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const search = searchParams.get("search") || ""
  const includeInactive = searchParams.get("include_inactive") === "true"

  let query = supabase
    .from("products")
    .select("*")
    .eq("user_id", user.id)
    .order("name", { ascending: true })

  if (!includeInactive) {
    query = query.eq("is_active", true)
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,reference.ilike.%${search}%`)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ products: data })
}

// POST /api/products — crée un nouveau produit
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  const body = await request.json()

  // Validation
  if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "Le nom est requis" }, { status: 400 })
  }
  if (body.unit_price_ht === undefined || body.unit_price_ht === null || isNaN(Number(body.unit_price_ht))) {
    return NextResponse.json({ error: "Le prix HT est requis" }, { status: 400 })
  }
  if (body.vat_rate === undefined || body.vat_rate === null || isNaN(Number(body.vat_rate))) {
    return NextResponse.json({ error: "Le taux de TVA est requis" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("products")
    .insert({
      user_id:       user.id,
      name:          body.name.trim(),
      description:   body.description?.trim() || null,
      unit_price_ht: Number(body.unit_price_ht),
      vat_rate:      Number(body.vat_rate),
      unit:          body.unit?.trim() || null,
      reference:     body.reference?.trim() || null,
      is_active:     body.is_active !== false,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ product: data }, { status: 201 })
}
