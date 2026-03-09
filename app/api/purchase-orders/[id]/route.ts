import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type Params = { params: Promise<{ id: string }> }

// GET /api/purchase-orders/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { id } = await params
  const { data, error } = await supabase
    .from("purchase_orders")
    .select(`*, client:clients(*)`)
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (error || !data) return NextResponse.json({ error: "Bon de commande introuvable" }, { status: 404 })
  return NextResponse.json({ purchase_order: data })
}

// PATCH /api/purchase-orders/[id] — mise à jour partielle
export async function PATCH(request: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { id } = await params
  const body    = await request.json()

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }

  // Recalcul des totaux si les lignes sont fournies
  if (body.lines) {
    const subtotal_ht = body.lines.reduce((s: number, l: { total_ht: number }) => s + (l.total_ht || 0), 0)
    const total_vat   = body.lines.reduce((s: number, l: { total_vat: number }) => s + (l.total_vat || 0), 0)
    update.lines       = body.lines
    update.subtotal_ht = subtotal_ht
    update.total_vat   = total_vat
    update.total_ttc   = subtotal_ht + total_vat
  }

  if (body.status !== undefined)        update.status        = body.status
  if (body.client_id !== undefined)     update.client_id     = body.client_id
  if (body.issue_date !== undefined)    update.issue_date    = body.issue_date
  if (body.delivery_date !== undefined) update.delivery_date = body.delivery_date || null
  if (body.reference !== undefined)     update.reference     = body.reference?.trim() || null
  if (body.notes !== undefined)         update.notes         = body.notes || null

  // Horodatage des transitions de statut
  if (body.status === "sent")      update.sent_at      = new Date().toISOString()
  if (body.status === "confirmed") update.confirmed_at = new Date().toISOString()

  const { data, error } = await supabase
    .from("purchase_orders")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id)
    .select(`*, client:clients(id, name, email)`)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ purchase_order: data })
}

// DELETE /api/purchase-orders/[id] — brouillons uniquement
export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { id } = await params

  const { data: po } = await supabase
    .from("purchase_orders")
    .select("status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (!po) return NextResponse.json({ error: "Bon de commande introuvable" }, { status: 404 })
  if (po.status !== "draft") {
    return NextResponse.json({ error: "Seuls les brouillons peuvent être supprimés" }, { status: 403 })
  }

  const { error } = await supabase
    .from("purchase_orders")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
