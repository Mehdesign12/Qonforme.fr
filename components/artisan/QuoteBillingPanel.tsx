"use client"

/**
 * Panneau « Facturation du chantier » d'un devis accepté (formule Artisan) :
 * acomptes, situations de travaux, facture de solde, avancement facturé et
 * factures déjà créées depuis ce devis.
 *
 * Partagé par /quotes/[id] (API) et /demo/quotes/[id] (lib/demo). Sans la
 * formule Artisan, les actions restent visibles et ouvrent le mur de paiement
 * (qui dit honnêtement si la formule n'est pas encore en vente). Les règles
 * (ce qui reste possible, pourquoi) viennent de lib/artisan/quote-billing.ts,
 * les mêmes que celles que la route applique.
 */
import { useState } from "react"
import Link from "next/link"
import { ChevronRight, Coins, HardHat, Layers, Link2, ReceiptText } from "lucide-react"
import { cn } from "@/lib/utils"
import { DocStatusPill } from "@/components/app/kit"
import type { QuoteBilling } from "@/lib/artisan/build"
import { invoiceKindLabel, parseBillingContext, parseInvoiceKind } from "@/lib/artisan/billing"
import { formatPercentFr, fromCents } from "@/lib/artisan/money"
import { invoiceNumberLabel } from "@/lib/utils/document-numbering"
import { ArtisanInvoiceDialog, type ArtisanInvoiceKind } from "./ArtisanInvoiceDialog"
import { ArtisanTag, KindPill, Progress, money } from "./ui"

export interface FreeDeposit {
  id: string
  invoice_number: string | null
  issue_date: string | null
  total_ttc: number
}

export interface QuoteBillingPanelProps {
  billing: QuoteBilling
  /** Formule Artisan active (null : pas encore connu). */
  artisan: boolean | null
  clientName?: string | null
  today: string
  invoiceHref: (inv: { id: string; invoice_number: string | null }) => string
  chantierHref?: (id: string) => string
  freeDeposits?: FreeDeposit[]
  creating?: boolean
  /** Création d'un brouillon (corps de POST /api/artisan/quotes/[id]/billing). */
  onCreate: (body: Record<string, unknown>) => void | Promise<unknown>
  onAttachDeposit?: (invoiceId: string) => void
  /** Sans la formule : ouvre le mur de paiement Artisan. */
  onLocked: () => void
}

const ACTIONS: { kind: ArtisanInvoiceKind; label: string; icon: typeof Coins }[] = [
  { kind: "deposit", label: "Facture d'acompte", icon: Coins },
  { kind: "situation", label: "Situation de travaux", icon: Layers },
  { kind: "final", label: "Facture de solde", icon: ReceiptText },
]

export function QuoteBillingPanel({
  billing, artisan, clientName, today, invoiceHref, chantierHref, freeDeposits = [], creating, onCreate, onAttachDeposit, onLocked,
}: QuoteBillingPanelProps) {
  const [dialog, setDialog] = useState<ArtisanInvoiceKind | null>(null)
  const { state, invoices, chantier } = billing
  const locked = artisan === false
  const allowed = { deposit: state.canDeposit, situation: state.canSituation, final: state.canFinal }
  const artisanInvoices = invoices
    .filter((i) => parseInvoiceKind(i.invoice_kind) !== "standard")
    .sort((a, b) => (a.issue_date ?? "").localeCompare(b.issue_date ?? ""))
  const contract = fromCents(state.contractTtc)
  const billed = fromCents(state.billedTtc)
  const billedPercent = state.contractTtc > 0 ? Math.min(100, (state.billedTtc / state.contractTtc) * 100) : 0
  const firstReason = [state.canDeposit, state.canSituation, state.canFinal].find((a) => !a.ok)
  const nothingPossible = !state.canDeposit.ok && !state.canSituation.ok && !state.canFinal.ok

  const open = (kind: ArtisanInvoiceKind) => {
    if (locked) { onLocked(); return }
    setDialog(kind)
  }

  return (
    <section aria-label="Facturation du chantier" className="q-card flex flex-col gap-3.5 p-[18px]">
      <div className="flex items-center justify-between gap-2.5">
        <h2 className="q-h2">Facturation du chantier</h2>
        <ArtisanTag />
      </div>

      {chantier && (
        <Link
          href={chantierHref ? chantierHref(chantier.id) : "#"}
          className="flex items-center gap-2 text-[13px] font-medium text-[var(--q-accent-strong)] hover:underline"
        >
          <HardHat className="size-4" aria-hidden />
          {chantier.name}
        </Link>
      )}

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="text-[var(--q-text-3)]">Facturé</span>
          <span className="tabular-nums font-semibold text-[var(--q-ink)]">{money(billed)} <span className="font-normal text-[var(--q-text-4)]">/ {money(contract)} TTC</span></span>
        </div>
        <Progress value={billedPercent} label="Part du devis facturée" />
        {state.situationsIssued > 0 && (
          <span className="text-[13px] text-[var(--q-text-4)]">Avancement facturé : {formatPercentFr(state.progressPercent)} % des travaux (HT)</span>
        )}
        {state.retentionTtc > 0 && (
          <span className="text-[13px] text-[var(--q-text-4)]">Retenue de garantie : {money(fromCents(state.retentionTtc))} TTC</span>
        )}
      </div>

      {artisanInvoices.length > 0 && (
        <ul className="q-inset flex flex-col divide-y divide-[var(--q-line-soft)] p-0" aria-label="Factures de ce devis">
          {artisanInvoices.map((inv) => {
            const ctx = parseBillingContext(inv.billing_context)
            const label = invoiceKindLabel(ctx?.kind ?? parseInvoiceKind(inv.invoice_kind), ctx)
            return (
              <li key={inv.id}>
                <Link href={invoiceHref(inv)} className="flex min-h-11 items-center gap-2.5 px-3 py-2 hover:bg-[var(--q-row-hover)]">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <KindPill label={label} />
                      <span className={cn("text-[13px]", inv.invoice_number ? "font-mono" : "text-[var(--q-text-3)]")}>{invoiceNumberLabel(inv.invoice_number)}</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">{money(Number(inv.total_ttc) || 0)}</span>
                  <DocStatusPill kind="invoice" status={inv.status} className="hidden sm:inline-flex" />
                  <ChevronRight className="size-4 shrink-0 text-[var(--q-text-4)]" aria-hidden />
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {state.draft && (
        <p className="text-[13px] leading-normal text-[var(--q-text-3)]">
          Un brouillon est en cours : envoyez-le (il reçoit alors son numéro) ou supprimez-le avant d&apos;en créer un autre.
        </p>
      )}

      {!state.finalIssued && (
        <div className="flex flex-wrap gap-2">
          {ACTIONS.map((a) => {
            const ok = allowed[a.kind].ok
            if (!ok && a.kind !== "situation") return null
            const Icon = a.icon
            return (
              <button
                key={a.kind}
                type="button"
                className={cn("q-btn q-btn-sm", a.kind === "situation" && state.situationsIssued > 0 ? "q-btn-primary" : "q-btn-secondary")}
                disabled={!ok || creating}
                title={ok ? undefined : (allowed[a.kind] as { reason: string }).reason}
                onClick={() => open(a.kind)}
              >
                <Icon aria-hidden />
                {a.kind === "situation" ? `Situation n° ${state.nextSituation}` : a.label}
              </button>
            )
          })}
        </div>
      )}
      {nothingPossible && firstReason && !firstReason.ok && !state.draft && (
        <p className="text-[13px] leading-normal text-[var(--q-text-3)]">{firstReason.reason}</p>
      )}
      {locked && (
        <p className="text-[13px] leading-normal text-[var(--q-text-3)]">
          Acomptes, situations et retenue de garantie : avec la formule Artisan.
        </p>
      )}

      {freeDeposits.length > 0 && onAttachDeposit && !state.finalIssued && (
        <div className="flex flex-col gap-2 border-t border-[var(--q-line-soft)] pt-3">
          <p className="text-[13px] text-[var(--q-text-3)]">Acomptes émis sans devis pour ce client : rattachez-les pour qu&apos;ils soient repris.</p>
          {freeDeposits.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="font-mono text-[13px]">{invoiceNumberLabel(d.invoice_number)}</span>
              <span className="tabular-nums">{money(d.total_ttc)}</span>
              <button type="button" className="q-btn q-btn-ghost q-btn-sm" onClick={() => (locked ? onLocked() : onAttachDeposit(d.id))}>
                <Link2 aria-hidden />
                Rattacher
              </button>
            </div>
          ))}
        </div>
      )}

      {dialog && (
        <ArtisanInvoiceDialog
          open
          onOpenChange={(o) => { if (!o) setDialog(null) }}
          kind={dialog}
          billing={billing}
          clientName={clientName}
          today={today}
          submitting={creating}
          onSubmit={async (body) => { await onCreate(body) }}
        />
      )}
    </section>
  )
}
