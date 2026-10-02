"use client"

/**
 * Fiche d'un avoir (canevas « Avoir-AV-2026-001 »).
 *
 * Composant de présentation partagé par /credit-notes/[id] (API) et
 * /demo/credit-notes/[id] (lib/demo/data.ts). Les actions (PDF, envoi par
 * email) sont fournies par la page : appels d'API réels, ou invitation à
 * créer un compte dans la démo.
 *
 * Un avoir n'a pas de statut dans le code : pas d'« imputé » ni de
 * « remboursé », pas de reste dû calculé, pas de Factur-X (le PDF d'avoir
 * est un PDF simple). Le suivi ne montre que ce qui est enregistré.
 */
import { useState } from "react"
import Link from "next/link"
import { ChevronLeft, Download, FileText, Loader2, MoreHorizontal, Printer, Send, Undo2, Users } from "lucide-react"
import { Initials, Kpi, KpiGrid, StatusPill } from "@/components/app/kit"
import { SetCrumb } from "@/components/layout/crumb"
import {
  Act, BarBtn, DocModal, DocPaper, LinkedRow, MobileActionBar, MoreRow, RecipientBox, Timeline, TotalRow, WashIcon,
  negCurrency, useIsCompact, type PaperLine, type PaperParty, type TimelineEvent,
} from "@/components/purchase-orders/detail-bits"
import { formatCurrency } from "@/lib/utils/invoice"
import { fmtQty, fmtRate, fmtUnit, longDate, shortDate, vatBreakdown, vatRatesLabel } from "@/components/quotes/QuoteListHelpers"

export interface CreditNoteDetailData {
  id: string
  credit_note_number: string
  issue_date: string
  /** Date d'envoi par email, si la base l'enregistre. */
  sent_at?: string | null
  reason: string
  lines: PaperLine[]
  subtotal_ht: number
  total_vat: number
  total_ttc: number
  client: (PaperParty & { href?: string | null; editHref?: string | null }) | null
  original_invoice: {
    invoice_number: string
    href: string | null
    issue_date?: string | null
    total_ttc?: number | null
  } | null
}

export interface CreditNoteDetailActions {
  onDownloadPdf: () => void
  /** Envoi par email ; renvoie vrai si l'envoi a réussi (la fenêtre se ferme). */
  onSend: () => Promise<boolean>
  busy: { pdf: boolean; send: boolean }
}

export function CreditNoteDetailView({
  note,
  company,
  listHref,
  companySettingsHref,
  actions,
}: {
  note: CreditNoteDetailData
  company: PaperParty | null
  listHref: string
  companySettingsHref?: string
  actions: CreditNoteDetailActions
}) {
  const compact = useIsCompact()
  const [modal, setModal] = useState<null | "send" | "more">(null)
  const close = () => setModal(null)

  const inv = note.original_invoice
  const clientName = note.client?.name ?? null
  const share = inv?.total_ttc ? Math.round((Number(note.total_ttc) / Number(inv.total_ttc)) * 100) : null
  const isTotal = inv?.total_ttc != null && Number(note.total_ttc) >= Number(inv.total_ttc) - 0.01

  const send = async () => {
    if (await actions.onSend()) close()
  }

  const events: TimelineEvent[] = [
    ...(inv ? [{ title: `Facture ${inv.invoice_number}`, sub: inv.issue_date ? `Émise le ${longDate(inv.issue_date, false)}` : "Facture d'origine", state: "done" as const }] : []),
    { title: "Avoir émis", sub: `${shortDate(note.issue_date)} · ${note.reason}`, state: "done" },
    note.sent_at
      ? { title: "Envoyé par email", sub: `${shortDate(note.sent_at.slice(0, 10))}${clientName ? ` · ${clientName}` : ""}`, state: "done" }
      : { title: "Envoi au client", sub: "Par email, avec le PDF en pièce jointe", state: "todo" },
  ]

  const subLine = (
    <>
      {inv && (
        <>
          Sur la facture{" "}
          {inv.href
            ? <Link href={inv.href} className="font-mono font-medium text-[var(--q-accent-strong)] hover:underline">{inv.invoice_number}</Link>
            : <span className="font-mono">{inv.invoice_number}</span>}
          {" · "}
        </>
      )}
      {note.reason} · émis le {longDate(note.issue_date, false)}
    </>
  )

  return (
    <div className="flex flex-col gap-[18px]">
      <SetCrumb label={note.credit_note_number} />

      {/* Barre de navigation mobile : retour, numéro, autres actions */}
      <div className="-mx-1 -mt-2 flex items-center justify-between gap-2 lg:hidden print:hidden">
        <Link href={listHref} className="inline-flex min-h-11 items-center gap-0.5 pr-2 text-base font-medium text-[var(--q-accent-strong)]">
          <ChevronLeft className="size-5" strokeWidth={2.25} aria-hidden />
          Avoirs
        </Link>
        <span className="truncate font-mono text-sm font-medium text-[var(--q-ink)]">{note.credit_note_number}</span>
        <button
          type="button"
          aria-label="Plus d'actions"
          aria-haspopup="dialog"
          onClick={() => setModal("more")}
          className="grid size-11 shrink-0 place-items-center rounded-xl text-[var(--q-text-2)] hover:bg-[var(--q-hover)]"
        >
          <MoreHorizontal className="size-5" aria-hidden />
        </button>
      </div>

      {/* En-tête (ordinateur) */}
      <div className="hidden flex-wrap items-end justify-between gap-4 lg:flex print:hidden">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-sm text-[var(--q-text-3)]">{note.credit_note_number}</span>
            <StatusPill tone="neutral" icon={<Undo2 strokeWidth={2.25} aria-hidden />}>Avoir</StatusPill>
          </div>
          <h1 className="q-h1 !text-[30px]">Avoir{clientName ? ` · ${clientName}` : ""}</h1>
          <span className="text-sm text-[var(--q-text-4)]">{subLine}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Act label="Imprimer" icon={Printer} onClick={() => window.print()} />
          <Act label={actions.busy.pdf ? "Génération…" : "PDF"} icon={Download} onClick={actions.onDownloadPdf} loading={actions.busy.pdf} />
          <Act label="Envoyer par email" icon={Send} variant="primary" onClick={() => setModal("send")} loading={actions.busy.send} />
        </div>
      </div>

      {/* Carte de tête (mobile) */}
      <section className="q-card flex flex-col gap-3.5 rounded-[22px] p-[18px] lg:hidden print:hidden" aria-label="Résumé de l'avoir">
        <div className="flex flex-col gap-1">
          <h1 className="text-[13px] font-normal leading-snug text-[var(--q-text-3)]">Avoir{clientName ? ` · ${clientName}` : ""}</h1>
          <span className="text-[13px] text-[var(--q-text-3)]">Montant de l&apos;avoir</span>
          <span className="font-display text-[38px] font-semibold leading-[1.05] tracking-[-0.04em] tabular-nums text-[var(--q-ink)]">
            {negCurrency(note.total_ttc)}
          </span>
        </div>
        <span className="text-[13px] leading-normal text-[var(--q-text-3)]">{subLine}</span>
      </section>

      {/* Indicateurs (ordinateur) */}
      <KpiGrid className="hidden lg:grid print:hidden">
        <Kpi label="Émis le" value={shortDate(note.issue_date)} sub={note.reason} />
        <Kpi
          label="Facture d'origine"
          value={inv?.total_ttc != null ? formatCurrency(Number(inv.total_ttc)) : "—"}
          sub={inv ? <span className="font-mono">{inv.invoice_number}{inv.issue_date ? ` · ${shortDate(inv.issue_date)}` : ""}</span> : "Facture introuvable"}
        />
        <Kpi
          label="Part de la facture"
          value={share == null ? "—" : `${share} %`}
          sub={share == null ? "—" : isTotal ? "Avoir total : la facture est annulée" : "Avoir partiel"}
        />
        <Kpi
          label="Total de l'avoir"
          value={negCurrency(note.total_ttc)}
          sub={`${negCurrency(note.subtotal_ht)} HT · ${vatRatesLabel(note.lines)}`}
          tone="ink"
        />
      </KpiGrid>

      {/* Deux colonnes dès 1280 px : à 1024 px, l'aperçu papier tombait à 280 px et les désignations s'écrivaient une lettre par ligne */}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Colonne principale */}
        <div className="flex min-w-0 flex-col gap-4">
          <section aria-label="Aperçu de l'avoir" className="q-paper-bed hidden justify-center lg:flex print:flex print:border-0 print:bg-transparent print:!p-0">
            <DocPaper
              title="Avoir"
              meta={[
                `${note.credit_note_number} · ${shortDate(note.issue_date)}${inv ? ` · sur ${inv.invoice_number}` : ""}`,
                `Émis le ${longDate(note.issue_date)}`,
              ]}
              company={company}
              companySettingsHref={companySettingsHref}
              clientLabel="FACTURÉ À"
              client={note.client}
              intro={
                <div className="leading-[1.55]">
                  <strong className="block text-[11px] font-semibold tracking-[.04em] text-[#64748B]">MOTIF DE L&apos;AVOIR</strong>
                  {note.reason}
                  {inv && <span className="text-[#64748B]"> · avoir sur la facture {inv.invoice_number}{inv.issue_date ? ` du ${longDate(inv.issue_date)}` : ""}</span>}
                </div>
              }
              lines={note.lines}
              subtotal_ht={note.subtotal_ht}
              total_ttc={note.total_ttc}
              negative
              totalLabel="Total TTC de l'avoir"
            />
          </section>

          {/* Suivi (mobile) */}
          <section aria-label="Suivi de l'avoir" className="q-card rounded-[22px] p-[18px] lg:hidden print:hidden">
            <h2 className="q-h2 mb-3.5">Suivi de l&apos;avoir</h2>
            <Timeline events={events} />
          </section>

          {/* Lignes (mobile) */}
          <section aria-label="Lignes de l'avoir" className="flex flex-col gap-2 lg:hidden print:hidden">
            <div className="flex items-baseline justify-between">
              <h2 className="q-h2">Lignes annulées</h2>
              <span className="text-[13px] tabular-nums text-[var(--q-text-4)]">{note.lines.length}</span>
            </div>
            <div className="q-card q-list overflow-hidden rounded-[18px]">
              {note.lines.map((l, i) => (
                <div key={i} className="q-list-row px-3.5 py-2.5">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[15px] font-semibold">{l.description || "Ligne"}</span>
                    <span className="truncate text-[13px] tabular-nums text-[var(--q-text-4)]">
                      {fmtQty(l.quantity)}{l.unit ? ` ${fmtUnit(l.quantity, l.unit)}` : ""} × {formatCurrency(l.unit_price_ht)} · TVA {fmtRate(l.vat_rate)} %
                    </span>
                  </span>
                  <span className="shrink-0 text-[15px] font-semibold tabular-nums">{negCurrency(l.total_ht)}</span>
                </div>
              ))}
              <div className="flex flex-col gap-1.5 bg-[var(--q-surface-2)] px-3.5 py-3 text-sm tabular-nums">
                <TotalRow label="Total HT" value={negCurrency(note.subtotal_ht)} />
                {vatBreakdown(note.lines).map((v) => (
                  <TotalRow key={v.rate} label={`TVA ${fmtRate(v.rate)} %`} value={negCurrency(v.amount)} />
                ))}
                <TotalRow label="Total TTC de l'avoir" value={negCurrency(note.total_ttc)} strong />
              </div>
            </div>
          </section>
        </div>

        {/* Colonne de droite */}
        <div className="flex min-w-0 flex-col gap-4 print:hidden">
          <section aria-label="Suivi de l'avoir" className="q-card hidden p-[18px] lg:block">
            <h2 className="q-h2 mb-3.5">Suivi de l&apos;avoir</h2>
            <Timeline events={events} />
          </section>

          {(inv || note.client) && (
            <section aria-label="Liés à cet avoir" className="q-card overflow-hidden py-1.5">
              <h2 className="q-h2 px-[18px] pb-2 pt-3">Liés à ce document</h2>
              <div className="flex flex-col">
                {inv && (
                  <LinkedRow
                    href={inv.href ?? undefined}
                    icon={<WashIcon icon={FileText} />}
                    title={inv.invoice_number}
                    mono
                    sub={`Facture d'origine${inv.total_ttc != null ? ` · ${formatCurrency(Number(inv.total_ttc))} TTC` : ""}`}
                  />
                )}
                {note.client && (
                  <LinkedRow
                    href={note.client.href ?? undefined}
                    icon={<Initials name={note.client.name} />}
                    title={note.client.name}
                    sub={["Client", note.client.city].filter(Boolean).join(" · ")}
                  />
                )}
              </div>
            </section>
          )}

          <p className="hidden px-1 text-[13px] leading-normal text-[var(--q-text-4)] lg:block">
            Une facture émise ne se modifie ni ne se supprime : l&apos;avoir est la seule façon de la corriger. Il est numéroté à la suite des précédents et conservé avec vos documents.
          </p>
        </div>
      </div>

      {/* Barre d'actions collée en bas (mobile) */}
      <MobileActionBar>
        <BarBtn primary label="Envoyer par email" icon={Send} onClick={() => setModal("send")} loading={actions.busy.send} />
        <div className="grid grid-cols-2 gap-2.5">
          <BarBtn label="PDF" icon={Download} onClick={actions.onDownloadPdf} loading={actions.busy.pdf} />
          {inv?.href
            ? <BarBtn label="Voir la facture" icon={FileText} href={inv.href} />
            : <BarBtn label="Imprimer" icon={Printer} onClick={() => window.print()} />}
        </div>
      </MobileActionBar>

      {/* ── Fenêtres ── */}
      <DocModal
        open={modal === "send"}
        onOpenChange={(o) => !o && close()}
        compact={compact}
        title="Envoyer l'avoir"
        description={`${note.credit_note_number} · ${negCurrency(note.total_ttc)} TTC`}
        actions={[{
          label: actions.busy.send ? "Envoi…" : "Envoyer",
          icon: actions.busy.send ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />,
          variant: "primary",
          onClick: send,
          disabled: actions.busy.send || !note.client?.email,
        }]}
      >
        <RecipientBox name={clientName} email={note.client?.email} clientHref={note.client?.editHref ?? note.client?.href} />
        <p className="text-sm leading-relaxed text-[var(--q-text-3)]">
          L&apos;avoir <span className="font-mono">{note.credit_note_number}</span> part avec son PDF en pièce jointe.
        </p>
        <p className="q-inset px-3.5 py-2.5 text-[13px] text-[var(--q-text-3)]">
          Objet : <span className="font-medium text-[var(--q-ink)]">Avoir {note.credit_note_number} — {company?.name ?? "votre entreprise"}</span>
        </p>
      </DocModal>

      <DocModal open={modal === "more"} onOpenChange={(o) => !o && close()} compact={compact} title="Actions" description={note.credit_note_number} actions={[]}>
        <div className="flex flex-col">
          <MoreRow icon={Printer} label="Imprimer" onClick={() => { close(); setTimeout(() => window.print(), 300) }} />
          <MoreRow icon={Download} label="Télécharger le PDF" onClick={() => { close(); actions.onDownloadPdf() }} />
          {inv?.href && <MoreRow icon={FileText} label={`Voir la facture ${inv.invoice_number}`} href={inv.href} onClick={close} />}
          {note.client?.href && <MoreRow icon={Users} label="Fiche client" hint={note.client.name} href={note.client.href} onClick={close} />}
        </div>
      </DocModal>
    </div>
  )
}
