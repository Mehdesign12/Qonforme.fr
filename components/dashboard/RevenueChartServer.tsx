import { createClient } from "@/lib/supabase/server"
import { RevenueChart } from "./RevenueChart"

const MONTH_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"]

export async function RevenueChartServer() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const now          = new Date()
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split("T")[0]

  const { data: invoices } = await supabase
    .from("invoices")
    .select("total_ttc, issue_date")
    .eq("user_id", user.id)
    .in("status", ["sent", "accepted", "paid"])
    .gte("issue_date", sixMonthsAgo)

  // Construire les 6 mois
  const chartData = Array.from({ length: 6 }, (_, i) => {
    const d     = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const value = (invoices || [])
      .filter(inv => inv.issue_date?.startsWith(key))
      .reduce((s, inv) => s + (inv.total_ttc || 0), 0)
    return { month: MONTH_LABELS[d.getMonth()], value }
  })

  return <RevenueChart data={chartData} currentMonth={5} />
}
