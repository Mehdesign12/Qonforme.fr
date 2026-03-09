import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type Params = { params: Promise<{ id: string }> }

// GET /api/products/[id] — récupère un produit
export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { id } = await params

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "Produit introuvable" }, { status: 404 })
  }

  return NextResponse.json({ product: data })
}

// PATCH /api/products/[id] — met à jour un produit
export async function PATCH(request: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  // Vérifier que le produit appartient à l'utilisateur
  const { data: existing } = await supabase
    .from("products")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: "Produit introuvable" }, { status: 404 })
  }

  // Construire l'objet de mise à jour (ne mettre à jour que les champs fournis)
  const updates: Record<string, unknown> = {}
  if (body.name      !== undefined) updates.name          = body.name.trim()
  if (body.description !== undefined) updates.description = body.description?.trim() || null
  if (body.unit_price_ht !== undefined) updates.unit_price_ht = Number(body.unit_price_ht)
  if (body.vat_rate  !== undefined) updates.vat_rate      = Number(body.vat_rate)
  if (body.unit      !== undefined) updates.unit          = body.unit?.trim() || null
  if (body.reference !== undefined) updates.reference     = body.reference?.trim() || null
  if (body.is_active !== undefined) updates.is_active     = Boolean(body.is_active)

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Aucun champ à mettre à jour" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("products")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ product: data })
}

// DELETE /api/products/[id] — désactive (soft-delete) un produit
export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { id } = await params

  // Soft-delete : on désactive le produit plutôt que de le supprimer
  // Cela préserve les documents existants qui référencent ce produit
  const { data, error } = await supabase
    .from("products")
    .update({ is_active: false })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "Produit introuvable" }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
