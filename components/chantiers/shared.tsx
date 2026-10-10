'use client'

import { CHANTIER_STATUS_LABELS, type ChantierStatus } from "@/lib/chantiers/metrics"
import { cn } from "@/lib/utils"

export const cardStyle: React.CSSProperties = {
  background: "var(--card-glass-bg)",
  boxShadow:  "var(--card-glass-shadow)",
}

const STATUS_STYLE: Record<ChantierStatus, string> = {
  todo:     "bg-[#F1F5F9] text-[#475569] dark:bg-[#162032] dark:text-slate-300",
  active:   "bg-[#DBEAFE] text-[#1E40AF] dark:bg-[#1E3A5F] dark:text-[#93C5FD]",
  done:     "bg-[#D1FAE5] text-[#065F46]",
  archived: "bg-[#F1F5F9] text-[#64748B] dark:bg-[#162032] dark:text-slate-400",
}

export function ChantierStatusBadge({ status }: { status: ChantierStatus }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap", STATUS_STYLE[status])}>
      {CHANTIER_STATUS_LABELS[status]}
    </span>
  )
}

/** Barre d'avancement de la facturation */
export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 rounded-full bg-[#E2E8F0] dark:bg-[#1E3A5F] overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-label="Avancement de la facturation">
      <div className={cn("h-full rounded-full", value >= 100 ? "bg-[#059669]" : "bg-[#2563EB]")} style={{ width: `${Math.max(value ? 3 : 0, value)}%` }} />
    </div>
  )
}

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
/** « 2 nov. 2026 » depuis « 2026-11-02 » */
export function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number)
  return dateFmt.format(new Date(Date.UTC(y, m - 1, d, 12)))
}

export function periodLabel(start: string | null, end: string | null): string {
  if (start && end) return `${fmtDate(start)} → ${fmtDate(end)}`
  if (start) return `Depuis le ${fmtDate(start)}`
  if (end) return `Fin prévue le ${fmtDate(end)}`
  return "Dates à préciser"
}
