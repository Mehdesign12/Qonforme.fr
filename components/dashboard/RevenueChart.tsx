/**
 * Graphique « Facturé » (canevas « Tableau de bord », carte « Encaissements ») :
 * six mois complets et le mois en cours, en barres CSS rendues côté serveur
 * (plus de Recharts ni de chargement différé).
 *
 * Montre le montant facturé par mois, seule donnée vraie disponible : la date
 * de paiement n'est pas enregistrée, donc pas d'« encaissé » ni de prévision
 * hachurée. Le dernier mois complet est mis en avant ; le mois en cours est
 * plus clair. Survol : bulle de détail ; lecteurs d'écran : tableau masqué.
 */
import { formatCurrency } from "@/lib/utils/invoice"
import { cn } from "@/lib/utils"
import { formatCompactEuro, niceScale, plural, type ChartMonth } from "@/components/dashboard/model"

const GRID_LINES = [0, 50, 100, 150]

export function RevenueChart({ chart, recoveryRate }: { chart: ChartMonth[]; recoveryRate: number | null }) {
  const max = Math.max(0, ...chart.map((m) => m.value))
  const { top, ticks } = niceScale(max)

  return (
    <section aria-labelledby="dash-chart-title" className="q-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id="dash-chart-title" className="q-h2">Facturé</h2>
          <p className="text-xs text-[var(--q-text-4)]">
            Factures émises, montants TTC par mois
            {recoveryRate !== null && <> · {recoveryRate}&nbsp;% du montant émis déjà réglé</>}
          </p>
        </div>
        <div className="flex items-center gap-4 text-[13px] text-[var(--q-text-2)]" aria-hidden>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-[3px] bg-[var(--q-accent-strong)]" />
            Facturé
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-[3px] bg-[var(--q-accent-strong)] opacity-40" />
            Mois en cours
          </span>
        </div>
      </div>

      <div className="relative mt-5 flex gap-3" aria-hidden>
        {/* Axe des montants */}
        <div className="flex h-[200px] w-11 shrink-0 -translate-y-[7px] flex-col justify-between text-right text-xs text-[var(--q-text-4)] tabular-nums">
          {ticks.map((t) => (
            <span key={t}>{formatCompactEuro(t)}</span>
          ))}
        </div>

        {/* Zone de tracé */}
        <div className="relative h-[200px] min-w-0 flex-1">
          {GRID_LINES.map((y) => (
            <div key={y} className="absolute inset-x-0 border-t border-dashed border-[var(--q-line-soft)]" style={{ top: y }} />
          ))}
          <div className="absolute inset-x-0 bottom-0 border-t border-[var(--q-field)]" />

          <div className="absolute inset-0 grid grid-cols-7 items-end gap-0.5">
            {chart.map((m, i) => {
              const pct = top > 0 ? (m.value / top) * 100 : 0
              // Montant affiché : dernier mois complet, et mois en cours (même à zéro)
              const showValue = (m.highlight && m.value > 0) || m.current
              return (
                <div key={m.key} className="group relative flex h-full flex-col items-center justify-end">
                  {showValue && (
                    <span
                      className={cn(
                        "mb-1.5 whitespace-nowrap text-xs tabular-nums",
                        m.current ? "text-[var(--q-text-4)]" : "font-semibold text-[var(--q-ink)]",
                      )}
                    >
                      {m.value > 0 ? formatCompactEuro(m.value) : "0\u00a0€"}
                      {m.current && <span className="max-sm:sr-only"> à ce jour</span>}
                    </span>
                  )}
                  <div
                    className={cn(
                      "w-[44%] rounded-t bg-[var(--q-accent-strong)] transition-[filter] duration-150 group-hover:brightness-110",
                      m.current && "opacity-40",
                    )}
                    style={{
                      height: `${pct}%`,
                      minHeight: m.value > 0 ? 2 : 0,
                      boxShadow: m.highlight && m.value > 0 ? "0 0 0 2px var(--q-surface), 0 0 0 4px rgba(29,78,216,.25)" : undefined,
                    }}
                  />
                  {/* Bulle de détail au survol (verre sur ordinateur, opaque sous 768 px) */}
                  <div
                    className={cn(
                      "q-float pointer-events-none absolute -top-1.5 z-10 hidden w-[200px] flex-col gap-1 rounded-xl px-3 py-2.5 text-xs group-hover:flex",
                      i <= 1 ? "left-0" : i >= 5 ? "right-0" : "left-1/2 -translate-x-1/2",
                    )}
                  >
                    <span className="font-semibold text-[var(--q-ink)]">
                      {m.long}
                      {m.current && " (en cours)"}
                    </span>
                    <span className="flex justify-between gap-3 text-[var(--q-text-2)] tabular-nums">
                      <span>Facturé</span>
                      <span className="font-semibold text-[var(--q-ink)]">{formatCurrency(m.value)}</span>
                    </span>
                    {m.count !== null && (
                      <span className="flex justify-between gap-3 text-[var(--q-text-2)] tabular-nums">
                        <span>{plural(m.count, "Facture émise", "Factures émises")}</span>
                        <span className="font-semibold text-[var(--q-ink)]">{m.count}</span>
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {max === 0 && (
            <p className="absolute inset-0 grid place-items-center text-sm text-[var(--q-text-4)]">
              Aucune facture émise sur ces mois.
            </p>
          )}
        </div>
      </div>

      {/* Mois */}
      <div className="ml-14 mt-2 grid grid-cols-7 gap-0.5 text-center text-xs text-[var(--q-text-4)]" aria-hidden>
        {chart.map((m) => (
          <span key={m.key} className={cn(m.highlight && "font-semibold text-[var(--q-ink)]")}>{m.short}</span>
        ))}
      </div>

      {/* Données pour les lecteurs d'écran. Le tableau est enveloppé : un <table>
          ignore la largeur de 1 px de sr-only et faisait défiler la page en largeur sur mobile. */}
      <div className="sr-only">
        <table>
          <caption>Montant facturé par mois</caption>
          <thead>
            <tr>
              <th scope="col">Mois</th>
              <th scope="col">Facturé TTC</th>
              <th scope="col">Factures émises</th>
            </tr>
          </thead>
          <tbody>
            {chart.map((m) => (
              <tr key={m.key}>
                <th scope="row">{m.long}{m.current ? " (en cours)" : ""}</th>
                <td>{formatCurrency(m.value)}</td>
                <td>{m.count ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
