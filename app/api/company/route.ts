import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  const body = await request.json()

  const { error } = await supabase.from("companies").upsert({
    user_id: user.id,
    name: body.name,
    siren: body.siren,
    address: body.address,
    zip_code: body.zip_code,
    city: body.city,
    country: "FR",
    vat_number: body.vat_number || null,
    iban: body.iban || null,
    invoice_prefix: "F",
    invoice_sequence: 1,
  }, { onConflict: "user_id" })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
