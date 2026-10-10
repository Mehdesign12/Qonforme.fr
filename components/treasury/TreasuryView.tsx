'use client'

/**
 * Trésorerie : ce qui doit rentrer (factures émises) et sortir (factures
 * reçues), semaine par semaine, avec les retards et l'échéancier.
 *
 * Présentationnelle et partagée : la page réelle lui passe les données de
 * /api/tresorerie, la démo celles de lib/demo (règle « Mode démo » de CLAUDE.md).
 * Tous les calculs viennent de lib/treasury/forecast.ts.
 */

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, BellRing, ChevronRight, Inbox, Plus, RefreshCw, Wallet } from "lucide-react"
import { EmptyState, Kpi, KpiGrid, PageHeader, Panel, StatusPill } from "@/components/app/kit"
import { formatCurrency } from "@/lib/utils/invoice"
import { plural } from "@/components/invoices/invoice-view"
import { daysBetween } from "@/lib/utils/paris-date"
import {
  buildForecast, fmtDay, type ForecastInvoice, type ForecastPayable, type Horizon, type ScheduleItem, type WeekBucket,
} from "@/lib/treasury/forecast"
import { cn } from "@/lib/utils"

export type TreasuryMode = "app" | "demo"

interface Props {
  mode: TreasuryMode
  /** Aujourd'hui (Paris, AAAA-MM-JJ) ; null tant qu'il n'est pas connu (rendu serveur). */
  today: string | null
  /** null pendant le chargement. */
  invoices: ForecastInvoice[] | null
  payables: ForecastPayable[]
  /** Faux tant que la réception des factures fournisseurs n'est pas activée. */
  payablesAvailable: boolean
  error?: string | null
  onRetry?: () => void
}

const HORIZONS: Horizon[] = [30, 60, 90]

// Espaces insécables : le signe et l'unité ne passent jamais seuls à la ligne
const kEur = (v: number) =>
  Math.abs(v) >= 1000
    ? `${(v / 1000).toLocaleString("fr-FR", { maximumFractionDigits: Math.abs(v) >= 10000 ? 0 : 1 })}\u00A0k€`
    : `${Math.round(v)}\u00A0€`
/** Solde : signe seulement s'il est négatif (le « + » faisait déborder la carte sur mobile). */
const signed = (v: number) => (v < 0 ? "−\u00A0" : "") + formatCurrency(Math.abs(v))

/* Palette validée (scripts/validate_palette.js de la compétence dataviz), clair et sombre :
   encaissements = accent, sorties = sarcelle, retards = ambre. */
const C_IN = "bg-[var(--q-accent)]"
const C_OUT = "bg-[#0D9488]"
const C_LATE = "bg-[#B45309] dark:bg-[#D97706]"

type Group =
  | { kind: "late"; key: string; label: string; in: number; out: number; inCount: number; outCount: number }
  | ({ kind: "week"; key: string; label: string } & WeekBucket)

export function TreasuryView({ mode, today, invoices, payables, payablesAvailable, error, onRetry }: Props) {
  const router = useRouter()
  const [horizon, setHorizon] = useState<Horizon>(30)
  const [selected, setSelected] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)

  const base = mode === "demo" ? "/demo" : ""
  const hrefOf = (s: ScheduleItem) => (s.kind === "in" ? `${base}/invoices/${s.id}` : `${base}/received-invoices/${s.id}`)

  const f = useMemo(
    () => (invoices && today ? buildForecast(invoices, payablesAvailable ? payables : [], today, horizon) : null),
    [invoices, payables, payablesAvailable, today, horizon],
  )

  const groups: Group[] = useMemo(() => {
    if (!f) return []
    const list: Group[] = []
    if (f.inflow.overdue.count || f.outflow.overdue.count) {
      list.push({
        kind: "late", key: "late", label: "En retard",
        in: f.inflow.overdue.amount, out: f.outflow.overdue.amount,
        inCount: f.inflow.overdue.count, outCount: f.outflow.overdue.count,
      })
    }
    for (const w of f.weeks) list.push({ kind: "week", key: w.start, label: fmtDay(w.start), ...w })
    return list
  }, [f])

  const horizonControl = (
    <div role="group" aria-label="Horizon de la prévision" className="q-seg">
      {HORIZONS.map((h) => (
        <button key={h} type="button" aria-pressed={horizon === h} onClick={() => { setHorizon(h); setSelected(null) }}>
          {h} jours
        </button>
      ))}
    </div>
  )

  const header = (
    <PageHeader
      title="Trésorerie"
      subtitle="Ce qui doit rentrer et sortir, semaine par semaine, d’après les échéances de vos factures"
      actions={horizonControl}
    />
  )

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <section className="q-card">
          <EmptyState
            icon={<Wallet className="size-5" aria-hidden />}
            title="Impossible de charger la trésorerie"
            text={error}
            action={onRetry && (
              <button type="button" className="q-btn q-btn-secondary" onClick={onRetry}>
                <RefreshCw aria-hidden />
                Réessayer
              </button>
            )}
          />
        </section>
      </div>
    )
  }

  if (!f) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <section className="q-card h-[420px] animate-pulse" aria-busy="true" aria-label="Chargement de la trésorerie" />
      </div>
    )
  }

  if (f.inflow.total.count === 0 && f.outflow.total.count === 0) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <section className="q-card">
          <EmptyState
            className="py-14"
            icon={<Wallet className="size-5" aria-hidden />}
            title="Rien à encaisser ni à payer pour l’instant"
            text="Vos factures envoyées et les factures de vos fournisseurs apparaîtront ici, semaine par semaine, selon leur échéance."
            action={
              <Link href={`${base}/invoices/new`} className="q-btn q-btn-primary">
                <Plus strokeWidth={2.25} aria-hidden />
                Créer une facture
              </Link>
            }
          />
        </section>
      </div>
    )
  }

  /* ── Graphique ── */
  const max = Math.max(1, ...groups.flatMap((g) => [g.in, g.out])) / 0.85 // 15 % de marge pour les étiquettes
  const H = 200
  const h = (v: number) => (v > 0 ? Math.max(3, Math.round((v / max) * H)) : 0)
  const peak = groups.filter((g) => g.kind === "week").reduce<Group | null>((m, g) => (!m || g.in > m.in ? g : m), null)
  const tipOf = (g: Group) => {
    const what = [
      g.inCount ? `${formatCurrency(g.in)} à encaisser` : null,
      g.outCount ? `${formatCurrency(g.out)} à payer` : null,
    ].filter(Boolean).join(", ") || "aucune échéance"
    return g.kind === "late" ? `En retard : ${what}` : `Semaine du ${fmtDay(g.start)} au ${fmtDay(g.end)} : ${what}`
  }
  const tip = groups.find((g) => g.key === hovered) ?? null
  const sel = groups.find((g) => g.key === selected) ?? null

  const rows = f.schedule.filter((r) => {
    if (!sel) return true
    if (sel.kind === "late") return r.daysLate > 0
    return r.daysLate === 0 && r.due_date >= sel.start && r.due_date <= sel.end
  })
  const stateOf = (r: ScheduleItem) => {
    if (r.daysLate > 0) return <StatusPill tone={r.daysLate > 30 ? "danger" : "warn"}>{plural(r.daysLate, "jour", "jours")} de retard</StatusPill>
    const d = daysBetween(f.today, r.due_date)
    return <StatusPill tone={d === 0 ? "info" : "neutral"}>{d === 0 ? "Aujourd’hui" : `Dans ${plural(d, "jour", "jours")}`}</StatusPill>
  }
  const kindPill = (r: ScheduleItem) =>
    r.kind === "in" ? (
      <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--q-accent)]"><ArrowDownLeft className="size-3.5" aria-hidden />Entrée</span>
    ) : (
      <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#0F766E] dark:text-[#2DD4BF]"><ArrowUpRight className="size-3.5" aria-hidden />Sortie</span>
    )
  // Entrée : « + » ; sortie : « − », sauf un avoir fournisseur qui la réduit
  const amountOf = (r: ScheduleItem) => (r.kind === "in" || r.amount < 0 ? "+\u00A0" : "−\u00A0") + formatCurrency(Math.abs(r.amount))

  return (
    <div className="flex flex-col gap-4">
      {header}

      <KpiGrid>
        <Kpi
          label={`À encaisser sous ${horizon} jours`}
          value={formatCurrency(f.inflow.inHorizon.amount)}
          sub={f.inflow.thisWeek.count ? `dont ${formatCurrency(f.inflow.thisWeek.amount)} d’ici dimanche` : plural(f.inflow.inHorizon.count, "facture", "factures")}
        />
        <Kpi
          label={`À payer sous ${horizon} jours`}
          value={payablesAvailable ? formatCurrency(f.outflow.inHorizon.amount) : "—"}
          sub={
            !payablesAvailable
              ? "Factures fournisseurs à activer"
              : f.outflow.overdue.count
                ? `et ${formatCurrency(f.outflow.overdue.amount)} déjà échus`
                : plural(f.outflow.inHorizon.count, "facture fournisseur", "factures fournisseurs")
          }
        />
        <Kpi
          tone={f.inflow.overdue.count ? "warn" : "default"}
          icon={f.inflow.overdue.count ? <AlertTriangle className="size-3.5" aria-hidden /> : undefined}
          label="Clients en retard"
          value={formatCurrency(f.inflow.overdue.amount)}
          sub={
            f.inflow.overdue.count
              ? `${plural(f.inflow.overdue.count, "facture", "factures")}${f.inflow.overdue.over30 ? ` · ${formatCurrency(f.inflow.overdue.over30)} à plus de 30 jours` : ""}`
              : "Aucun retard"
          }
        />
        <Kpi
          tone="ink"
          label={`Solde prévu à ${horizon} jours`}
          value={signed(f.net)}
          sub={f.inflow.overdue.amount ? `sans compter ${formatCurrency(f.inflow.overdue.amount)} de retards à recouvrer` : "Entrées moins sorties de la période"}
        />
      </KpiGrid>

      <Panel
        title="Prévision par semaine"
        action={
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[var(--q-text-3)]">
            <span className="inline-flex items-center gap-1.5"><span className={cn("size-3 rounded-[3px]", C_IN)} />À encaisser</span>
            {payablesAvailable && <span className="inline-flex items-center gap-1.5"><span className={cn("size-3 rounded-[3px]", C_OUT)} />À payer</span>}
            {f.inflow.overdue.count > 0 && <span className="inline-flex items-center gap-1.5"><span className={cn("size-3 rounded-[3px]", C_LATE)} />Retards clients</span>}
          </div>
        }
        bodyClassName="px-5 pb-5"
      >
        <div className="relative mt-3 flex gap-3">
          <div className="flex h-[200px] w-11 shrink-0 -translate-y-[7px] flex-col justify-between whitespace-nowrap text-right font-mono text-[11px] text-[var(--q-text-4)]" aria-hidden>
            <span>{kEur(max)}</span><span>{kEur(max / 2)}</span><span>0</span>
          </div>
          <div className="relative min-w-0 flex-1 overflow-x-auto [scrollbar-width:none]">
            <div className="relative h-[200px]" style={{ minWidth: groups.length * 54 }}>
              <div className="absolute inset-x-0 top-0 border-t border-dashed border-[var(--q-line-soft)]" />
              <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-[var(--q-line-soft)]" />
              <div className="absolute inset-x-0 bottom-0 border-t border-[var(--q-line)]" />
              <div className="absolute inset-0 flex items-end gap-2">
                {groups.map((g) => {
                  const isSel = selected === g.key
                  const dim = selected !== null && !isSel
                  return (
                    <button
                      key={g.key}
                      type="button"
                      onClick={() => setSelected(isSel ? null : g.key)}
                      onMouseEnter={() => setHovered(g.key)}
                      onMouseLeave={() => setHovered((k) => (k === g.key ? null : k))}
                      onFocus={() => setHovered(g.key)}
                      onBlur={() => setHovered((k) => (k === g.key ? null : k))}
                      aria-pressed={isSel}
                      aria-label={tipOf(g)}
                      className={cn("group relative flex h-full min-w-[46px] flex-1 items-end justify-center gap-[2px] rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--q-focus)]", dim && "opacity-35")}
                    >
                      {(g.kind === "late" || g === peak) && g.in > 0 && (
                        <span className="absolute font-mono text-[11px] font-semibold text-[var(--q-text-2)]" style={{ bottom: h(g.in) + 4 }}>{kEur(g.in)}</span>
                      )}
                      <span className={cn("block w-full max-w-[22px] rounded-t-[4px]", g.kind === "late" ? C_LATE : C_IN)} style={{ height: h(g.in) }} />
                      {payablesAvailable && <span className={cn("block w-full max-w-[22px] rounded-t-[4px]", C_OUT)} style={{ height: h(g.out) }} />}
                    </button>
                  )
                })}
              </div>
              {tip && (
                <div role="tooltip" className="pointer-events-none absolute left-1/2 top-1 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#0A1122] px-3 py-1.5 text-[12px] font-medium text-white shadow-lg">
                  {tipOf(tip)}
                </div>
              )}
            </div>
            <div className="mt-2 flex gap-2" style={{ minWidth: groups.length * 54 }} aria-hidden>
              {groups.map((g) => (
                <span key={g.key} className={cn("min-w-[46px] flex-1 whitespace-nowrap text-center text-[11px]", g.kind === "late" ? "font-semibold text-[var(--q-warn)]" : "text-[var(--q-text-4)]")}>{g.label}</span>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-3 text-[12px] text-[var(--q-text-4)]">Touchez une semaine pour n’afficher que ses échéances.</p>
      </Panel>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Panel
          title={sel ? (sel.kind === "late" ? "Échéances dépassées" : `Semaine du ${fmtDay(sel.start)}`) : `Échéancier, ${horizon} jours`}
          action={sel ? <button type="button" onClick={() => setSelected(null)} className="q-link text-[13px] font-semibold">Tout afficher</button> : undefined}
        >
          {rows.length === 0 ? (
            <p className="px-5 pb-6 text-sm text-[var(--q-text-4)]">Aucune échéance sur cette période.</p>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="q-table min-w-[640px]">
                  <thead className="bg-[var(--q-surface-2)]">
                    <tr>
                      <th scope="col">Échéance</th>
                      <th scope="col">Sens</th>
                      <th scope="col">Client ou fournisseur</th>
                      <th scope="col" className="is-num">Montant TTC</th>
                      <th scope="col">État</th>
                      <th scope="col" className="w-10"><span className="sr-only">Ouvrir</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.kind + r.id} onClick={() => router.push(hrefOf(r))} className="cursor-pointer">
                        <td className="whitespace-nowrap text-[var(--q-text-3)]">{fmtDay(r.due_date)}{r.assumedDue && <span className="ml-1 text-[11px]" title="Pas d’échéance sur la facture : 30 jours après son émission">*</span>}</td>
                        <td>{kindPill(r)}</td>
                        <td className="max-w-[260px]">
                          <Link href={hrefOf(r)} className="block truncate font-semibold hover:underline" onClick={(e) => e.stopPropagation()}>{r.party}</Link>
                          <span className="font-mono text-[12px] text-[var(--q-text-4)]">{r.number}</span>
                        </td>
                        <td className="is-num whitespace-nowrap font-semibold">{amountOf(r)}</td>
                        <td>{stateOf(r)}</td>
                        <td><ChevronRight className="size-4 text-[var(--q-text-4)]" aria-hidden /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="q-list md:hidden">
                {rows.map((r) => (
                  <Link key={r.kind + r.id} href={hrefOf(r)} className="q-list-row">
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-[15px] font-semibold">{r.party}</span>
                      <span className="truncate text-xs text-[var(--q-text-4)]">{fmtDay(r.due_date)} · {r.kind === "in" ? "à encaisser" : "à payer"} · <span className="font-mono">{r.number}</span></span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-[15px] font-semibold tabular-nums">{amountOf(r)}</span>
                      {stateOf(r)}
                    </span>
                  </Link>
                ))}
              </div>
            </>
          )}
        </Panel>

        <div className="flex flex-col gap-4">
          {f.inflow.overdue.count > 0 && (
            <section className="q-card flex flex-col gap-3 border-[var(--q-warn-line)] p-5">
              <h2 className="q-h2 flex items-center gap-2"><BellRing className="size-4 text-[var(--q-warn)]" aria-hidden />À relancer</h2>
              <p className="text-[13px] leading-relaxed text-[var(--q-text-3)]">
                {f.inflow.overdue.count > 1 ? `${f.inflow.overdue.count} factures dépassent leur échéance` : "Une facture dépasse son échéance"} pour {formatCurrency(f.inflow.overdue.amount)}. Les relances automatiques suivent vos réglages ; depuis chaque facture, vous pouvez aussi relancer tout de suite.
              </p>
              <Link href={`${base}/settings/notifications`} className="q-btn q-btn-secondary">Régler les relances</Link>
            </section>
          )}
          {!payablesAvailable && (
            <section className="q-card flex flex-col gap-3 p-5">
              <h2 className="q-h2 flex items-center gap-2"><Inbox className="size-4 text-[var(--q-accent)]" aria-hidden />Vos sorties d’argent</h2>
              <p className="text-[13px] leading-relaxed text-[var(--q-text-3)]">
                Les factures de vos fournisseurs ne sont pas encore reçues dans Qonforme. Une fois la réception activée, leurs échéances apparaîtront ici à côté de vos encaissements.
              </p>
              <Link href={`${base}/received-invoices`} className="q-btn q-btn-secondary">Factures reçues</Link>
            </section>
          )}
          <section className="q-card flex flex-col gap-2 p-5">
            <h2 className="q-h2">Comment lire cette prévision</h2>
            <p className="text-[13px] leading-relaxed text-[var(--q-text-3)]">
              Chaque facture envoyée et non réglée est placée dans la semaine de son échéance, avoirs et retenue de garantie déduits. Les factures fournisseurs réglées, refusées ou en litige n’y figurent pas ; sans échéance, le paiement est attendu 30 jours après la facture (*).
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
