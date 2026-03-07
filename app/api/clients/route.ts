import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET /api/clients — liste tous les clients de l'utilisateur
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const search = searchParams.get("search") || ""
  const includeArchived = searchParams.get("archived") === "true"

  let query = supabase
    .from("clients")
    .select(`
      *,
      invoices:invoices(count),
      invoices_total:invoices(total_ttc)
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (!includeArchived) {
    query = query.eq("is_archived", false)
  }

  if (search) {
    query = query.ilike("name", `%${search}%`)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ clients: data })
}

// POST /api/clients — crée un nouveau client
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  const body = await request.json()

  const { data, error } = await supabase
    .from("clients")
    .insert({
      user_id: user.id,
      name: body.name,
      siren: body.siren || null,
      vat_number: body.vat_number || null,
      email: body.email || null,
      phone: body.phone || null,
      address: body.address || null,
      zip_code: body.zip_code || null,
      city: body.city || null,
      country: body.country || "FR",
      is_archived: false,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ client: data }, { status: 201 })
}
