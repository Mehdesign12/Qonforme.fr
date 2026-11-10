"use client"

/**
 * Vue de la page privée d'un partenaire : chiffres sur 30 jours ou depuis le
 * début, visites par semaine, pages qui citent Qonforme, générateur de lien,
 * détail des commissions. Aucun nom ni adresse de client n'arrive jusqu'ici.
 */
import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { StatusPill, type Tone } from "@/components/app/kit"
import { Button } from "@/components/ui/button"
import { euros, partnerLink, percent, type CommissionDisplay } from "@/lib/affiliation/model"
import type { PartnerStats } from "@/lib/affiliation/data"
import { cn } from "@/lib/utils"

export interface PartnerView {
  name: string
  code: string
  terms: string
  stats: PartnerStats
  weeks: { start: string; count: number }[]
  pages: { url: string; target: string | null; found: boolean; visits: number | null }[]
  lines: { id: string; date: string; plan: string; paid: number; commission: number; display: CommissionDisplay }[]
  targets: { title: string; path: string }[]
}

const LABEL: Record<CommissionDisplay, { label: string; tone: Tone }> = {
  pending: { label: "En attente", tone: "neutral" },
  due: { label: "Acquise", tone: "info" },
  paid_out: { label: "Reçue", tone: "ok" },
  void: { label: "Remboursé", tone: "danger" },
}

const DATE = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Paris" })
const WEEK = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" })
const n = (v: number) => v.toLocaleString("fr-FR")

export function PartnerStatsView({ view }: { view: PartnerView }) {
  const [period, setPeriod] = useState<"30" | "all">("30")
  const [target, setTarget] = useState(view.targets[0]?.path ?? "/")
  const [copied, setCopied] = useState(false)
  const s = view.stats
  const visits = period === "30" ? s.visits30 : s.visitsAll
  const signups = period === "30" ? s.signups30 : s.signupsAll
  const paid = period === "30" ? s.paid30 : s.paidAll
  const cutoff = Date.now() - 30 * 24 * 3600 * 1000
  const lines = period === "30" ? view.lines.filter((l) => new Date(l.date).getTime() >= cutoff) : view.lines
  const periodTotal = lines.filter((l) => l.display !== "void").reduce((sum, l) => sum + l.commission, 0)
  const periodPending = lines.filter((l) => l.display === "pending").reduce((sum, l) => sum + l.commission, 0)
  const max = Math.max(1, ...view.weeks.map((w) => w.count))
  const url = partnerLink(target, view.code)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4 pt-4">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[var(--q-text-3)]">{view.name} · code <span className="font-mono text-[var(--q-ink)]">{view.code}</span></span>
          <h1 className="font-display text-[34px] font-bold leading-[1.05] tracking-[-0.02em] md:text-[42px]">Vos liens, <span className="q-serif">vos résultats.</span></h1>
          <p className="max-w-[620px] text-[15px] text-[var(--q-text-3)] md:text-base">Ce que vos articles amènent à Qonforme, à jour à chaque ouverture. Les chiffres sont des totaux : aucun nom, aucune adresse.</p>
        </div>
        <div role="group" aria-label="Période" className="q-seg">
          <button type="button" aria-pressed={period === "30"} onClick={() => setPeriod("30")}>30 jours</button>
          <button type="button" aria-pressed={period === "all"} onClick={() => setPeriod("all")}>Depuis le début</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="q-card flex flex-col gap-1 p-4"><span className="text-xs font-semibold text-[var(--q-text-4)]">Visites amenées</span><span className="q-kpi-value">{n(visits)}</span><span className="q-kpi-sub">par vos liens</span></div>
        <div className="q-card flex flex-col gap-1 p-4"><span className="text-xs font-semibold text-[var(--q-text-4)]">Inscrits</span><span className="q-kpi-value">{n(signups)}</span><span className="q-kpi-sub">{percent(signups, visits)} de vos visites</span></div>
        <div className="q-card flex flex-col gap-1 p-4"><span className="text-xs font-semibold text-[var(--q-text-4)]">Abonnés payants</span><span className="q-kpi-value">{n(paid)}</span><span className="q-kpi-sub">{period === "30" ? "premier paiement ces 30 jours" : "Essentiel ou Artisan"}</span></div>
        <div className="q-card flex flex-col gap-1 border-[var(--q-wash-line)] bg-[var(--q-wash)] p-4"><span className="text-xs font-semibold text-[var(--q-text-4)]">Commission sur la période</span><span className="q-kpi-value !text-[var(--q-accent-strong)]">{euros(periodTotal)}</span><span className="q-kpi-sub">dont {euros(periodPending)} en attente</span></div>
      </div>

      <div className="flex flex-wrap items-stretch gap-4">
        <section className="q-card min-w-0 flex-[999_1_520px] p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="q-h2">Visites par semaine</h2><span className="text-xs text-[var(--q-text-4)]">8 dernières semaines</span></div>
          <div className="mt-4 flex h-[160px] items-end gap-2 border-b border-[var(--q-line)] sm:gap-3" role="img" aria-label={`Visites par semaine : ${view.weeks.map((w) => `${WEEK.format(new Date(w.start))} ${w.count}`).join(", ")}`}>
            {view.weeks.map((w) => (
              <div key={w.start} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
                <span className="text-xs tabular-nums text-[var(--q-text-3)]">{n(w.count)}</span>
                <div aria-hidden className="w-full max-w-12 rounded-t-md bg-[var(--q-accent)]" style={{ height: Math.max(3, Math.round((w.count / max) * 120)) }} />
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex gap-2 sm:gap-3">{view.weeks.map((w) => <span key={w.start} className="min-w-0 flex-1 truncate text-center text-[11px] text-[var(--q-text-4)]">{WEEK.format(new Date(w.start))}</span>)}</div>
        </section>
        <section className="q-card flex flex-[1_1_300px] flex-col gap-3 p-5 text-sm">
          <h2 className="q-h2">Votre commission</h2>
          <div className="flex justify-between"><span className="text-[var(--q-text-3)]">Acquise, à recevoir</span><span className="font-bold tabular-nums text-[var(--q-accent-strong)]">{euros(s.commissions.due)}</span></div>
          <div className="flex justify-between"><span className="text-[var(--q-text-3)]">En attente</span><span className="tabular-nums">{euros(s.commissions.pending)}</span></div>
          <div className="flex justify-between"><span className="text-[var(--q-text-3)]">Déjà reçue</span><span className="tabular-nums">{euros(s.commissions.paidOut)}</span></div>
          <div className="h-px bg-[var(--q-line-soft)]" />
          <p className="text-[13px] leading-relaxed text-[var(--q-text-4)]">
            {view.terms}. Une commission est acquise 30 jours après le paiement (délai de remboursement) ; un abonnement remboursé n&apos;en donne pas. Versement par virement.
          </p>
        </section>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <section className="q-card min-w-0 flex-[999_1_520px] overflow-x-auto">
          <h2 className="q-h2 px-5 pb-2 pt-4">Vos pages qui citent Qonforme</h2>
          {view.pages.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-[var(--q-text-4)]">Aucune page vérifiée pour l&apos;instant.</p>
          ) : (
            <table className="q-table">
              <thead><tr><th>Page</th><th>Lien vers</th><th>État</th><th className="q-num">Visites 30 j</th></tr></thead>
              <tbody>
                {view.pages.map((p) => (
                  <tr key={p.url}>
                    <td className="max-w-[320px] truncate font-medium">{p.url}</td>
                    <td><span className="font-mono text-[13px]">{p.target ?? "—"}</span></td>
                    <td><StatusPill tone={p.found ? "ok" : "danger"}>{p.found ? "Lien en place" : "Lien introuvable"}</StatusPill></td>
                    <td className="q-num">{p.visits === null ? "—" : n(p.visits)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="px-5 pb-4 pt-1 text-xs text-[var(--q-text-4)]">Vérifiées chaque semaine. Si un lien disparaît, vous le verrez ici.</p>
        </section>
        <section className="q-card flex flex-[1_1_340px] flex-col gap-2 p-5">
          <h2 className="q-h2 mb-1">Créer un lien pour un nouvel article</h2>
          {view.targets.map((t) => (
            <button
              key={t.path}
              type="button"
              aria-pressed={target === t.path}
              onClick={() => { setTarget(t.path); setCopied(false) }}
              className={cn("flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm", target === t.path ? "border-[var(--q-accent)] bg-[var(--q-wash)]" : "border-[var(--q-line)] bg-[var(--q-surface)] hover:bg-[var(--q-hover)]")}
            >
              <span aria-hidden className={cn("size-4 shrink-0 rounded-full border-2", target === t.path ? "border-[5px] border-[var(--q-accent)]" : "border-[var(--q-field)]")} />
              {t.title}
            </button>
          ))}
          <code className="mt-1 overflow-x-auto whitespace-nowrap rounded-[10px] border border-[var(--q-field)] bg-[var(--q-surface-2)] px-3 py-2.5 font-mono text-[13px]">{url}</code>
          <Button
            className="self-start"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url)
                setCopied(true)
              } catch {
                setCopied(false)
              }
            }}
          >
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
            {copied ? "Copié" : "Copier le lien"}
          </Button>
        </section>
      </div>

      <section className="q-card overflow-x-auto">
        <h2 className="q-h2 px-5 pb-2 pt-4">Détail des commissions</h2>
        {lines.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-[var(--q-text-4)]">Aucun paiement sur cette période.</p>
        ) : (
          <table className="q-table">
            <thead><tr><th>Paiement du</th><th>Formule</th><th className="q-num">Montant payé</th><th className="q-num">Commission</th><th>État</th></tr></thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id}>
                  <td className="tabular-nums">{DATE.format(new Date(l.date))}</td>
                  <td>{l.plan}</td>
                  <td className="q-num">{euros(l.paid)}</td>
                  <td className="q-num font-semibold">{l.display === "void" ? "—" : euros(l.commission)}</td>
                  <td><StatusPill tone={LABEL[l.display].tone}>{LABEL[l.display].label}</StatusPill></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="px-5 pb-4 pt-1 text-xs text-[var(--q-text-4)]">Chaque ligne est un paiement d&apos;un abonné venu de vos liens. Aucun nom ni aucune adresse n&apos;est affiché.</p>
      </section>
    </div>
  )
}
