import { TrendingUp, TrendingDown, FileText, Clock, AlertTriangle, ArrowUpRight, ArrowDownRight } from "lucide-react"
import Image from "next/image"
import { formatCurrency } from "@/lib/utils/invoice"
import { createClient } from "@/lib/supabase/server"

const PICTO_Q =
  "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20bleu%20Qonforme%20PNG.webp"

async function getStats() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const now              = new Date()
  const startOfMonth     = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0]
  const endOfPrevMonth   = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0]
  const today            = now.toISOString().split("T")[0]

  const [
    { data: currMonth },
    { data: prevMonth },
    { count: sentCount },
    { data: pending },
    { data: overdue },
  ] = await Promise.all([
    supabase
      .from("invoices")
      .select("total_ttc")
      .eq("user_id", user.id)
      .in("status", ["sent", "accepted", "paid"])
      .gte("issue_date", startOfMonth),

    supabase
      .from("invoices")
      .select("total_ttc")
      .eq("user_id", user.id)
      .in("status", ["sent", "accepted", "paid"])
      .gte("issue_date", startOfPrevMonth)
      .lte("issue_date", endOfPrevMonth),

    supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .neq("status", "draft")
      .gte("issue_date", startOfMonth),

    supabase
      .from("invoices")
      .select("total_ttc")
      .eq("user_id", user.id)
      .in("status", ["sent", "pending", "received"]),

    supabase
      .from("invoices")
      .select("total_ttc")
      .eq("user_id", user.id)
      .in("status", ["sent", "pending"])
      .lt("due_date", today),
  ])

  return {
    revenue_current_month:   currMonth?.reduce((s, i) => s + (i.total_ttc || 0), 0) || 0,
    revenue_previous_month:  prevMonth?.reduce((s, i) => s + (i.total_ttc || 0), 0) || 0,
    invoices_sent_count:     sentCount || 0,
    invoices_pending_amount: pending?.reduce((s, i) => s + (i.total_ttc || 0), 0) || 0,
    invoices_overdue_amount: overdue?.reduce((s, i) => s + (i.total_ttc || 0), 0) || 0,
  }
}

export async function DashboardStats() {
  const stats = await getStats()

  const s = stats || {
    revenue_current_month:   0,
    revenue_previous_month:  0,
    invoices_sent_count:     0,
    invoices_pending_amount: 0,
    invoices_overdue_amount: 0,
  }

  const revenueDiff    = s.revenue_current_month - s.revenue_previous_month
  const revenuePercent = s.revenue_previous_month > 0
    ? Math.round((revenueDiff / s.revenue_previous_month) * 100)
    : null

  const isUp        = revenuePercent !== null && revenuePercent >= 0
  const hasOverdue  = s.invoices_overdue_amount > 0

  return (
    <div className="relative">
      {/* Q filigrane centré dans la zone KPI */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none z-0"
        style={{ opacity: 0.035 }}
      >
        <Image src={PICTO_Q} alt="" width={200} height={200} className="w-[200px]" unoptimized />
      </div>

      <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-4">

        {/* ── CA ce mois ── */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EFF6FF]">
              {isUp
                ? <TrendingUp  className="w-4 h-4 text-[#2563EB]" />
                : <TrendingDown className="w-4 h-4 text-[#2563EB]" />
              }
            </div>
            {revenuePercent !== null && (
              <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold rounded-full px-2 py-0.5 ${
                isUp ? "bg-[#D1FAE5] text-[#065F46]" : "bg-[#FEE2E2] text-[#991B1B]"
              }`}>
                {isUp
                  ? <ArrowUpRight className="w-3 h-3" />
                  : <ArrowDownRight className="w-3 h-3" />
                }
                {Math.abs(revenuePercent)}%
              </span>
            )}
          </div>
          <p className="font-mono text-xl sm:text-2xl font-extrabold text-[#0F172A] truncate leading-none">
            {formatCurrency(s.revenue_current_month)}
          </p>
          <p className="mt-2 text-[12px] font-medium text-slate-400">CA ce mois</p>
          {revenuePercent !== null && (
            <p className="mt-0.5 text-[11px] text-slate-300">
              vs {formatCurrency(s.revenue_previous_month)} le mois dernier
            </p>
          )}
        </div>

        {/* ── Factures émises ── */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EFF6FF]">
              <FileText className="w-4 h-4 text-[#2563EB]" />
            </div>
          </div>
          <p className="font-mono text-xl sm:text-2xl font-extrabold text-[#0F172A] leading-none">
            {s.invoices_sent_count}
          </p>
          <p className="mt-2 text-[12px] font-medium text-slate-400">Factures émises</p>
          <p className="mt-0.5 text-[11px] text-slate-300">ce mois</p>
        </div>

        {/* ── En attente ── */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FEF3C7]">
              <Clock className="w-4 h-4 text-[#D97706]" />
            </div>
          </div>
          <p className="font-mono text-xl sm:text-2xl font-extrabold text-[#0F172A] truncate leading-none">
            {formatCurrency(s.invoices_pending_amount)}
          </p>
          <p className="mt-2 text-[12px] font-medium text-slate-400">En attente</p>
          <p className="mt-0.5 text-[11px] text-slate-300">à encaisser</p>
        </div>

        {/* ── En retard ── */}
        <div className={`bg-white rounded-xl border p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow ${
          hasOverdue ? "border-[#FECACA]" : "border-[#E2E8F0]"
        }`}>
          <div className="flex items-start justify-between mb-3">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
              hasOverdue ? "bg-[#FEE2E2]" : "bg-[#D1FAE5]"
            }`}>
              <AlertTriangle className={`w-4 h-4 ${hasOverdue ? "text-[#EF4444]" : "text-[#10B981]"}`} />
            </div>
            {hasOverdue && (
              <span className="inline-flex items-center text-[11px] font-semibold rounded-full px-2 py-0.5 bg-[#FEE2E2] text-[#991B1B]">
                Action requise
              </span>
            )}
          </div>
          <p className={`font-mono text-xl sm:text-2xl font-extrabold truncate leading-none ${
            hasOverdue ? "text-[#EF4444]" : "text-[#0F172A]"
          }`}>
            {hasOverdue ? formatCurrency(s.invoices_overdue_amount) : "0 €"}
          </p>
          <p className="mt-2 text-[12px] font-medium text-slate-400">En retard</p>
          <p className="mt-0.5 text-[11px] text-slate-300">
            {hasOverdue ? "à relancer" : "Aucun retard 🎉"}
          </p>
        </div>

      </div>
    </div>
  )
}
