'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { TrendingUp, Euro, BarChart2 } from 'lucide-react'

interface ChartDataPoint {
  month: string
  count: number
}

interface Props {
  mrr: number
  arr: number
  activeCount: number
  churnRate: number
  data: ChartDataPoint[]
}

function MetricCard({ icon: Icon, iconColor, value, label }: {
  icon: React.ElementType
  iconColor: string
  value: string
  label: string
}) {
  return (
    <div className="rounded-2xl border p-4 bg-white/95 dark:bg-[#0F1E35] border-slate-100 dark:border-[#1E3A5F]">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <p className="font-mono text-2xl font-extrabold text-[#0F172A] dark:text-[#E2E8F0]">{value}</p>
    </div>
  )
}

export default function MrrChart({ mrr, arr, activeCount, churnRate, data }: Props) {
  const fmtEur = (n: number) =>
    n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

  return (
    <div className="space-y-4">
      {/* KPI Revenus */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          icon={Euro}
          iconColor="text-[#2563EB]"
          value={fmtEur(mrr)}
          label="MRR"
        />
        <MetricCard
          icon={TrendingUp}
          iconColor="text-[#059669]"
          value={fmtEur(arr)}
          label="ARR estimé"
        />
        <MetricCard
          icon={BarChart2}
          iconColor="text-[#7C3AED]"
          value={activeCount.toString()}
          label="Abonnés actifs"
        />
        <div className="rounded-2xl border p-4 bg-white/95 dark:bg-[#0F1E35] border-slate-100 dark:border-[#1E3A5F]">
          <div className="flex items-center gap-2 mb-2">
            <span className={`w-4 h-4 rounded-full flex-shrink-0 ${churnRate > 20 ? 'bg-red-400' : churnRate > 10 ? 'bg-yellow-400' : 'bg-green-400'}`} />
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Taux de churn</span>
          </div>
          <p className="font-mono text-2xl font-extrabold text-[#0F172A] dark:text-[#E2E8F0]">
            {churnRate.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Graphique : nouveaux abonnés par mois */}
      <div className="rounded-2xl border p-4 sm:p-5 bg-white/95 dark:bg-[#0F1E35] border-slate-100 dark:border-[#1E3A5F]">
        <p className="text-sm font-semibold text-foreground mb-4">Nouveaux abonnés — 6 derniers mois</p>
        {data.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">Pas de données</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--background)',
                  border: '1px solid rgba(100,116,139,0.2)',
                  borderRadius: '12px',
                  fontSize: '12px',
                }}
                formatter={(value: number) => [value, 'Nouveaux abonnés']}
                cursor={{ fill: 'rgba(37,99,235,0.06)' }}
              />
              <Bar dataKey="count" fill="#2563EB" radius={[6, 6, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
