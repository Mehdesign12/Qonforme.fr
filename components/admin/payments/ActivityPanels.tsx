import Link from "next/link"
import { CircleAlert } from "lucide-react"
import { EmptyState, Kpi, KpiGrid, Panel, StatusPill } from "@/components/app/kit"
import { fmtDate, fmtEuro, fmtInt } from "@/components/admin/ui"
import { ACTIVITY_WINDOW_DAYS, type ActivityResult } from "@/lib/stripe/admin-activity"
import type { StripeMode } from "@/lib/stripe/mode"
import { cn } from "@/lib/utils"

const euros = (cents: number) => fmtEuro(cents / 100, 2)

/** Production / bac à sable : deux liens, pas un interrupteur (aucun état enregistré). */
export function ModeTabs({ mode }: { mode: StripeMode }) {
  const tabs: { key: StripeMode; label: string }[] = [
    { key: "live", label: "Production" },
    { key: "test", label: "Essai" },
  ]
  return (
    <nav aria-label="Mode Stripe" className="inline-flex rounded-xl border border-[var(--q-line)] bg-[var(--q-surface)] p-1">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.key === "live" ? "/admin/payments" : "/admin/payments?mode=test"}
          aria-current={mode === t.key ? "page" : undefined}
          className={cn(
            "inline-flex h-9 min-w-[96px] items-center justify-center rounded-lg px-4 text-sm font-medium transition-colors",
            mode === t.key
              ? "bg-[var(--q-ink)] text-white"
              : "text-[var(--q-text-3)] hover:bg-[var(--q-sunken)]",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  )
}

export function ActivityPanels({ mode, activity }: { mode: StripeMode; activity: ActivityResult }) {
  if (!activity.ok) {
    return (
      <div role="alert" className="q-banner q-banner-warn items-start">
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>{activity.message}</p>
      </div>
    )
  }
  const { summary, payments, refunds, truncated } = activity
  const where = mode === "test" ? "du bac à sable" : "de production"

  return (
    <div className="flex flex-col gap-5">
      <KpiGrid>
        <Kpi label={`Encaissé (${ACTIVITY_WINDOW_DAYS} j)`} value={euros(summary.collected)} sub={`Net : ${euros(summary.net)}`} tone="ink" />
        <Kpi label="Remboursé" value={euros(summary.refunded)} sub={`Garantie ${ACTIVITY_WINDOW_DAYS} jours`} />
        <Kpi label="Abonnements actifs" value={fmtInt(summary.activeSubscriptions)} sub={summary.scheduledCancellations > 0 ? `${fmtInt(summary.scheduledCancellations)} résiliation(s) programmée(s)` : "Aucune résiliation programmée"} />
        <Kpi label="Paiements refusés" value={fmtInt(summary.failedPayments)} tone={summary.failedPayments > 0 ? "warn" : "default"} sub="Factures à régler après un échec" />
      </KpiGrid>

      <Panel title={`Paiements ${where}`} bodyClassName="pb-2">
        {payments.length === 0 ? (
          <EmptyState title="Aucun paiement" text={`Rien n'a encore été encaissé dans le mode ${mode === "test" ? "essai" : "production"}.`} />
        ) : (
          <ul className="divide-y divide-[var(--q-line-soft)] border-t border-[var(--q-line-soft)]">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
                <div className="flex min-w-0 flex-1 basis-[200px] flex-col">
                  <span className="truncate text-[15px] font-medium text-[var(--q-ink)]">{p.email ?? "Client sans email"}</span>
                  <span className="truncate text-sm text-[var(--q-text-4)]">
                    {fmtDate(p.date)} · {p.label}
                    {p.number ? ` · ${p.number}` : ""}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex flex-col items-end">
                    <span className="text-sm font-semibold tabular-nums text-[var(--q-ink)]">{euros(p.amount)}</span>
                    {p.refunded > 0 && <span className="text-xs tabular-nums text-[var(--q-text-4)]">{euros(p.refunded)} remboursés</span>}
                  </span>
                  <StatusPill tone={p.badge.tone}>{p.badge.label}</StatusPill>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title={`Remboursements ${where}`} bodyClassName="pb-2">
        {refunds.length === 0 ? (
          <EmptyState title="Aucun remboursement" text="Les remboursements de la garantie de 30 jours apparaissent ici, avec leur avoir." />
        ) : (
          <ul className="divide-y divide-[var(--q-line-soft)] border-t border-[var(--q-line-soft)]">
            {refunds.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
                <div className="flex min-w-0 flex-1 basis-[200px] flex-col">
                  <span className="truncate text-[15px] font-medium text-[var(--q-ink)]">{r.email ?? "Client inconnu"}</span>
                  <span className="truncate text-sm text-[var(--q-text-4)]">
                    {fmtDate(r.date)}
                    {r.invoiceNumber ? ` · facture ${r.invoiceNumber}` : ""}
                    {r.number ? ` · avoir ${r.number}` : ""}
                  </span>
                </div>
                <span className="text-sm font-semibold tabular-nums text-[var(--q-ink)]">− {euros(r.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {truncated && (
        <p className="text-sm text-[var(--q-text-4)]">
          Les chiffres portent sur les 100 dernières factures. Le détail complet est dans le tableau de bord Stripe.
        </p>
      )}
    </div>
  )
}
