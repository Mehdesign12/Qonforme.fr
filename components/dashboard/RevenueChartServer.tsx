import { createClient } from "@/lib/supabase/server"
import dynamic from "next/dynamic"

/* ── Recharts lazy-chargé côté client uniquement ──────────────────────────
   next/dynamic avec ssr:false exclut Recharts (~200 Ko gzippé) du bundle
   initial. Il sera chargé uniquement quand le navigateur en a besoin,
   après que la page soit déjà rendue et interactive.
──────────────────────────────────────────────────────────────────────── */
const RevenueChart = dynamic(
  () => import("./RevenueChart").then(m => m.RevenueChart),
  {
    ssr: false,
    loading: () => (
      <div
        className="rounded-2xl border border-slate-100 p-4 sm:p-5 overflow-hidden"
        style={{ background: "#ffffff", boxShadow: "0 2px 16px rgba(37,99,235,0.07)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="h-3.5 w-32 rounded-full bg-slate-100 animate-pulse mb-1.5" />
            <div className="h-2.5 w-20 rounded-full bg-slate-100 animate-pulse" />
          </div>
        </div>
        <div className="flex items-end gap-2 h-[160px] px-1">
          {[0.4, 0.6, 0.35, 0.75, 0.5, 1].map((h, i) => (
            <div key={i} className="flex-1 rounded-t-lg bg-slate-100 animate-pulse" style={{ height: `${h * 100}%` }} />
          ))}
        </div>
      </div>
    ),
  }
)

/* ── Cache 60s : les données revenue ne changent pas à chaque requête ── */
export const revalidate = 60

const MONTH_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"]

export async function RevenueChartServer() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const now          = new Date()
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().split("T")[0]

  const { data: invoices } = await supabase
    .from("invoices")
    .select("total_ttc, issue_date")
    .eq("user_id", user.id)
    .in("status", ["sent", "accepted", "paid"])
    .gte("issue_date", twelveMonthsAgo)

  // Construire les 12 mois
  const chartData = Array.from({ length: 12 }, (_, i) => {
    const d     = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
    const key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const value = (invoices || [])
      .filter(inv => inv.issue_date?.startsWith(key))
      .reduce((s, inv) => s + (inv.total_ttc || 0), 0)
    return { month: MONTH_LABELS[d.getMonth()], value }
  })

  return <RevenueChart data={chartData} currentMonth={11} />
}
