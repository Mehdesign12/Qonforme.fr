import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
  const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString()
  const today = now.toISOString().split("T")[0]

  // CA mois en cours (factures envoyées/acceptées/payées)
  const { data: currentMonthInvoices } = await supabase
    .from("invoices")
    .select("total_ttc")
    .eq("user_id", user.id)
    .in("status", ["sent", "accepted", "paid"])
    .gte("issue_date", startOfMonth.split("T")[0])

  const revenue_current_month = currentMonthInvoices?.reduce(
    (sum, inv) => sum + (inv.total_ttc || 0), 0
  ) || 0

  // CA mois précédent
  const { data: prevMonthInvoices } = await supabase
    .from("invoices")
    .select("total_ttc")
    .eq("user_id", user.id)
    .in("status", ["sent", "accepted", "paid"])
    .gte("issue_date", startOfPrevMonth.split("T")[0])
    .lte("issue_date", endOfPrevMonth.split("T")[0])

  const revenue_previous_month = prevMonthInvoices?.reduce(
    (sum, inv) => sum + (inv.total_ttc || 0), 0
  ) || 0

  // Nombre de factures envoyées ce mois
  const { count: invoices_sent_count } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .neq("status", "draft")
    .gte("issue_date", startOfMonth.split("T")[0])

  // Montant en attente
  const { data: pendingInvoices } = await supabase
    .from("invoices")
    .select("total_ttc")
    .eq("user_id", user.id)
    .in("status", ["sent", "pending", "received"])

  const invoices_pending_amount = pendingInvoices?.reduce(
    (sum, inv) => sum + (inv.total_ttc || 0), 0
  ) || 0

  // Montant en retard
  const { data: overdueInvoices } = await supabase
    .from("invoices")
    .select("total_ttc, due_date")
    .eq("user_id", user.id)
    .in("status", ["sent", "pending"])
    .lt("due_date", today)

  const invoices_overdue_amount = overdueInvoices?.reduce(
    (sum, inv) => sum + (inv.total_ttc || 0), 0
  ) || 0

  // 5 dernières factures
  const { data: recent_invoices } = await supabase
    .from("invoices")
    .select(`id, invoice_number, status, issue_date, total_ttc, client:clients(name)`)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5)

  return NextResponse.json({
    revenue_current_month,
    revenue_previous_month,
    invoices_sent_count: invoices_sent_count || 0,
    invoices_pending_amount,
    invoices_overdue_amount,
    recent_invoices: recent_invoices || [],
    ppf_connected: false,
  })
}
