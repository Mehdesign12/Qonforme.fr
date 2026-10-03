"use client"

/**
 * Page Chantiers (formule Artisan) : chaque chantier avec son client, son
 * statut et ses montants — signé, facturé, encaissé, reste à facturer,
 * retenue de garantie.
 *
 * Partagée par /chantiers (API) et /demo/chantiers (lib/demo/chantiers.ts).
 * Les montants viennent de lib/artisan/chantier.ts (chantierSummary), au
 * centime, à partir des seuls documents existants.
 */
import { useMemo, useState } from "react"
import Link from "next/link"
import { ChevronRight, HardHat, MapPin, Plus, RefreshCw } from "lucide-react"
import { EmptyState, Kpi, KpiGrid, PageHeader, SearchField } from "@/components/app/kit"
import { normalize } from "@/components/invoices/invoice-view"
import type { Chantier, ChantierStatus, ChantierSummary } from "@/lib/artisan/chantier"
import { fromCents } from "@/lib/artisan/money"
import { ArtisanLockedBanner, ArtisanUnavailable } from "./ArtisanNotice"
import { ChantierStatusPill, Progress, money } from "./ui"

export type ChantierWithSummary = Chantier & { summary: ChantierSummary }

export interface ChantierListViewProps {
  chantiers: ChantierWithSummary[]
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  unavailable?: boolean
  /** Formule Artisan active (null : pas encore connu). */
  artisan: boolean | null
  hrefFor: (id: string) => string
  onCreate: () => void
  demoHref?: string
}

const TABS: { key: "active" | "all" | ChantierStatus; label: string }[] = [
  { key: "active", label: "En cours" },
  { key: "received", label: "Réceptionnés" },
  { key: "closed", label: "Clôturés" },
  { key: "all", label: "Tous" },
]

export function ChantierListView({ chantiers, loading, error, onRetry, unavailable, artisan, hrefFor, onCreate, demoHref }: ChantierListViewProps) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("active")
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = normalize(query.trim())
    return chantiers.filter((c) => {
      const inTab = tab === "all" ? true : tab === "active" ? c.status === "preparation" || c.status === "in_progress" : c.status === tab
      if (!inTab) return false
      if (!q) return true
      return normalize([c.name, c.client?.name, c.city, c.address].filter(Boolean).join(" ")).includes(q)
    })
  }, [chantiers, tab, query])

  const totals = useMemo(() => chantiers.reduce(
    (t, c) => ({
      signed: t.signed + c.summary.signed,
      invoiced: t.invoiced + c.summary.invoiced,
      collected: t.collected + c.summary.collected,
      retention: t.retention + (c.summary.retention.state === "released" ? 0 : c.summary.retentionHeld),
    }),
    { signed: 0, invoiced: 0, collected: 0, retention: 0 },
  ), [chantiers])

  const count = (key: (typeof TABS)[number]["key"]) => chantiers.filter((c) =>
    key === "all" ? true : key === "active" ? c.status === "preparation" || c.status === "in_progress" : c.status === key).length

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Chantiers"
        subtitle="Devis, acomptes, situations, factures et retenues de garantie, chantier par chantier."
        actions={!unavailable && (
          <button type="button" className="q-btn q-btn-primary" onClick={onCreate}>
            <Plus aria-hidden />
            Nouveau chantier
          </button>
        )}
      />

      {unavailable ? <ArtisanUnavailable demoHref={demoHref} /> : artisan === false && <ArtisanLockedBanner demoHref={demoHref} />}

      {!unavailable && chantiers.length > 0 && (
        <KpiGrid>
          <Kpi label="Signé" value={money(fromCents(totals.signed))} sub="Devis acceptés, TTC" />
          <Kpi label="Facturé" value={money(fromCents(totals.invoiced))} sub="Factures émises, avoirs déduits" />
          <Kpi label="Encaissé" value={money(fromCents(totals.collected))} sub="Factures marquées payées" />
          <Kpi tone="ink" label="Retenues de garantie" value={money(fromCents(totals.retention))} sub="À libérer" />
        </KpiGrid>
      )}

      {!unavailable && (
        <section className="q-card overflow-hidden">
          <div className="flex flex-col gap-3 px-4 pt-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="q-tabs -mx-1 border-b-0" role="tablist" aria-label="Statut des chantiers">
              {TABS.map((t) => (
                <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}>
                  {t.label} <span className="q-count">{count(t.key)}</span>
                </button>
              ))}
            </div>
            <SearchField value={query} onChange={setQuery} placeholder="Chantier, client, ville…" className="mb-3 sm:w-64" />
          </div>

          {loading ? (
            <div className="flex flex-col gap-2 p-4" aria-busy="true">
              {[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-xl bg-[var(--q-sunken)]" />)}
            </div>
          ) : error ? (
            <EmptyState
              icon={<RefreshCw className="size-5" aria-hidden />}
              title="Chargement impossible"
              text={error}
              action={onRetry && <button type="button" className="q-btn q-btn-secondary" onClick={onRetry}>Réessayer</button>}
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<HardHat className="size-5" aria-hidden />}
              title={chantiers.length === 0 ? "Aucun chantier pour l'instant" : "Aucun chantier ici"}
              text={chantiers.length === 0
                ? "Créez un chantier pour y rattacher ses devis, acomptes, situations et factures, et suivre sa retenue de garantie."
                : "Changez d'onglet ou de recherche."}
              action={chantiers.length === 0 && <button type="button" className="q-btn q-btn-primary" onClick={onCreate}><Plus aria-hidden />Nouveau chantier</button>}
            />
          ) : (
            <ul className="q-list border-t border-[var(--q-line-soft)]">
              {filtered.map((c) => <ChantierRow key={c.id} chantier={c} href={hrefFor(c.id)} />)}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}

function ChantierRow({ chantier: c, href }: { chantier: ChantierWithSummary; href: string }) {
  const s = c.summary
  const place = [c.city, c.client?.name].filter(Boolean).join(" · ")
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--q-row-hover)] sm:px-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--q-wash)] text-[var(--q-accent-strong)]">
          <HardHat className="size-5" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate text-[15px] font-semibold text-[var(--q-ink)]">{c.name}</span>
            <ChantierStatusPill status={c.status} />
          </span>
          {place && (
            <span className="flex items-center gap-1 truncate text-[13px] text-[var(--q-text-4)]">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              {place}
            </span>
          )}
          {s.signed > 0 && (
            <span className="flex max-w-md flex-col gap-1">
              <Progress value={s.progress} label={`Facturé : ${Math.round(s.progress)} % du signé`} />
              <span className="text-xs tabular-nums text-[var(--q-text-4)]">
                Facturé {money(fromCents(s.invoiced))} sur {money(fromCents(s.signed))}
                {s.retentionHeld > 0 && s.retention.state !== "released" ? ` · retenue ${money(fromCents(s.retentionHeld))}` : ""}
              </span>
            </span>
          )}
        </span>
        <span className="hidden shrink-0 flex-col items-end gap-0.5 sm:flex">
          <span className="text-sm font-semibold tabular-nums text-[var(--q-ink)]">{money(fromCents(s.toInvoice))}</span>
          <span className="text-xs text-[var(--q-text-4)]">reste à facturer</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-[var(--q-text-4)]" aria-hidden />
      </Link>
    </li>
  )
}
