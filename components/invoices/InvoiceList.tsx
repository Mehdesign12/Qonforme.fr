"use client"

/**
 * Liste des factures (canevas « Factures », « Factures-vide », « Mobile-factures »).
 *
 * Composant de présentation partagé par la page réelle (/invoices, données de
 * l'API) et sa démo (/demo/invoices, lib/demo/data.ts) : même rendu des deux
 * côtés. Filtres et recherche se font ici, sur la liste déjà chargée.
 *
 * Pas de colonne « Transmission », de « Reste dû » ni d'actions groupées :
 * la transmission par plateforme agréée et le paiement partiel ne sont pas
 * livrés (DECISIONS-STRATEGIQUES.md § 10).
 */
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Archive, ChevronRight, FileText, Plus, RotateCcw, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils/invoice"
import { DocStatusPill, EmptyState, Kpi, KpiGrid, PageHeader, SearchField } from "@/components/app/kit"
import {
  type InvoiceListItem, OPEN_STATUSES, daysLate, isLate, isOpen, normalize, plural, shortDate, yearOf,
} from "@/components/invoices/invoice-view"

type TabKey = "all" | "open" | "late" | "draft" | "paid" | "archived"

/** Valeurs de « ?filtre= » acceptées dans l'URL. */
const FILTER_PARAM: Record<string, TabKey> = {
  "a-encaisser": "open",
  retard: "late",
  brouillons: "draft",
  payees: "paid",
  archives: "archived",
}

const TABS: { key: TabKey; label: string; empty: string }[] = [
  { key: "all",      label: "Toutes",      empty: "Aucune facture" },
  { key: "open",     label: "À encaisser", empty: "Aucune facture à encaisser" },
  { key: "late",     label: "En retard",   empty: "Aucune facture en retard" },
  { key: "draft",    label: "Brouillons",  empty: "Aucun brouillon" },
  { key: "paid",     label: "Payées",      empty: "Aucune facture payée" },
  { key: "archived", label: "Archivées",   empty: "Aucune facture archivée" },
]

export interface InvoiceListProps {
  /** Factures non archivées. */
  invoices: InvoiceListItem[]
  /** Factures archivées (null : pas encore chargées). */
  archived: InvoiceListItem[] | null
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  /** Date du jour « AAAA-MM-JJ » (retards, année du sous-titre). */
  today: string
  hrefFor: (id: string) => string
  newHref: string
  quoteNewHref: string
  creditNotesHref: string
  creditNotesCount?: number | null
  /** Actions secondaires de l'en-tête (ex. « Exporter »), avant « Nouvelle facture ». */
  extraActions?: React.ReactNode
}

export function InvoiceList({
  invoices, archived, loading, error, onRetry, today, hrefFor,
  newHref, quoteNewHref, creditNotesHref, creditNotesCount, extraActions,
}: InvoiceListProps) {
  const router = useRouter()
  const [tab, setTab] = useState<TabKey>("all")
  const [query, setQuery] = useState("")

  // Onglet demandé par un lien (tableau de bord : « ?filtre=retard ») ; lu après le
  // montage pour ne pas imposer de frontière Suspense à useSearchParams.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const wanted = params.get("archived") === "true" ? "archives" : params.get("filtre")
    const fromUrl = wanted ? FILTER_PARAM[wanted] : undefined
    if (fromUrl) setTab(fromUrl)
  }, [])

  const year = yearOf(today)

  const counts = useMemo<Record<TabKey, number | null>>(() => ({
    all: invoices.length,
    open: invoices.filter((i) => isOpen(i.status)).length,
    late: invoices.filter((i) => isLate(i.status, i.due_date, today)).length,
    draft: invoices.filter((i) => i.status === "draft").length,
    paid: invoices.filter((i) => i.status === "paid").length,
    archived: archived ? archived.length : null,
  }), [invoices, archived, today])

  const dueTotal = useMemo(
    () => invoices.filter((i) => OPEN_STATUSES.includes(i.status)).reduce((s, i) => s + i.total_ttc, 0),
    [invoices],
  )
  const inYear = invoices.filter((i) => yearOf(i.issue_date) === year).length

  const rows = useMemo(() => {
    const source = tab === "archived" ? archived ?? [] : invoices
    const byTab = source.filter((i) => {
      switch (tab) {
        case "open": return isOpen(i.status)
        case "late": return isLate(i.status, i.due_date, today)
        case "draft": return i.status === "draft"
        case "paid": return i.status === "paid"
        default: return true
      }
    })
    const q = normalize(query.trim())
    if (!q) return byTab
    return byTab.filter((i) =>
      normalize(`${i.invoice_number} ${i.client_name ?? ""} ${i.subject ?? ""}`).includes(q),
    )
  }, [tab, invoices, archived, query, today])

  const rowsTtc = rows.reduce((s, i) => s + i.total_ttc, 0)
  const rowsDue = rows.filter((i) => isOpen(i.status)).reduce((s, i) => s + i.total_ttc, 0)
  const noInvoiceYet = !loading && !error && invoices.length === 0 && (archived?.length ?? 0) === 0
  const activeTab = TABS.find((t) => t.key === tab)!

  const subtitle = loading || error ? " " : (
    <span className="tabular-nums">
      {inYear === 0 ? `Aucune facture en ${year}` : `${plural(inYear, "facture", "factures")} en ${year}`}
      {" · "}
      {formatCurrency(dueTotal)} à encaisser
    </span>
  )

  const tabCount = (n: number | null, active: boolean) =>
    n === null ? null : (
      <span className={cn("q-count", active && "rounded-[6px] bg-[var(--q-wash)] px-[7px] py-px font-semibold")}>{n}</span>
    )

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Factures"
        subtitle={subtitle}
        actions={
          <div className="hidden flex-wrap items-center gap-2 md:flex">
            {extraActions}
            <Link href={newHref} className="q-btn q-btn-primary">
              <Plus strokeWidth={2.25} aria-hidden />
              Nouvelle facture
            </Link>
          </div>
        }
      />

      <div className="flex flex-col gap-4">
        {/* Onglets — ordinateur : soulignés, avec compteur (réduits à « Factures · Avoirs » tant qu'il n'y a aucune facture) */}
        <div role="tablist" aria-label="Filtrer les factures" className="q-tabs hidden md:flex">
          {noInvoiceYet ? (
            <button type="button" role="tab" aria-selected>
              Factures
              {tabCount(0, true)}
            </button>
          ) : TABS.map((t) => {
            const active = tab === t.key
            return (
              <button key={t.key} type="button" role="tab" aria-selected={active} onClick={() => setTab(t.key)}>
                {t.key === "archived" && <Archive className="size-3.5" aria-hidden />}
                {t.label}
                {tabCount(counts[t.key], active)}
              </button>
            )
          })}
          <Link href={creditNotesHref}>
            Avoirs
            {creditNotesCount != null && <span className="q-count">{creditNotesCount}</span>}
          </Link>
        </div>

        {/* Recherche (au-dessus des pastilles sur mobile, sous les onglets sur ordinateur) */}
        <div className={cn("flex flex-wrap items-center gap-2", noInvoiceYet && "hidden")}>
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Numéro, client, objet…"
            aria-label="Rechercher une facture"
            className="h-12 w-full rounded-2xl md:h-9 md:w-[300px] md:rounded-[9px]"
          />
        </div>

        {/* Onglets — mobile : pastilles défilantes */}
        <div role="tablist" aria-label="Filtrer les factures" className={cn("-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden", noInvoiceYet && "!hidden")}>
          {TABS.map((t) => {
            const active = tab === t.key
            const n = counts[t.key]
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
                {n !== null && <span className={cn("text-xs tabular-nums", active ? "opacity-70" : "text-[var(--q-text-4)]")}>{n}</span>}
              </button>
            )
          })}
        </div>
      </div>

      {tab === "archived" && !loading && (
        <div className="q-banner">
          <Archive className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>Les factures archivées n&apos;apparaissent pas dans les autres onglets. Elles restent consultables et téléchargeables ici.</p>
        </div>
      )}

      {loading ? (
        <ListSkeleton />
      ) : error ? (
        <section className="q-card">
          <EmptyState
            icon={<FileText className="size-5" aria-hidden />}
            title="Impossible de charger vos factures"
            text={error}
            action={onRetry && (
              <button type="button" className="q-btn q-btn-secondary" onClick={onRetry}>
                <RefreshCw aria-hidden />
                Réessayer
              </button>
            )}
          />
        </section>
      ) : noInvoiceYet && tab !== "archived" ? (
        <>
        {/* Compte neuf : les indicateurs de suivi, à zéro (planche Factures-vide) */}
        <KpiGrid className="lg:grid-cols-3">
          <Kpi label="À encaisser" value={formatCurrency(0)} sub="Aucune facture en attente" />
          <Kpi label="En retard" value="0" sub="Rien à relancer" />
          <Kpi label="Brouillons" value="0" sub="Aucun brouillon en cours" className="col-span-2 lg:col-span-1" />
        </KpiGrid>
        <section className="q-card">
          <EmptyState
            className="py-14"
            icon={<FileText className="size-5" aria-hidden />}
            title="Aucune facture pour l’instant"
            text="Transformez un devis accepté en facture en un clic, ou créez une facture directe. Elle part par email à votre client, avec son PDF."
            action={
              <>
                <Link href={newHref} className="q-btn q-btn-primary">
                  <Plus strokeWidth={2.25} aria-hidden />
                  Nouvelle facture
                </Link>
                <Link href={quoteNewHref} className="q-btn q-btn-secondary">Faire un devis d&apos;abord</Link>
              </>
            }
          />
        </section>
        </>
      ) : rows.length === 0 ? (
        <section className="q-card">
          <EmptyState
            icon={tab === "archived" ? <Archive className="size-5" aria-hidden /> : <FileText className="size-5" aria-hidden />}
            title={query.trim() ? "Aucune facture ne correspond à cette recherche" : activeTab.empty}
            text={query.trim() ? "Vérifiez le numéro ou le nom du client." : undefined}
          />
        </section>
      ) : (
        <>
          {/* Ordinateur : tableau */}
          <section aria-label="Liste des factures" className="q-card hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="q-table min-w-[760px]">
                <thead className="bg-[var(--q-surface-2)] [&_th]:border-t-0">
                  <tr>
                    <th scope="col">Numéro</th>
                    <th scope="col">Client · objet</th>
                    <th scope="col">Émise</th>
                    <th scope="col">Échéance</th>
                    <th scope="col" className="is-num">Total TTC</th>
                    <th scope="col">Statut</th>
                    <th scope="col" className="w-12"><span className="sr-only">Ouvrir</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((inv) => {
                    const href = hrefFor(inv.id)
                    const late = isLate(inv.status, inv.due_date, today)
                    return (
                      <tr
                        key={inv.id}
                        onClick={() => router.push(href)}
                        className={cn("cursor-pointer", inv.is_archived && tab !== "archived" && "opacity-60")}
                      >
                        <td className="whitespace-nowrap text-[13px]">
                          <Link href={href} className="font-mono text-[var(--q-accent-strong)] hover:underline">
                            {inv.invoice_number}
                          </Link>
                        </td>
                        <td className="max-w-[320px]">
                          <span className="block truncate font-semibold">{inv.client_name ?? "—"}</span>
                          {inv.subject && <span className="block truncate text-xs text-[var(--q-text-4)]">{inv.subject}</span>}
                        </td>
                        <td className="whitespace-nowrap text-[var(--q-text-3)]">{shortDate(inv.issue_date, year)}</td>
                        <td className={cn("whitespace-nowrap", late ? "font-semibold text-[var(--q-warn)]" : "text-[var(--q-text-3)]")}>
                          {shortDate(inv.due_date, year)}
                        </td>
                        <td className="is-num whitespace-nowrap font-semibold">{formatCurrency(inv.total_ttc)}</td>
                        <td><ListPill inv={inv} today={today} /></td>
                        <td>
                          <Link
                            href={href}
                            aria-label={`Ouvrir ${inv.invoice_number}`}
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
                    <td className="is-num whitespace-nowrap border-t border-[var(--q-line-soft)] font-semibold">
                      {formatCurrency(rowsTtc)}
                    </td>
                    <td colSpan={2} className="whitespace-nowrap border-t border-[var(--q-line-soft)] tabular-nums text-[var(--q-text-4)]">
                      {rowsDue > 0 && `dont ${formatCurrency(rowsDue)} à encaisser`}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {/* Mobile : lignes */}
          <section aria-label="Liste des factures" className="q-card q-list overflow-hidden rounded-[18px] md:hidden">
            {rows.map((inv) => (
              <Link key={inv.id} href={hrefFor(inv.id)} className={cn("q-list-row", inv.is_archived && tab !== "archived" && "opacity-60")}>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-semibold">{inv.client_name ?? "—"}</span>
                  <span className="truncate font-mono text-xs text-[var(--q-text-4)]">
                    {inv.invoice_number}{inv.subject ? ` · ${inv.subject}` : ""}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-[15px] font-semibold tabular-nums">{formatCurrency(inv.total_ttc)}</span>
                  <ListPill inv={inv} today={today} />
                </span>
              </Link>
            ))}
          </section>
        </>
      )}

      {/* Mobile : accès aux avoirs (onglet sur ordinateur) */}
      {!loading && (
        <section className="q-card q-list overflow-hidden rounded-[18px] md:hidden">
          <Link href={creditNotesHref} className="q-list-row">
            <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-[var(--q-wash)] text-[var(--q-accent-strong)]">
              <RotateCcw className="size-4" aria-hidden />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[15px] font-semibold">Avoirs</span>
              {creditNotesCount != null && (
                <span className="text-[13px] tabular-nums text-[var(--q-text-4)]">
                  {creditNotesCount === 0 ? "Aucun avoir émis" : plural(creditNotesCount, "avoir émis", "avoirs émis")}
                </span>
              )}
            </span>
            <ChevronRight className="size-4 text-[var(--q-text-4)]" aria-hidden />
          </Link>
        </section>
      )}
    </div>
  )
}

/** Pastille de la liste : le retard prime, avec son nombre de jours. */
function ListPill({ inv, today }: { inv: InvoiceListItem; today: string }) {
  const late = daysLate(inv.status, inv.due_date, today)
  if (late > 0) return <DocStatusPill kind="invoice" status="overdue" label={`Retard ${late} j`} />
  return <DocStatusPill kind="invoice" status={inv.status} />
}

/** Squelette statique (pas d'animation en boucle : règle iOS de CLAUDE.md). */
function ListSkeleton() {
  return (
    <section className="q-card q-list overflow-hidden" aria-busy="true" aria-label="Chargement des factures">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="q-list-row">
          <span className="flex flex-1 flex-col gap-2">
            <span className="h-3.5 w-40 max-w-full rounded bg-[var(--q-sunken)]" />
            <span className="h-3 w-56 max-w-full rounded bg-[var(--q-line-soft)]" />
          </span>
          <span className="h-3.5 w-20 rounded bg-[var(--q-sunken)]" />
        </div>
      ))}
      <span className="sr-only">Chargement des factures…</span>
    </section>
  )
}
