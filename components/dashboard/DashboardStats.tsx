/**
 * Indicateurs du tableau de bord (réel et démo) :
 * - ordinateur : quatre cartes (canevas « Tableau de bord ») ;
 * - mobile : la carte « À encaisser » (canevas « Mobile — accueil »).
 *
 * Libellés fidèles à ce qui est calculé : « Facturé », pas « Encaissé »
 * (date de paiement non enregistrée), « À échoir sous 30 jours », pas « Prévision ».
 */
import { Clock } from "lucide-react"
import { Kpi } from "@/components/app/kit"
import { formatCurrency } from "@/lib/utils/invoice"
import { cn } from "@/lib/utils"
import { plural, type DashboardView } from "@/components/dashboard/model"
import { KPI_GRID, SOLID } from "@/components/dashboard/ui"

type Kpis = DashboardView["kpi"]

function signedPct(pct: number): string {
  return `${pct > 0 ? "+" : pct < 0 ? "−" : ""}${Math.abs(pct)}\u00a0%`
}

/** Sous-titre de « Facturé ce mois » : nombre de factures et comparaison au mois précédent. */
function monthSub({ amount, count, prevAmount, prevMonthName, deltaPct }: Kpis["month"]): string {
  if (amount > 0) {
    const n = `${count}\u00a0${plural(count, "facture émise", "factures émises")}`
    return deltaPct !== null ? `${n} · ${signedPct(deltaPct)} vs ${prevMonthName}` : n
  }
  if (prevAmount > 0) return `vs ${formatCurrency(prevAmount)} en ${prevMonthName}`
  return "Aucune facture émise ce mois-ci"
}

function openSub({ count }: Kpis["open"]): string {
  return count > 0 ? `${count}\u00a0${plural(count, "facture en cours", "factures en cours")}` : "Aucune facture en attente"
}

function dueSoonSub({ count, untilLabel }: Kpis["dueSoon"]): string {
  return count > 0
    ? `${count}\u00a0${plural(count, "facture", "factures")} d'ici le ${untilLabel}`
    : `Aucune échéance d'ici le ${untilLabel}`
}

const clock = <Clock className="size-3.5" strokeWidth={2.25} aria-hidden />

/** Cartes d'indicateurs (≥ 768 px). */
export function DashboardStats({ kpi }: { kpi: Kpis }) {
  const { late } = kpi
  return (
    <section aria-label="Indicateurs du mois" className={cn(KPI_GRID, "hidden md:grid")}>
      <Kpi label="Facturé ce mois" value={formatCurrency(kpi.month.amount)} sub={monthSub(kpi.month)} />
      <Kpi label="À encaisser" value={formatCurrency(kpi.open.amount)} sub={openSub(kpi.open)} />
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
        <span className="flex flex-col gap-0.5">
          <span className="text-xs text-[var(--q-text-4)]">À échoir sous 30 jours</span>
          <span className="text-base font-semibold text-[var(--q-ink)] tabular-nums">{formatCurrency(kpi.dueSoon.amount)}</span>
        </span>
      </div>
    </section>
  )
}
