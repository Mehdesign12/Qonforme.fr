import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

interface Params {
  params: Promise<{ id: string }>
}

// GET /api/invoices/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { id } = await params

  const { data, error } = await supabase
    .from("invoices")
    .select(`*, client:clients(*)`)
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ invoice: data })
}

// PATCH /api/invoices/[id]
export async function PATCH(request: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  // Recalculer les totaux si les lignes sont modifiées
  let updateData: Record<string, unknown> = {}
  
  if (body.lines) {
    const subtotal_ht = body.lines.reduce((sum: number, l: { total_ht: number }) => sum + (l.total_ht || 0), 0)
    const total_vat = body.lines.reduce((sum: number, l: { total_vat: number }) => sum + (l.total_vat || 0), 0)
    updateData = {
      lines: body.lines,
      subtotal_ht,
      total_vat,
      total_ttc: subtotal_ht + total_vat,
    }
  }

  if (body.status) updateData.status = body.status
  if (body.client_id) updateData.client_id = body.client_id
  if (body.issue_date) updateData.issue_date = body.issue_date
  if (body.due_date) updateData.due_date = body.due_date
  if (body.notes !== undefined) updateData.notes = body.notes
  if (body.payment_terms !== undefined) updateData.payment_terms = body.payment_terms

  const { data, error } = await supabase
    .from("invoices")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", user.id)
    .select(`*, client:clients(id, name, email)`)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ invoice: data })
}

// DELETE /api/invoices/[id] — seulement les brouillons
export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { id } = await params

  // Vérifier que c'est un brouillon
  const { data: inv } = await supabase
    .from("invoices")
    .select("status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (inv?.status !== "draft") {
    return NextResponse.json({ error: "Seuls les brouillons peuvent être supprimés" }, { status: 403 })
  }

  const { error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
