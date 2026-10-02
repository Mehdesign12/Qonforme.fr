/**
 * « Dernières factures » (réel et démo) : tableau sur ordinateur (canevas
 * « Tableau de bord »), liste sur mobile (canevas « Mobile — accueil »).
 *
 * Une seule colonne de statut : le canevas montre aussi « Paiement partiel »
 * et « Transmission », qui n'existent pas dans l'application (DECISIONS § 10).
 */
import Link from "next/link"
import { FileText } from "lucide-react"
import { formatCurrency } from "@/lib/utils/invoice"
import { cn } from "@/lib/utils"
import { formatShortDate, hrefFor, type DashMode, type RecentRow } from "@/components/dashboard/model"
import { InvoicePill, ListHeading } from "@/components/dashboard/ui"

function Empty({ newHref }: { newHref: string }) {
  return (
    <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
      <FileText className="size-8 text-[var(--q-placeholder)]" strokeWidth={1.25} aria-hidden />
      <p className="text-[15px] text-[var(--q-text-3)]">Vos factures apparaîtront ici.</p>
      <Link href={newHref} className="q-btn q-btn-secondary">Créer une facture</Link>
    </div>
  )
}

export function RecentInvoices({ rows, mode }: { rows: RecentRow[]; mode: DashMode }) {
  const allHref = hrefFor(mode, "/invoices")
  const newHref = hrefFor(mode, "/invoices/new")

  return (
    <>
      {/* Mobile : liste */}
      <section aria-labelledby="dash-recent-m" className="flex flex-col gap-2 md:hidden">
        <ListHeading
          id="dash-recent-m"
          title="Dernières factures"
          aside={rows.length > 0 && <Link href={allHref} className="q-link text-[13px]">Tout voir</Link>}
        />
        <div className="q-card q-list overflow-hidden rounded-[18px]">
          {rows.length === 0 ? (
            <Empty newHref={newHref} />
          ) : (
            rows.map((r) => (
              <Link
                key={r.id}
                href={r.href}
                className="flex min-h-[60px] items-center gap-3 px-3.5 py-2.5 transition-colors active:bg-[var(--q-row-hover)]"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-semibold text-[var(--q-ink)]">{r.clientName ?? "Client inconnu"}</span>
                  <span className="font-mono text-xs text-[var(--q-text-4)]">{r.number}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-[15px] font-semibold text-[var(--q-ink)] tabular-nums">{formatCurrency(r.total)}</span>
                  <InvoicePill status={r.status} lateDays={r.lateDays} compact />
                </span>
              </Link>
            ))
          )}
        </div>
      </section>

      {/* Ordinateur : tableau */}
      <section aria-labelledby="dash-recent" className="q-card hidden overflow-hidden md:block">
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <h2 id="dash-recent" className="q-h2">Dernières factures</h2>
          {rows.length > 0 && <Link href={allHref} className="q-link text-[13px]">Tout voir</Link>}
        </div>
        {rows.length === 0 ? (
          <Empty newHref={newHref} />
        ) : (
          <div className="overflow-x-auto">
            <table className="q-table min-w-[640px]">
              <thead>
                <tr>
                  <th scope="col">Numéro</th>
                  <th scope="col">Client</th>
                  <th scope="col">Échéance</th>
                  <th scope="col" className="is-num">Montant TTC</th>
                  <th scope="col">Statut</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">
                      <Link href={r.href} className="font-mono text-[13px] text-[var(--q-text-2)] hover:text-[var(--q-accent-strong)] hover:underline">
                        {r.number}
                      </Link>
                    </td>
                    <td>
                      <span className="block font-semibold">{r.clientName ?? "Client inconnu"}</span>
                      {r.clientCity && <span className="text-xs text-[var(--q-text-4)]">{r.clientCity}</span>}
                    </td>
                    <td className={cn("whitespace-nowrap", r.lateDays ? "font-semibold text-[var(--q-warn)]" : "text-[var(--q-text-2)]")}>
                      {r.dueDate ? formatShortDate(r.dueDate) : "—"}
                    </td>
                    <td className="is-num whitespace-nowrap font-semibold">{formatCurrency(r.total)}</td>
                    <td>
                      <InvoicePill status={r.status} lateDays={r.lateDays} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
