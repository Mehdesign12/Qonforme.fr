"use client"

/**
 * Fiche d'une facture reçue : contenu lu dans le fichier, PDF d'origine,
 * contrôles, cycle de vie horodaté et décisions de l'artisan (approuver,
 * refuser avec motif, litige, justificatifs, paiement).
 *
 * Partagée par la page réelle (ReceivedInvoiceDetail.tsx, API) et la démo
 * (lib/demo/reception.ts). Les règles de statut font foi côté serveur
 * (lib/reception/lifecycle.ts) ; ici on ne propose que les actions permises.
 */
import { useState } from "react"
import Link from "next/link"
import {
  AlertTriangle, Check, ChevronLeft, CircleDot, Download, Eye, FileText, Inbox, MoreHorizontal,
  PauseCircle, Send, Trash2, X, type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Kpi, KpiGrid, Panel } from "@/components/app/kit"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SetCrumb } from "@/components/layout/crumb"
import { daysBetween, longDate, mediumDate, plural, shortDate, timeOf, yearOf } from "@/components/invoices/invoice-view"
import { REASON_LABELS, RECIPIENT_TRANSITIONS, STATUS_DEFS, type ReceivedStatus } from "@/lib/reception/lifecycle"
import { FORMAT_LABELS, documentTypeLabel, isCreditNoteType } from "@/lib/reception/types"
import type { ReceivedDetail, ReceivedEvent } from "@/lib/reception/view"
import { ChecksList } from "@/components/reception/ChecksList"
import { StatusLocalNote } from "@/components/reception/PlatformNotice"
import { IbanRow, ReceivedInvoiceDocument } from "@/components/reception/ReceivedInvoiceDocument"
import { LatePill, ReceivedStatusPill, isUnpaid, money } from "@/components/reception/reception-ui"
import { StatusDialog, type DialogStatus } from "@/components/reception/StatusDialog"

export interface ReceivedDetailHandlers {
  /** Rend vrai si le statut a été enregistré. */
  changeStatus: (to: ReceivedStatus, reasonCode?: string | null, reason?: string | null) => Promise<boolean>
  statusLoading?: boolean
  download: () => void
  /** Retrait d'une facture importée par erreur (absent : non proposé). */
  remove?: () => void
  removeLoading?: boolean
}

export interface ReceivedDetailViewProps {
  invoice: ReceivedDetail
  today: string
  backHref: string
  /** Fichier d'origine en PDF à afficher dans la page ; null : pas d'aperçu (démo). */
  pdfUrl: string | null
  /** Lien vers une autre facture reçue (doublon signalé à l'import). */
  hrefFor: (id: string) => string
  handlers: ReceivedDetailHandlers
}

interface Action {
  key: string
  label: string
  short?: string
  icon: LucideIcon
  run: () => void
  danger?: boolean
  busy?: boolean
}

const DIALOG_STATUSES: DialogStatus[] = ["refused", "disputed", "partially_approved", "suspended"]

export function ReceivedInvoiceDetailView({ invoice: inv, today, backHref, pdfUrl, hrefFor, handlers: h }: ReceivedDetailViewProps) {
  const [dialog, setDialog] = useState<DialogStatus | null>(null)
  const [view, setView] = useState<"data" | "pdf">("data")

  const credit = isCreditNoteType(inv.document_type)
  const allowed = RECIPIENT_TRANSITIONS[inv.status] ?? []
  const can = (s: ReceivedStatus) => allowed.includes(s)
  const year = yearOf(today)
  const late = inv.due_date && isUnpaid(inv.status) && !credit ? Math.max(0, daysBetween(inv.due_date, today)) : 0
  const label = `${documentTypeLabel(inv.document_type)} ${inv.invoice_number} · ${inv.supplier_name}`

  const act = (to: ReceivedStatus) => () => {
    if ((DIALOG_STATUSES as ReceivedStatus[]).includes(to)) setDialog(to as DialogStatus)
    else void h.changeStatus(to)
  }

  /* ---- Actions permises ---- */
  const A: Partial<Record<ReceivedStatus, Action>> = {
    approved: { key: "approve", label: credit ? "Accepter l’avoir" : "Approuver", icon: Check, run: act("approved"), busy: h.statusLoading },
    payment_sent: { key: "paid", label: "Marquer payée", icon: Send, run: act("payment_sent"), busy: h.statusLoading },
    refused: { key: "refuse", label: "Refuser…", short: "Refuser", icon: X, run: act("refused"), danger: true },
    disputed: { key: "dispute", label: "Mettre en litige…", icon: AlertTriangle, run: act("disputed") },
    partially_approved: { key: "partial", label: "Approuver en partie…", icon: CircleDot, run: act("partially_approved") },
    suspended: { key: "suspend", label: "Demander des justificatifs…", icon: PauseCircle, run: act("suspended") },
    in_hand: { key: "inhand", label: "Marquer prise en charge", icon: Eye, run: act("in_hand"), busy: h.statusLoading },
  }
  const pick = (...keys: ReceivedStatus[]) => keys.filter(can).map((k) => A[k]).filter((a): a is Action => !!a)

  const primary = (can("approved") ? A.approved : can("payment_sent") && !credit ? A.payment_sent : null) ?? null
  const secondary = can("refused") ? A.refused! : null
  const menuStatus = pick("partially_approved", "disputed", "suspended", "in_hand", "payment_sent")
    .filter((a) => a !== primary && !(credit && a.key === "paid"))
  const download: Action = { key: "download", label: "Fichier d’origine", icon: Download, run: h.download }
  const remove: Action | null = h.remove
    ? { key: "remove", label: "Retirer (importée par erreur)", icon: Trash2, run: h.remove, danger: true, busy: h.removeLoading }
    : null
  const menu = [...menuStatus, download, ...(remove ? [remove] : [])]

  /* ---- Bandeaux ---- */
  const reasonText = [inv.status_reason_code ? REASON_LABELS[inv.status_reason_code] ?? inv.status_reason_code : null, inv.status_reason]
    .filter(Boolean).join(" · ")

  return (
    <div className="flex flex-col gap-5">
      <SetCrumb label={inv.invoice_number} />

      {/* ---- Téléphone : retour, numéro, menu ---- */}
      <div className="-mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2 lg:hidden">
        <Link href={backHref} className="q-link inline-flex min-h-11 items-center gap-1 justify-self-start text-[15px]">
          <ChevronLeft className="size-4" strokeWidth={2.25} aria-hidden />
          Reçues
        </Link>
        <span className="max-w-[46vw] truncate font-mono text-sm font-medium text-[var(--q-ink)]">{inv.invoice_number}</span>
        <span className="justify-self-end">
          <MoreMenu actions={menu} triggerClassName="q-btn q-btn-ghost q-btn-icon !size-11 !rounded-xl" />
        </span>
      </div>

      {/* ---- Ordinateur : en-tête ---- */}
      <header className="hidden flex-wrap items-end justify-between gap-x-6 gap-y-4 lg:flex">
        <div className="flex min-w-0 grow basis-[420px] flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-sm text-[var(--q-text-3)]">{inv.invoice_number}</span>
            <ReceivedStatusPill status={inv.status} />
            {late > 0 && <LatePill days={late} />}
            {credit && <span className="q-tag">Avoir</span>}
          </div>
          <h1 className="q-h1 md:!text-[30px]">{inv.supplier_name}</h1>
          <p className="text-sm text-[var(--q-text-4)]">
            {documentTypeLabel(inv.document_type)} du {longDate(inv.issue_date)}
            {inv.due_date ? ` · échéance le ${longDate(inv.due_date)}` : ""}
            {" · "}{inv.source === "platform" ? "reçue par la plateforme agréée" : `importée (${FORMAT_LABELS[inv.format]})`}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ActionButton action={download} />
          {secondary && <ActionButton action={secondary} />}
          {primary && <ActionButton action={primary} primary />}
          <MoreMenu actions={[...menuStatus, ...(remove ? [remove] : [])]} triggerClassName="q-btn q-btn-secondary q-btn-icon" />
        </div>
      </header>

      {/* ---- Téléphone : montant ---- */}
      <section className="q-card flex flex-col gap-3.5 rounded-[22px] p-[18px] lg:hidden">
        <div className="flex flex-col gap-1">
          <h1 className="text-[13px] font-normal text-[var(--q-text-3)]">{inv.supplier_name}</h1>
          <span className="text-[13px] text-[var(--q-text-3)]">{credit ? "Avoir à déduire" : isUnpaid(inv.status) ? "Net à payer" : "Total TTC"}</span>
          <span className="q-display text-[38px] leading-[1.05] tracking-[-0.04em] tabular-nums text-[var(--q-ink)]">
            {money(credit ? inv.total_ttc : inv.amount_due, inv.currency)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ReceivedStatusPill status={inv.status} />
          {late > 0 && <LatePill days={late} />}
          {inv.due_date && <span className={cn("text-[13px]", late ? "font-semibold text-[var(--q-warn)]" : "text-[var(--q-text-3)]")}>Échéance {shortDate(inv.due_date, year)}</span>}
        </div>
      </section>

      {/* ---- Bandeaux ---- */}
      {inv.status === "refused" && (
        <Banner tone="danger" icon={X} title={`Refusée${reasonText ? ` : ${reasonText}` : ""}`}>
          Le fournisseur doit émettre un avoir pour l&apos;annuler, puis une nouvelle facture s&apos;il y a lieu.
        </Banner>
      )}
      {inv.status === "disputed" && (
        <Banner tone="warn" icon={AlertTriangle} title={`En litige${reasonText ? ` : ${reasonText}` : ""}`}>
          Réglez le désaccord avec le fournisseur, puis approuvez ou refusez la facture.
        </Banner>
      )}
      {inv.status === "suspended" && (
        <Banner tone="warn" icon={PauseCircle} title="Justificatifs demandés">
          {inv.status_reason ?? "Vous attendez des pièces du fournisseur avant de traiter la facture."}
        </Banner>
      )}
      {inv.status === "partially_approved" && inv.status_reason && (
        <Banner icon={CircleDot} title="Approuvée en partie">{inv.status_reason}</Banner>
      )}
      {late > 0 && inv.status !== "disputed" && inv.status !== "suspended" && (
        <Banner tone="warn" icon={AlertTriangle} title={`Échéance dépassée depuis ${plural(late, "jour", "jours")}`}>
          Elle était fixée au {longDate(inv.due_date)}. Une fois le virement fait, marquez la facture payée.
        </Banner>
      )}
      {credit && (
        <Banner icon={FileText} title="Avoir de votre fournisseur">
          {inv.data?.preceding_invoice
            ? <>Il annule tout ou partie de la facture <span className="font-mono">{inv.data.preceding_invoice.number}</span> : à déduire de ce que vous lui devez.</>
            : "Il annule tout ou partie d’une facture : à déduire de ce que vous lui devez."}
        </Banner>
      )}

      {/* ---- Ordinateur : indicateurs ---- */}
      <KpiGrid className="hidden lg:grid">
        <Kpi label="Total TTC" value={money(inv.total_ttc, inv.currency)} sub={inv.data ? plural(inv.data.lines.length, "ligne", "lignes") : "Saisie manuelle"} />
        <Kpi label="Total HT" value={money(inv.total_ht, inv.currency)} sub={`TVA ${money(inv.total_vat, inv.currency)}`} />
        <Kpi label="Échéance" value={inv.due_date ? shortDate(inv.due_date, year) : "—"} sub={late ? `Dépassée de ${plural(late, "jour", "jours")}` : inv.due_date && isUnpaid(inv.status) ? dueSub(inv.due_date, today) : inv.due_date ? "—" : "Non indiquée"} tone={late ? "warn" : "default"} />
        <Kpi tone="ink" label={credit ? "Avoir à déduire" : "Net à payer"} value={money(credit ? inv.total_ttc : inv.amount_due, inv.currency)} sub={STATUS_DEFS[inv.status].label} />
      </KpiGrid>

      {/* ---- Document + colonne ---- */}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="order-2 flex min-w-0 flex-col gap-3 xl:order-1">
          {inv.has_pdf && (
            <div className="q-seg self-start" role="tablist" aria-label="Affichage">
              <button type="button" role="tab" aria-selected={view === "data"} onClick={() => setView("data")}>Données de la facture</button>
              <button type="button" role="tab" aria-selected={view === "pdf"} onClick={() => setView("pdf")}>PDF d&apos;origine</button>
            </div>
          )}
          {view === "pdf" && inv.has_pdf ? (
            <PdfPreview url={pdfUrl} onDownload={h.download} />
          ) : inv.data ? (
            <ReceivedInvoiceDocument invoice={inv.data} />
          ) : (
            <ManualSummary inv={inv} />
          )}
        </div>

        <div className="order-1 flex min-w-0 flex-col gap-4 xl:order-2">
          <Panel title="Cycle de vie" bodyClassName="px-5 pb-5 pt-2" className="order-2 xl:order-1">
            <Timeline events={inv.events} invoice={inv} year={year} />
            <StatusLocalNote source={inv.source} />
          </Panel>

          {!credit && (inv.data?.payment.iban || isUnpaid(inv.status)) && (
            <Panel title="Paiement" bodyClassName="flex flex-col gap-3 px-5 pb-5 pt-2" className="order-1 xl:order-2">
              <dl className="flex flex-col gap-2 text-sm">
                <Row label="Net à payer"><span className="font-semibold tabular-nums">{money(inv.amount_due, inv.currency)}</span></Row>
                <Row label="Échéance"><span className={cn(late && "font-semibold text-[var(--q-warn)]")}>{mediumDate(inv.due_date)}</span></Row>
                {inv.data?.payment.reference && <Row label="Référence"><span className="font-mono text-[13px]">{inv.data.payment.reference}</span></Row>}
              </dl>
              {inv.data?.payment.iban && <IbanRow iban={inv.data.payment.iban} />}
              {inv.status === "payment_sent" && <p className="q-field-hint">Marquée payée dans Qonforme.</p>}
            </Panel>
          )}

          <Panel title="Contrôles à l’import" bodyClassName="px-5 pb-5 pt-2" className="order-3">
            {inv.checks.length ? <ChecksList checks={inv.checks} duplicateHref={hrefFor} /> : <p className="text-sm text-[var(--q-text-4)]">Aucun contrôle enregistré.</p>}
          </Panel>

          <Panel title="Fichier d’origine" bodyClassName="flex flex-col gap-3 px-5 pb-5 pt-2" className="order-4">
            <dl className="flex flex-col gap-2 text-sm">
              <Row label="Format">{FORMAT_LABELS[inv.format]}</Row>
              {inv.file_name && <Row label="Nom"><span className="break-all">{inv.file_name}</span></Row>}
              {inv.file_size != null && <Row label="Taille">{fileSize(inv.file_size)}</Row>}
              <Row label={inv.source === "platform" ? "Reçue le" : "Importée le"}>{stamp(inv.received_at, year)}</Row>
            </dl>
            <ActionButton action={download} size="sm" className="self-start" />
            {remove && (
              <button type="button" className="q-btn q-btn-danger q-btn-sm self-start" onClick={remove.run} disabled={remove.busy}>
                <Trash2 aria-hidden />
                {remove.busy ? "Retrait…" : "Retirer cette facture"}
              </button>
            )}
          </Panel>
        </div>
      </div>

      {/* ---- Téléphone : barre d'actions au-dessus de la barre de navigation ---- */}
      {(primary || secondary) && (
        <>
          <div aria-hidden className="h-[72px] lg:hidden" />
          <div
            className="q-card fixed inset-x-3 z-30 grid gap-2.5 rounded-3xl p-3 shadow-[var(--q-shadow-pop)] lg:hidden"
            style={{ bottom: "calc(96px + env(safe-area-inset-bottom))", gridTemplateColumns: primary && secondary ? "1fr 1fr" : "1fr" }}
          >
            {secondary && <ActionButton action={secondary} size="lg" className="w-full" short />}
            {primary && <ActionButton action={primary} primary size="lg" className="w-full" short />}
          </div>
        </>
      )}

      <StatusDialog
        status={dialog}
        invoiceLabel={label}
        loading={h.statusLoading}
        onClose={() => setDialog(null)}
        onConfirm={async (code, reason) => {
          if (!dialog) return
          const ok = await h.changeStatus(dialog, code, reason)
          if (ok) setDialog(null)
        }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Sous-composants                                                      */
/* ------------------------------------------------------------------ */

function dueSub(due: string, today: string): string {
  const d = daysBetween(today, due)
  return d === 0 ? "Aujourd’hui" : `Dans ${plural(d, "jour", "jours")}`
}

function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / (1024 * 1024)).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`
}

function stamp(value: string | null | undefined, year: number): string {
  if (!value) return "—"
  const t = timeOf(value)
  return `${shortDate(value, year)}${t ? ` · ${t}` : ""}`
}

function ActionButton({ action: a, primary, size, className, short }: {
  action: Action
  primary?: boolean
  size?: "sm" | "lg"
  className?: string
  short?: boolean
}) {
  const Icon = a.icon
  return (
    <button
      type="button"
      onClick={a.run}
      disabled={a.busy}
      aria-busy={a.busy || undefined}
      className={cn(
        "q-btn",
        primary ? "q-btn-primary" : a.danger ? "q-btn-danger" : "q-btn-secondary",
        size === "sm" && "q-btn-sm",
        size === "lg" && "q-btn-lg",
        className,
      )}
    >
      <Icon aria-hidden />
      {a.busy ? "Enregistrement…" : short && a.short ? a.short : a.label}
    </button>
  )
}

function MoreMenu({ actions, triggerClassName }: { actions: Action[]; triggerClassName: string }) {
  if (actions.length === 0) return null
  const normal = actions.filter((a) => !a.danger)
  const dangers = actions.filter((a) => a.danger)
  const item = (a: Action) => {
    const Icon = a.icon
    return (
      <DropdownMenuItem key={a.key} onClick={a.run} disabled={a.busy} variant={a.danger ? "destructive" : "default"}>
        <Icon aria-hidden />
        {a.label}
      </DropdownMenuItem>
    )
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={triggerClassName} aria-label="Plus d'actions">
        <MoreHorizontal aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-[260px]">
        {normal.map(item)}
        {dangers.length > 0 && normal.length > 0 && <DropdownMenuSeparator className="bg-[var(--q-line-soft)]" />}
        {dangers.map(item)}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-[var(--q-text-3)]">{label}</dt>
      <dd className="min-w-0 text-right text-[var(--q-ink)]">{children}</dd>
    </div>
  )
}

function Banner({ icon: Icon, title, children, tone }: {
  icon: LucideIcon
  title: React.ReactNode
  children: React.ReactNode
  tone?: "warn" | "danger"
}) {
  return (
    <div
      className={cn(
        "q-banner items-start",
        tone === "warn" && "q-banner-warn",
        tone === "danger" && "!border-[var(--q-danger-line)] !bg-[var(--q-danger-bg)] !text-[var(--q-danger)]",
      )}
    >
      <Icon className="mt-0.5 size-[18px] shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="break-words font-semibold">{title}</p>
        <p className="text-[13px] opacity-90">{children}</p>
      </div>
    </div>
  )
}

/** Résumé d'une facture classée à la main (PDF sans données structurées). */
function ManualSummary({ inv }: { inv: ReceivedDetail }) {
  return (
    <article className="q-card flex flex-col gap-4 p-5 sm:p-6" aria-label="Contenu de la facture">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="q-display text-[22px] text-[var(--q-ink)]">
          {documentTypeLabel(inv.document_type)} <span className="font-mono text-[18px] font-medium">{inv.invoice_number}</span>
        </h2>
        <span className="q-tag">Saisie manuelle</span>
      </div>
      <p className="text-sm text-[var(--q-text-3)]">
        Ce PDF ne contient pas de facture électronique : seul l&apos;essentiel a été saisi. Le détail est dans le PDF d&apos;origine.
      </p>
      <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
        <Row label="Fournisseur">{inv.supplier_name}</Row>
        {inv.supplier_siren && <Row label="SIREN"><span className="font-mono">{inv.supplier_siren}</span></Row>}
        <Row label="Date">{mediumDate(inv.issue_date)}</Row>
        <Row label="Échéance">{mediumDate(inv.due_date)}</Row>
        <Row label="Total HT"><span className="tabular-nums">{money(inv.total_ht, inv.currency)}</span></Row>
        <Row label="TVA"><span className="tabular-nums">{money(inv.total_vat, inv.currency)}</span></Row>
        <Row label="Total TTC"><span className="font-semibold tabular-nums">{money(inv.total_ttc, inv.currency)}</span></Row>
      </dl>
    </article>
  )
}

function PdfPreview({ url, onDownload }: { url: string | null; onDownload: () => void }) {
  if (!url) {
    return (
      <div className="q-paper-bed flex min-h-[320px] flex-col items-center justify-center gap-3 text-center">
        <FileText className="size-6 text-[var(--q-text-4)]" aria-hidden />
        <p className="max-w-xs text-sm text-[var(--q-text-3)]">Dans votre compte, le PDF d&apos;origine du fournisseur s&apos;affiche ici, tel que vous l&apos;avez reçu.</p>
      </div>
    )
  }
  return (
    <>
      {/* Ordinateur : le PDF dans la page */}
      <iframe src={url} title="PDF d'origine de la facture" className="hidden h-[78vh] w-full rounded-2xl border border-[var(--q-line)] bg-[var(--q-sunken)] md:block" />
      {/* Téléphone : ouverture dans la visionneuse du navigateur */}
      <div className="q-card flex flex-col items-start gap-3 p-5 md:hidden">
        <p className="text-sm text-[var(--q-text-3)]">Ouvrez le PDF dans la visionneuse de votre téléphone.</p>
        <a href={url} target="_blank" rel="noopener" className="q-btn q-btn-secondary">
          <FileText aria-hidden />
          Ouvrir le PDF
        </a>
        <button type="button" className="q-link text-sm" onClick={onDownload}>Télécharger</button>
      </div>
    </>
  )
}

/* ---- Cycle de vie : uniquement des statuts enregistrés ---- */

function eventTitle(e: ReceivedEvent, invoice: ReceivedDetail): string {
  if (e.actor === "import") return `Importée dans Qonforme (${FORMAT_LABELS[invoice.format]})`
  const def = STATUS_DEFS[e.status]
  return `${def.label}${e.code ? ` · ${e.code}` : ""}`
}

function eventSub(e: ReceivedEvent, year: number): string {
  const who = e.actor === "platform" ? "par la plateforme agréée" : e.actor === "user" ? "par vous" : ""
  const reason = [e.reason_code ? REASON_LABELS[e.reason_code] ?? e.reason_code : null, e.reason].filter(Boolean).join(" · ")
  return [stamp(e.created_at, year), who, reason].filter(Boolean).join(" · ")
}

function Timeline({ events, invoice, year }: { events: ReceivedEvent[]; invoice: ReceivedDetail; year: number }) {
  // Sans historique (migration partielle) : au moins la réception
  const list: ReceivedEvent[] = events.length ? events : [{
    id: "reception", status: "received", code: null, reason_code: null, reason: null,
    actor: invoice.source === "platform" ? "platform" : "import", transmitted_at: null, created_at: invoice.received_at,
  }]
  const open = isUnpaid(invoice.status)
  const next = !open ? null
    : ["approved", "partially_approved"].includes(invoice.status) ? "Paiement"
    : "Votre décision : approuver ou refuser"
  return (
    <ol className="flex flex-col">
      {list.map((e, i) => {
        const last = i === list.length - 1 && !next
        const warn = e.status === "refused" || e.status === "rejected" || e.status === "disputed" || e.status === "suspended"
        return (
          <li key={e.id} className="flex gap-3">
            <span className="flex flex-col items-center">
              <span className={cn("grid size-5 shrink-0 place-items-center rounded-full text-white", warn ? "bg-[var(--q-warn)]" : "bg-[var(--q-accent)]")}>
                {e.actor === "import" ? <Inbox className="size-3" strokeWidth={2.5} aria-hidden /> : <Check className="size-3" strokeWidth={3} aria-hidden />}
              </span>
              {!last && <span className="min-h-[18px] w-0.5 flex-1 bg-[var(--q-accent)]" />}
            </span>
            <span className={cn("flex min-w-0 flex-col gap-0.5", !last && "pb-3.5")}>
              <span className={cn("text-sm font-semibold", warn && "text-[var(--q-warn)]")}>{eventTitle(e, invoice)}</span>
              <span className="break-words text-xs tabular-nums text-[var(--q-text-4)]">{eventSub(e, year)}</span>
              {e.transmitted_at && <span className="text-xs text-[var(--q-ok)]">Transmis à la plateforme agréée</span>}
            </span>
          </li>
        )
      })}
      {next && (
        <li className="flex gap-3">
          <span className="size-5 shrink-0 rounded-full border-2 border-dashed border-[var(--q-placeholder)] bg-[var(--q-surface)]" />
          <span className="text-sm font-semibold text-[var(--q-text-3)]">{next}</span>
        </li>
      )}
    </ol>
  )
}
