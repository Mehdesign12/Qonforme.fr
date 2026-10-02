"use client"

/**
 * Liste des devis (canevas « Devis », « Devis-vide », « Mobile-devis »).
 *
 * Composant de présentation partagé par /quotes (données de l'API) et
 * /demo/quotes (lib/demo/data.ts) : la démo est un miroir exact de la page réelle.
 * Indicateurs limités à ce qui se calcule sur les devis : montant en attente de
 * réponse, acceptés et taux d'acceptation sur 90 jours.
 *
 * Pastilles : le kit compose `q-pill-${tone}` à la volée, que Tailwind ne voit
 * pas ; les noms complets cités ici (q-pill-danger, q-pill-neutral) gardent
 * ces classes dans la feuille de style générée.
 */
import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronRight, FileCheck2, Loader2, Plus, ShoppingCart } from "lucide-react"
import { DocStatusPill, EmptyState, Kpi, KpiGrid, PageHeader, SearchField } from "@/components/app/kit"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils/invoice"
import {
  addDays, daysLeft, normalizeSearch, plural, quoteNextStep, shortDate, type QuoteStatus,
} from "@/components/quotes/QuoteListHelpers"

export interface QuoteListItem {
  id: string
  quote_number: string
  status: QuoteStatus
  issue_date: string
  valid_until: string
  total_ttc: number
  client_name: string | null
  /** Objet affiché sous le client (voir quoteSubject). */
  subject: string
  /** Texte recherché en plus du numéro, du client et de l'objet (désignations des lignes). */
  search_text?: string
  converted: boolean
  converted_invoice_number?: string | null
  href: string
}

type Filter = "all" | QuoteStatus

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "draft", label: "Brouillons" },
  { key: "sent", label: "Envoyés" },
  { key: "accepted", label: "Acceptés" },
  { key: "rejected", label: "Refusés" },
]

export function QuoteListView({
  items,
  loading = false,
  error = null,
  onRetry,
  today,
  newHref,
  catalogueHref,
  purchaseOrdersHref,
  purchaseOrdersCount,
}: {
  items: QuoteListItem[]
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  /** « Aujourd'hui » (AAAA-MM-JJ) : date du navigateur, ou date fixe de la démo. */
  today: string
  newHref: string
  catalogueHref: string
  purchaseOrdersHref: string
  /** Nombre de bons de commande (onglet lié) ; null tant qu'il n'est pas connu. */
  purchaseOrdersCount?: number | null
}) {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>("all")
  const [query, setQuery] = useState("")

  const stats = useMemo(() => {
    const year = today.slice(0, 4)
    const since = addDays(today, -90)
    const pending = items.filter((q) => q.status === "sent" && (daysLeft(q, today) ?? 0) >= 0)
    const soon = pending
      .map((q) => daysLeft(q, today) ?? 99)
      .filter((d) => d <= 7)
      .sort((a, b) => a - b)
    const recent = items.filter((q) => q.issue_date >= since)
    const accepted = recent.filter((q) => q.status === "accepted")
    const decided = recent.filter((q) => q.status === "accepted" || q.status === "rejected")
    const counts: Record<Filter, number> = { all: items.length, draft: 0, sent: 0, accepted: 0, rejected: 0 }
    for (const q of items) counts[q.status] += 1
    return {
      year,
      yearCount: items.filter((q) => q.issue_date.startsWith(year)).length,
      pendingSum: pending.reduce((s, q) => s + Number(q.total_ttc), 0),
      pendingCount: pending.length,
      soon,
      acceptedSum: accepted.reduce((s, q) => s + Number(q.total_ttc), 0),
      acceptedCount: accepted.length,
      toInvoice: accepted.filter((q) => !q.converted).length,
      decidedCount: decided.length,
      rate: decided.length ? Math.round((accepted.length / decided.length) * 100) : null,
      counts,
    }
  }, [items, today])

  const visible = useMemo(() => {
    const q = normalizeSearch(query)
    return items.filter((item) => {
      if (filter !== "all" && item.status !== filter) return false
      if (!q) return true
      return normalizeSearch(`${item.quote_number} ${item.client_name ?? ""} ${item.subject} ${item.search_text ?? ""}`).includes(q)
    })
  }, [items, filter, query])

  const visibleSum = visible.reduce((s, q) => s + Number(q.total_ttc), 0)
  const pendingLabel = stats.pendingCount
    ? `${formatCurrency(stats.pendingSum)} en attente de réponse`
    : "Aucun devis en attente de réponse"

  const newButton = (
    <Link href={newHref} className="q-btn q-btn-primary hidden md:inline-flex">
      <Plus strokeWidth={2.25} aria-hidden />
      Nouveau devis
    </Link>
  )

  /* ── Chargement / erreur ── */
  if (loading || error) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Devis" actions={newButton} />
        <div className="q-card grid min-h-[280px] place-items-center p-8">
          {loading ? (
            <Loader2 className="size-6 animate-spin text-[var(--q-accent)]" aria-label="Chargement des devis" />
          ) : (
            <EmptyState
              title="Les devis n'ont pas pu être chargés"
              text={error}
              action={onRetry && <button type="button" className="q-btn q-btn-secondary" onClick={onRetry}>Réessayer</button>}
            />
          )}
        </div>
      </div>
    )
  }

  /* ── Compte sans aucun devis (canevas « Devis-vide ») ── */
  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Devis"
          subtitle="Aucun devis pour l'instant · gratuits et illimités"
          actions={newButton}
        />
        <div className="q-tabs">
          <button type="button" className="is-active" aria-pressed="true">
            Devis <CountBadge active>0</CountBadge>
          </button>
          <Link href={purchaseOrdersHref}>
            Bons de commande {purchaseOrdersCount != null && <span className="q-count">{purchaseOrdersCount}</span>}
          </Link>
        </div>
        <section className="q-card" aria-label="Votre premier devis">
          <EmptyState
            className="py-12"
            icon={<FileCheck2 className="size-6" strokeWidth={1.75} aria-hidden />}
            title={<span className="text-[19px] tracking-[-0.01em]">Votre premier devis, en deux minutes</span>}
            text={
              <span className="block max-w-[480px] text-[15px] leading-relaxed text-[var(--q-text-3)]">
                Choisissez un client, ajoutez vos prestations depuis le catalogue, puis envoyez le devis par email avec son PDF.
              </span>
            }
            action={
              <>
                <Link href={newHref} className="q-btn q-btn-primary">
                  <Plus strokeWidth={2.25} aria-hidden />
                  Faire un devis
                </Link>
                <Link href={catalogueHref} className="q-btn q-btn-secondary">Voir mon catalogue</Link>
              </>
            }
          />
        </section>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { n: 1, t: "Choisir le client", d: "Particulier ou professionnel, enregistré une fois dans vos clients." },
            { n: 2, t: "Composer le devis", d: "Vos prestations et vos prix nets, la TVA calculée ligne par ligne." },
            { n: 3, t: "Envoyer et suivre", d: "Envoi par email avec le PDF. Accepté, il se convertit en facture en un clic." },
          ].map((s) => (
            <div key={s.n} className="q-card flex flex-col gap-2 p-[18px]">
              <span className="flex items-center gap-2.5">
                <span className="grid size-[26px] shrink-0 place-items-center rounded-full bg-[var(--q-wash)] text-[13px] font-bold tabular-nums text-[var(--q-accent-strong)]">{s.n}</span>
                <strong className="text-[15px] font-semibold text-[var(--q-ink)]">{s.t}</strong>
              </span>
              <span className="text-sm leading-normal text-[var(--q-text-3)]">{s.d}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  /* ── Liste ── */
  const soonCount = stats.soon.length
  const pendingSub = stats.pendingCount === 0 ? "Aucun devis envoyé en attente" : [
    plural(stats.pendingCount, "devis", "devis"),
    soonCount === 1
      ? stats.soon[0] === 0 ? "1 expire aujourd'hui" : `1 expire dans ${plural(stats.soon[0], "jour")}`
      : soonCount > 1 ? `${soonCount} expirent sous 7 jours` : null,
  ].filter(Boolean).join(" · ")

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Devis"
        subtitle={
          <span className="tabular-nums">
            <span className="hidden md:inline">{plural(stats.yearCount, "devis", "devis")} en {stats.year} · </span>
            {pendingLabel}
          </span>
        }
        actions={newButton}
      />

      {/* Indicateurs (ordinateur) */}
      <KpiGrid className="hidden md:grid lg:grid-cols-3">
        <Kpi label="En attente de réponse" value={formatCurrency(stats.pendingSum)} sub={pendingSub} />
        <Kpi
          label="Acceptés sur 90 jours"
          value={formatCurrency(stats.acceptedSum)}
          sub={
            stats.acceptedCount === 0
              ? "Aucun devis accepté"
              : `${plural(stats.acceptedCount, "devis", "devis")} · ${stats.toInvoice ? `${stats.toInvoice} à facturer` : "tous facturés"}`
          }
        />
        <Kpi
          label="Taux d'acceptation"
          value={stats.rate === null ? "—" : `${stats.rate} %`}
          sub={
            stats.decidedCount === 0
              ? "Aucun devis accepté ou refusé sur 90 jours"
              : `${stats.acceptedCount} accepté${stats.acceptedCount > 1 ? "s" : ""} sur ${stats.decidedCount} décidé${stats.decidedCount > 1 ? "s" : ""}, 90 jours`
          }
        />
      </KpiGrid>

      {/* Onglets (ordinateur) */}
      <div className="q-tabs hidden md:flex" aria-label="Statut des devis">
        {FILTERS.map((f) => {
          const on = filter === f.key
          return (
            <button key={f.key} type="button" aria-pressed={on} className={cn(on && "is-active")} onClick={() => setFilter(f.key)}>
              {f.label} <CountBadge active={on}>{stats.counts[f.key]}</CountBadge>
            </button>
          )
        })}
        <span className="mx-1.5 h-5 w-px shrink-0 self-center bg-[var(--q-line)]" aria-hidden />
        <Link href={purchaseOrdersHref}>
          <ShoppingCart className="size-[15px]" strokeWidth={1.75} aria-hidden />
          Bons de commande
          {purchaseOrdersCount != null && <span className="q-count">{purchaseOrdersCount}</span>}
        </Link>
      </div>

      {/* Recherche */}
      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Client, numéro, objet…"
        aria-label="Rechercher un devis"
        className="h-12 rounded-2xl md:h-9 md:w-[300px] md:rounded-[9px]"
      />

      {/* Filtres (mobile) */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] md:hidden" aria-label="Statut des devis">
        {FILTERS.map((f) => {
          const on = filter === f.key
          return (
            <button
              key={f.key}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(f.key)}
              className={cn(
                "inline-flex h-[38px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm",
                on
                  ? "border-[var(--q-ink)] bg-[var(--q-ink)] font-semibold text-[var(--q-surface)]"
                  : "border-[var(--q-field)] bg-[var(--q-surface)] font-medium text-[var(--q-text-2)]",
              )}
            >
              {f.label}
              <span className={cn("text-xs tabular-nums", on ? "opacity-70" : "text-[var(--q-text-4)]")}>{stats.counts[f.key]}</span>
            </button>
          )
        })}
      </div>

      {/* Tableau (ordinateur) */}
      <section aria-label="Liste des devis" className="q-card hidden overflow-hidden md:block">
        {visible.length === 0 ? (
          <p className="px-5 py-10 text-center text-[15px] text-[var(--q-text-3)]">Aucun devis ne correspond à cette recherche.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="q-table min-w-[880px] [&_th]:border-t-0 [&_thead_tr]:bg-[var(--q-surface-2)]">
              <thead>
                <tr>
                  <th scope="col">Numéro</th>
                  <th scope="col">Client · objet</th>
                  <th scope="col">Émis</th>
                  <th scope="col">Valable jusqu&apos;au</th>
                  <th scope="col" className="is-num">Total TTC</th>
                  <th scope="col">Statut</th>
                  <th scope="col">Suite</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((q) => {
                  const next = quoteNextStep(q, today)
                  return (
                    <tr key={q.id} className="cursor-pointer" onClick={() => router.push(q.href)}>
                      <td className="font-mono text-[13px]">
                        <Link href={q.href} className="text-[var(--q-accent-strong)] hover:underline" onClick={(e) => e.stopPropagation()}>
                          {q.quote_number}
                        </Link>
                      </td>
                      <td className="max-w-[360px]">
                        <span className="block truncate font-semibold">{q.client_name ?? "Sans client"}</span>
                        <span className="block truncate text-xs text-[var(--q-text-4)]">{q.subject}</span>
                      </td>
                      <td className="whitespace-nowrap text-[var(--q-text-3)]">{shortDate(q.issue_date)}</td>
                      <td className="whitespace-nowrap text-[var(--q-text-2)]">{q.valid_until ? shortDate(q.valid_until) : "—"}</td>
                      <td className="is-num whitespace-nowrap font-semibold">{formatCurrency(Number(q.total_ttc))}</td>
                      <td><DocStatusPill kind="quote" status={q.status} /></td>
                      <td className={cn("whitespace-nowrap text-[13px]", next.tone === "warn" ? "font-semibold text-[var(--q-warn)]" : "text-[var(--q-text-3)]")}>
                        {next.text}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-[var(--q-surface-2)] text-[13px]">
                  <td colSpan={4} className="border-t border-[var(--q-line-soft)] text-[var(--q-text-3)]">
                    {plural(visible.length, "devis affiché", "devis affichés")}
                  </td>
                  <td className="is-num whitespace-nowrap border-t border-[var(--q-line-soft)] font-semibold">{formatCurrency(visibleSum)}</td>
                  <td colSpan={2} className="border-t border-[var(--q-line-soft)]" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* Liste (mobile) */}
      <section aria-label="Liste des devis" className="md:hidden">
        {visible.length === 0 ? (
          <p className="q-card px-5 py-7 text-center text-sm leading-normal text-[var(--q-text-4)]">Aucun devis ne correspond à cette recherche.</p>
        ) : (
          <div className="q-card q-list overflow-hidden rounded-[18px]">
            {visible.map((q) => (
              <Link key={q.id} href={q.href} className="q-list-row px-3.5 py-2.5">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-semibold">{q.client_name ?? "Sans client"}</span>
                  <span className="truncate font-mono text-xs text-[var(--q-text-4)]">{q.quote_number} · {q.subject}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-[15px] font-semibold tabular-nums">{formatCurrency(Number(q.total_ttc))}</span>
                  <DocStatusPill kind="quote" status={q.status} className="h-[22px] px-2 text-[11px]" />
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <Link href={purchaseOrdersHref} className="q-card q-list-row overflow-hidden rounded-[18px] px-3.5 md:hidden">
        <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-[var(--q-wash)] text-[var(--q-accent-strong)]">
          <ShoppingCart className="size-[18px]" strokeWidth={1.75} aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[15px] font-semibold">Bons de commande</span>
          <span className="truncate text-[13px] tabular-nums text-[var(--q-text-4)]">
            {purchaseOrdersCount == null ? "Facultatifs, à la demande du client" : purchaseOrdersCount === 0 ? "Aucun pour l'instant" : plural(purchaseOrdersCount, "bon de commande", "bons de commande")}
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-[var(--q-text-4)]" aria-hidden />
      </Link>
    </div>
  )
}

/** Compteur d'onglet : lavis bleu sur l'onglet actif (canevas). */
function CountBadge({ active, children }: { active?: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "q-count",
        active && "rounded-md bg-[var(--q-wash)] px-[7px] py-px font-semibold",
      )}
    >
      {children}
    </span>
  )
}
