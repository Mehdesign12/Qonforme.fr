import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET /api/credit-notes — liste tous les avoirs de l'utilisateur
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { data, error } = await supabase
    .from("credit_notes")
    .select(`
      *,
      client:clients(id, name, email),
      original_invoice:invoices(id, invoice_number)
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ credit_notes: data })
}
