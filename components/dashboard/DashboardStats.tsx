/**
 * Indicateurs du tableau de bord (réel et démo) :
 * - ordinateur : quatre cartes (canevas « Tableau de bord ») ;
 * - mobile : la carte « À encaisser » (canevas « Mobile — accueil »).
 *
 * Libellés fidèles à ce qui est calculé : « Facturé » par date d'émission ;
 * « encaissé » sous « À encaisser », seulement d'après les dates de paiement
 * saisies (une facture payée sans date n'est comptée nulle part) ;
 * « À échoir sous 30 jours », pas « Prévision » (elle est à /tresorerie).
 */
import { Clock } from "lucide-react"
import { Kpi } from "@/components/app/kit"
import { formatCurrency } from "@/lib/utils/invoice"
import { cn } from "@/lib/utils"
import { plural, type DashPeriod, type DashboardView } from "@/components/dashboard/model"
import { KPI_GRID, SOLID } from "@/components/dashboard/ui"

type Kpis = DashboardView["kpi"]

function signedPct(pct: number): string {
  return `${pct > 0 ? "+" : pct < 0 ? "−" : ""}${Math.abs(pct)}\u00a0%`
}

const NONE: Record<DashPeriod, string> = {
  mois: "Aucune facture émise ce mois-ci",
  trimestre: "Aucune facture émise ce trimestre",
  annee: "Aucune facture émise cette année",
}

/** Sous-titre de « Facturé … » : nombre de factures et comparaison à la période précédente. */
function periodSub({ amount, count, prevAmount, prevLabel, deltaPct }: Kpis["period"], period: DashPeriod): string {
  if (amount > 0) {
    const n = `${count}\u00a0${plural(count, "facture émise", "factures émises")}`
    if (period === "annee") return `${n} depuis janvier`
    return deltaPct !== null && prevLabel ? `${n} · ${signedPct(deltaPct)} vs ${prevLabel}` : n
  }
  if (prevAmount > 0 && prevLabel) {
    return `vs ${formatCurrency(prevAmount)} ${period === "mois" ? "en " : ""}${prevLabel}`
  }
  return NONE[period]
}

function openSub({ count }: Kpis["open"], collected?: Kpis["collected"]): string {
  const base = count > 0 ? `${count}\u00a0${plural(count, "facture en cours", "factures en cours")}` : "Aucune facture en attente"
  return collected && collected.amount > 0 ? `${base} · ${formatCurrency(collected.amount)} encaissés ${collected.label}` : base
}

function dueSoonSub({ count, untilLabel }: Kpis["dueSoon"]): string {
  return count > 0
    ? `${count}\u00a0${plural(count, "facture", "factures")} d'ici le ${untilLabel}`
    : `Aucune échéance d'ici le ${untilLabel}`
}

const clock = <Clock className="size-3.5" strokeWidth={2.25} aria-hidden />

/** Cartes d'indicateurs (≥ 768 px). */
export function DashboardStats({ kpi, period }: { kpi: Kpis; period: DashPeriod }) {
  const { late } = kpi
  return (
    <section aria-label="Indicateurs" className={cn(KPI_GRID, "hidden md:grid")}>
      <Kpi label={kpi.period.label} value={formatCurrency(kpi.period.amount)} sub={periodSub(kpi.period, period)} />
      <Kpi label="À encaisser" value={formatCurrency(kpi.open.amount)} sub={openSub(kpi.open, kpi.collected)} />
      {late.count > 0 ? (
        <Kpi
          tone="warn"
          icon={clock}
          label="En retard"
          value={formatCurrency(late.amount)}
          sub={`${late.count}\u00a0${plural(late.count, "facture", "factures")} · jusqu'à ${late.oldestDays}\u00a0j de retard`}
        />
      ) : (
        <Kpi label="En retard" value={formatCurrency(0)} sub="Aucune facture en retard" />
      )}
      <Kpi label="À échoir sous 30 jours" value={formatCurrency(kpi.dueSoon.amount)} sub={dueSoonSub(kpi.dueSoon)} />
    </section>
  )
}

/** Carte « À encaisser » de l'accueil mobile (< 768 px). */
export function MobileHero({ kpi }: { kpi: Kpis }) {
  const { open, late } = kpi
  return (
    <section aria-label="À encaisser" className={cn(SOLID, "flex flex-col gap-3.5 rounded-[22px] p-[18px] md:hidden")}>
      <div className="flex flex-col gap-1">
        <span className="text-[13px] text-[var(--q-text-3)]">À encaisser</span>
        <span className="font-display text-[38px] font-semibold leading-[1.05] tracking-[-0.04em] text-[var(--q-ink)] tabular-nums">
          {formatCurrency(open.amount)}
        </span>
        {late.count > 0 ? (
          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--q-warn)]">
            <Clock className="size-[13px]" strokeWidth={2.25} aria-hidden />
            dont {formatCurrency(late.amount)} en retard
          </span>
        ) : (
          <span className="text-[13px] text-[var(--q-text-4)]">{openSub(open)} · aucun retard</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2.5 border-t border-[var(--q-line)] pt-3">
        <span className="flex flex-col gap-0.5">
          <span className="text-xs text-[var(--q-text-4)]">Facturé ce mois</span>
          <span className="text-base font-semibold text-[var(--q-ink)] tabular-nums">{formatCurrency(kpi.month.amount)}</span>
        </span>
        {kpi.collected && kpi.collected.amount > 0 ? (
          <span className="flex flex-col gap-0.5">
            <span className="text-xs text-[var(--q-text-4)]">Encaissé {kpi.collected.label}</span>
            <span className="text-base font-semibold text-[var(--q-ink)] tabular-nums">{formatCurrency(kpi.collected.amount)}</span>
          </span>
        ) : (
          <span className="flex flex-col gap-0.5">
            <span className="text-xs text-[var(--q-text-4)]">À échoir sous 30 jours</span>
            <span className="text-base font-semibold text-[var(--q-ink)] tabular-nums">{formatCurrency(kpi.dueSoon.amount)}</span>
          </span>
        )}
      </div>
    </section>
  )
}
