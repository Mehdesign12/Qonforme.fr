"use client"

/**
 * Fiche facture (canevas « Facture-detail » et « Mobile-facture-F-2026-0142 »).
 *
 * Composant de présentation partagé par la page réelle (InvoiceDetail.tsx,
 * qui garde les appels d'API, les fenêtres et le mur de paiement) et sa démo
 * (/demo/invoices/[id], lib/demo/data.ts) : mêmes actions, mêmes règles
 * d'affichage. Les gardes de statut font foi côté serveur
 * (lib/utils/document-status.ts) ; ici on n'affiche que les actions permises.
 *
 * Écarts volontaires avec le canevas (fonctions non livrées, DECISIONS § 10) :
 * pas de cycle de vie « plateforme agréée », pas de paiement partiel, pas de
 * relances programmables par facture (elles se règlent pour tout le compte,
 * Paramètres › Relances). L'historique ne montre que des dates réellement
 * enregistrées. Le lien de paiement par virement arrive par les emplacements
 * `payment` et `paymentBanner` (components/payment-link).
 *
 * Un brouillon n'a pas encore de numéro : il le reçoit à l'envoi
 * (lib/utils/document-numbering.ts) et s'affiche « Brouillon » d'ici là.
 */
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  AlertTriangle, Archive, ArchiveX, Bell, Check, ChevronLeft, ChevronRight, Clock, Copy,
  CreditCard, Download, FileCheck2, FileCode, FileX, HardHat, MoreHorizontal, Pencil, Printer,
  RotateCcw, Send, Trash2, XCircle, CheckCircle2, type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils/invoice"
import { invoiceNumberLabel } from "@/lib/utils/document-numbering"
import { DEFAULT_REMINDER_SETTINGS, describeInvoiceSchedule } from "@/lib/reminders/settings"
import type { InvoiceStatus } from "@/types"
import {
  DocStatusPill, Initials, Kpi, KpiGrid, Panel, StatusPill,
} from "@/components/app/kit"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SetCrumb } from "@/components/layout/crumb"
import { invoiceKindLabel, isArtisanKind, parseBillingContext, parseInvoiceKind } from "@/lib/artisan/billing"
import { formatPercentFr, fromCents, toCents } from "@/lib/artisan/money"
import { InvoicePaper } from "@/components/invoices/InvoicePaper"
import {
  type CompanyView, type InvoiceView, daysBetween, daysLate, formatIban, isOpen, longDate,
  mediumDate, plural, shortDate, subjectFromLines, timeOf, yearOf,
} from "@/components/invoices/invoice-view"

/* ------------------------------------------------------------------ */
/* Règles d'affichage des actions                                       */
/* ------------------------------------------------------------------ */

/** Changements de statut proposés à la main (le serveur garde la liste blanche). */
export const NEXT_ACTIONS: Partial<Record<InvoiceStatus, { label: string; status: InvoiceStatus; icon: LucideIcon; main: boolean }[]>> = {
  draft:    [{ label: "Marquer comme envoyée", status: "sent", icon: Send, main: true }],
  sent: [
    { label: "Marquer comme payée", status: "paid", icon: CreditCard, main: true },
    { label: "Marquer en retard", status: "overdue", icon: AlertTriangle, main: false },
  ],
  pending:  [{ label: "Marquer comme payée", status: "paid", icon: CreditCard, main: true }],
  received: [
    { label: "Marquer comme acceptée", status: "accepted", icon: CheckCircle2, main: true },
    { label: "Marquer comme rejetée", status: "rejected", icon: XCircle, main: false },
  ],
  accepted: [{ label: "Marquer comme payée", status: "paid", icon: CreditCard, main: true }],
  overdue:  [{ label: "Marquer comme payée", status: "paid", icon: CreditCard, main: true }],
}

/** Statuts éligibles à un avoir (tout sauf brouillon, annulée, avoir émis). */
export const CAN_CREDIT: readonly InvoiceStatus[] = ["sent", "pending", "received", "accepted", "rejected", "paid", "overdue"]

/** Une action de la fiche : bouton, entrée de menu ou lien. */
interface Action {
  key: string
  label: string
  icon: LucideIcon
  onClick?: () => void
  href?: string
  busy?: boolean
  busyLabel?: string
  disabled?: boolean
  danger?: boolean
  title?: string
}

export interface InvoiceDetailHandlers {
  downloadPdf: () => void
  pdfLoading?: boolean
  downloadFacturX: () => void
  fxLoading?: boolean
  print: () => void
  /** Modification du brouillon : lien (réel) ou action (démo). */
  editHref?: string
  onEdit?: () => void
  deleteDraft: () => void
  deleteLoading?: boolean
  toggleArchive: () => void
  archiveLoading?: boolean
  openCredit: () => void
  remind: () => void
  remindLoading?: boolean
  openSend: () => void
  sendLoading?: boolean
  changeStatus: (status: InvoiceStatus) => void
  statusLoading?: boolean
}

export interface InvoiceDetailViewProps {
  invoice: InvoiceView
  company: CompanyView | null
  /** Date du jour « AAAA-MM-JJ » (retard, jours restants). */
  today: string
  backHref: string
  clientHref?: string | null
  quote?: { number: string; href: string } | null
  creditNotesHref: string
  settingsCompanyHref: string
  /**
   * Calendrier des relances automatiques du compte (« 30 et 45 jours après
   * l'échéance »), null si elles sont désactivées. Absent : calendrier par défaut.
   */
  autoReminders?: string | null
  handlers: InvoiceDetailHandlers
  /** Contenu du panneau « Paiement » sous l'état et l'échéance (lien de paiement) ; à défaut, l'IBAN seul. */
  payment?: React.ReactNode
  /** Bandeau en tête de fiche (virement déclaré par le client). */
  paymentBanner?: React.ReactNode
  /** Lien d'une facture citée (acompte repris par un solde ou une situation). */
  invoiceHref?: (ref: { id: string; number: string }) => string
  /** Lien du devis d'origine d'un acompte, d'une situation ou d'un solde. */
  quoteHref?: (quoteId: string) => string
}

/* ------------------------------------------------------------------ */
/* Composant                                                            */
/* ------------------------------------------------------------------ */

export function InvoiceDetailView({
  invoice, company, today, backHref, clientHref, quote, creditNotesHref, settingsCompanyHref, handlers: h,
  autoReminders = describeInvoiceSchedule(DEFAULT_REMINDER_SETTINGS),
  payment, paymentBanner, invoiceHref, quoteHref,
}: InvoiceDetailViewProps) {
  const router = useRouter()
  const status = invoice.status
  const draft = status === "draft"
  const numberLabel = invoiceNumberLabel(invoice.invoice_number)
  // Journal des relances en place : plus de limite à deux relances manuelles
  const journal = Array.isArray(invoice.reminders)
  const open = isOpen(status)
  const lateDays = daysLate(status, invoice.due_date, today)
  const late = status === "overdue" || lateDays > 0
  // Échéance dépassée alors que la facture est encore « Envoyée » : on propose de la passer en retard
  const pastDueSent = status === "sent" && lateDays > 0
  const year = yearOf(today)
  const subject = invoice.subject ?? subjectFromLines(invoice.lines)
  const clientName = invoice.client?.name ?? "Client"
  const clientEmail = invoice.client?.email ?? null
  // Formule Artisan : nature (acompte, situation, solde), devis, acomptes repris, retenue de garantie
  const ctx = parseBillingContext(invoice.billing_context)
  const kind = ctx?.kind ?? parseInvoiceKind(invoice.invoice_kind)
  const kindLabel = invoiceKindLabel(kind, ctx)
  const artisanDoc = isArtisanKind(kind)
  const retentionCents = ctx?.retention?.mode === "retenue" ? Math.max(0, toCents(invoice.retention_amount ?? ctx.retention.amount)) : 0
  const originQuote = ctx?.quote && quoteHref ? { number: ctx.quote.number, href: quoteHref(ctx.quote.id) } : null
  const linkedQuote = quote ?? originQuote

  /* ---- Actions ---- */
  const pdf: Action = {
    key: "pdf", label: "PDF", icon: Download, onClick: h.downloadPdf, busy: h.pdfLoading, busyLabel: "Génération…",
    title: draft ? "PDF du brouillon, filigrané « BROUILLON », sans XML Factur-X" : "Télécharger la facture en PDF",
  }
  const xml: Action | null = draft ? null : {
    key: "xml", label: "XML Factur-X", icon: FileCode, onClick: h.downloadFacturX, busy: h.fxLoading, busyLabel: "Génération…",
    title: "Télécharger le fichier XML Factur-X de la facture",
  }
  const print: Action = { key: "print", label: "Imprimer", icon: Printer, onClick: h.print }
  // Acompte, situation, solde : calculés depuis le devis, ils ne se modifient pas à la main
  const edit: Action | null = draft && !artisanDoc
    ? { key: "edit", label: "Modifier", icon: Pencil, href: h.editHref, onClick: h.onEdit }
    : null
  const del: Action | null = draft
    ? { key: "delete", label: "Supprimer le brouillon", icon: Trash2, onClick: h.deleteDraft, busy: h.deleteLoading, busyLabel: "Suppression…", danger: true }
    : null
  const archive: Action = invoice.is_archived
    ? { key: "archive", label: "Désarchiver", icon: ArchiveX, onClick: h.toggleArchive, busy: h.archiveLoading, busyLabel: "Désarchivage…" }
    : { key: "archive", label: "Archiver", icon: Archive, onClick: h.toggleArchive, busy: h.archiveLoading, busyLabel: "Archivage…" }
  const credit: Action | null = CAN_CREDIT.includes(status)
    ? { key: "credit", label: "Créer un avoir", icon: RotateCcw, onClick: h.openCredit }
    : null
  // Relance manuelle : facture émise et impayée, client avec email (sans journal :
  // deux relances au plus, suivies par reminder_1_sent_at / reminder_2_sent_at)
  const canRemindNow = open && !!clientEmail && (journal || !invoice.reminder_2_sent_at)
  const remind: Action | null = canRemindNow
    ? {
        key: "remind", label: !journal && invoice.reminder_1_sent_at ? "Relance 2" : "Relancer", icon: Bell, onClick: h.remind,
        busy: h.remindLoading, busyLabel: "Envoi…",
        title: !journal && invoice.reminder_1_sent_at ? "Envoyer la 2e relance" : "Envoyer une relance par email",
      }
    : null
  // Envoi par email : brouillon dont le client a une adresse
  const send: Action | null = draft && clientEmail
    ? { key: "send", label: "Envoyer par email", icon: Send, onClick: h.openSend, busy: h.sendLoading, busyLabel: "Envoi…" }
    : null
  // Facture émise : renvoyer une copie (email perdu, ou envoi interrompu après l'émission)
  const resend: Action | null = !draft && clientEmail && (open || status === "paid")
    ? { key: "resend", label: "Renvoyer par email", icon: Send, onClick: h.openSend, busy: h.sendLoading, busyLabel: "Envoi…" }
    : null
  // « Marquer comme envoyée » n'est jamais proposé sur un brouillon : il part par email
  const transitions: (Action & { main: boolean })[] = (NEXT_ACTIONS[status] ?? [])
    .filter((a) => a.status !== "sent" || !draft)
    .map((a) => ({
      key: `status-${a.status}`, label: a.label, icon: a.icon, main: a.main,
      onClick: () => h.changeStatus(a.status), busy: h.statusLoading, busyLabel: "Mise à jour…",
    }))
  const mainTransition = transitions.find((t) => t.main) ?? null
  const otherTransitions = transitions.filter((t) => t !== mainTransition)

  let primary: Action | null
  let secondaries: Action[]
  let menu: Action[]
  if (draft) {
    primary = send ?? edit
    secondaries = send && edit ? [edit] : []
    menu = [print, archive, ...(del ? [del] : [])]
  } else if (late && remind) {
    // En retard : relancer d'abord (canevas « Relancer maintenant »)
    primary = remind
    secondaries = [mainTransition, credit].filter(Boolean) as Action[]
    menu = [...(xml ? [xml] : []), print, ...(resend ? [resend] : []), ...otherTransitions, archive]
  } else {
    primary = mainTransition
    secondaries = [remind, credit].filter(Boolean) as Action[]
    menu = [...(xml ? [xml] : []), print, ...(resend ? [resend] : []), ...otherTransitions, archive]
  }
  // Téléphone : une action secondaire à côté du PDF, le reste dans le menu « ··· »
  const mobileSecond = secondaries[0] ?? null
  const mobileMenu = [...secondaries.slice(1), ...menu]

  const run = (a: Action) => {
    if (a.href) router.push(a.href)
    else a.onClick?.()
  }

  /* ---- Montants ---- */
  // Reste à encaisser à l'échéance : la retenue de garantie se règle à sa libération
  const remaining = open || status === "rejected" ? fromCents(toCents(invoice.total_ttc) - retentionCents) : 0
  const dueIn = daysBetween(today, invoice.due_date)
  const dueSub = draft ? "Facture pas encore émise"
    : status === "paid" ? "Réglée"
    : status === "credited" ? "Annulée par un avoir"
    : status === "cancelled" ? "Annulée"
    : lateDays > 0 ? `Dépassée de ${plural(lateDays, "jour", "jours")}`
    : status === "overdue" ? "Marquée en retard"
    : open ? (dueIn === 0 ? "Aujourd’hui" : `Dans ${plural(dueIn, "jour", "jours")}`)
    : undefined
  const remainingSub = draft ? "Rien tant qu’elle n’est pas envoyée"
    : status === "paid" ? "Facture réglée"
    : status === "credited" ? "Annulée par un avoir"
    : status === "rejected" ? "Rejetée, à corriger"
    : open ? (lateDays > 0 ? `En retard de ${plural(lateDays, "jour", "jours")}` : dueSub)
    : undefined

  return (
    <div className="flex flex-col gap-5">
      <SetCrumb label={numberLabel} />
      <style>{PRINT_CSS}</style>

      {/* ---- Téléphone : retour, numéro, menu ---- */}
      <div className="-mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2 lg:hidden print:hidden">
        <Link href={backHref} className="q-link inline-flex min-h-11 items-center gap-1 justify-self-start text-[15px]">
          <ChevronLeft className="size-4" strokeWidth={2.25} aria-hidden />
          Factures
        </Link>
        <span className={cn("text-sm font-medium text-[var(--q-ink)]", invoice.invoice_number && "font-mono")}>{numberLabel}</span>
        <span className="justify-self-end">
          <MoreMenu actions={mobileMenu} run={run} triggerClassName="q-btn q-btn-ghost q-btn-icon !size-11 !rounded-xl" />
        </span>
      </div>

      {/* ---- Ordinateur : en-tête ---- */}
      {/* Titre d'au moins 420 px : sinon les actions passent dessous (à 1024 px, le titre tombait à un mot par ligne) */}
      <header className="hidden flex-wrap items-end justify-between gap-x-6 gap-y-4 lg:flex print:hidden">
        <div className="flex min-w-0 grow basis-[420px] flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            {invoice.invoice_number && <span className="font-mono text-sm text-[var(--q-text-3)]">{invoice.invoice_number}</span>}
            {kindLabel && <span className="q-tag">{kindLabel}</span>}
            <StatusPills invoice={invoice} lateDays={lateDays} />
          </div>
          <h1 className="q-h1 md:!text-[30px]">
            {clientName}
            {subject && <> · {subject}</>}
          </h1>
          <p className="text-sm text-[var(--q-text-4)]">
            {draft ? "Brouillon daté du " : "Émise le "}
            {longDate(invoice.issue_date)} · échéance le {longDate(invoice.due_date, yearOf(invoice.due_date) !== yearOf(invoice.issue_date))}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ActionButton action={pdf} run={run} />
          {secondaries.map((a) => <ActionButton key={a.key} action={a} run={run} />)}
          {primary && <ActionButton action={primary} run={run} primary />}
          <MoreMenu actions={menu} run={run} triggerClassName="q-btn q-btn-secondary q-btn-icon" />
        </div>
      </header>

      {/* ---- Téléphone : montant ---- */}
      <section className="q-card flex flex-col gap-3.5 rounded-[22px] p-[18px] lg:hidden print:hidden">
        <div className="flex flex-col gap-1">
          {/* Titre de la page sur téléphone (celui de l'en-tête ordinateur est masqué) */}
          <h1 className="text-[13px] font-normal text-[var(--q-text-3)]">{clientName}{subject && ` · ${subject}`}</h1>
          <span className="text-[13px] text-[var(--q-text-3)]">{open ? "Reste à encaisser" : "Total TTC"}</span>
          <span className="q-display text-[38px] leading-[1.05] tracking-[-0.04em] tabular-nums text-[var(--q-ink)]">
            {formatCurrency(open ? remaining : invoice.total_ttc)}
          </span>
          {retentionCents > 0 && (
            <span className="text-[13px] text-[var(--q-text-3)]">Retenue de garantie : {formatCurrency(fromCents(retentionCents))}, à sa libération</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {kindLabel && <span className="q-tag">{kindLabel}</span>}
          <StatusPills invoice={invoice} lateDays={lateDays} />
          <span className={cn("text-[13px]", late ? "font-semibold text-[var(--q-warn)]" : "text-[var(--q-text-3)]")}>
            Échéance {shortDate(invoice.due_date, year)}
          </span>
        </div>
      </section>

      {/* ---- Bandeaux ---- */}
      {paymentBanner}
      {invoice.is_archived && (
        <Banner icon={Archive} title="Facture archivée" action={<ActionButton action={{ ...archive, label: "Désarchiver" }} run={run} size="sm" />}>
          Elle n&apos;apparaît plus dans la liste principale. Vous pouvez la désarchiver à tout moment.
        </Banner>
      )}
      {pastDueSent && (
        <Banner
          tone="warn"
          icon={AlertTriangle}
          title={`En retard depuis le ${longDate(invoice.due_date)}`}
          action={
            <ActionButton
              action={{ key: "late", label: "Marquer en retard", icon: Clock, onClick: () => h.changeStatus("overdue"), busy: h.statusLoading, busyLabel: "Mise à jour…" }}
              run={run}
              size="sm"
            />
          }
        >
          L&apos;échéance est passée et la facture n&apos;est pas marquée comme payée.
        </Banner>
      )}
      {status === "credited" && (
        <Banner
          icon={FileX}
          title="Un avoir a été émis sur cette facture"
          action={<Link href={creditNotesHref} className="q-btn q-btn-secondary q-btn-sm"><RotateCcw aria-hidden />Voir les avoirs</Link>}
        >
          Cette facture est annulée par l&apos;avoir. Le détail est dans la section Avoirs.
        </Banner>
      )}
      {draft && (
        <Banner icon={Pencil} title="Ce brouillon n’est pas encore une facture">
          {artisanDoc && ctx?.quote && <>Calculé depuis le devis {ctx.quote.number} : pour le changer, supprimez ce brouillon et recréez-le depuis le devis. </>}
          {clientEmail
            ? invoice.invoice_number
              ? "Modifiez-le librement, puis envoyez-le à votre client par email pour l’émettre."
              : "Modifiez-le librement, puis envoyez-le à votre client par email pour l’émettre : il recevra alors son numéro de facture, à la date du jour."
            : <>Le client n&apos;a pas d&apos;adresse email : ajoutez-la {clientHref ? <Link href={clientHref} className="q-link">dans sa fiche</Link> : "dans sa fiche"} pour envoyer la facture.</>}
        </Banner>
      )}

      {/* ---- Ordinateur : indicateurs ---- */}
      <KpiGrid className="hidden lg:grid print:hidden">
        <Kpi label="Total TTC" value={formatCurrency(invoice.total_ttc)} sub={plural(invoice.lines?.length ?? 0, "ligne", "lignes")} />
        <Kpi label="Total HT" value={formatCurrency(invoice.subtotal_ht)} sub={`TVA ${formatCurrency(invoice.total_vat)}`} />
        <Kpi label="Échéance" value={shortDate(invoice.due_date, year)} sub={dueSub} tone={late ? "warn" : "default"} />
        <Kpi
          tone="ink"
          label="Reste à encaisser"
          value={draft ? "—" : formatCurrency(remaining)}
          sub={retentionCents > 0 && (open || status === "paid") ? `+ ${formatCurrency(fromCents(retentionCents))} de retenue, à sa libération` : remainingSub}
        />
      </KpiGrid>

      {/* ---- Document + colonne ---- */}
      {/* Deux colonnes dès 1280 px : à 1024 px, l'aperçu papier tombait à 280 px et les désignations s'écrivaient une lettre par ligne */}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section aria-label="Document" className="q-paper-bed order-2 flex justify-center !p-3 sm:!p-6 lg:order-1 print:border-0 print:bg-transparent print:!p-0">
          <InvoicePaper invoice={invoice} company={company} settingsHref={settingsCompanyHref} />
        </section>

        <div className="order-1 flex min-w-0 flex-col gap-4 lg:order-2 print:hidden">
          <Panel title="Historique" className="order-2 lg:order-1" bodyClassName="px-5 pb-5 pt-2">
            <Timeline invoice={invoice} today={today} year={year} />
            {open && clientEmail && (journal || !invoice.reminder_2_sent_at) && (
              <p className="q-field-hint mt-3 border-t border-[var(--q-line-soft)] pt-3">
                {autoReminders
                  ? <>Avec une formule active, le client est relancé automatiquement par email : {autoReminders}.</>
                  : "Les relances automatiques sont désactivées dans vos paramètres."}
              </p>
            )}
          </Panel>

          <Panel title="Paiement" className="order-1 lg:order-2" bodyClassName="flex flex-col gap-3.5 px-5 pb-5 pt-2">
            <dl className="flex flex-col gap-2.5 text-sm">
              <Row label="État"><PaymentState status={status} lateDays={lateDays} /></Row>
              <Row label="Montant TTC"><span className="font-semibold tabular-nums">{formatCurrency(invoice.total_ttc)}</span></Row>
              {retentionCents > 0 && ctx?.retention && (
                <>
                  <Row label={`Retenue de garantie ${formatPercentFr(ctx.retention.rate)} %`}><span className="tabular-nums">{formatCurrency(-fromCents(retentionCents))}</span></Row>
                  <Row label="À l’échéance"><span className="font-semibold tabular-nums">{formatCurrency(fromCents(toCents(invoice.total_ttc) - retentionCents))}</span></Row>
                </>
              )}
              <Row label="Échéance">
                <span className={cn(late && "font-semibold text-[var(--q-warn)]")}>{mediumDate(invoice.due_date)}</span>
              </Row>
            </dl>
            {payment ?? (company?.iban ? (
              <div className="flex flex-col gap-2">
                <div className="q-inset flex items-center gap-2 py-1.5 pl-3 pr-1.5">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[11px] text-[var(--q-text-4)]">IBAN</span>
                    <span className="truncate font-mono text-[13px] text-[var(--q-text-2)]">{formatIban(company.iban)}</span>
                  </span>
                  <button
                    type="button"
                    aria-label="Copier l'IBAN"
                    title="Copier l'IBAN"
                    className="q-btn q-btn-secondary q-btn-sm q-btn-icon shrink-0"
                    onClick={() => {
                      navigator.clipboard?.writeText(company.iban!.replace(/\s+/g, ""))
                        .then(() => toast.success("IBAN copié"), () => toast.error("Copie impossible"))
                    }}
                  >
                    <Copy aria-hidden />
                  </button>
                </div>
                <p className="q-field-hint">Règlement par virement : l&apos;IBAN figure sur la facture et dans l&apos;email d&apos;envoi.</p>
              </div>
            ) : company ? (
              <p className="text-[13px] text-[var(--q-text-3)]">
                Aucun IBAN renseigné. <Link href={settingsCompanyHref} className="q-link">Ajoutez-le</Link> pour qu&apos;il figure sur vos factures.
              </p>
            ) : null)}
          </Panel>

          {invoice.client && (
            <Panel title="Liés" className="order-3" bodyClassName="q-list pb-1">
              <RelatedRow
                href={clientHref ?? null}
                icon={<Initials name={invoice.client.name} />}
                title={invoice.client.name}
                sub={clientEmail ?? ([invoice.client.zip_code, invoice.client.city].filter(Boolean).join(" ") || "Client")}
              />
              {linkedQuote && (
                <RelatedRow
                  href={linkedQuote.href}
                  icon={
                    <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-[var(--q-wash)] text-[var(--q-accent-strong)]">
                      <FileCheck2 className="size-4" aria-hidden />
                    </span>
                  }
                  title={<span className="font-mono text-sm">{linkedQuote.number}</span>}
                  sub="Devis d’origine"
                />
              )}
              {invoice.chantier && (
                <RelatedRow
                  href={invoice.chantier.href}
                  icon={
                    <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-[var(--q-wash)] text-[var(--q-accent-strong)]">
                      <HardHat className="size-4" aria-hidden />
                    </span>
                  }
                  title={invoice.chantier.name}
                  sub="Chantier"
                />
              )}
              {(ctx?.deductions ?? []).map((d) => (
                <RelatedRow
                  key={d.invoice_id}
                  href={invoiceHref ? invoiceHref({ id: d.invoice_id, number: d.number }) : null}
                  icon={
                    <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-[var(--q-wash)] text-[var(--q-accent-strong)]">
                      <RotateCcw className="size-4" aria-hidden />
                    </span>
                  }
                  title={<span className="font-mono text-sm">{d.number}</span>}
                  sub={`Acompte repris : ${formatCurrency(-d.ttc)} TTC`}
                />
              ))}
            </Panel>
          )}
        </div>
      </div>

      {/* ---- Téléphone : barre d'actions collée en bas, au-dessus de la barre de navigation ---- */}
      <div aria-hidden className={cn("lg:hidden print:hidden", primary ? "h-[124px]" : "h-[64px]")} />
      <div
        className="q-card fixed inset-x-3 z-30 flex flex-col gap-2.5 rounded-3xl p-3 shadow-[var(--q-shadow-pop)] lg:hidden print:hidden"
        style={{ bottom: "calc(96px + env(safe-area-inset-bottom))" }}
      >
        {primary && <ActionButton action={primary} run={run} primary size="xl" className="w-full" />}
        <div className={cn("grid gap-2.5", mobileSecond ? "grid-cols-2" : "grid-cols-1")}>
          {mobileSecond && <ActionButton action={mobileSecond} run={run} size="lg" className="w-full" short />}
          <ActionButton action={pdf} run={run} size="lg" className="w-full" />
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Sous-composants                                                      */
/* ------------------------------------------------------------------ */

/**
 * Impression : seule la feuille de la facture sort. La coque tient dans
 * l'écran (hauteur fixe, défilement interne) : sans ce déblocage, l'impression
 * serait coupée à la première page et embarquerait barre latérale et en-tête.
 * Navigateur sans :has() : la règle est ignorée en bloc, l'impression reste
 * celle de la page entière.
 */
const PRINT_CSS = `@media print {
  body *:not(:has([data-invoice-print])):not([data-invoice-print]):not([data-invoice-print] *) { display: none !important; }
  :has([data-invoice-print]) {
    display: block !important; position: static !important; height: auto !important; min-height: 0 !important;
    max-height: none !important; overflow: visible !important; margin: 0 !important; padding: 0 !important;
    border: 0 !important; box-shadow: none !important; background: none !important;
  }
  [data-invoice-print] { -webkit-print-color-adjust: exact; print-color-adjust: exact; max-width: none !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; padding: 0 !important; }
}`

/** Libellés courts pour la barre du téléphone. */
const SHORT_LABELS: Record<string, string> = {
  "Marquer comme payée": "Marquer payée",
  "Marquer comme acceptée": "Marquer acceptée",
  "Créer un avoir": "Avoir",
}

function ActionButton({
  action: a, run, primary, size, className, short,
}: {
  action: Action
  run: (a: Action) => void
  primary?: boolean
  size?: "sm" | "lg" | "xl"
  className?: string
  short?: boolean
}) {
  const Icon = a.icon
  const label = a.busy && a.busyLabel ? a.busyLabel : short ? SHORT_LABELS[a.label] ?? a.label : a.label
  const cls = cn(
    "q-btn",
    primary ? "q-btn-primary" : a.danger ? "q-btn-danger" : "q-btn-secondary",
    size === "sm" && "q-btn-sm",
    size === "lg" && "q-btn-lg",
    size === "xl" && "q-btn-xl",
    className,
  )
  if (a.href && !a.onClick) {
    return (
      <Link href={a.href} className={cls} title={a.title}>
        <Icon aria-hidden />
        {label}
      </Link>
    )
  }
  return (
    <button type="button" className={cls} onClick={() => run(a)} disabled={a.busy || a.disabled} title={a.title} aria-busy={a.busy || undefined}>
      <Icon aria-hidden />
      {label}
    </button>
  )
}

function MoreMenu({ actions, run, triggerClassName }: { actions: Action[]; run: (a: Action) => void; triggerClassName: string }) {
  if (actions.length === 0) return null
  const dangers = actions.filter((a) => a.danger)
  const normal = actions.filter((a) => !a.danger)
  const item = (a: Action) => {
    const Icon = a.icon
    return (
      <DropdownMenuItem
        key={a.key}
        onClick={() => run(a)}
        disabled={a.busy || a.disabled}
        variant={a.danger ? "destructive" : "default"}
      >
        <Icon aria-hidden />
        {a.busy && a.busyLabel ? a.busyLabel : a.label}
      </DropdownMenuItem>
    )
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={triggerClassName} aria-label="Plus d'actions">
        <MoreHorizontal aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-[240px]">
        {normal.map(item)}
        {dangers.length > 0 && normal.length > 0 && <DropdownMenuSeparator className="bg-[var(--q-line-soft)]" />}
        {dangers.map(item)}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Statut du document, retard et archivage : toujours un libellé, jamais la couleur seule. */
function StatusPills({ invoice, lateDays }: { invoice: InvoiceView; lateDays: number }) {
  return (
    <>
      {invoice.status === "overdue" && lateDays > 0 ? (
        <DocStatusPill kind="invoice" status="overdue" label={`Retard ${lateDays} j`} />
      ) : (
        <DocStatusPill kind="invoice" status={invoice.status} />
      )}
      {invoice.status !== "overdue" && lateDays > 0 && (
        <StatusPill tone="warn" icon={<Clock strokeWidth={2.25} aria-hidden />}>Retard {lateDays} j</StatusPill>
      )}
      {invoice.is_archived && <StatusPill tone="neutral" icon={<Archive strokeWidth={2.25} aria-hidden />}>Archivée</StatusPill>}
    </>
  )
}

function PaymentState({ status, lateDays }: { status: InvoiceStatus; lateDays: number }) {
  if (status === "paid") return <StatusPill tone="ok" icon={<Check strokeWidth={2.75} aria-hidden />}>Réglée</StatusPill>
  if (status === "draft") return <StatusPill tone="neutral">Pas encore émise</StatusPill>
  if (status === "credited") return <StatusPill tone="neutral">Annulée par avoir</StatusPill>
  if (status === "cancelled") return <StatusPill tone="neutral">Annulée</StatusPill>
  if (status === "rejected") return <StatusPill tone="danger">Rejetée</StatusPill>
  if (status === "overdue" || lateDays > 0) {
    return (
      <StatusPill tone="warn" icon={<Clock strokeWidth={2.25} aria-hidden />}>
        {lateDays > 0 ? `En retard de ${lateDays} j` : "En retard"}
      </StatusPill>
    )
  }
  return <StatusPill tone="neutral" icon={<Clock strokeWidth={2.25} aria-hidden />}>En attente de virement</StatusPill>
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[var(--q-text-3)]">{label}</dt>
      <dd className="text-right text-[var(--q-ink)]">{children}</dd>
    </div>
  )
}

function Banner({
  icon: Icon, title, children, action, tone,
}: {
  icon: LucideIcon
  title: React.ReactNode
  children: React.ReactNode
  action?: React.ReactNode
  tone?: "warn"
}) {
  return (
    <div className={cn("q-banner flex-wrap items-center print:hidden", tone === "warn" && "q-banner-warn")}>
      <Icon className="size-[18px] shrink-0 self-start sm:self-center" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <p className="text-[13px] opacity-90">{children}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

function RelatedRow({ href, icon, title, sub }: { href: string | null; icon: React.ReactNode; title: React.ReactNode; sub: React.ReactNode }) {
  const body = (
    <>
      {icon}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-semibold">{title}</span>
        <span className="truncate text-[13px] text-[var(--q-text-4)]">{sub}</span>
      </span>
      {href && <ChevronRight className="size-4 shrink-0 text-[var(--q-text-4)]" aria-hidden />}
    </>
  )
  return href ? <Link href={href} className="q-list-row px-5">{body}</Link> : <div className="q-list-row px-5">{body}</div>
}

/* ---- Historique : seulement des dates enregistrées ---- */

interface Step { title: string; sub: string; state: "done" | "todo" | "warn" }

function stamp(value: string | null | undefined, year: number): string {
  if (!value) return ""
  const t = timeOf(value)
  return `${shortDate(value, year)}${t ? ` · ${t}` : ""}`
}

function buildSteps(inv: InvoiceView, today: string, year: number): Step[] {
  const steps: Step[] = []
  const status = inv.status
  if (inv.created_at) steps.push({ title: "Brouillon créé", sub: stamp(inv.created_at, year), state: "done" })

  if (inv.sent_at) {
    steps.push({ title: "Envoyée par email", sub: `${stamp(inv.sent_at, year)}${inv.client?.email ? ` · à ${inv.client.email}` : ""}`, state: "done" })
  } else if (status !== "draft") {
    steps.push({ title: "Émise", sub: `Facture datée du ${shortDate(inv.issue_date, year)}`, state: "done" })
  } else {
    steps.push({ title: "Envoi au client", sub: "Pas encore envoyée", state: "todo" })
  }

  if (Array.isArray(inv.reminders)) {
    for (const r of inv.reminders) {
      const title = r.stage.startsWith("before_") ? "Rappel avant échéance envoyé"
        : r.origin === "manual" ? "Relance envoyée"
        : "Relance automatique envoyée"
      steps.push({ title, sub: stamp(r.sent_at, year), state: "done" })
    }
  } else {
    if (inv.reminder_1_sent_at) steps.push({ title: "Relance 1 envoyée", sub: stamp(inv.reminder_1_sent_at, year), state: "done" })
    if (inv.reminder_2_sent_at) steps.push({ title: "Relance 2 envoyée", sub: stamp(inv.reminder_2_sent_at, year), state: "done" })
  }

  const late = daysLate(status, inv.due_date, today)
  if (status === "paid") {
    steps.push({ title: "Encaissée", sub: inv.paid_at ? stamp(inv.paid_at, year) : "Marquée comme payée", state: "done" })
  } else if (status === "credited") {
    steps.push({ title: "Avoir émis", sub: "La facture est annulée par un avoir", state: "done" })
  } else if (status === "cancelled") {
    steps.push({ title: "Annulée", sub: "", state: "done" })
  } else if (status === "rejected") {
    steps.push({ title: "Rejetée", sub: "À corriger avant un nouvel envoi", state: "warn" })
  } else if (status === "draft") {
    steps.push({ title: "Encaissement", sub: `Échéance prévue le ${shortDate(inv.due_date, year)}`, state: "todo" })
  } else {
    steps.push({
      title: "Encaissement",
      sub: late > 0 ? `Attendu depuis le ${shortDate(inv.due_date, year)}` : `Attendu le ${shortDate(inv.due_date, year)}`,
      state: late > 0 || status === "overdue" ? "warn" : "todo",
    })
  }
  return steps
}

function Timeline({ invoice, today, year }: { invoice: InvoiceView; today: string; year: number }) {
  const steps = buildSteps(invoice, today, year)
  return (
    <ol className="flex flex-col">
      {steps.map((s, i) => {
        const last = i === steps.length - 1
        const nextDone = !last && steps[i + 1].state === "done"
        return (
          <li key={i} className="flex gap-3">
            <span className="flex flex-col items-center">
              {s.state === "done" ? (
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[var(--q-accent)] text-white">
                  <Check className="size-3" strokeWidth={3} aria-hidden />
                </span>
              ) : (
                <span
                  className={cn(
                    "size-5 shrink-0 rounded-full border-2 border-dashed bg-[var(--q-surface)]",
                    s.state === "warn" ? "border-[var(--q-warn)]" : "border-[var(--q-placeholder)]",
                  )}
                />
              )}
              {!last && (
                <span
                  className={cn(
                    "min-h-[18px] w-0.5 flex-1",
                    nextDone ? "bg-[var(--q-accent)]" : "bg-[repeating-linear-gradient(180deg,var(--q-placeholder)_0_4px,transparent_4px_8px)]",
                  )}
                />
              )}
            </span>
            <span className={cn("flex min-w-0 flex-col gap-0.5", !last && "pb-3.5")}>
              <span className={cn("text-sm font-semibold", s.state === "todo" && "text-[var(--q-text-3)]", s.state === "warn" && "text-[var(--q-warn)]")}>
                {s.title}
              </span>
              {s.sub && <span className="break-words text-xs tabular-nums text-[var(--q-text-4)]">{s.sub}</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
