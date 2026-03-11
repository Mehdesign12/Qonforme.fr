'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'

/* ─────────────────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────────────────── */
interface MonthData {
  month: string   // "Jan", "Fév", …
  value: number
}

interface RevenueChartProps {
  data:         MonthData[]
  currentMonth: number  // index 0-based du mois courant dans data
}

/* ─────────────────────────────────────────────────────────────────────────
   Tooltip personnalisé
───────────────────────────────────────────────────────────────────────── */
function CustomTooltip({ active, payload, label }: {
  active?:  boolean
  payload?: { value: number }[]
  label?:   string
}) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-xl border border-white/60 px-3 py-2 text-xs shadow-lg"
      style={{
        background:          'rgba(255,255,255,0.95)',
        backdropFilter:      'blur(12px)',
        WebkitBackdropFilter:'blur(12px)',
      }}
    >
      <p className="font-semibold text-[#0F172A] mb-0.5">{label}</p>
      <p className="text-[#2563EB] font-bold">
        {payload[0].value.toLocaleString('fr-FR', { minimumFractionDigits: 0 })} €
      </p>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   Component
───────────────────────────────────────────────────────────────────────── */
export function RevenueChart({ data, currentMonth }: RevenueChartProps) {
  return (
    <div
      className="rounded-2xl border border-white/60 p-4 sm:p-5 overflow-hidden"
      style={{
        background:          'rgba(255,255,255,0.80)',
        backdropFilter:      'blur(12px)',
        WebkitBackdropFilter:'blur(12px)',
        boxShadow:           '0 2px 16px rgba(37,99,235,0.07)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[14px] font-bold text-[#0F172A]">Chiffre d&apos;affaires</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">6 derniers mois</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" />
          <span className="text-[11px] text-slate-400">CA facturé</span>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} barSize={28} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#2563EB" stopOpacity={1}   />
              <stop offset="100%" stopColor="#60A5FA" stopOpacity={0.7} />
            </linearGradient>
            <linearGradient id="barGradientActive" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#1D4ED8" stopOpacity={1}   />
              <stop offset="100%" stopColor="#2563EB" stopOpacity={0.9} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#E2E8F0"
            vertical={false}
            strokeWidth={0.8}
          />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#94A3B8', fontWeight: 500 }}
            dy={6}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: '#CBD5E1' }}
            tickFormatter={(v) => v === 0 ? '0' : `${Math.round(v / 1000)}k`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(37,99,235,0.04)', radius: 6 }} />
          <Bar dataKey="value" radius={[6, 6, 2, 2]}>
            {data.map((_, i) => (
              <Cell
                key={`cell-${i}`}
                fill={i === currentMonth
                  ? 'url(#barGradientActive)'
                  : 'url(#barGradient)'
                }
                opacity={i === currentMonth ? 1 : 0.55}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
