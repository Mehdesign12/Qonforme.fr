import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

interface Params { params: Promise<{ id: string }> }

// GET /api/quotes/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { id } = await params
  const { data, error } = await supabase
    .from("quotes")
    .select(`*, client:clients(*)`)
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ quote: data })
}

// PATCH /api/quotes/[id]
export async function PATCH(request: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { id }  = await params
  const body    = await request.json()
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.lines) {
    const subtotal_ht = body.lines.reduce((s: number, l: { total_ht: number }) => s + (l.total_ht || 0), 0)
    const total_vat   = body.lines.reduce((s: number, l: { total_vat: number }) => s + (l.total_vat || 0), 0)
    update.lines       = body.lines
    update.subtotal_ht = subtotal_ht
    update.total_vat   = total_vat
    update.total_ttc   = subtotal_ht + total_vat
  }

  if (body.status)      update.status      = body.status
  if (body.client_id !== undefined) update.client_id = body.client_id
  if (body.issue_date)  update.issue_date  = body.issue_date
  if (body.valid_until) update.valid_until = body.valid_until
  if (body.notes !== undefined) update.notes = body.notes

  const { data, error } = await supabase
    .from("quotes")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id)
    .select(`*, client:clients(id, name, email)`)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ quote: data })
}

// DELETE /api/quotes/[id] — brouillons seulement
export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { id } = await params
  const { data: q } = await supabase
    .from("quotes")
    .select("status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (q?.status !== "draft") {
    return NextResponse.json({ error: "Seuls les brouillons peuvent être supprimés" }, { status: 403 })
  }

  const { error } = await supabase.from("quotes").delete().eq("id", id).eq("user_id", user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
