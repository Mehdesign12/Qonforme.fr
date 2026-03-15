'use client'

import dynamic from 'next/dynamic'

/* Recharts chargé en client-only pour éviter les erreurs SSR */
const RevenueChart = dynamic(
  () => import('@/components/dashboard/RevenueChart').then(m => m.RevenueChart),
  { ssr: false, loading: () => (
    <div className="rounded-2xl border border-white/60 p-4 sm:p-5"
      style={{ background: 'var(--card-glass-bg)', boxShadow: 'var(--card-glass-shadow)' }}>
      <div className="h-[200px] flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-[#2563EB] border-t-transparent animate-spin" />
      </div>
    </div>
  )}
)

/* 12 mois avr 2025 → mars 2026 */
const DEMO_DATA = [
  { month: "Avr", value: 4200 },
  { month: "Mai", value: 5800 },
  { month: "Jun", value: 3900 },
  { month: "Jui", value: 6100 },
  { month: "Aoû", value: 5200 },
  { month: "Sep", value: 7800 },
  { month: "Oct", value: 6400 },
  { month: "Nov", value: 8900 },
  { month: "Déc", value: 9200 },
  { month: "Jan", value: 6800 },
  { month: "Fév", value: 7180 },
  { month: "Mar", value: 8450 },
]

export function DemoRevenueChart() {
  return <RevenueChart data={DEMO_DATA} currentMonth={11} />
}
