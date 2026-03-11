import { TrendingUp, TrendingDown, FileText, Clock, AlertTriangle } from "lucide-react"
import Image from "next/image"
import { formatCurrency } from "@/lib/utils/invoice"
import { createClient } from "@/lib/supabase/server"

const PICTO_Q = "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20bleu%20Qonforme%20PNG.webp"

async function getStats() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0]
  const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0]
  const today = now.toISOString().split("T")[0]

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
    revenue_current_month: currMonth?.reduce((s, i) => s + (i.total_ttc || 0), 0) || 0,
    revenue_previous_month: prevMonth?.reduce((s, i) => s + (i.total_ttc || 0), 0) || 0,
    invoices_sent_count: sentCount || 0,
    invoices_pending_amount: pending?.reduce((s, i) => s + (i.total_ttc || 0), 0) || 0,
    invoices_overdue_amount: overdue?.reduce((s, i) => s + (i.total_ttc || 0), 0) || 0,
  }
}

export async function DashboardStats() {
  const stats = await getStats()

  // Valeurs par défaut si pas encore de données
  const s = stats || {
    revenue_current_month: 0,
    revenue_previous_month: 0,
    invoices_sent_count: 0,
    invoices_pending_amount: 0,
    invoices_overdue_amount: 0,
  }

  const revenueDiff = s.revenue_current_month - s.revenue_previous_month
  const revenuePercent = s.revenue_previous_month > 0
    ? Math.round((revenueDiff / s.revenue_previous_month) * 100)
    : 0

  const cards = [
    {
      title: "CA ce mois",
      value: formatCurrency(s.revenue_current_month),
      sub: s.revenue_previous_month > 0
        ? `${revenuePercent > 0 ? "+" : ""}${revenuePercent}% vs mois dernier`
        : "Pas encore de données",
      icon: revenuePercent >= 0 ? TrendingUp : TrendingDown,
      iconColor: revenuePercent >= 0 ? "text-[#10B981]" : "text-[#EF4444]",
      iconBg: revenuePercent >= 0 ? "bg-[#D1FAE5]" : "bg-[#FEE2E2]",
    },
    {
      title: "Factures émises",
      value: s.invoices_sent_count.toString(),
      sub: "ce mois",
      icon: FileText,
      iconColor: "text-[#2563EB]",
      iconBg: "bg-[#DBEAFE]",
    },
    {
      title: "En attente",
      value: formatCurrency(s.invoices_pending_amount),
      sub: "à encaisser",
      icon: Clock,
      iconColor: "text-[#D97706]",
      iconBg: "bg-[#FEF3C7]",
    },
    {
      title: "En retard",
      value: formatCurrency(s.invoices_overdue_amount),
      sub: s.invoices_overdue_amount > 0 ? "à relancer" : "Aucun retard 🎉",
      icon: AlertTriangle,
      iconColor: s.invoices_overdue_amount > 0 ? "text-[#EF4444]" : "text-[#10B981]",
      iconBg: s.invoices_overdue_amount > 0 ? "bg-[#FEE2E2]" : "bg-[#D1FAE5]",
    },
  ]

  return (
    <div className="relative overflow-hidden">
      {/* Q filigrane centré dans la zone KPI */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none"
        style={{ opacity: 0.035, zIndex: 0 }}
      >
        <Image src={PICTO_Q} alt="" width={240} height={240} className="w-[200px]" unoptimized />
      </div>
      <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.title} className="bg-white rounded-xl border border-[#E2E8F0] p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-slate-500">{card.title}</p>
            <div className={`w-9 h-9 rounded-lg ${card.iconBg} flex items-center justify-center`}>
              <card.icon className={`w-4 h-4 ${card.iconColor}`} />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-[#0F172A] font-mono truncate">{card.value}</p>
          <p className="text-xs text-slate-400 mt-1">{card.sub}</p>
        </div>
      ))}
      </div>
    </div>
  )
}
