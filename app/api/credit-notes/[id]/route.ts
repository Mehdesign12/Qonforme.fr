import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

interface Params {
  params: Promise<{ id: string }>
}

// GET /api/credit-notes/[id] — détail d'un avoir
export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { id } = await params

  const { data, error } = await supabase
    .from("credit_notes")
    .select(`
      *,
      client:clients(id, name, email, address, zip_code, city, siren, vat_number),
      original_invoice:invoices(id, invoice_number, issue_date, total_ttc)
    `)
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ credit_note: data })
}
