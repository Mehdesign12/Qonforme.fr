import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

type Supabase = Awaited<ReturnType<typeof createClient>>

async function countOf(supabase: Supabase, table: string, userId: string, archivable = false): Promise<number | null> {
  const base = () => supabase.from(table).select("id", { count: "exact", head: true }).eq("user_id", userId)
  const first = archivable ? await base().eq("is_archived", false) : await base()
  if (!first.error) return first.count ?? 0
  // Colonne d'archivage absente (migration pas appliquée) : on compte tout
  if (archivable) {
    const retry = await base()
    if (!retry.error) return retry.count ?? 0
  }
  return null
}

/** Nombre de documents par type, pour les pastilles du rail des ventes (mobile). Un total absent reste `null` : le rail n'affiche alors aucun chiffre. */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401, headers: NO_STORE })

  const [quotes, purchaseOrders, invoices, creditNotes] = await Promise.all([
    countOf(supabase, "quotes", user.id),
    countOf(supabase, "purchase_orders", user.id),
    countOf(supabase, "invoices", user.id, true),
    countOf(supabase, "credit_notes", user.id),
  ])
  return NextResponse.json({ quotes, purchaseOrders, invoices, creditNotes }, { headers: NO_STORE })
}
