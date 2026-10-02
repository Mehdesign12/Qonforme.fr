/**
 * Meilleurs clients par montant payé (réel et démo). Absente du canevas,
 * conservée de l'ancien tableau de bord dans la colonne de droite ; masquée
 * tant qu'aucune facture n'est payée.
 */
import Link from "next/link"
import { formatCurrency } from "@/lib/utils/invoice"
import type { DashboardView } from "@/components/dashboard/model"

export function TopClients({ clients }: { clients: DashboardView["topClients"] }) {
  if (clients.length === 0) return null
  const max = clients[0].total || 1

  return (
    <section aria-labelledby="dash-top" className="q-card p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 id="dash-top" className="q-h2">Meilleurs clients</h2>
        <span className="text-xs text-[var(--q-text-4)]">par montant payé</span>
      </div>
      <ol className="flex flex-col gap-3.5">
        {clients.map((c, i) => (
          <li key={c.key} className="flex items-center gap-3">
            <span className="w-4 shrink-0 text-xs text-[var(--q-text-4)] tabular-nums">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                {c.href ? (
                  <Link href={c.href} className="truncate text-sm font-semibold text-[var(--q-ink)] hover:text-[var(--q-accent-strong)]">
                    {c.name}
                  </Link>
                ) : (
                  <span className="truncate text-sm font-semibold text-[var(--q-ink)]">{c.name}</span>
                )}
                <span className="shrink-0 text-[13px] font-semibold text-[var(--q-ink)] tabular-nums">{formatCurrency(c.total)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--q-line-soft)]">
                <div
                  className="h-full rounded-full bg-[var(--q-accent-strong)]"
                  style={{ width: `${Math.max(4, Math.round((c.total / max) * 100))}%` }}
                />
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
