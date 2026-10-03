"use client"

/**
 * Boîte de réception « Factures reçues » : liste des factures fournisseurs,
 * onglets par étape du cycle de vie, recherche.
 *
 * Partagée par la page réelle (/received-invoices, API) et sa démo
 * (/demo/received-invoices, lib/demo/reception.ts) : même rendu des deux côtés.
 * Qonforme n'est pas raccordé à une plateforme agréée : la page le dit et
 * propose l'import manuel.
 */
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronRight, Inbox, Plus, RefreshCw, Upload } from "lucide-react"
import { cn } from "@/lib/utils"
import { EmptyState, Kpi, KpiGrid, PageHeader, SearchField } from "@/components/app/kit"
import { daysBetween, normalize, plural, shortDate, yearOf } from "@/components/invoices/invoice-view"
import { IN_DISPUTE, TO_PAY, TO_PROCESS } from "@/lib/reception/lifecycle"
import { isCreditNoteType } from "@/lib/reception/types"
import type { ReceivedListItem } from "@/lib/reception/view"
import { PlatformNotice, ReceptionUnavailable } from "@/components/reception/PlatformNotice"
import {
  LatePill, RECEIVED_TABS, ReceivedStatusPill, isUnpaid, money, signedMoney, type ReceivedTab,
} from "@/components/reception/reception-ui"

export interface ReceivedInvoiceListProps {
  invoices: ReceivedListItem[]
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  /** Migration pas encore appliquée : état « en cours de mise en service ». */
  unavailable?: boolean
  /** Date du jour « AAAA-MM-JJ ». */
  today: string
  hrefFor: (id: string) => string
  importHref: string
  settingsHref: string
}

const FILTER_PARAM: Record<string, ReceivedTab> = {
  "a-traiter": "todo", "a-payer": "topay", litiges: "dispute", payees: "paid", refusees: "refused",
}

/** Jours écoulés depuis l'échéance d'une facture encore à régler (0 sinon). */
function lateDays(inv: ReceivedListItem, today: string): number {
  if (!inv.due_date || !isUnpaid(inv.status) || isCreditNoteType(inv.document_type)) return 0
  return Math.max(0, daysBetween(inv.due_date, today))
}

export function ReceivedInvoiceList({
  invoices, loading, error, onRetry, unavailable, today, hrefFor, importHref, settingsHref,
}: ReceivedInvoiceListProps) {
  const router = useRouter()
  const [tab, setTab] = useState<ReceivedTab>("all")
  const [query, setQuery] = useState("")

  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("filtre")
    if (wanted && FILTER_PARAM[wanted]) setTab(FILTER_PARAM[wanted])
  }, [])

  const year = yearOf(today)
  const counts = useMemo(() => Object.fromEntries(RECEIVED_TABS.map((t) => [
    t.key, t.statuses ? invoices.filter((i) => t.statuses!.includes(i.status)).length : invoices.length,
  ])) as Record<ReceivedTab, number>, [invoices])

  const sum = (list: ReceivedListItem[]) => list.reduce((s, i) => s + (isCreditNoteType(i.document_type) ? -i.amount_due : i.amount_due), 0)
  const todo = invoices.filter((i) => TO_PROCESS.includes(i.status))
  const toPay = invoices.filter((i) => TO_PAY.includes(i.status))
  const overdue = toPay.filter((i) => lateDays(i, today) > 0)
  const disputes = invoices.filter((i) => IN_DISPUTE.includes(i.status))

  const rows = useMemo(() => {
    const def = RECEIVED_TABS.find((t) => t.key === tab)!
    const byTab = def.statuses ? invoices.filter((i) => def.statuses!.includes(i.status)) : invoices
    const q = normalize(query.trim())
    if (!q) return byTab
    return byTab.filter((i) => normalize(`${i.supplier_name} ${i.invoice_number} ${i.supplier_siren ?? ""}`).includes(q))
  }, [tab, invoices, query])

  const empty = !loading && !error && !unavailable && invoices.length === 0
  const activeTab = RECEIVED_TABS.find((t) => t.key === tab)!

  const importButton = (
    <Link href={importHref} className="q-btn q-btn-primary">
      <Upload aria-hidden />
      Importer une facture
    </Link>
  )

  const subtitle = loading || error || unavailable ? "Les factures de vos fournisseurs" : (
    <span className="tabular-nums">
      {invoices.length === 0 ? "Aucune facture reçue" : plural(invoices.length, "facture reçue", "factures reçues")}
      {toPay.length > 0 && <>{" · "}{money(sum(toPay))} à payer</>}
    </span>
  )

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Factures reçues"
        subtitle={subtitle}
        actions={!unavailable && <div className="hidden md:flex">{importButton}</div>}
      />

      {!unavailable && <PlatformNotice settingsHref={settingsHref} />}

      {unavailable ? (
        <ReceptionUnavailable settingsHref={settingsHref} />
      ) : loading ? (
        <ListSkeleton />
      ) : error ? (
        <section className="q-card">
          <EmptyState
            icon={<Inbox className="size-5" aria-hidden />}
            title="Impossible de charger vos factures reçues"
            text={error}
            action={onRetry && (
              <button type="button" className="q-btn q-btn-secondary" onClick={onRetry}>
                <RefreshCw aria-hidden />
                Réessayer
              </button>
            )}
          />
        </section>
      ) : empty ? (
        <section className="q-card">
          <EmptyState
            className="py-14"
            icon={<Inbox className="size-5" aria-hidden />}
            title="Aucune facture reçue pour l’instant"
            text="Importez les factures de vos fournisseurs reçues par email : Factur-X, XML (CII ou UBL) ou PDF. Qonforme les lit, les contrôle et suit leur traitement jusqu’au paiement."
            action={
              <Link href={importHref} className="q-btn q-btn-primary">
                <Plus strokeWidth={2.25} aria-hidden />
                Importer une facture
              </Link>
            }
          />
        </section>
      ) : (
        <>
          <KpiGrid className="lg:grid-cols-3">
            <Kpi label="À traiter" value={String(todo.length)} sub={todo.length ? `${money(sum(todo))} au total` : "Rien en attente"} />
            <Kpi
              label="À payer"
              value={money(sum(toPay))}
              tone={overdue.length ? "warn" : "default"}
              sub={overdue.length ? `dont ${plural(overdue.length, "facture échue", "factures échues")}` : toPay.length ? plural(toPay.length, "facture approuvée", "factures approuvées") : "Aucune facture approuvée"}
            />
            <Kpi label="En litige" value={String(disputes.length)} sub={disputes.length ? "Litiges et justificatifs demandés" : "Aucun litige"} className="col-span-2 lg:col-span-1" />
          </KpiGrid>

          {/* Onglets — ordinateur */}
          <div role="tablist" aria-label="Filtrer les factures reçues" className="q-tabs hidden md:flex">
            {RECEIVED_TABS.map((t) => {
              const active = tab === t.key
              return (
                <button key={t.key} type="button" role="tab" aria-selected={active} onClick={() => setTab(t.key)}>
                  {t.label}
                  <span className={cn("q-count", active && "rounded-[6px] bg-[var(--q-wash)] px-[7px] py-px font-semibold")}>{counts[t.key]}</span>
                </button>
              )
            })}
          </div>

          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Fournisseur, numéro, SIREN…"
            aria-label="Rechercher une facture reçue"
            className="h-12 w-full rounded-2xl md:h-9 md:w-[300px] md:rounded-[9px]"
          />

          {/* Onglets — mobile : pastilles défilantes */}
          <div role="tablist" aria-label="Filtrer les factures reçues" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden">
            {RECEIVED_TABS.map((t) => {
              const active = tab === t.key
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "inline-flex h-[38px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm",
                    active
                      ? "border-[var(--q-ink-strong)] bg-[var(--q-ink-strong)] font-semibold text-[var(--q-surface)]"
                      : "border-[var(--q-field)] bg-[var(--q-surface)] font-medium text-[var(--q-text-2)]",
                  )}
                >
                  {t.label}
                  <span className={cn("text-xs tabular-nums", active ? "opacity-70" : "text-[var(--q-text-4)]")}>{counts[t.key]}</span>
                </button>
              )
            })}
          </div>

          {rows.length === 0 ? (
            <section className="q-card">
              <EmptyState
                icon={<Inbox className="size-5" aria-hidden />}
                title={query.trim() ? "Aucune facture ne correspond à cette recherche" : activeTab.empty}
                text={query.trim() ? "Vérifiez le nom du fournisseur ou le numéro." : undefined}
              />
            </section>
          ) : (
            <>
              {/* Ordinateur : tableau */}
              <section aria-label="Liste des factures reçues" className="q-card hidden overflow-hidden md:block">
                <div className="overflow-x-auto">
                  <table className="q-table min-w-[760px]">
                    <thead className="bg-[var(--q-surface-2)] [&_th]:border-t-0">
                      <tr>
                        <th scope="col">Fournisseur</th>
                        <th scope="col">Numéro</th>
                        <th scope="col">Date</th>
                        <th scope="col">Échéance</th>
                        <th scope="col" className="is-num">Montant TTC</th>
                        <th scope="col">Statut</th>
                        <th scope="col" className="w-12"><span className="sr-only">Ouvrir</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((inv) => {
                        const href = hrefFor(inv.id)
                        const late = lateDays(inv, today)
                        const credit = isCreditNoteType(inv.document_type)
                        return (
                          <tr key={inv.id} onClick={() => router.push(href)} className="cursor-pointer">
                            <td className="max-w-[280px]">
                              <Link href={href} className="block truncate font-semibold hover:underline">{inv.supplier_name}</Link>
                            </td>
                            <td className="whitespace-nowrap text-[13px]">
                              <span className="font-mono text-[var(--q-text-2)]">{inv.invoice_number}</span>
                              {credit && <span className="q-tag ml-2">Avoir</span>}
                            </td>
                            <td className="whitespace-nowrap text-[var(--q-text-3)]">{shortDate(inv.issue_date, year)}</td>
                            <td className={cn("whitespace-nowrap", late > 0 ? "font-semibold text-[var(--q-warn)]" : "text-[var(--q-text-3)]")}>
                              {shortDate(inv.due_date, year)}
                            </td>
                            <td className="is-num whitespace-nowrap font-semibold">{signedMoney(inv)}</td>
                            <td>
                              <span className="flex flex-wrap items-center gap-1.5">
                                <ReceivedStatusPill status={inv.status} />
                                {late > 0 && <LatePill days={late} />}
                              </span>
                            </td>
                            <td>
                              <Link
                                href={href}
                                aria-label={`Ouvrir la facture ${inv.invoice_number} de ${inv.supplier_name}`}
                                className="grid size-[30px] place-items-center rounded-lg text-[var(--q-text-4)] hover:bg-[var(--q-hover)]"
                              >
                                <ChevronRight className="size-4" aria-hidden />
                              </Link>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[var(--q-surface-2)] text-[13px]">
                        <td colSpan={4} className="border-t border-[var(--q-line-soft)] text-[var(--q-text-3)]">
                          {plural(rows.length, "facture", "factures")}
                        </td>
                        <td className="is-num whitespace-nowrap border-t border-[var(--q-line-soft)] font-semibold">{money(sum(rows))}</td>
                        <td colSpan={2} className="border-t border-[var(--q-line-soft)]" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>

              {/* Mobile : lignes */}
              <section aria-label="Liste des factures reçues" className="q-card q-list overflow-hidden rounded-[18px] md:hidden">
                {rows.map((inv) => {
                  const late = lateDays(inv, today)
                  return (
                    <Link key={inv.id} href={hrefFor(inv.id)} className="q-list-row">
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-[15px] font-semibold">{inv.supplier_name}</span>
                        <span className="truncate font-mono text-xs text-[var(--q-text-4)]">
                          {inv.invoice_number} · {shortDate(inv.issue_date, year)}
                          {isCreditNoteType(inv.document_type) ? " · avoir" : ""}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-[15px] font-semibold tabular-nums">{signedMoney(inv)}</span>
                        {late > 0 ? <LatePill days={late} /> : <ReceivedStatusPill status={inv.status} />}
                      </span>
                    </Link>
                  )
                })}
              </section>
            </>
          )}
        </>
      )}

      {/* Mobile : import, au-dessus de la barre du bas */}
      {!unavailable && !loading && (
        <Link href={importHref} className="q-btn q-btn-primary q-btn-lg w-full md:hidden">
          <Upload aria-hidden />
          Importer une facture
        </Link>
      )}
    </div>
  )
}

/** Squelette statique (pas d'animation en boucle : règle iOS de CLAUDE.md). */
function ListSkeleton() {
  return (
    <section className="q-card q-list overflow-hidden" aria-busy="true" aria-label="Chargement des factures reçues">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="q-list-row">
          <span className="flex flex-1 flex-col gap-2">
            <span className="h-3.5 w-40 max-w-full rounded bg-[var(--q-sunken)]" />
            <span className="h-3 w-56 max-w-full rounded bg-[var(--q-line-soft)]" />
          </span>
          <span className="h-3.5 w-20 rounded bg-[var(--q-sunken)]" />
        </div>
      ))}
      <span className="sr-only">Chargement des factures reçues…</span>
    </section>
  )
}
