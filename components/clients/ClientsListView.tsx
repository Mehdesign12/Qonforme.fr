"use client"

/**
 * Liste des clients (planches « Clients », « Clients-vide », « Mobile-clients »).
 * Présentation partagée par /clients (données de l'API) et /demo/clients
 * (lib/demo/data.ts) : la page fournit les lignes et les actions.
 */
import { useMemo, useState } from "react"
import Link from "next/link"
import {
  Archive, ArrowUpDown, Building2, CircleAlert, History, Loader2, Pencil, Plus, Send, Users,
} from "lucide-react"
import { EmptyState, Initials, Kpi, KpiGrid, PageHeader, SearchField, StatusPill } from "@/components/app/kit"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { formatCurrency } from "@/lib/utils/invoice"
import { cn } from "@/lib/utils"
import { cityLine, formatSirenDisplay, plural, type ClientMetrics, type ClientRecord } from "./client-data"

export interface ClientRow extends ClientRecord {
  /** Indicateurs du client ; null quand les factures n'ont pas pu être lues. */
  metrics: ClientMetrics | null
}

type Tab = "all" | "due" | "nosiren" | "archived"
type Sort = "name" | "recent" | "due"

const SORT_LABEL: Record<Sort, string> = { name: "nom", recent: "plus récents", due: "à encaisser" }

const normalize = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

export function ClientsListView({
  rows,
  hasMetrics,
  year,
  newHref,
  detailHref,
  editHref,
  onArchive,
  error,
  onRetry,
}: {
  /** null pendant le chargement. */
  rows: ClientRow[] | null
  /** false : à encaisser et chiffre d'affaires indisponibles (lecture des factures en échec). */
  hasMetrics: boolean
  year: number
  newHref: string
  detailHref: (id: string) => string
  editHref?: (id: string) => string
  /** Archive le client ; renvoie true si c'est fait. */
  onArchive: (row: ClientRow) => Promise<boolean> | boolean
  error?: string | null
  onRetry?: () => void
}) {
  const [tab, setTab] = useState<Tab>("all")
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<Sort>("name")
  const [pending, setPending] = useState<ClientRow | null>(null)
  const [archiving, setArchiving] = useState(false)

  const all = useMemo(() => rows ?? [], [rows])
  const active = useMemo(() => all.filter((r) => !r.is_archived), [all])
  const archived = useMemo(() => all.filter((r) => r.is_archived), [all])
  const withDue = active.filter((r) => (r.metrics?.due ?? 0) > 0)
  const noSiren = active.filter((r) => !r.siren)
  const totalDue = active.reduce((s, r) => s + (r.metrics?.due ?? 0), 0)
  const openCount = active.reduce((s, r) => s + (r.metrics?.openCount ?? 0), 0)
  const billed = active.reduce((s, r) => s + (r.metrics?.billedYear ?? 0), 0)

  // Un onglet qui disparaît (plus aucun client archivé…) ramène sur « Tous »
  const currentTab: Tab =
    (tab === "archived" && archived.length === 0) || (tab === "due" && !hasMetrics) ? "all" : tab

  const visible = useMemo(() => {
    const base =
      currentTab === "archived" ? archived
      : currentTab === "due" ? active.filter((r) => (r.metrics?.due ?? 0) > 0)
      : currentTab === "nosiren" ? active.filter((r) => !r.siren)
      : active
    const q = normalize(query.trim())
    const qDigits = query.replace(/\D/g, "")
    const found = q
      ? base.filter((r) =>
          [r.name, r.city, r.zip_code, r.email, r.address].some((v) => normalize(v).includes(q)) ||
          (qDigits.length >= 3 && [r.siren, r.phone].some((v) => (v ?? "").replace(/\D/g, "").includes(qDigits))))
      : base
    const sorted = [...found]
    if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }))
    if (sort === "recent") sorted.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    if (sort === "due") sorted.sort((a, b) => (b.metrics?.due ?? 0) - (a.metrics?.due ?? 0))
    return sorted
  }, [active, archived, currentTab, query, sort])

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "all", label: "Tous", count: active.length },
    ...(hasMetrics ? [{ key: "due" as const, label: "À encaisser", count: withDue.length }] : []),
    { key: "nosiren", label: "Sans SIREN", count: noSiren.length },
    ...(archived.length > 0 ? [{ key: "archived" as const, label: "Archivés", count: archived.length }] : []),
  ]
  const sorts: Sort[] = hasMetrics ? ["name", "recent", "due"] : ["name", "recent"]
  const nextSort = () => setSort(sorts[(sorts.indexOf(sort) + 1) % sorts.length])

  const confirmArchive = async () => {
    if (!pending) return
    setArchiving(true)
    try {
      const done = await onArchive(pending)
      if (done) setPending(null)
    } finally {
      setArchiving(false)
    }
  }

  const headerActions = (
    <>
      <Link href={newHref} className="q-btn q-btn-primary hidden md:inline-flex">
        <Plus strokeWidth={2.25} aria-hidden />
        Nouveau client
      </Link>
      <Link
        href={newHref}
        aria-label="Nouveau client"
        className="q-btn q-btn-secondary q-btn-icon !size-11 !rounded-[14px] md:hidden"
      >
        <Plus className="!size-5" strokeWidth={2} aria-hidden />
      </Link>
    </>
  )

  /* ── Chargement, erreur ─────────────────────────────────────────── */
  if (rows === null && !error) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Clients" subtitle="Chargement…" actions={headerActions} />
        <div className="q-card grid place-items-center py-20" role="status" aria-label="Chargement des clients">
          <Loader2 className="size-6 animate-spin text-[var(--q-accent)]" aria-hidden />
        </div>
      </div>
    )
  }
  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Clients" actions={headerActions} />
        <div className="q-card">
          <EmptyState
            icon={<Users className="size-5" aria-hidden />}
            title="Impossible de charger vos clients"
            text={error}
            action={onRetry && <Button variant="outline" onClick={onRetry}>Réessayer</Button>}
          />
        </div>
      </div>
    )
  }

  /* ── Aucun client (planche « Clients-vide ») ────────────────────── */
  if (all.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Clients" subtitle="Aucun client pour l'instant" actions={headerActions} />
        <div className="q-card">
          <EmptyState
            className="py-12"
            icon={<Users className="size-5" aria-hidden />}
            title="Ajoutez votre premier client"
            text="Pour une entreprise, le SIREN suffit : Qonforme retrouve sa raison sociale et calcule son numéro de TVA. Pour un particulier, quelques champs suffisent."
            action={
              <Link href={newHref} className="q-btn q-btn-primary">
                <Plus strokeWidth={2.25} aria-hidden />
                Nouveau client
              </Link>
            }
          />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { icon: Building2, title: "Fiche remplie par le SIREN", text: "Raison sociale et TVA intracommunautaire retrouvées à partir du SIREN ; l'adresse aussi avec le SIRET." },
            { icon: History, title: "Tout l'historique réuni", text: "Devis, factures et avoirs du client sur une seule fiche, avec ce qui reste à encaisser." },
            { icon: Send, title: "Envoi par e-mail", text: "Vos devis et factures partent à l'adresse enregistrée sur la fiche du client." },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="q-card flex flex-col gap-2.5 p-[18px]">
              <span className="flex items-center gap-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-[var(--q-wash)] text-[var(--q-accent-strong)]">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="q-h2">{title}</span>
              </span>
              <p className="text-sm leading-relaxed text-[var(--q-text-3)]">{text}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  /* ── Liste ──────────────────────────────────────────────────────── */
  const subtitle = [
    plural(active.length, "client"),
    hasMetrics && totalDue > 0 ? `${formatCurrency(totalDue)} à encaisser` : null,
  ].filter(Boolean).join(" · ")

  const shownDue = visible.reduce((s, r) => s + (r.metrics?.due ?? 0), 0)

  const editAction = (r: ClientRow) =>
    editHref ? (
      <Link href={editHref(r.id)} className="q-btn q-btn-ghost q-btn-sm q-btn-icon" aria-label={`Modifier ${r.name}`}>
        <Pencil aria-hidden />
      </Link>
    ) : null

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Clients"
        subtitle={<span className="tabular-nums">{subtitle}</span>}
        actions={headerActions}
      />

      {/* Indicateurs (ordinateur ; la planche mobile passe directement à la liste) */}
      <KpiGrid className={cn("hidden md:grid", !hasMetrics && "lg:grid-cols-2")}>
        <Kpi
          label="Clients"
          value={active.length}
          sub={hasMetrics
            ? `${plural(withDue.length, "client")} avec une facture en cours`
            : archived.length > 0 ? `${plural(archived.length, "client archivé", "clients archivés")} en plus` : "Clients actifs"}
        />
        {hasMetrics && (
          <Kpi label="À encaisser" value={formatCurrency(totalDue)} sub={plural(openCount, "facture en cours", "factures en cours")} />
        )}
        {hasMetrics && (
          <Kpi label={`Chiffre d'affaires ${year}`} value={formatCurrency(billed)} sub="TTC facturé, avoirs déduits" />
        )}
        <Kpi
          tone={noSiren.length > 0 ? "warn" : "default"}
          icon={noSiren.length > 0 ? <CircleAlert className="size-3.5" strokeWidth={2.25} aria-hidden /> : undefined}
          label="À compléter"
          value={plural(noSiren.length, "client")}
          sub={noSiren.length > 0 ? (
            <button type="button" onClick={() => setTab("nosiren")} className="q-link text-[13px]">
              Voir les clients sans SIREN
            </button>
          ) : "Tous vos clients ont un SIREN"}
        />
      </KpiGrid>

      <div className="flex flex-col gap-3">
        {/* Filtres : pastilles sur mobile, onglets soulignés sur ordinateur */}
        <div className="order-2 md:order-1">
          <div role="tablist" aria-label="Filtrer les clients" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] md:hidden">
            {tabs.map((t) => {
              const on = currentTab === t.key
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "inline-flex h-[38px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm",
                    on
                      ? "border-[var(--q-ink-strong)] bg-[var(--q-ink-strong)] font-semibold text-[var(--q-surface)]"
                      : "border-[var(--q-field)] bg-[var(--q-surface)] font-medium text-[var(--q-text-2)]",
                  )}
                >
                  {t.label}
                  <span className={cn("text-xs tabular-nums", on ? "opacity-70" : "text-[var(--q-text-4)]")}>{t.count}</span>
                </button>
              )
            })}
          </div>
          <div role="tablist" aria-label="Filtrer les clients" className="q-tabs hidden md:flex">
            {tabs.map((t) => {
              const on = currentTab === t.key
              return (
                <button key={t.key} type="button" role="tab" aria-selected={on} onClick={() => setTab(t.key)}>
                  {t.label}
                  <span className={cn("q-count", on && "rounded-md bg-[var(--q-wash)] px-[7px] py-px font-semibold")}>{t.count}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="order-1 flex items-center gap-2 md:order-2">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Nom, ville, e-mail, SIREN…"
            aria-label="Rechercher un client"
            className="h-12 flex-1 rounded-2xl md:h-9 md:max-w-[300px] md:rounded-[9px]"
          />
          <span className="hidden flex-1 md:block" />
          <button
            type="button"
            onClick={nextSort}
            className="q-btn q-btn-ghost q-btn-sm hidden !font-medium md:inline-flex"
            aria-label={`Trier par ${SORT_LABEL[sort]} (changer)`}
          >
            <ArrowUpDown aria-hidden />
            Trier : {SORT_LABEL[sort]}
          </button>
        </div>
      </div>

      {/* Tableau (ordinateur) */}
      <section aria-label="Liste des clients" className="q-card hidden overflow-hidden md:block">
        {visible.length === 0 ? (
          <NoMatch query={query} />
        ) : (
          <div className="overflow-x-auto">
            <table className="q-table min-w-[860px] [&_th]:border-t-0">
              <thead>
                <tr className="bg-[var(--q-surface-2)]">
                  <th scope="col">Client</th>
                  <th scope="col">Contact</th>
                  {hasMetrics && <th scope="col" className="is-num">À encaisser</th>}
                  {hasMetrics && <th scope="col" className="is-num">CA {year}</th>}
                  <th scope="col">SIREN</th>
                  <th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const due = r.metrics?.due ?? 0
                  const billedYear = r.metrics?.billedYear ?? 0
                  return (
                    <tr key={r.id}>
                      <td className="!py-2.5">
                        <Link href={detailHref(r.id)} className="flex items-center gap-3 text-[var(--q-ink)]">
                          <Initials name={r.name} className="!size-9 !rounded-[10px]" />
                          <span className="flex min-w-0 flex-col gap-px">
                            <span className="font-semibold">{r.name}</span>
                            <span className="flex items-center gap-2 text-xs text-[var(--q-text-4)]">
                              {cityLine(r) || "Ville non renseignée"}
                              {r.is_archived && <StatusPill tone="neutral" icon={<Archive aria-hidden />} className="!h-5 !text-[11px]">Archivé</StatusPill>}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="!py-2.5">
                        <span className="flex min-w-0 flex-col gap-px">
                          <span className="truncate text-[var(--q-text-2)]">{r.email || "—"}</span>
                          {r.phone && <span className="text-xs tabular-nums text-[var(--q-text-4)]">{r.phone}</span>}
                        </span>
                      </td>
                      {hasMetrics && (
                        <td className="is-num !py-2.5">
                          {due > 0
                            ? <span className="font-semibold">{formatCurrency(due)}</span>
                            : <span className="text-[var(--q-placeholder)]">—</span>}
                        </td>
                      )}
                      {hasMetrics && (
                        <td className="is-num !py-2.5 text-[var(--q-text-2)]">
                          {billedYear > 0 ? formatCurrency(billedYear) : <span className="text-[var(--q-placeholder)]">—</span>}
                        </td>
                      )}
                      <td className="!py-2.5">
                        {r.siren
                          ? <span className="font-mono text-[13px] text-[var(--q-text-2)]">{formatSirenDisplay(r.siren)}</span>
                          : <StatusPill tone="warn" icon={<CircleAlert strokeWidth={2.5} aria-hidden />}>SIREN à compléter</StatusPill>}
                      </td>
                      <td className="w-px whitespace-nowrap !py-2.5 text-right">
                        <span className="inline-flex items-center gap-0.5">
                          {editAction(r)}
                          {!r.is_archived && (
                            <Button variant="ghost" size="icon-sm" onClick={() => setPending(r)} aria-label={`Archiver ${r.name}`}>
                              <Archive aria-hidden />
                            </Button>
                          )}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-[var(--q-surface-2)] text-[13px] [&>td]:border-t [&>td]:border-[var(--q-line-soft)]">
                  <td colSpan={2} className="text-[var(--q-text-3)]">
                    {plural(visible.length, "client affiché", "clients affichés")}
                  </td>
                  {hasMetrics && <td className="is-num font-semibold">{formatCurrency(shownDue)}</td>}
                  <td colSpan={hasMetrics ? 3 : 2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* Liste (mobile) */}
      <section aria-label="Liste des clients" className="q-card q-list overflow-hidden !rounded-[18px] md:hidden">
        {visible.length === 0 ? (
          <NoMatch query={query} />
        ) : (
          visible.map((r) => {
            const due = r.metrics?.due ?? 0
            const sub = [r.city, r.is_archived ? "Archivé" : null].filter(Boolean).join(" · ") || r.email || "Coordonnées à compléter"
            return (
              <Link key={r.id} href={detailHref(r.id)} className="q-list-row !gap-3 !px-3.5 !py-2.5">
                <Initials name={r.name} className="!size-10 !rounded-xl !text-[13px]" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-semibold">{r.name}</span>
                  <span className="truncate text-[13px] text-[var(--q-text-4)]">{sub}</span>
                </span>
                {due > 0 && (
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-semibold tabular-nums">{formatCurrency(due)}</span>
                    <span className="text-[11px] text-[var(--q-text-4)]">à encaisser</span>
                  </span>
                )}
              </Link>
            )
          })
        )}
      </section>

      {/* Confirmation d'archivage */}
      <Dialog open={pending !== null} onOpenChange={(open) => { if (!open && !archiving) setPending(null) }}>
        <DialogContent showCloseButton={false} className="gap-3 sm:max-w-md">
          <DialogTitle className="q-display text-[22px] font-semibold leading-tight">
            Archiver {pending?.name}&nbsp;?
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-[var(--q-text-3)]">
            Le client sort de la liste ; vous le retrouvez dans l&apos;onglet « Archivés ». Ses devis, factures et avoirs sont conservés.
          </DialogDescription>
          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setPending(null)} disabled={archiving}>Annuler</Button>
            <Button variant="destructive" onClick={confirmArchive} disabled={archiving}>
              {archiving ? <Loader2 className="animate-spin" aria-hidden /> : <Archive aria-hidden />}
              Archiver
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function NoMatch({ query }: { query: string }) {
  return (
    <p className="px-5 py-10 text-center text-[15px] text-[var(--q-text-3)]">
      {query.trim() ? "Aucun client ne correspond à cette recherche." : "Aucun client dans cette liste."}
    </p>
  )
}
