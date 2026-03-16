import {
  TrendingUp, FileText, Clock, AlertTriangle, ArrowUpRight, Zap, CheckCircle2
} from "lucide-react"
import { formatCurrency } from "@/lib/utils/invoice"

/* ─────────────────────────────────────────────────────────────────────────
   Sparkline SVG inline
───────────────────────────────────────────────────────────────────────── */
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1)
  const w = 80, h = 28, pad = 2
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2)
    const y = h - pad - ((v / max) * (h - pad * 2))
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible" aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
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
  alert?:     boolean
}

function KpiCard({ icon, iconBg, label, sub, value, badge, sparkline, alert }: KpiCardProps) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-4 sm:p-5 hover:-translate-y-0.5"
      style={{
        background:  alert ? '#ffffff' : 'var(--card-glass-bg)',
        boxShadow:   alert ? '0 2px 12px rgba(239,68,68,0.08)' : 'var(--card-glass-shadow)',
        borderColor: alert ? '#FECACA' : 'rgba(255,255,255,0.60)',
        contain:     'layout style',
        transition:  'transform 0.15s ease, box-shadow 0.15s ease',
      }}
    >
      <div aria-hidden className="pointer-events-none absolute -right-4 -bottom-4 w-24 h-24 rounded-full"
        style={{ background: alert
          ? 'radial-gradient(circle, rgba(239,68,68,0.04) 0%, transparent 70%)'
          : 'radial-gradient(circle, rgba(37,99,235,0.05) 0%, transparent 70%)'
        }}
      />
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: iconBg }}>
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
          {sparkline && <div className="shrink-0 opacity-80">{sparkline}</div>}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   Données mock réalistes
───────────────────────────────────────────────────────────────────────── */
const MOCK_STATS = {
  revenue_current_month:   8450,
  revenue_previous_month:  7180,
  invoices_sent_count:     5,
  invoices_pending_amount: 4250,
  invoices_overdue_amount: 1650,
  recovery_rate:           87,
  // 12 mois : avr → mars
  monthly_revenue: [4200, 5800, 3900, 6100, 5200, 7800, 6400, 8900, 9200, 6800, 7180, 8450],
}

/* ─────────────────────────────────────────────────────────────────────────
   Export
───────────────────────────────────────────────────────────────────────── */
export function DemoDashboardStats() {
  const s = MOCK_STATS
  const revenueDiff    = s.revenue_current_month - s.revenue_previous_month
  const revenuePercent = Math.round((revenueDiff / s.revenue_previous_month) * 100)

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">

      {/* CA ce mois */}
      <KpiCard
        iconBg="linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)"
        icon={<TrendingUp className="w-4 h-4 text-[#2563EB]" />}
        value={formatCurrency(s.revenue_current_month)}
        label="CA ce mois"
        sub={`vs ${formatCurrency(s.revenue_previous_month)} le mois dernier`}
        badge={
          <span className="inline-flex items-center gap-0.5 text-[11px] font-bold rounded-full px-2 py-0.5 bg-[#D1FAE5] text-[#065F46]">
            <ArrowUpRight className="w-3 h-3" />
            {revenuePercent}%
          </span>
        }
        sparkline={<Sparkline values={s.monthly_revenue} color="#2563EB" />}
      />

      {/* Factures émises */}
      <KpiCard
        iconBg="linear-gradient(135deg, #EDE9FE 0%, #DDD6FE 100%)"
        icon={<FileText className="w-4 h-4 text-[#7C3AED]" />}
        value={s.invoices_sent_count}
        label="Factures émises"
        sub="ce mois"
        sparkline={<Sparkline values={[1, 2, 3, 2, 4, 5]} color="#7C3AED" />}
      />

      {/* En attente */}
      <KpiCard
        iconBg="linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)"
        icon={<Clock className="w-4 h-4 text-[#D97706]" />}
        value={formatCurrency(s.invoices_pending_amount)}
        label="En attente"
        sub="à encaisser"
        badge={
          <span className="inline-flex items-center gap-1 text-[11px] font-bold rounded-full px-2 py-0.5 bg-[#FEF3C7] text-[#92400E]">
            <Zap className="w-2.5 h-2.5" />
            Action
          </span>
        }
      />

      {/* En retard */}
      <KpiCard
        iconBg="linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%)"
        icon={<AlertTriangle className="w-4 h-4 text-[#EF4444]" />}
        value={formatCurrency(s.invoices_overdue_amount)}
        label="En retard"
        sub="à relancer d'urgence"
        alert
        badge={
          <span className="inline-flex items-center text-[11px] font-bold rounded-full px-2 py-0.5 bg-[#FEE2E2] text-[#991B1B]">
            Urgent
          </span>
        }
      />

      {/* Taux de recouvrement */}
      <KpiCard
        iconBg="linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)"
        icon={<CheckCircle2 className="w-4 h-4 text-[#10B981]" />}
        value={`${s.recovery_rate} %`}
        label="Recouvrement"
        sub="payé / facturé total"
        badge={
          <span className="inline-flex items-center text-[11px] font-bold rounded-full px-2 py-0.5 bg-[#D1FAE5] text-[#065F46]">
            Excellent
          </span>
        }
      />

    </div>
  )
}
