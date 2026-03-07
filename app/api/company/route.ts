import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET /api/company — récupère les infos de l'entreprise de l'utilisateur connecté
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("user_id", user.id)
    .single()

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ company: data ?? null })
}

// POST /api/company — création (onboarding)
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const body = await request.json()

  const { data, error } = await supabase.from("companies").upsert({
    user_id: user.id,
    name: body.name,
    siren: body.siren,
    address: body.address,
    zip_code: body.zip_code,
    city: body.city,
    country: "FR",
    vat_number: body.vat_number || null,
    iban: body.iban || null,
    invoice_prefix: body.invoice_prefix || "F",
    invoice_sequence: 1,
  }, { onConflict: "user_id" }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ company: data }, { status: 201 })
}

// PATCH /api/company — mise à jour des infos entreprise
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const body = await request.json()

  const { data, error } = await supabase
    .from("companies")
    .update({
      name: body.name,
      siren: body.siren,
      siret: body.siret || null,
      vat_number: body.vat_number || null,
      address: body.address,
      zip_code: body.zip_code,
      city: body.city,
      country: body.country || "FR",
      iban: body.iban || null,
      logo_url: body.logo_url || null,
      invoice_prefix: body.invoice_prefix || "F",
      payment_terms: body.payment_terms || null,
    })
    .eq("user_id", user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ company: data })
}
