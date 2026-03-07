import { TrendingUp, TrendingDown, FileText, Clock, AlertTriangle } from "lucide-react"
import { formatCurrency } from "@/lib/utils/invoice"

// Données mock — seront remplacées par des appels Supabase
const MOCK_STATS = {
  revenue_current_month: 8450,
  revenue_previous_month: 6200,
  invoices_sent_count: 12,
  invoices_pending_amount: 3200,
  invoices_overdue_amount: 950,
}

export async function DashboardStats() {
  const stats = MOCK_STATS
  const revenueDiff = stats.revenue_current_month - stats.revenue_previous_month
  const revenuePercent = Math.round((revenueDiff / stats.revenue_previous_month) * 100)

  const cards = [
    {
      title: "CA ce mois",
      value: formatCurrency(stats.revenue_current_month),
      sub: `${revenuePercent > 0 ? "+" : ""}${revenuePercent}% vs mois dernier`,
      icon: revenuePercent >= 0 ? TrendingUp : TrendingDown,
      iconColor: revenuePercent >= 0 ? "text-[#10B981]" : "text-[#EF4444]",
      iconBg: revenuePercent >= 0 ? "bg-[#D1FAE5]" : "bg-[#FEE2E2]",
    },
    {
      title: "Factures émises",
      value: stats.invoices_sent_count.toString(),
      sub: "ce mois",
      icon: FileText,
      iconColor: "text-[#2563EB]",
      iconBg: "bg-[#DBEAFE]",
    },
    {
      title: "En attente",
      value: formatCurrency(stats.invoices_pending_amount),
      sub: "à encaisser",
      icon: Clock,
      iconColor: "text-[#D97706]",
      iconBg: "bg-[#FEF3C7]",
    },
    {
      title: "En retard",
      value: formatCurrency(stats.invoices_overdue_amount),
      sub: "à relancer",
      icon: AlertTriangle,
      iconColor: "text-[#EF4444]",
      iconBg: "bg-[#FEE2E2]",
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.title} className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-slate-500">{card.title}</p>
            <div className={`w-9 h-9 rounded-lg ${card.iconBg} flex items-center justify-center`}>
              <card.icon className={`w-4.5 h-4.5 ${card.iconColor}`} />
            </div>
          </div>
          <p className="text-2xl font-bold text-[#0F172A] font-mono">{card.value}</p>
          <p className="text-xs text-slate-400 mt-1">{card.sub}</p>
        </div>
      ))}
    </div>
  )
}
