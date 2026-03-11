import { TrendingUp, TrendingDown, FileText, Clock, AlertTriangle, ArrowUpRight, ArrowDownRight, Zap } from "lucide-react"
import { formatCurrency } from "@/lib/utils/invoice"
import { createClient } from "@/lib/supabase/server"

/* ─────────────────────────────────────────────────────────────────────────
   Micro sparkline SVG inline — aucune dépendance, rendu serveur
───────────────────────────────────────────────────────────────────────── */
function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (!values || values.length < 2) return null
  const max = Math.max(...values, 1)
  const w = 80, h = 28, pad = 2
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2)
    const y = h - pad - ((v / max) * (h - pad * 2))
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible" aria-hidden>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
      {/* Point final */}
      {(() => {
        const last = values[values.length - 1]
        const x = w - pad
        const y = h - pad - ((last / max) * (h - pad * 2))
        return <circle cx={x} cy={y} r="2.5" fill={color} opacity="0.9" />
      })()}
    </svg>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   Fetch stats
───────────────────────────────────────────────────────────────────────── */
async function getStats() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const now              = new Date()
  const startOfMonth     = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0]
  const endOfPrevMonth   = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0]
  const today            = now.toISOString().split("T")[0]

  // Données des 6 derniers mois pour sparkline CA
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split("T")[0]

  const [
    { data: currMonth },
    { data: prevMonth },
    { count: sentCount },
    { data: pending },
    { data: overdue },
    { data: sixMonths },
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

    supabase
      .from("invoices")
      .select("total_ttc, issue_date")
      .eq("user_id", user.id)
      .in("status", ["sent", "accepted", "paid"])
      .gte("issue_date", sixMonthsAgo),
  ])

  // Agréger par mois pour sparkline
  const monthlyRevenue = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const total = (sixMonths || [])
      .filter(inv => inv.issue_date?.startsWith(key))
      .reduce((s, inv) => s + (inv.total_ttc || 0), 0)
    return total
  })

  return {
    revenue_current_month:   currMonth?.reduce((s, i) => s + (i.total_ttc || 0), 0) || 0,
    revenue_previous_month:  prevMonth?.reduce((s, i) => s + (i.total_ttc || 0), 0) || 0,
    invoices_sent_count:     sentCount || 0,
    invoices_pending_amount: pending?.reduce((s, i) => s + (i.total_ttc || 0), 0) || 0,
    invoices_overdue_amount: overdue?.reduce((s, i) => s + (i.total_ttc || 0), 0) || 0,
    monthly_revenue:         monthlyRevenue,
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   KPI Card
───────────────────────────────────────────────────────────────────────── */
interface KpiCardProps {
  icon:       React.ReactNode
  iconBg:     string
  label:      string
  sub:        string
  value:      React.ReactNode
  badge?:     React.ReactNode
  sparkline?: React.ReactNode
  accent?:    boolean   // bordure colorée
  alert?:     boolean   // état alerte rouge
}

function KpiCard({ icon, iconBg, label, sub, value, badge, sparkline, alert }: KpiCardProps) {
  return (
    <div
      className={`
        relative overflow-hidden rounded-2xl border p-4 sm:p-5
        transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5
        ${alert
          ? 'bg-white border-[#FECACA] shadow-[0_2px_12px_rgba(239,68,68,0.08)]'
          : 'bg-white/80 border-white/60 shadow-[0_2px_12px_rgba(37,99,235,0.06)]'
        }
      `}
      style={{
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      {/* Déco arrière-plan légère */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-4 -bottom-4 w-24 h-24 rounded-full"
        style={{ background: alert
          ? 'radial-gradient(circle, rgba(239,68,68,0.04) 0%, transparent 70%)'
          : 'radial-gradient(circle, rgba(37,99,235,0.05) 0%, transparent 70%)'
        }}
      />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: iconBg }}
          >
            {icon}
          </div>
          {badge}
        </div>

        <p className={`font-mono text-xl sm:text-2xl font-extrabold leading-none truncate mb-2 ${
          alert ? 'text-[#EF4444]' : 'text-[#0F172A]'
        }`}>
          {value}
        </p>

        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-[12px] font-semibold text-slate-500">{label}</p>
            <p className="text-[11px] text-slate-300 mt-0.5">{sub}</p>
          </div>
          {sparkline && (
            <div className="shrink-0 opacity-80">
              {sparkline}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   Export
───────────────────────────────────────────────────────────────────────── */
export async function DashboardStats() {
  const stats = await getStats()

  const s = stats || {
    revenue_current_month:   0,
    revenue_previous_month:  0,
    invoices_sent_count:     0,
    invoices_pending_amount: 0,
    invoices_overdue_amount: 0,
    monthly_revenue:         [0, 0, 0, 0, 0, 0],
  }

  const revenueDiff    = s.revenue_current_month - s.revenue_previous_month
  const revenuePercent = s.revenue_previous_month > 0
    ? Math.round((revenueDiff / s.revenue_previous_month) * 100)
    : null

  const isUp       = revenuePercent !== null && revenuePercent >= 0
  const hasOverdue = s.invoices_overdue_amount > 0

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">

      {/* ── CA ce mois ── */}
      <KpiCard
        iconBg="linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)"
        icon={isUp
          ? <TrendingUp  className="w-4 h-4 text-[#2563EB]" />
          : <TrendingDown className="w-4 h-4 text-[#2563EB]" />
        }
        value={formatCurrency(s.revenue_current_month)}
        label="CA ce mois"
        sub={revenuePercent !== null
          ? `vs ${formatCurrency(s.revenue_previous_month)} le mois dernier`
          : 'aucune donnée précédente'
        }
        badge={revenuePercent !== null ? (
          <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold rounded-full px-2 py-0.5 ${
            isUp ? 'bg-[#D1FAE5] text-[#065F46]' : 'bg-[#FEE2E2] text-[#991B1B]'
          }`}>
            {isUp
              ? <ArrowUpRight   className="w-3 h-3" />
              : <ArrowDownRight className="w-3 h-3" />
            }
            {Math.abs(revenuePercent)}%
          </span>
        ) : undefined}
        sparkline={
          <Sparkline values={s.monthly_revenue} color="#2563EB" />
        }
      />

      {/* ── Factures émises ── */}
      <KpiCard
        iconBg="linear-gradient(135deg, #EDE9FE 0%, #DDD6FE 100%)"
        icon={<FileText className="w-4 h-4 text-[#7C3AED]" />}
        value={s.invoices_sent_count}
        label="Factures émises"
        sub="ce mois"
        sparkline={
          <Sparkline
            values={[1, 2, 1, 3, s.invoices_sent_count > 0 ? s.invoices_sent_count : 0, s.invoices_sent_count]}
            color="#7C3AED"
          />
        }
      />

      {/* ── En attente ── */}
      <KpiCard
        iconBg="linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)"
        icon={<Clock className="w-4 h-4 text-[#D97706]" />}
        value={formatCurrency(s.invoices_pending_amount)}
        label="En attente"
        sub="à encaisser"
        badge={s.invoices_pending_amount > 0 ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold rounded-full px-2 py-0.5 bg-[#FEF3C7] text-[#92400E]">
            <Zap className="w-2.5 h-2.5" />
            Action
          </span>
        ) : undefined}
      />

      {/* ── En retard ── */}
      <KpiCard
        iconBg={hasOverdue
          ? 'linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%)'
          : 'linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)'
        }
        icon={<AlertTriangle className={`w-4 h-4 ${hasOverdue ? 'text-[#EF4444]' : 'text-[#10B981]'}`} />}
        value={hasOverdue ? formatCurrency(s.invoices_overdue_amount) : "0 €"}
        label="En retard"
        sub={hasOverdue ? "à relancer d'urgence" : "Aucun retard 🎉"}
        alert={hasOverdue}
        badge={hasOverdue ? (
          <span className="inline-flex items-center text-[11px] font-bold rounded-full px-2 py-0.5 bg-[#FEE2E2] text-[#991B1B]">
            Urgent
          </span>
        ) : undefined}
      />

    </div>
  )
}
