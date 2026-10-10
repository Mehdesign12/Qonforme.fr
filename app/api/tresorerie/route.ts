import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { OPEN_INVOICE_STATUSES, type ForecastInvoice } from "@/lib/treasury/forecast"
import { creditedByInvoice, joinedOne } from "@/lib/treasury/credited"

export const dynamic = "force-dynamic"

/**
 * GET /api/tresorerie
 * Factures émises et non réglées (hors archives), avec le total des avoirs déjà
 * émis sur chacune. Le calcul de la prévision se fait côté client, à la date
 * locale de l'utilisateur (lib/treasury/forecast.ts).
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, status, due_date, total_ttc, client:clients(name)")
    .eq("user_id", user.id)
    .eq("is_archived", false)
    .in("status", [...OPEN_INVOICE_STATUSES])
    .order("due_date", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { credited, error: cErr } = await creditedByInvoice(supabase, user.id, (invoices ?? []).map((i) => i.id))
  if (cErr) return NextResponse.json({ error: cErr }, { status: 500 })

  const rows: ForecastInvoice[] = (invoices ?? []).map((i) => {
    const client = joinedOne(i.client as { name?: string } | { name?: string }[] | null)
    return {
      id:             i.id,
      invoice_number: i.invoice_number,
      client_name:    client?.name ?? null,
      due_date:       i.due_date,
      total_ttc:      i.total_ttc,
      credited_ttc:   credited[i.id] || 0,
      status:         i.status,
    }
  })

  return NextResponse.json({ invoices: rows })
}
