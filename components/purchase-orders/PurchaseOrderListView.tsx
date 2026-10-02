"use client"

/**
 * Liste des bons de commande (canevas « Bons-de-commande »,
 * « Bons-de-commande-vide », « Mobile-bons-de-commande »).
 *
 * Composant de présentation partagé par /purchase-orders (API) et
 * /demo/purchase-orders (lib/demo/data.ts) : la démo est un miroir exact.
 *
 * Le bon de commande est facultatif (le devis signé vaut commande,
 * DECISIONS § 11). Il se crée seul : le code ne le rattache ni à un devis ni
 * à une facture, la page ne le prétend donc pas. Indicateurs calculés sur les
 * statuts réels (draft, sent, confirmed, cancelled) et leurs horodatages.
 *
 * Pastilles : q-pill-danger q-pill-neutral (noms complets cités pour Tailwind).
 */
import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FileCheck2, Loader2, Plus, ShoppingCart } from "lucide-react"
import { DocStatusPill, EmptyState, Kpi, KpiGrid, PageHeader, SearchField } from "@/components/app/kit"
import { InfoNote } from "@/components/purchase-orders/detail-bits"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils/invoice"
import { normalizeSearch, plural, shortDate } from "@/components/quotes/QuoteListHelpers"

export type POStatus = "draft" | "sent" | "confirmed" | "cancelled"

export interface PurchaseOrderListItem {
  id: string
  po_number: string
  status: POStatus
  issue_date: string
  delivery_date: string | null
  reference: string | null
  total_ttc: number
  client_name: string | null
  /** Objet affiché sous le client (première ligne du bon). */
  subject: string
  /** Texte recherché en plus du numéro, du client, de l'objet et de la référence. */
  search_text?: string
  sent_at?: string | null
  confirmed_at?: string | null
  href: string
}

type Filter = "all" | POStatus

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "draft", label: "Brouillons" },
  { key: "sent", label: "Envoyés" },
  { key: "confirmed", label: "Confirmés" },
  { key: "cancelled", label: "Annulés" },
]

/**
 * Objet d'un bon réel (il n'a pas de champ « objet ») : la première ligne,
 * et le nombre d'autres articles si `withCount`.
 */
export function poSubject(lines: { description?: string | null }[] | null | undefined, withCount = true): string {
  const named = (lines ?? []).filter((l) => l.description?.trim())
  if (named.length === 0) return "Bon sans article"
  const first = named[0].description!.trim()
  if (!withCount || named.length === 1) return first
  return `${first}, et ${plural(named.length - 1, "autre article", "autres articles")}`
}

/** « 1,8 j » ; « < 1 j » sous 24 h. */
function fmtDelay(days: number): string {
  if (days < 1) return "< 1 j"
  return `${(Math.round(days * 10) / 10).toString().replace(".", ",")} j`
}

export function PurchaseOrderListView({
  items,
  loading = false,
  error = null,
  onRetry,
  today,
  newHref,
  quotesHref,
  quotesCount,
}: {
  items: PurchaseOrderListItem[]
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  /** « Aujourd'hui » (AAAA-MM-JJ) : date du navigateur, ou date fixe de la démo. */
  today: string
  newHref: string
  quotesHref: string
  /** Nombre de devis (onglet lié) ; null tant qu'il n'est pas connu. */
  quotesCount?: number | null
}) {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>("all")
  const [query, setQuery] = useState("")

  const stats = useMemo(() => {
    const year = today.slice(0, 4)
    const counts: Record<Filter, number> = { all: items.length, draft: 0, sent: 0, confirmed: 0, cancelled: 0 }
    const sums: Record<POStatus, number> = { draft: 0, sent: 0, confirmed: 0, cancelled: 0 }
    for (const p of items) {
      counts[p.status] += 1
      sums[p.status] += Number(p.total_ttc)
    }
    // Délai entre l'envoi et la confirmation, quand les deux sont enregistrés
    const delays = items
      .filter((p) => p.status === "confirmed" && p.sent_at && p.confirmed_at)
      .map((p) => (new Date(p.confirmed_at!).getTime() - new Date(p.sent_at!).getTime()) / 86_400_000)
      .filter((d) => d >= 0)
    return {
      year,
      yearCount: items.filter((p) => p.issue_date.startsWith(year)).length,
      counts,
      sums,
      delay: delays.length ? delays.reduce((s, d) => s + d, 0) / delays.length : null,
      delayCount: delays.length,
    }
  }, [items, today])

  const visible = useMemo(() => {
    const q = normalizeSearch(query)
    return items.filter((p) => {
      if (filter !== "all" && p.status !== filter) return false
      if (!q) return true
      return normalizeSearch(`${p.po_number} ${p.client_name ?? ""} ${p.subject} ${p.reference ?? ""} ${p.search_text ?? ""}`).includes(q)
    })
  }, [items, filter, query])

  const visibleSum = visible.reduce((s, p) => s + Number(p.total_ttc), 0)

  const newButton = (
    <Link href={newHref} className="q-btn q-btn-primary hidden md:inline-flex">
      <Plus strokeWidth={2.25} aria-hidden />
      Nouveau bon de commande
    </Link>
  )

  const quotesTab = (
    <Link href={quotesHref}>
      <FileCheck2 className="size-[15px]" strokeWidth={1.75} aria-hidden />
      Devis
      {quotesCount != null && <span className="q-count">{quotesCount}</span>}
    </Link>
  )

  const optionalNote = (
    <InfoNote>
      Le bon de commande est facultatif : il confirme la commande d&apos;un client qui en demande un. Le devis signé vaut déjà commande.
    </InfoNote>
  )

  /* ── Chargement / erreur ── */
  if (loading || error) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Bons de commande" actions={newButton} />
        <div className="q-card grid min-h-[280px] place-items-center p-8">
          {loading ? (
            <Loader2 className="size-6 animate-spin text-[var(--q-accent)]" aria-label="Chargement des bons de commande" />
          ) : (
            <EmptyState
              title="Les bons de commande n'ont pas pu être chargés"
              text={error}
              action={onRetry && <button type="button" className="q-btn q-btn-secondary" onClick={onRetry}>Réessayer</button>}
            />
          )}
        </div>
      </div>
    )
  }

  /* ── Aucun bon de commande (canevas « Bons-de-commande-vide ») ── */
  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Bons de commande" subtitle="Aucun pour l'instant · facultatifs" actions={newButton} />
        <div className="q-tabs hidden md:flex">
          {quotesTab}
          <button type="button" className="is-active" aria-current="page">
            Bons de commande <CountBadge active>0</CountBadge>
          </button>
        </div>
        <section className="q-card" aria-label="Aucun bon de commande">
          <EmptyState
            className="py-12"
            icon={<ShoppingCart className="size-6" strokeWidth={1.75} aria-hidden />}
            title={<span className="text-[19px] tracking-[-0.01em]">Aucun bon de commande</span>}
            text={
              <span className="block max-w-[480px] text-[15px] leading-relaxed text-[var(--q-text-3)]">
                Facultatif : un bon de commande confirme la commande d&apos;un client qui en demande un.
                Le devis signé vaut déjà commande.
              </span>
            }
            action={
              <>
                <Link href={newHref} className="q-btn q-btn-primary">
                  <Plus strokeWidth={2.25} aria-hidden />
                  Nouveau bon de commande
                </Link>
                <Link href={quotesHref} className="q-btn q-btn-secondary">Voir mes devis</Link>
              </>
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
        title="Bons de commande"
        subtitle={
          <span className="tabular-nums">
            {stats.yearCount === 0 ? `Aucun en ${stats.year}` : `${plural(stats.yearCount, "document", "documents")} en ${stats.year}`}
          </span>
        }
        actions={newButton}
      />

      {/* Indicateurs (ordinateur) */}
      <KpiGrid className="hidden md:grid">
        <Kpi
          label="À confirmer"
          value={formatCurrency(stats.sums.sent)}
          sub={stats.counts.sent === 0 ? "Aucun bon en attente du client" : `${plural(stats.counts.sent, "bon envoyé", "bons envoyés")}, en attente du client`}
        />
        <Kpi
          label="Confirmés"
          value={formatCurrency(stats.sums.confirmed)}
          sub={stats.counts.confirmed === 0 ? "Aucun bon confirmé" : plural(stats.counts.confirmed, "bon confirmé", "bons confirmés")}
        />
        <Kpi
          label="Brouillons"
          value={formatCurrency(stats.sums.draft)}
          sub={stats.counts.draft === 0 ? "Aucun brouillon" : `${plural(stats.counts.draft, "bon", "bons")} à terminer`}
        />
        <Kpi
          label="Délai de confirmation"
          value={stats.delay == null ? "—" : fmtDelay(stats.delay)}
          sub={stats.delayCount === 0 ? "Pas encore de bon confirmé après envoi" : `De l'envoi à la confirmation, sur ${plural(stats.delayCount, "bon", "bons")}`}
        />
      </KpiGrid>

      {/* Onglets (ordinateur) */}
      <div className="q-tabs hidden md:flex" aria-label="Statut des bons de commande">
        {FILTERS.map((f) => {
          const on = filter === f.key
          return (
            <button key={f.key} type="button" aria-pressed={on} className={cn(on && "is-active")} onClick={() => setFilter(f.key)}>
              {f.label} <CountBadge active={on}>{stats.counts[f.key]}</CountBadge>
            </button>
          )
        })}
        <span className="mx-1.5 h-5 w-px shrink-0 self-center bg-[var(--q-line)]" aria-hidden />
        {quotesTab}
      </div>

      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Numéro, client, référence…"
        aria-label="Rechercher un bon de commande"
        className="h-12 rounded-2xl md:h-9 md:w-[300px] md:rounded-[9px]"
      />

      {/* Filtres (mobile) */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] md:hidden" aria-label="Statut des bons de commande">
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
      <section aria-label="Liste des bons de commande" className="q-card hidden overflow-hidden md:block">
        {visible.length === 0 ? (
          <p className="px-5 py-10 text-center text-[15px] text-[var(--q-text-3)]">Aucun bon de commande ne correspond à cette recherche.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="q-table min-w-[900px] [&_th]:border-t-0 [&_thead_tr]:bg-[var(--q-surface-2)]">
              <thead>
                <tr>
                  <th scope="col">Numéro</th>
                  <th scope="col">Client · objet</th>
                  <th scope="col">Réf. client</th>
                  <th scope="col">Émis</th>
                  <th scope="col">Intervention / livraison</th>
                  <th scope="col" className="is-num">Total TTC</th>
                  <th scope="col">Statut</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => {
                  const late = p.status === "sent" && !!p.delivery_date && p.delivery_date < today
                  return (
                    <tr key={p.id} className="cursor-pointer" onClick={() => router.push(p.href)}>
                      <td className="font-mono text-[13px]">
                        <Link href={p.href} className="text-[var(--q-accent-strong)] hover:underline" onClick={(e) => e.stopPropagation()}>
                          {p.po_number}
                        </Link>
                      </td>
                      <td className="max-w-[320px]">
                        <span className="block truncate font-semibold">{p.client_name ?? "Sans client"}</span>
                        <span className="block truncate text-xs text-[var(--q-text-4)]">{p.subject}</span>
                      </td>
                      <td className="whitespace-nowrap font-mono text-[13px] text-[var(--q-text-2)]">{p.reference || "—"}</td>
                      <td className="whitespace-nowrap text-[var(--q-text-3)]">{shortDate(p.issue_date)}</td>
                      <td className={cn("whitespace-nowrap", late ? "font-semibold text-[var(--q-warn)]" : "text-[var(--q-text-2)]")}>
                        {p.delivery_date ? shortDate(p.delivery_date) : "—"}
                        {late && <span className="sr-only"> (date dépassée)</span>}
                      </td>
                      <td className="is-num whitespace-nowrap font-semibold">{formatCurrency(Number(p.total_ttc))}</td>
                      <td><DocStatusPill kind="purchase_order" status={p.status} /></td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-[var(--q-surface-2)] text-[13px]">
                  <td colSpan={5} className="border-t border-[var(--q-line-soft)] text-[var(--q-text-3)]">
                    {plural(visible.length, "bon affiché", "bons affichés")}
                  </td>
                  <td className="is-num whitespace-nowrap border-t border-[var(--q-line-soft)] font-semibold">{formatCurrency(visibleSum)}</td>
                  <td className="border-t border-[var(--q-line-soft)]" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* Liste (mobile) */}
      <section aria-label="Liste des bons de commande" className="md:hidden">
        {visible.length === 0 ? (
          <p className="q-card px-5 py-7 text-center text-sm leading-normal text-[var(--q-text-4)]">Aucun bon de commande ne correspond à cette recherche.</p>
        ) : (
          <div className="q-card q-list overflow-hidden rounded-[18px]">
            {visible.map((p) => (
              <Link key={p.id} href={p.href} className="q-list-row px-3.5 py-2.5">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-semibold">{p.client_name ?? "Sans client"}</span>
                  <span className="truncate font-mono text-xs text-[var(--q-text-4)]">{p.po_number} · {p.subject}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-[15px] font-semibold tabular-nums">{formatCurrency(Number(p.total_ttc))}</span>
                  <DocStatusPill kind="purchase_order" status={p.status} className="h-[22px] px-2 text-[11px]" />
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="md:hidden">{optionalNote}</div>
    </div>
  )
}

/** Compteur d'onglet : lavis bleu sur l'onglet actif (canevas). */
function CountBadge({ active, children }: { active?: boolean; children: React.ReactNode }) {
  return (
    <span className={cn("q-count", active && "rounded-md bg-[var(--q-wash)] px-[7px] py-px font-semibold")}>
      {children}
    </span>
  )
}
