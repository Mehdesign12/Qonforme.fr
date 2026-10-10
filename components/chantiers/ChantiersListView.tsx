'use client'

/**
 * Liste des chantiers : avancement de la facturation, marché, reste à facturer.
 * Présentationnelle, partagée par /chantiers et /demo/chantiers.
 */

import { useMemo, useState } from "react"
import Link from "next/link"
import { ChevronRight, HardHat, Loader2, Plus } from "lucide-react"
import { formatCurrency } from "@/lib/utils/invoice"
import { chantierMetrics, type Chantier, type ChantierStatus } from "@/lib/chantiers/metrics"
import { cn } from "@/lib/utils"
import { cardStyle, ChantierStatusBadge, ProgressBar, periodLabel } from "@/components/chantiers/shared"

type Filter = "all" | ChantierStatus

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all",    label: "Tous" },
  { key: "active", label: "En cours" },
  { key: "todo",   label: "À démarrer" },
  { key: "done",   label: "Terminés" },
]

interface Props {
  chantiers:  Chantier[] | null
  error?:     string | null
  detailHref: (id: string) => string
  newHref:    string
}

export function ChantiersListView({ chantiers, error, detailHref, newHref }: Props) {
  const [filter, setFilter] = useState<Filter>("all")

  const rows = useMemo(() => (chantiers ?? []).map((c) => ({ c, m: chantierMetrics(c) })), [chantiers])
  const totals = useMemo(() => {
    const live = rows.filter((r) => r.c.status === "active" || r.c.status === "todo")
    return {
      active:    rows.filter((r) => r.c.status === "active").length,
      market:    live.reduce((s, r) => s + r.m.marketHt, 0),
      remaining: live.reduce((s, r) => s + r.m.remainingHt, 0),
      retenue:   rows.reduce((s, r) => s + r.m.retenueTtc, 0),
    }
  }, [rows])

  if (error) {
    return (
      <div className="max-w-[1200px] mx-auto rounded-2xl border border-white/60 dark:border-[#1E3A5F] px-6 py-10 text-center" style={cardStyle}>
        <p className="text-[15px] font-bold text-[#0F172A] dark:text-[#E2E8F0] mb-1">Les chantiers n’ont pas pu être chargés</p>
        <p className="text-sm text-slate-500">{error}</p>
      </div>
    )
  }
  if (!chantiers) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 text-[#2563EB] animate-spin" /></div>
  }

  if (chantiers.length === 0) {
    return (
      <div className="max-w-[1200px] mx-auto rounded-2xl border border-white/60 dark:border-[#1E3A5F] py-20 text-center px-6" style={cardStyle}>
        <div className="w-14 h-14 rounded-2xl bg-[#EFF6FF] dark:bg-[#1E3A5F] flex items-center justify-center mx-auto mb-4">
          <HardHat className="w-6 h-6 text-[#2563EB]" />
        </div>
        <p className="text-[15px] font-bold text-[#0F172A] dark:text-[#E2E8F0] mb-1">Aucun chantier pour l’instant</p>
        <p className="text-sm text-slate-500 mb-5 max-w-md mx-auto">Un chantier regroupe le marché, ses lots et tous ses devis et factures : vous voyez d’un coup d’œil ce qui reste à facturer.</p>
        <Link href={newHref} className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-xl transition-colors">
          <Plus className="w-4 h-4" />Créer un chantier
        </Link>
      </div>
    )
  }

  const visible = rows.filter((r) => filter === "all" || r.c.status === filter)

  return (
    <div className="space-y-4 max-w-[1200px] mx-auto">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ["En cours", String(totals.active), "chantiers ouverts"],
          ["Marché en cours", formatCurrency(totals.market), "HT, chantiers à démarrer et en cours"],
          ["Reste à facturer", formatCurrency(totals.remaining), "HT, sur ces mêmes chantiers"],
        ].map(([l, v, s]) => (
          <div key={l} className="rounded-2xl border border-white/60 dark:border-[#1E3A5F] p-4 flex flex-col gap-1.5" style={cardStyle}>
            <span className="text-[13px] text-slate-500">{l}</span>
            <span className="font-mono text-[20px] md:text-[24px] font-bold tracking-tight text-[#0F172A] dark:text-[#E2E8F0]">{v}</span>
            <span className="text-[12px] text-slate-500">{s}</span>
          </div>
        ))}
        <div className="rounded-2xl bg-[#0A1122] p-4 flex flex-col gap-1.5">
          <span className="text-[13px] text-[#AFBDD3]">Retenues de garantie</span>
          <span className="font-mono text-[20px] md:text-[24px] font-bold tracking-tight text-white">{formatCurrency(totals.retenue)}</span>
          <span className="text-[12px] text-[#94A3B8]">TTC, libérées un an après réception</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all whitespace-nowrap",
                filter === f.key
                  ? "bg-[#2563EB] text-white border-[#2563EB] shadow-sm"
                  : "bg-white/80 dark:bg-[#0F1E35]/80 text-slate-600 dark:text-slate-400 border-[#E2E8F0] dark:border-[#1E3A5F] hover:border-[#2563EB] hover:text-[#2563EB]"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-white/60 dark:border-[#1E3A5F] overflow-hidden" style={cardStyle}>
        {visible.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-500">Aucun chantier dans cette catégorie.</p>
        ) : (
          <ul className="divide-y divide-[#F1F5F9] dark:divide-[#162032]">
            {visible.map(({ c, m }) => (
              <li key={c.id}>
                <Link href={detailHref(c.id)} className="grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1.6fr)_110px_130px_210px_20px] items-center gap-x-4 gap-y-2 px-4 md:px-5 py-3.5 hover:bg-[#F8FAFC] dark:hover:bg-[#162032] transition-colors">
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold text-[#0F172A] dark:text-[#E2E8F0] truncate">{c.name}</span>
                    </span>
                    <span className="block text-[12px] text-slate-500 truncate">{c.client_name || "Sans client"} · {periodLabel(c.start_date, c.end_date)}</span>
                  </span>
                  <span className="md:order-none justify-self-end md:justify-self-start"><ChantierStatusBadge status={c.status} /></span>
                  <span className="hidden md:block text-right">
                    <span className="block font-mono text-[13px] font-bold text-[#0F172A] dark:text-[#E2E8F0]">{formatCurrency(m.marketHt)}</span>
                    <span className="block text-[11px] text-slate-400">marché HT</span>
                  </span>
                  <span className="col-span-2 md:col-span-1 flex flex-col gap-1">
                    <span className="flex justify-between gap-2 text-[11px] text-slate-500 whitespace-nowrap"><span>{m.progress} % facturé</span><span>reste <span className="font-mono">{formatCurrency(m.remainingHt)}</span></span></span>
                    <ProgressBar value={m.progress} />
                  </span>
                  <ChevronRight className="hidden md:block w-4 h-4 text-slate-300" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
