"use client"

/**
 * Fiche d'un chantier (formule Artisan) : montants (signé, facturé, encaissé,
 * reste à facturer), documents rattachés (devis, acomptes, situations,
 * factures, avoirs, bons de commande), retenue de garantie et réception.
 *
 * Partagée par /chantiers/[id] (API) et /demo/chantiers/[id] : les actions
 * arrivent par `actions` (routes réelles, ou invitation à créer un compte).
 */
import { useState } from "react"
import Link from "next/link"
import {
  CalendarCheck, ChevronRight, Coins, Download, FileCheck2, FileText, HardHat, Link2, MapPin, MoreHorizontal,
  Pencil, ReceiptText, ShieldCheck, ShoppingCart, Trash2, Unlink,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { DocStatusPill, Kpi, KpiGrid, Panel, StatusPill } from "@/components/app/kit"
import { SetCrumb } from "@/components/layout/crumb"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { longDate, mediumDate } from "@/components/invoices/invoice-view"
import type { Chantier, ChantierDoc, ChantierSummary } from "@/lib/artisan/chantier"
import { formatPercentFr, fromCents } from "@/lib/artisan/money"
import { RETENTION_LAW, retentionStatusText } from "@/lib/artisan/retention"
import { REVERSE_CHARGE_MENTION } from "@/lib/artisan/reverse-charge"
import { invoiceNumberLabel } from "@/lib/utils/document-numbering"
import { ArtisanLockedBanner } from "./ArtisanNotice"
import { ArtisanTag, ChantierStatusPill, KindPill, Progress, money } from "./ui"

export interface ChantierDetailActions {
  onEdit: () => void
  onAttach: () => void
  onDetach: (doc: ChantierDoc) => void
  onFreeDeposit?: () => void
  onSaveReception: (date: string | null) => void
  onMarkReleased: (date: string | null) => void
  onRetentionRequest: () => void
  onDelete: () => void
}

export interface ChantierDetailViewProps {
  chantier: Chantier
  documents: ChantierDoc[]
  summary: ChantierSummary
  today: string
  artisan: boolean | null
  backHref: string
  docHref: (doc: ChantierDoc) => string
  clientHref?: string | null
  newQuoteHref?: string
  actions: ChantierDetailActions
  busy?: { reception?: boolean; release?: boolean; pdf?: boolean; delete?: boolean }
  demoHref?: string
}

const GROUPS: { type: ChantierDoc["type"]; title: string; icon: typeof FileText }[] = [
  { type: "quote", title: "Devis", icon: FileCheck2 },
  { type: "invoice", title: "Factures", icon: FileText },
  { type: "credit_note", title: "Avoirs", icon: ReceiptText },
  { type: "purchase_order", title: "Bons de commande", icon: ShoppingCart },
]

export function ChantierDetailView({
  chantier: c, documents, summary: s, today, artisan, backHref, docHref, clientHref, newQuoteHref, actions, busy = {}, demoHref,
}: ChantierDetailViewProps) {
  const [reception, setReception] = useState(c.reception_date ?? "")
  const address = [c.address, [c.zip_code, c.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")
  const retentionState = s.retention
  const held = fromCents(s.retentionHeld)
  const locked = artisan === false

  return (
    <div className="flex flex-col gap-5">
      <SetCrumb label={c.name} />

      {/* En-tête */}
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="flex min-w-0 grow basis-[360px] flex-col gap-2">
          <Link href={backHref} className="q-link -mb-1 inline-flex min-h-11 items-center gap-1 text-[15px] lg:hidden">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
            Chantiers
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <ChantierStatusPill status={c.status} />
            {c.subcontracting && <StatusPill tone="info">Sous-traitance</StatusPill>}
            <ArtisanTag />
          </div>
          <h1 className="q-h1 md:!text-[30px]">{c.name}</h1>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--q-text-4)]">
            {c.client && (clientHref ? <Link href={clientHref} className="q-link">{c.client.name}</Link> : <span>{c.client.name}</span>)}
            {address && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden />{address}</span>}
            {(c.start_date || c.end_date) && (
              <span>{c.start_date ? `Du ${mediumDate(c.start_date)}` : ""}{c.end_date ? ` au ${mediumDate(c.end_date)}` : ""}</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions.onFreeDeposit && c.client_id && (
            <button type="button" className="q-btn q-btn-secondary" onClick={actions.onFreeDeposit}><Coins aria-hidden />Acompte libre</button>
          )}
          <button type="button" className="q-btn q-btn-secondary" onClick={actions.onAttach}><Link2 aria-hidden />Rattacher un document</button>
          <button type="button" className="q-btn q-btn-primary" onClick={actions.onEdit}><Pencil aria-hidden />Modifier</button>
          <DropdownMenu>
            <DropdownMenuTrigger className="q-btn q-btn-secondary q-btn-icon" aria-label="Plus d'actions"><MoreHorizontal aria-hidden /></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {newQuoteHref && (
                <DropdownMenuItem onClick={() => { window.location.href = newQuoteHref }}><FileCheck2 aria-hidden />Nouveau devis</DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={actions.onDelete} disabled={busy.delete}>
                <Trash2 aria-hidden />Supprimer le chantier
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {locked && <ArtisanLockedBanner demoHref={demoHref} />}

      <KpiGrid>
        <Kpi label="Signé" value={money(fromCents(s.signed))} sub={`${s.counts.quotes} devis rattaché${s.counts.quotes > 1 ? "s" : ""}`} />
        <Kpi label="Facturé" value={money(fromCents(s.invoiced))} sub={s.signed > 0 ? `${formatPercentFr(s.progress)} % du signé` : "Factures émises"} />
        <Kpi label="Encaissé" value={money(fromCents(s.collected))} sub={s.outstanding > 0 ? `${money(fromCents(s.outstanding))} à encaisser` : "Factures payées"} />
        <Kpi tone="ink" label="Reste à facturer" value={money(fromCents(s.toInvoice))} sub="Devis signés, TTC" />
      </KpiGrid>
      {s.signed > 0 && <Progress value={s.progress} label="Part du montant signé déjà facturée" />}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Documents */}
        <Panel title="Documents" className="min-w-0" bodyClassName="pb-2">
          {documents.length === 0 ? (
            <div className="flex flex-col items-start gap-3 px-5 pb-4 pt-1 text-sm text-[var(--q-text-3)]">
              <p>Aucun document rattaché. Rattachez un devis : ses acomptes, situations et factures suivront.</p>
              <button type="button" className="q-btn q-btn-secondary q-btn-sm" onClick={actions.onAttach}><Link2 aria-hidden />Rattacher un document</button>
            </div>
          ) : (
            GROUPS.map((g) => {
              const docs = documents.filter((d) => d.type === g.type)
              if (docs.length === 0) return null
              const Icon = g.icon
              return (
                <div key={g.type} className="flex flex-col">
                  <h3 className="flex items-center gap-2 px-5 pb-1 pt-3 text-[13px] font-semibold text-[var(--q-text-3)]">
                    <Icon className="size-4" aria-hidden />{g.title}
                  </h3>
                  <ul className="q-list">
                    {docs.map((d) => <DocRow key={`${d.type}-${d.id}`} doc={d} href={docHref(d)} onDetach={() => actions.onDetach(d)} />)}
                  </ul>
                </div>
              )
            })
          )}
        </Panel>

        <div className="flex min-w-0 flex-col gap-4">
          {/* Retenue de garantie */}
          <Panel title="Retenue de garantie" action={<ShieldCheck className="size-4 text-[var(--q-text-4)]" aria-hidden />} bodyClassName="flex flex-col gap-3 px-5 pb-5 pt-1 text-sm">
            <p className="text-[var(--q-text-3)]">
              {c.retention_mode === "retenue"
                ? `${formatPercentFr(c.retention_rate)} % du TTC de chaque situation et du solde.`
                : c.retention_mode === "caution"
                  ? "Remplacée par une caution bancaire : rien n'est retenu sur les factures."
                  : "Aucune retenue prévue sur ce chantier."}
            </p>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[var(--q-text-3)]">Retenu sur les factures émises</span>
              <span className="text-lg font-semibold tabular-nums text-[var(--q-ink)]">{money(held)}</span>
            </div>
            <p className={cn("text-[13px] leading-normal", retentionState.state === "releasable" ? "font-semibold text-[var(--q-warn)]" : "text-[var(--q-text-3)]")}>
              {retentionStatusText(retentionState)}
            </p>
            {s.retentionHeld > 0 && (
              <div className="flex flex-wrap gap-2">
                {/* La demande cite la réception et l'échéance d'un an : seulement une fois la réception datée */}
                {(retentionState.state === "pending" || retentionState.state === "releasable") && (
                  <button type="button" className="q-btn q-btn-secondary q-btn-sm" onClick={actions.onRetentionRequest} disabled={busy.pdf}>
                    <Download aria-hidden />Demande de libération
                  </button>
                )}
                {retentionState.state === "released" ? (
                  <button type="button" className="q-btn q-btn-ghost q-btn-sm" onClick={() => actions.onMarkReleased(null)} disabled={busy.release}>Annuler la libération</button>
                ) : (
                  <button type="button" className="q-btn q-btn-ghost q-btn-sm" onClick={() => actions.onMarkReleased(today)} disabled={busy.release}>Marquer comme encaissée</button>
                )}
              </div>
            )}
            <p className="q-field-hint">{RETENTION_LAW}, art. 1er et 2 : 5 % au plus, libérée un an après la réception, sauf opposition motivée notifiée par lettre recommandée.</p>
          </Panel>

          {/* Réception */}
          <Panel title="Réception des travaux" action={<CalendarCheck className="size-4 text-[var(--q-text-4)]" aria-hidden />} bodyClassName="flex flex-col gap-3 px-5 pb-5 pt-1 text-sm">
            <label className="flex flex-col gap-1.5">
              <span className="q-label">Date de réception</span>
              <input type="date" className="q-input" value={reception} max={today} onChange={(e) => setReception(e.target.value)} />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="q-btn q-btn-secondary q-btn-sm"
                disabled={busy.reception || reception === (c.reception_date ?? "")}
                onClick={() => actions.onSaveReception(reception || null)}
              >
                Enregistrer
              </button>
            </div>
            <p className="q-field-hint">Point de départ de l&apos;année de garantie. Renseignée, le chantier passe à « Réceptionné ».</p>
          </Panel>

          {(c.subcontracting || c.notes) && (
            <Panel title="Informations" action={<HardHat className="size-4 text-[var(--q-text-4)]" aria-hidden />} bodyClassName="flex flex-col gap-2 px-5 pb-5 pt-1 text-sm text-[var(--q-text-3)]">
              {c.subcontracting && <p>Sous-traitance : les devis et factures de ce chantier se font en autoliquidation. {REVERSE_CHARGE_MENTION}</p>}
              {c.notes && <p className="whitespace-pre-line">{c.notes}</p>}
              {c.created_at && <p className="text-[13px] text-[var(--q-text-4)]">Créé le {longDate(c.created_at.slice(0, 10))}</p>}
            </Panel>
          )}
        </div>
      </div>
    </div>
  )
}

function DocRow({ doc: d, href, onDetach }: { doc: ChantierDoc; href: string; onDetach: () => void }) {
  const number = d.type === "invoice" ? invoiceNumberLabel(d.number) : d.number ?? "—"
  const negative = d.type === "credit_note"
  return (
    <li className="flex items-center gap-1 pr-2">
      <Link href={href} className="flex min-h-[52px] min-w-0 flex-1 items-center gap-2.5 py-2 pl-5 pr-2 hover:bg-[var(--q-row-hover)]">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className={cn("text-sm", d.number ? "font-mono" : "text-[var(--q-text-3)]")}>{number}</span>
            <KindPill label={d.kind_label} />
          </span>
          <span className="text-xs text-[var(--q-text-4)]">
            {d.issue_date ? mediumDate(d.issue_date) : ""}
            {d.retention_amount ? ` · retenue ${money(d.retention_amount)}` : ""}
          </span>
        </span>
        <span className="shrink-0 text-sm font-semibold tabular-nums">{money(negative ? -d.total_ttc : d.total_ttc)}</span>
        {d.type === "quote" || d.type === "invoice" || d.type === "purchase_order"
          ? <DocStatusPill kind={d.type} status={d.status} className="hidden sm:inline-flex" />
          : null}
        <ChevronRight className="size-4 shrink-0 text-[var(--q-text-4)]" aria-hidden />
      </Link>
      <button type="button" className="q-btn q-btn-ghost q-btn-icon !size-9 shrink-0" title="Détacher du chantier" aria-label={`Détacher ${number} du chantier`} onClick={onDetach}>
        <Unlink className="size-4" aria-hidden />
      </button>
    </li>
  )
}
