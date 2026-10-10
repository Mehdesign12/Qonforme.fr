'use client'

/**
 * Vue Trésorerie : prévision des encaissements semaine par semaine, retards,
 * échéancier. Purement présentationnelle — la page réelle lui passe les
 * factures de /api/tresorerie, la démo des données fictives : les deux restent
 * identiques par construction (règle « démo = miroir du tableau de bord »).
 */

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, BellRing, CalendarClock, ChevronRight, Loader2, Plus, Wallet } from "lucide-react"
import { formatCurrency } from "@/lib/utils/invoice"
import { buildForecast, daysBetween, fmtDay, isoDay, type ForecastInvoice, type Horizon, type WeekBucket } from "@/lib/treasury/forecast"
import { cn } from "@/lib/utils"

const cardStyle: React.CSSProperties = {
  background: "var(--card-glass-bg)",
  boxShadow:  "var(--card-glass-shadow)",
}

const HORIZONS: { value: Horizon; label: string }[] = [
  { value: 30, label: "30 jours" },
  { value: 60, label: "60 jours" },
  { value: 90, label: "90 jours" },
]

const kEur = (v: number) =>
  v >= 1000 ? `${(v / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} k€` : `${Math.round(v)} €`

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`

interface Props {
  /** null pendant le chargement */
  invoices:       ForecastInvoice[] | null
  error?:         string | null
  invoiceHref:    (id: string) => string
  newInvoiceHref: string
  remindersHref:  string
}

type Bar =
  | { kind: "late"; key: string; label: string; amount: number; count: number }
  | { kind: "week"; key: string; label: string; amount: number; count: number; week: WeekBucket }

export function TreasuryView({ invoices, error, invoiceHref, newInvoiceHref, remindersHref }: Props) {
  const [horizon, setHorizon] = useState<Horizon>(30)
  const [selected, setSelected] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  // Date du jour lue après le montage : le serveur et le navigateur peuvent ne pas être le même jour
  const [today, setToday] = useState<string | null>(null)
  useEffect(() => setToday(isoDay(new Date())), [])

  const f = useMemo(() => (invoices && today ? buildForecast(invoices, today, horizon) : null), [invoices, today, horizon])

  const bars: Bar[] = useMemo(() => {
    if (!f) return []
    const list: Bar[] = []
    if (f.overdue.count) list.push({ kind: "late", key: "late", label: "Retard", amount: f.overdue.amount, count: f.overdue.count })
    for (const w of f.weeks) list.push({ kind: "week", key: w.start, label: fmtDay(w.start), amount: w.amount, count: w.count, week: w })
    return list
  }, [f])

  if (error) {
    return (
      <div className="max-w-[1200px] mx-auto rounded-2xl border border-white/60 dark:border-[#1E3A5F] px-6 py-10 text-center" style={cardStyle}>
        <p className="text-[15px] font-bold text-[#0F172A] dark:text-[#E2E8F0] mb-1">La trésorerie n’a pas pu être chargée</p>
        <p className="text-sm text-slate-500">{error}</p>
      </div>
    )
  }

  if (!f) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-[#2563EB] animate-spin" />
      </div>
    )
  }

  if (f.totalOpen.count === 0) {
    return (
      <div className="max-w-[1200px] mx-auto rounded-2xl border border-white/60 dark:border-[#1E3A5F] py-20 text-center px-6" style={cardStyle}>
        <div className="w-14 h-14 rounded-2xl bg-[#EFF6FF] dark:bg-[#1E3A5F] flex items-center justify-center mx-auto mb-4">
          <Wallet className="w-6 h-6 text-[#2563EB]" />
        </div>
        <p className="text-[15px] font-bold text-[#0F172A] dark:text-[#E2E8F0] mb-1">Aucune facture en attente de paiement</p>
        <p className="text-sm text-slate-500 mb-5">Vos prochaines factures envoyées apparaîtront ici, semaine par semaine, selon leur échéance.</p>
        <Link href={newInvoiceHref} className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-xl transition-colors">
          <Plus className="w-4 h-4" />
          Créer une facture
        </Link>
      </div>
    )
  }

  // 15 % de marge au-dessus de la plus haute barre, pour son étiquette
  const max = Math.max(1, ...bars.map((b) => b.amount)) / 0.85
  const sel = bars.find((b) => b.key === selected) ?? null
  const rows = f.schedule.filter((r) => {
    if (!sel) return true
    if (sel.kind === "late") return r.overdue
    return !r.overdue && r.due_date >= sel.week.start && r.due_date <= sel.week.end
  })
  const tip = bars.find((b) => b.key === hovered) ?? null
  const tipText = (b: Bar) =>
    b.kind === "late"
      ? `En retard : ${formatCurrency(b.amount)} · ${plural(b.count, "facture", "factures")}`
      : `Semaine du ${fmtDay(b.week.start)} au ${fmtDay(b.week.end)} : ${b.count ? `${formatCurrency(b.amount)} · ${plural(b.count, "échéance", "échéances")}` : "aucune échéance"}`
  const peak = bars.filter((b) => b.kind === "week").reduce<Bar | null>((m, b) => (!m || b.amount > m.amount ? b : m), null)

  return (
    <div className="space-y-4 max-w-[1200px] mx-auto">
      {/* ── En-tête : période ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">Encaissements attendus d’après les échéances de vos factures envoyées</p>
        <div role="group" aria-label="Horizon de la prévision" className="flex rounded-xl bg-[#E9EDF4] dark:bg-[#162032] p-[3px] gap-[2px]">
          {HORIZONS.map((h) => (
            <button
              key={h.value}
              type="button"
              aria-pressed={horizon === h.value}
              onClick={() => { setHorizon(h.value); setSelected(null) }}
              className={cn(
                "h-8 px-3 rounded-lg text-[13px] font-semibold transition-colors",
                horizon === h.value
                  ? "bg-white dark:bg-[#0F1E35] text-[#0F172A] dark:text-[#E2E8F0] shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-[#E2E8F0]"
              )}
            >
              {h.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Chiffres clés ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className={cn("rounded-2xl border p-4 flex flex-col gap-1.5", f.overdue.count ? "border-[#F5DDB5] dark:border-[#92400E]/50" : "border-white/60 dark:border-[#1E3A5F]")} style={cardStyle}>
          <span className={cn("flex items-center gap-1.5 text-[13px] font-semibold", f.overdue.count ? "text-[#B45309] dark:text-[#FBBF24]" : "text-slate-500")}>
            <AlertTriangle className="w-3.5 h-3.5" />En retard
          </span>
          <span className="font-mono text-[22px] md:text-[26px] font-bold tracking-tight text-[#0F172A] dark:text-[#E2E8F0]">{formatCurrency(f.overdue.amount)}</span>
          <span className="text-[12px] text-slate-500 leading-snug">
            {f.overdue.count ? `${plural(f.overdue.count, "facture", "factures")}${f.overdue.over30 ? ` · ${formatCurrency(f.overdue.over30)} à plus de 30 jours` : ""}` : "Aucun retard"}
          </span>
        </div>
        <div className="rounded-2xl border border-white/60 dark:border-[#1E3A5F] p-4 flex flex-col gap-1.5" style={cardStyle}>
          <span className="text-[13px] text-slate-500">Cette semaine</span>
          <span className="font-mono text-[22px] md:text-[26px] font-bold tracking-tight text-[#0F172A] dark:text-[#E2E8F0]">{formatCurrency(f.thisWeek.amount)}</span>
          <span className="text-[12px] text-slate-500">{f.thisWeek.count ? `${plural(f.thisWeek.count, "échéance", "échéances")} d’ici dimanche` : "Aucune échéance d’ici dimanche"}</span>
        </div>
        <div className="rounded-2xl border border-white/60 dark:border-[#1E3A5F] p-4 flex flex-col gap-1.5" style={cardStyle}>
          <span className="text-[13px] text-slate-500">Sous {horizon} jours</span>
          <span className="font-mono text-[22px] md:text-[26px] font-bold tracking-tight text-[#0F172A] dark:text-[#E2E8F0]">{formatCurrency(f.dueInHorizon.amount)}</span>
          <span className="text-[12px] text-slate-500">{plural(f.dueInHorizon.count, "facture arrive", "factures arrivent")} à échéance</span>
        </div>
        <div className="rounded-2xl bg-[#0A1122] p-4 flex flex-col gap-1.5">
          <span className="text-[13px] text-[#AFBDD3]">Total à encaisser</span>
          <span className="font-mono text-[22px] md:text-[26px] font-bold tracking-tight text-white">{formatCurrency(f.totalOpen.amount)}</span>
          <span className="text-[12px] text-[#94A3B8]">{f.later.count ? `dont ${formatCurrency(f.later.amount)} au-delà de ${horizon} jours` : `${plural(f.totalOpen.count, "facture ouverte", "factures ouvertes")}`}</span>
        </div>
      </div>

      {/* ── Prévision par semaine ── */}
      <section aria-labelledby="treso-chart" className="rounded-2xl border border-white/60 dark:border-[#1E3A5F] p-4 md:p-5" style={cardStyle}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="treso-chart" className="text-[15px] font-bold text-[#0F172A] dark:text-[#E2E8F0]">Prévision par semaine</h2>
          <div className="flex items-center gap-4 text-[12px] text-slate-600 dark:text-slate-300">
            <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-[3px] bg-[#2563EB] dark:bg-[#3B82F6]" />À échoir</span>
            {f.overdue.count > 0 && <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-[3px] bg-[#D97706]" />En retard</span>}
          </div>
        </div>

        <div className="relative mt-5 flex gap-3">
          {/* axe : trois repères discrets */}
          <div className="flex flex-col justify-between h-[200px] w-12 shrink-0 text-right font-mono text-[11px] text-slate-400 -translate-y-[7px]" aria-hidden>
            <span>{kEur(max)}</span><span>{kEur(max / 2)}</span><span>0</span>
          </div>
          <div className="relative flex-1 min-w-0 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            <div className="relative h-[200px]" style={{ minWidth: bars.length * 46 }}>
              <div className="absolute inset-x-0 top-0 border-t border-dashed border-[#EEF1F5] dark:border-[#1E3A5F]" />
              <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-[#EEF1F5] dark:border-[#1E3A5F]" />
              <div className="absolute inset-x-0 bottom-0 border-t border-[#E2E8F0] dark:border-[#1E3A5F]" />
              <div className="absolute inset-0 flex items-end gap-2">
                {bars.map((b) => {
                  const h = b.amount ? Math.max(3, Math.round((b.amount / max) * 200)) : 0
                  const isSel = selected === b.key
                  const dim = selected !== null && !isSel
                  return (
                    <button
                      key={b.key}
                      type="button"
                      onClick={() => setSelected(isSel ? null : b.key)}
                      onMouseEnter={() => setHovered(b.key)}
                      onMouseLeave={() => setHovered((k) => (k === b.key ? null : k))}
                      onFocus={() => setHovered(b.key)}
                      onBlur={() => setHovered((k) => (k === b.key ? null : k))}
                      aria-pressed={isSel}
                      aria-label={tipText(b)}
                      className="relative flex-1 min-w-[38px] h-full flex flex-col justify-end items-center group focus:outline-none"
                    >
                      {(b.kind === "late" || b === peak) && b.amount > 0 && (
                        <span className="mb-1 font-mono text-[11px] font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">{kEur(b.amount)}</span>
                      )}
                      <span
                        className={cn(
                          "block w-full max-w-[44px] rounded-t-[4px] transition-opacity group-focus-visible:ring-2 group-focus-visible:ring-[#2563EB] group-focus-visible:ring-offset-2",
                          b.kind === "late" ? "bg-[#D97706]" : "bg-[#2563EB] dark:bg-[#3B82F6]",
                          dim ? "opacity-35" : "opacity-100"
                        )}
                        style={{ height: h }}
                      />
                    </button>
                  )
                })}
              </div>
              {tip && (
                <div role="tooltip" className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-1 z-10 rounded-lg bg-[#0A1122] text-white text-[12px] font-medium px-3 py-1.5 whitespace-nowrap shadow-lg">
                  {tipText(tip)}
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-2" style={{ minWidth: bars.length * 46 }} aria-hidden>
              {bars.map((b) => (
                <span key={b.key} className={cn("flex-1 min-w-[38px] text-center text-[11px] whitespace-nowrap", b.kind === "late" ? "text-[#B45309] font-semibold" : "text-slate-400")}>{b.label}</span>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-3 text-[12px] text-slate-400">Touchez une barre pour n’afficher que ses factures dans l’échéancier.</p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
        {/* ── Échéancier ── */}
        <section aria-labelledby="treso-schedule" className="rounded-2xl border border-white/60 dark:border-[#1E3A5F] overflow-hidden" style={cardStyle}>
          <div className="flex items-center justify-between gap-3 px-4 md:px-5 py-4">
            <h2 id="treso-schedule" className="text-[15px] font-bold text-[#0F172A] dark:text-[#E2E8F0]">
              {sel ? (sel.kind === "late" ? "Factures en retard" : `Semaine du ${fmtDay(sel.week.start)}`) : `Échéancier, ${horizon} jours`}
            </h2>
            {sel ? (
              <button type="button" onClick={() => setSelected(null)} className="text-[13px] font-semibold text-[#2563EB] hover:underline">Tout afficher</button>
            ) : (
              <span className="text-[12px] text-slate-400">Triés par échéance</span>
            )}
          </div>
          {rows.length === 0 ? (
            <p className="px-5 pb-6 text-sm text-slate-500">Aucune échéance sur cette période.</p>
          ) : (
            <ul className="divide-y divide-[#F1F5F9] dark:divide-[#162032] border-t border-[#F1F5F9] dark:border-[#162032]">
              {rows.map((r) => {
                const inDays = daysBetween(f.today, r.due_date)
                return (
                  <li key={r.id}>
                    <Link href={invoiceHref(r.id)} className="flex items-center gap-3 px-4 md:px-5 py-3 hover:bg-[#F8FAFC] dark:hover:bg-[#162032] transition-colors">
                      <span className="w-14 shrink-0 font-mono text-[12px] text-slate-500">{fmtDay(r.due_date)}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13px] font-semibold text-[#0F172A] dark:text-[#E2E8F0] truncate">{r.client}</span>
                        <span className="block font-mono text-[12px] text-[#2563EB]">{r.number}</span>
                      </span>
                      <span
                        className={cn(
                          "hidden sm:inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap",
                          r.overdue
                            ? r.daysLate > 30 ? "bg-[#FEE2E2] text-[#991B1B]" : "bg-[#FFF7E6] text-[#B45309]"
                            : inDays === 0 ? "bg-[#EEF3FF] text-[#1D4ED8]" : "bg-[#F1F5F9] text-[#475569] dark:bg-[#162032] dark:text-slate-300"
                        )}
                      >
                        {r.overdue ? <><AlertTriangle className="w-3 h-3" />{plural(r.daysLate, "jour", "jours")} de retard</> : inDays === 0 ? "Aujourd’hui" : `Dans ${plural(inDays, "jour", "jours")}`}
                      </span>
                      <span className="w-24 text-right font-mono text-[13px] font-bold text-[#0F172A] dark:text-[#E2E8F0] shrink-0">{formatCurrency(r.amount)}</span>
                      <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* ── À faire ── */}
        <div className="flex flex-col gap-4">
          {f.overdue.count > 0 && (
            <section className="rounded-2xl border border-[#F5DDB5] dark:border-[#92400E]/50 p-4 flex flex-col gap-3" style={cardStyle}>
              <h2 className="flex items-center gap-2 text-[15px] font-bold text-[#0F172A] dark:text-[#E2E8F0]"><BellRing className="w-4 h-4 text-[#B45309]" />À relancer</h2>
              <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">
                {f.overdue.count > 1 ? `${f.overdue.count} factures dépassent leur échéance` : "Une facture dépasse son échéance"} pour {formatCurrency(f.overdue.amount)}. Les relances automatiques partent à J+30 et J+45 ; vous pouvez aussi relancer tout de suite.
              </p>
              <Link href={remindersHref} className="inline-flex items-center justify-center gap-2 h-10 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-bold transition-colors">
                Voir les relances
              </Link>
            </section>
          )}
          <section className="rounded-2xl border border-white/60 dark:border-[#1E3A5F] p-4 flex flex-col gap-2" style={cardStyle}>
            <h2 className="flex items-center gap-2 text-[15px] font-bold text-[#0F172A] dark:text-[#E2E8F0]"><CalendarClock className="w-4 h-4 text-[#2563EB]" />Comment lire cette prévision</h2>
            <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">
              Chaque facture envoyée et non réglée est placée dans la semaine de son échéance, avoirs déduits. Les factures payées ou en brouillon n’y figurent pas.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
