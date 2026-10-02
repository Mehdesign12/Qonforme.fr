"use client"

/**
 * Liste des avoirs (canevas « Avoirs », « Avoirs-vide », « Mobile-avoirs »).
 *
 * Composant de présentation partagé par /credit-notes (données de l'API) et
 * /demo/credit-notes (lib/demo/data.ts) : la démo est un miroir exact.
 *
 * Un avoir n'a pas de statut dans le code (ni « à imputer », ni « remboursé ») :
 * pas de pastille ni d'indicateur de ce genre, seulement ce qui se calcule sur
 * les avoirs eux-mêmes. Un avoir se crée depuis la facture concernée (« Créer
 * un avoir » sur sa fiche) : le bouton de la page mène donc aux factures.
 */
import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FileText, Loader2, Plus, ReceiptText } from "lucide-react"
import { EmptyState, Kpi, KpiGrid, PageHeader, SearchField } from "@/components/app/kit"
import { InfoNote, negCurrency } from "@/components/purchase-orders/detail-bits"
import { addDays, normalizeSearch, plural, shortDate } from "@/components/quotes/QuoteListHelpers"

export interface CreditNoteListItem {
  id: string
  credit_note_number: string
  issue_date: string
  /** Montant de l'avoir (positif, affiché en négatif). */
  total_ttc: number
  reason: string
  client_name: string | null
  invoice_number: string | null
  invoice_href: string | null
  href: string
}

export function CreditNoteListView({
  items,
  loading = false,
  error = null,
  onRetry,
  today,
  invoicesHref,
  newInvoiceHref,
}: {
  items: CreditNoteListItem[]
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  /** « Aujourd'hui » (AAAA-MM-JJ) : date du navigateur, ou date fixe de la démo. */
  today: string
  invoicesHref: string
  newInvoiceHref: string
}) {
  const router = useRouter()
  const [query, setQuery] = useState("")

  const stats = useMemo(() => {
    const year = today.slice(0, 4)
    const since = addDays(today, -90)
    const ofYear = items.filter((c) => c.issue_date.startsWith(year))
    const recent = items.filter((c) => c.issue_date >= since)
    const sum = (list: CreditNoteListItem[]) => list.reduce((s, c) => s + Number(c.total_ttc), 0)
    return {
      year,
      yearCount: ofYear.length,
      yearSum: sum(ofYear),
      recentCount: recent.length,
      recentSum: sum(recent),
      invoices: new Set(items.map((c) => c.invoice_number).filter(Boolean)).size,
    }
  }, [items, today])

  const visible = useMemo(() => {
    const q = normalizeSearch(query)
    if (!q) return items
    return items.filter((c) =>
      normalizeSearch(`${c.credit_note_number} ${c.client_name ?? ""} ${c.reason} ${c.invoice_number ?? ""}`).includes(q),
    )
  }, [items, query])

  const visibleSum = visible.reduce((s, c) => s + Number(c.total_ttc), 0)

  const tabs = (count: number | null) => (
    <div className="q-tabs hidden md:flex" aria-label="Factures et avoirs">
      <Link href={invoicesHref}>
        <FileText className="size-[15px]" strokeWidth={1.75} aria-hidden />
        Factures
      </Link>
      <button type="button" className="is-active" aria-current="page">
        Avoirs
        {count != null && (
          <span className="q-count rounded-md bg-[var(--q-wash)] px-[7px] py-px font-semibold">{count}</span>
        )}
      </button>
    </div>
  )

  const howTo = (
    <InfoNote>
      Un avoir se crée depuis la facture concernée : ouvrez-la, puis «&nbsp;Créer un avoir&nbsp;».
    </InfoNote>
  )

  /* ── Chargement / erreur ── */
  if (loading || error) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Avoirs" />
        {tabs(null)}
        <div className="q-card grid min-h-[280px] place-items-center p-8">
          {loading ? (
            <Loader2 className="size-6 animate-spin text-[var(--q-accent)]" aria-label="Chargement des avoirs" />
          ) : (
            <EmptyState
              title="Les avoirs n'ont pas pu être chargés"
              text={error}
              action={onRetry && <button type="button" className="q-btn q-btn-secondary" onClick={onRetry}>Réessayer</button>}
            />
          )}
        </div>
      </div>
    )
  }

  /* ── Aucun avoir (canevas « Avoirs-vide ») ── */
  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Avoirs"
          subtitle={`Aucun avoir émis en ${stats.year}`}
          actions={
            <Link href={newInvoiceHref} className="q-btn q-btn-primary hidden md:inline-flex">
              <Plus strokeWidth={2.25} aria-hidden />
              Nouvelle facture
            </Link>
          }
        />
        {tabs(0)}
        <section className="q-card" aria-label="Aucun avoir">
          <EmptyState
            className="py-12"
            icon={<ReceiptText className="size-6" strokeWidth={1.75} aria-hidden />}
            title={<span className="text-[19px] tracking-[-0.01em]">Aucun avoir émis</span>}
            text={
              <span className="block max-w-[460px] text-[15px] leading-relaxed text-[var(--q-text-3)]">
                Un avoir annule tout ou partie d&apos;une facture déjà émise : prestation non réalisée, erreur de facturation.
                Vous le créez depuis la facture concernée, pour la totalité ou pour les lignes choisies.
              </span>
            }
            action={
              <Link href={invoicesHref} className="q-btn q-btn-primary">
                <FileText aria-hidden />
                Voir mes factures
              </Link>
            }
          />
        </section>
      </div>
    )
  }

  /* ── Liste ── */
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Avoirs"
        subtitle={
          <span className="tabular-nums">
            {stats.yearCount === 0
              ? `Aucun avoir émis en ${stats.year}`
              : `${plural(stats.yearCount, "émis", "émis")} en ${stats.year} · ${negCurrency(stats.yearSum)} au total`}
          </span>
        }
        actions={
          <Link
            href={invoicesHref}
            className="q-btn q-btn-primary hidden md:inline-flex"
            title="Un avoir se crée depuis la facture concernée"
          >
            <Plus strokeWidth={2.25} aria-hidden />
            Créer depuis une facture
          </Link>
        }
      />

      {tabs(items.length)}

      {/* Indicateurs (ordinateur) : uniquement ce qui se calcule sur les avoirs */}
      <KpiGrid className="hidden md:grid lg:grid-cols-3">
        <Kpi
          label={`Avoirs ${stats.year}`}
          value={negCurrency(stats.yearSum)}
          sub={stats.yearCount === 0 ? "Aucun avoir cette année" : `${plural(stats.yearCount, "avoir émis", "avoirs émis")} depuis le 1er janvier`}
        />
        <Kpi
          label="Sur 90 jours"
          value={negCurrency(stats.recentSum)}
          sub={stats.recentCount === 0 ? "Aucun avoir sur la période" : plural(stats.recentCount, "avoir émis", "avoirs émis")}
        />
        <Kpi
          label="Factures corrigées"
          value={<span className="tabular-nums">{stats.invoices}</span>}
          sub={stats.invoices === items.length ? "Un avoir par facture" : `${plural(items.length, "avoir")} sur ${plural(stats.invoices, "facture")}`}
        />
      </KpiGrid>

      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Numéro, client, motif…"
        aria-label="Rechercher un avoir"
        className="h-12 rounded-2xl md:h-9 md:w-[300px] md:rounded-[9px]"
      />

      {/* Tableau (ordinateur) */}
      <section aria-label="Liste des avoirs" className="q-card hidden overflow-hidden md:block">
        {visible.length === 0 ? (
          <p className="px-5 py-10 text-center text-[15px] text-[var(--q-text-3)]">Aucun avoir ne correspond à cette recherche.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="q-table min-w-[760px] [&_th]:border-t-0 [&_thead_tr]:bg-[var(--q-surface-2)]">
              <thead>
                <tr>
                  <th scope="col">Numéro</th>
                  <th scope="col">Client · motif</th>
                  <th scope="col">Facture d&apos;origine</th>
                  <th scope="col">Émis</th>
                  <th scope="col" className="is-num">Total TTC</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((c) => (
                  <tr key={c.id} className="cursor-pointer" onClick={() => router.push(c.href)}>
                    <td className="whitespace-nowrap font-mono text-[13px]">
                      <Link href={c.href} className="text-[var(--q-accent-strong)] hover:underline" onClick={(e) => e.stopPropagation()}>
                        {c.credit_note_number}
                      </Link>
                    </td>
                    <td className="max-w-[380px]">
                      <span className="block truncate font-semibold">{c.client_name ?? "Sans client"}</span>
                      <span className="block truncate text-xs text-[var(--q-text-4)]">{c.reason}</span>
                    </td>
                    <td className="whitespace-nowrap font-mono text-[13px]">
                      {c.invoice_number ? (
                        c.invoice_href ? (
                          <Link href={c.invoice_href} className="text-[var(--q-ink)] hover:text-[var(--q-accent-strong)] hover:underline" onClick={(e) => e.stopPropagation()}>
                            {c.invoice_number}
                          </Link>
                        ) : c.invoice_number
                      ) : <span className="text-[var(--q-text-4)]">—</span>}
                    </td>
                    <td className="whitespace-nowrap text-[var(--q-text-3)]">{shortDate(c.issue_date)}</td>
                    <td className="is-num whitespace-nowrap font-semibold">{negCurrency(c.total_ttc)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[var(--q-surface-2)] text-[13px]">
                  <td colSpan={4} className="border-t border-[var(--q-line-soft)] text-[var(--q-text-3)]">
                    {plural(visible.length, "avoir")}
                  </td>
                  <td className="is-num whitespace-nowrap border-t border-[var(--q-line-soft)] font-semibold">{negCurrency(visibleSum)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* Liste (mobile) */}
      <section aria-label="Liste des avoirs" className="md:hidden">
        {visible.length === 0 ? (
          <p className="q-card px-5 py-7 text-center text-sm leading-normal text-[var(--q-text-4)]">Aucun avoir ne correspond à cette recherche.</p>
        ) : (
          <div className="q-card q-list overflow-hidden rounded-[18px]">
            {visible.map((c) => (
              <Link key={c.id} href={c.href} className="q-list-row px-3.5 py-2.5">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-semibold">{c.client_name ?? "Sans client"}</span>
                  <span className="truncate font-mono text-xs text-[var(--q-text-4)]">
                    {c.credit_note_number}{c.invoice_number ? ` · sur ${c.invoice_number}` : ""}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-[15px] font-semibold tabular-nums">{negCurrency(c.total_ttc)}</span>
                  <span className="text-xs text-[var(--q-text-4)]">{shortDate(c.issue_date)}</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {howTo}
    </div>
  )
}
