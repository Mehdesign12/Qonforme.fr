"use client"

/**
 * Fiche d'un devis (canevas « Devis-detail », « Devis-envoye »,
 * « Devis-detail-accepte », « Mobile-devis-D-2026-037 »).
 *
 * Composant de présentation partagé par /quotes/[id] (API) et
 * /demo/quotes/[id] (lib/demo/data.ts). Les actions arrivent par `actions` :
 * la page réelle appelle les routes (statuts filtrés côté serveur par
 * lib/utils/document-status.ts), la démo affiche « Créez un compte… ».
 *
 * Honnêteté (DECISIONS-STRATEGIQUES.md) : pas de signature en ligne, de suivi
 * d'ouverture, de relance automatique ni d'acompte, fonctions non livrées.
 * L'accord du client se fait sur papier ou par retour d'email, puis l'artisan
 * marque le devis comme accepté. L'historique ne montre que des dates réelles.
 */
import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Check, CheckCircle2, ChevronLeft, ChevronRight, Clock, Copy, Download, FileText, Info,
  Loader2, MoreHorizontal, Pencil, Printer, RefreshCw, Send, Trash2, X, type LucideIcon,
} from "lucide-react"
import { DocStatusPill, INVOICE_PILLS, Initials, Kpi, KpiGrid, StatusPill, initialsOf } from "@/components/app/kit"
import { SetCrumb } from "@/components/layout/crumb"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils/invoice"
import {
  daysBetween, daysLeft, dateTime, expiryHint, fmtAmount, fmtQty, fmtRate, fmtSiren, fmtUnit, longDate, parisDay, plural,
  quoteTitle, shortDate, vatBreakdown, vatRatesLabel, type QuoteStatus,
} from "@/components/quotes/QuoteListHelpers"

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface QuoteDetailLine {
  description: string
  quantity: number
  unit?: string | null
  unit_price_ht: number
  vat_rate: number
  total_ht: number
  total_vat?: number | null
}

export interface QuoteDetailData {
  id: string
  quote_number: string
  status: QuoteStatus
  issue_date: string
  valid_until: string
  /** Horodatages réels quand ils existent (la démo n'en a pas). */
  created_at?: string | null
  sent_at?: string | null
  /** Objet du chantier (démo) ; sinon tiré de la première prestation. */
  subject?: string | null
  lines: QuoteDetailLine[]
  subtotal_ht: number
  total_vat: number
  total_ttc: number
  notes?: string | null
  client: {
    name: string
    email?: string | null
    address?: string | null
    zip_code?: string | null
    city?: string | null
    siren?: string | null
    href?: string | null
  } | null
  converted: boolean
  converted_invoice: { number?: string | null; status?: string | null; href: string } | null
}

export interface QuoteDetailCompany {
  name: string
  address?: string | null
  zip_code?: string | null
  city?: string | null
  siret?: string | null
  siren?: string | null
  vat_number?: string | null
}

export interface QuoteDetailActions {
  onDownloadPdf: () => void
  onPrint: () => void
  onDuplicate: () => void
  /** Brouillon : lien de modification (réel) ou action (démo). */
  editHref?: string
  onEdit?: () => void
  onDelete: () => unknown
  /** Envoi (ou renvoi) par email ; true si le devis est parti. */
  onSend: () => Promise<boolean>
  /** Accord ou refus du client ; true si le statut a changé. */
  onSetStatus: (status: "accepted" | "rejected") => Promise<boolean>
  onConvert: () => unknown
}

export interface QuoteDetailBusy {
  pdf?: boolean
  duplicate?: boolean
  delete?: boolean
  send?: boolean
  status?: boolean
  convert?: boolean
}

type ModalKey = "send" | "accept" | "reject" | "delete" | "convert" | "more"

/* ------------------------------------------------------------------ */
/* Vue                                                                 */
/* ------------------------------------------------------------------ */

export function QuoteDetailView({
  quote,
  company,
  today,
  actions,
  busy = {},
  links,
  demo = false,
}: {
  quote: QuoteDetailData
  company: QuoteDetailCompany | null
  /** « Aujourd'hui » (AAAA-MM-JJ) : date du navigateur, ou date fixe de la démo. */
  today: string
  actions: QuoteDetailActions
  busy?: QuoteDetailBusy
  links: { list: string; newQuote: string; companySettings?: string }
  /** Démo : rien n'est enregistré, les fenêtres se ferment après l'invitation à créer un compte. */
  demo?: boolean
}) {
  const compact = useIsCompact()
  const [modal, setModal] = useState<ModalKey | null>(null)
  const [justSent, setJustSent] = useState<string | null>(null)

  const s = quote.status
  const left = daysLeft(quote, today)
  const expired = left !== null && left < 0
  const hint = expiryHint(quote, today)
  const clientName = quote.client?.name ?? null
  const title = quoteTitle(clientName, quote)
  const canConvert = (s === "sent" || s === "accepted") && !quote.converted
  const invoiceNumber = quote.converted_invoice?.number ?? null
  const closeModal = () => setModal(null)
  const openModal = (k: ModalKey) => () => setModal(k)

  /* ── Actions communes (en-tête, barre mobile, feuille « Plus ») ── */
  const send = async () => {
    const ok = await actions.onSend()
    if (ok || demo) setModal(null)
    if (ok && !demo) setJustSent(clientName ?? "votre client")
  }
  const setStatus = async (status: "accepted" | "rejected") => {
    const ok = await actions.onSetStatus(status)
    if (ok || demo) setModal(null)
  }
  const convert = async () => {
    await actions.onConvert()
    setModal(null)
  }
  const remove = async () => {
    await actions.onDelete()
    setModal(null)
  }
  const fromMore = (fn: () => void) => () => {
    setModal(null)
    fn()
  }

  /* ── Sous-titre de l'en-tête ── */
  const validity = `valable jusqu'au ${longDate(quote.valid_until, quote.valid_until.slice(0, 4) !== today.slice(0, 4))}`
  const subLine =
    s === "draft" ? `Brouillon daté du ${longDate(quote.issue_date)} · ${validity}`
    : s === "sent" ? `${quote.sent_at ? `Envoyé le ${longDate(parisDay(quote.sent_at))}` : `Émis le ${longDate(quote.issue_date)}`} · ${validity}`
    : s === "accepted" ? `Émis le ${longDate(quote.issue_date)} · accepté par le client`
    : `Émis le ${longDate(quote.issue_date)} · refusé par le client`

  /* ── Indicateurs ── */
  const validityKpi =
    s === "sent"
      ? expired
        ? { value: "Expiré", sub: `Depuis le ${longDate(quote.valid_until, false)}` }
        : { value: left === 0 ? "Dernier jour" : plural(left ?? 0, "jour"), sub: `Expire le ${longDate(quote.valid_until, false)}` }
      : { value: plural(Math.max(0, daysBetween(quote.issue_date, quote.valid_until)), "jour"), sub: `Jusqu'au ${longDate(quote.valid_until, false)}` }
  const nextKpi =
    s === "draft" ? { value: "À envoyer", sub: "Brouillon modifiable" }
    : s === "sent" ? (expired ? { value: "Expiré", sub: "Renouvelez le devis" } : { value: "En attente", sub: "de l'accord du client" })
    : s === "accepted" ? (quote.converted ? { value: "Facturé", sub: invoiceNumber ?? "Facture créée" } : { value: "À facturer", sub: "Convertissez-le en facture" })
    : { value: "Sans suite", sub: "Refusé par le client" }

  /* ── Historique (dates réelles uniquement) ── */
  const events: TimelineEvent[] = [
    { title: "Créé", sub: quote.created_at ? dateTime(quote.created_at) : `Daté du ${shortDate(quote.issue_date)}`, state: "done" },
  ]
  if (s === "draft") {
    events.push({ title: "Envoi au client", sub: "Pas encore envoyé", state: "todo" })
  } else {
    events.push(
      quote.sent_at
        ? { title: "Envoyé par email", sub: [dateTime(quote.sent_at), quote.client?.email].filter(Boolean).join(" · "), state: "done" }
        : { title: "Envoyé au client", sub: `Émis le ${shortDate(quote.issue_date)}`, state: "done" },
    )
    if (s === "sent") {
      events.push({
        title: "Réponse du client",
        sub: expired ? `Sans réponse · expiré le ${shortDate(quote.valid_until)}` : `En attente · valable jusqu'au ${shortDate(quote.valid_until)}`,
        state: "todo",
      })
    } else if (s === "accepted") {
      events.push({ title: "Accepté par le client", sub: "Accord enregistré", state: "done" })
      events.push(
        quote.converted
          ? { title: "Converti en facture", sub: invoiceNumber ?? "Facture créée", state: "done" }
          : { title: "Facture à créer", sub: "Conversion en facture brouillon", state: "todo" },
      )
    } else {
      events.push({ title: "Refusé par le client", sub: "Sans suite", state: "refused" })
    }
  }

  /* ── Boutons ── */
  const pdfBtn = (label = "PDF") => (
    <Act key="pdf" label={label} icon={Download} onClick={actions.onDownloadPdf} loading={busy.pdf} />
  )
  const dupBtn = (label = "Dupliquer", primary = false) => (
    <Act key="dup" label={label} icon={Copy} onClick={actions.onDuplicate} loading={busy.duplicate} variant={primary ? "primary" : "secondary"} />
  )
  const printBtn = <Act key="print" label="Imprimer" icon={Printer} onClick={actions.onPrint} iconOnly />
  const editBtn = <Act key="edit" label="Modifier" icon={Pencil} href={actions.editHref} onClick={actions.onEdit} />

  let headerActions: React.ReactNode[] = []
  if (s === "draft") {
    headerActions = [
      pdfBtn(), dupBtn(), printBtn, editBtn,
      <Act key="del" label="Supprimer" icon={Trash2} variant="danger" onClick={openModal("delete")} loading={busy.delete} />,
      <Act key="send" label="Envoyer par email" icon={Send} variant="primary" onClick={openModal("send")} loading={busy.send} />,
    ]
  } else if (s === "sent" && !expired) {
    headerActions = [
      pdfBtn(), dupBtn(), printBtn,
      <Act key="resend" label="Renvoyer par email" icon={RefreshCw} onClick={openModal("send")} loading={busy.send} />,
      <Act key="rej" label="Refusé ?" onClick={openModal("reject")} />,
      <Act key="acc" label="Marquer accepté" icon={Check} variant="primary" onClick={openModal("accept")} loading={busy.status} />,
    ]
  } else if (s === "sent") {
    headerActions = [
      pdfBtn(), printBtn,
      <Act key="rej" label="Refusé ?" onClick={openModal("reject")} />,
      <Act key="acc" label="Marquer accepté" icon={Check} onClick={openModal("accept")} loading={busy.status} />,
      dupBtn("Renouveler le devis", true),
    ]
  } else if (s === "accepted") {
    headerActions = [
      pdfBtn(), dupBtn(), printBtn,
      quote.converted && quote.converted_invoice
        ? <Act key="inv" label="Voir la facture" icon={FileText} variant="primary" href={quote.converted_invoice.href} />
        : <Act key="conv" label="Convertir en facture" icon={FileText} variant="primary" onClick={openModal("convert")} loading={busy.convert} />,
    ]
  } else {
    headerActions = [pdfBtn(), printBtn, dupBtn("Dupliquer en nouveau devis", true)]
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <SetCrumb label={quote.quote_number} />

      {/* Barre de navigation mobile : retour, numéro, autres actions */}
      <div className="-mx-1 -mt-2 flex items-center justify-between gap-2 lg:hidden print:hidden">
        <Link href={links.list} className="inline-flex min-h-11 items-center gap-0.5 pr-2 text-base font-medium text-[var(--q-accent-strong)]">
          <ChevronLeft className="size-5" strokeWidth={2.25} aria-hidden />
          Devis
        </Link>
        <span className="truncate font-mono text-sm font-medium text-[var(--q-ink)]">{quote.quote_number}</span>
        <button
          type="button"
          aria-label="Plus d'actions"
          aria-haspopup="dialog"
          onClick={openModal("more")}
          className="grid size-11 shrink-0 place-items-center rounded-xl text-[var(--q-text-2)] hover:bg-[var(--q-hover)]"
        >
          <MoreHorizontal className="size-5" aria-hidden />
        </button>
      </div>

      {/* Bandeaux */}
      {justSent && (
        <div role="status" className="q-banner q-banner-ok flex-wrap items-center print:hidden">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden />
          <span className="min-w-[220px] flex-1 text-[15px] leading-snug">
            <strong className="font-semibold">Devis envoyé à {justSent}.</strong> Le PDF est joint à l&apos;email.
          </span>
          <span className="flex flex-wrap gap-3 text-sm font-semibold">
            <Link href={links.newQuote} className="hover:underline">Faire un autre devis</Link>
            <Link href={links.list} className="hover:underline">Retour aux devis</Link>
          </span>
        </div>
      )}
      {s === "accepted" && !quote.converted && (
        <div role="status" className="q-banner flex-wrap items-center print:hidden">
          <CheckCircle2 className="size-5 shrink-0" aria-hidden />
          <span className="min-w-[220px] flex-1 text-[15px] leading-snug">
            <strong className="font-semibold">Devis accepté.</strong> Prochaine étape : le convertir en facture ({formatCurrency(quote.total_ttc)} TTC), à relire avant l&apos;envoi.
          </span>
          {/* Sur mobile, la barre d'actions du bas porte déjà la conversion */}
          <span className="hidden lg:inline-flex">
            <Act label="Convertir en facture" icon={FileText} variant="primary" size="sm" onClick={openModal("convert")} loading={busy.convert} />
          </span>
        </div>
      )}
      {quote.converted && quote.converted_invoice && (
        <div role="status" className="q-banner q-banner-ok flex-wrap items-center print:hidden">
          <CheckCircle2 className="size-5 shrink-0" aria-hidden />
          <span className="min-w-[220px] flex-1 text-[15px] leading-snug">
            <strong className="font-semibold">Devis converti en facture{invoiceNumber ? ` ${invoiceNumber}` : ""}.</strong> Elle se trouve dans vos factures.
          </span>
          <Link href={quote.converted_invoice.href} className="text-sm font-semibold hover:underline">Voir la facture</Link>
        </div>
      )}
      {expired && (
        <div role="status" className="q-banner q-banner-warn items-center print:hidden">
          <Clock className="size-5 shrink-0" aria-hidden />
          <span className="flex-1 text-[15px] leading-snug">
            <strong className="font-semibold">Ce devis a expiré le {longDate(quote.valid_until)}.</strong> Un devis envoyé ne se modifie plus : dupliquez-le pour proposer une version à jour.
          </span>
        </div>
      )}

      {/* En-tête (ordinateur) */}
      <div className="hidden flex-wrap items-end justify-between gap-4 lg:flex print:hidden">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-sm text-[var(--q-text-3)]">{quote.quote_number}</span>
            <DocStatusPill kind="quote" status={s} />
            {hint && <StatusPill tone="warn" icon={<Clock strokeWidth={2.25} aria-hidden />}>{expired ? "Expiré" : hint}</StatusPill>}
          </div>
          <h1 className="q-h1 !text-[30px]">{title}</h1>
          <span className="text-sm text-[var(--q-text-4)]">{subLine}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">{headerActions}</div>
      </div>

      {/* Carte de tête (mobile) */}
      <section className="q-card flex flex-col gap-3.5 rounded-[22px] p-[18px] lg:hidden print:hidden" aria-label="Résumé du devis">
        <div className="flex flex-col gap-1">
          <h1 className="text-[13px] font-normal leading-snug text-[var(--q-text-3)]">{title}</h1>
          <span className="text-[13px] text-[var(--q-text-3)]">Montant TTC</span>
          <span className="font-display text-[38px] font-semibold leading-[1.05] tracking-[-0.04em] tabular-nums text-[var(--q-ink)]">
            {formatCurrency(quote.total_ttc)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DocStatusPill kind="quote" status={s} />
          {hint && <StatusPill tone="warn" icon={<Clock strokeWidth={2.25} aria-hidden />}>{hint}</StatusPill>}
          {!hint && <span className="text-[13px] text-[var(--q-text-3)]">Valable jusqu&apos;au {longDate(quote.valid_until, false)}</span>}
        </div>
      </section>

      {/* Indicateurs (ordinateur) */}
      <KpiGrid className="hidden lg:grid print:hidden">
        <Kpi label="Total TTC" value={formatCurrency(quote.total_ttc)} sub={`${formatCurrency(quote.subtotal_ht)} HT · ${vatRatesLabel(quote.lines)}`} />
        <Kpi label="Date du devis" value={shortDate(quote.issue_date)} sub={plural(quote.lines.length, "prestation")} />
        <Kpi label="Validité" value={validityKpi.value} sub={validityKpi.sub} tone={s === "sent" && expired ? "warn" : "default"} />
        <Kpi label="Prochaine étape" value={nextKpi.value} sub={nextKpi.sub} tone="ink" />
      </KpiGrid>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Colonne principale */}
        <div className="flex min-w-0 flex-col gap-4">
          <section aria-label="Aperçu du devis" className="q-paper-bed hidden justify-center lg:flex print:flex print:border-0 print:bg-transparent print:!p-0">
            <QuotePaper quote={quote} company={company} companySettings={links.companySettings} />
          </section>

          {/* Suivi (mobile : avant les prestations, comme le canevas) */}
          <section aria-label="Suivi du devis" className="q-card rounded-[22px] p-[18px] lg:hidden print:hidden">
            <h2 className="q-h2 mb-3.5">Suivi du devis</h2>
            <Timeline events={events} />
          </section>

          {/* Prestations (mobile) */}
          <section aria-label="Prestations" className="flex flex-col gap-2 lg:hidden print:hidden">
            <div className="flex items-baseline justify-between">
              <h2 className="q-h2">Prestations</h2>
              <span className="text-[13px] tabular-nums text-[var(--q-text-4)]">{quote.lines.length}</span>
            </div>
            <div className="q-card q-list overflow-hidden rounded-[18px]">
              {quote.lines.map((l, i) => (
                <div key={i} className="q-list-row px-3.5 py-2.5">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[15px] font-semibold">{l.description || "Prestation"}</span>
                    <span className="truncate text-[13px] tabular-nums text-[var(--q-text-4)]">
                      {fmtQty(l.quantity)}{l.unit ? ` ${fmtUnit(l.quantity, l.unit)}` : ""} × {formatCurrency(l.unit_price_ht)} · TVA {fmtRate(l.vat_rate)} %
                    </span>
                  </span>
                  <span className="shrink-0 text-[15px] font-semibold tabular-nums">{formatCurrency(l.total_ht)}</span>
                </div>
              ))}
              <div className="flex flex-col gap-1.5 bg-[var(--q-surface-2)] px-3.5 py-3 text-sm tabular-nums">
                <TotalRow label="Total HT" value={formatCurrency(quote.subtotal_ht)} />
                {vatBreakdown(quote.lines).map((v) => (
                  <TotalRow key={v.rate} label={`TVA ${fmtRate(v.rate)} %`} value={formatCurrency(v.amount)} />
                ))}
                <TotalRow label="Total TTC" value={formatCurrency(quote.total_ttc)} strong />
              </div>
            </div>
          </section>

          {quote.notes && (
            <section aria-label="Notes et conditions" className="q-card flex flex-col gap-2 p-[18px] lg:hidden print:hidden">
              <h2 className="q-h2">Notes et conditions</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--q-text-3)]">{quote.notes}</p>
            </section>
          )}
        </div>

        {/* Colonne de droite */}
        <div className="flex min-w-0 flex-col gap-4 print:hidden">
          <section aria-label="Suivi du devis" className="q-card hidden p-[18px] lg:block">
            <h2 className="q-h2 mb-3.5">Suivi du devis</h2>
            <Timeline events={events} />
          </section>

          {/* Accord du client : la signature en ligne n'existe pas, l'accord se donne sur le devis signé */}
          <section aria-label="Accord du client" className="q-card hidden flex-col gap-3 p-[18px] lg:flex">
            <div className="flex items-center justify-between gap-2.5">
              <h2 className="q-h2">Accord du client</h2>
              {s === "accepted" ? <StatusPill tone="ok" icon={<Check strokeWidth={2.75} aria-hidden />}>Accepté</StatusPill>
                : s === "rejected" ? <StatusPill tone="danger" icon={<X strokeWidth={2.75} aria-hidden />}>Refusé</StatusPill>
                : s === "sent" ? <StatusPill tone="neutral">En attente</StatusPill>
                : <StatusPill tone="neutral">À envoyer</StatusPill>}
            </div>
            <p className="text-[13px] leading-normal text-[var(--q-text-3)]">
              {s === "draft" && "Une fois le devis envoyé, votre client donne son accord en vous retournant le devis daté et signé, avec la mention « Bon pour accord ». Vous le marquez alors comme accepté."}
              {s === "sent" && "Votre client donne son accord en vous retournant le devis daté et signé, avec la mention « Bon pour accord ». Dès réception, marquez-le comme accepté."}
              {s === "accepted" && "Accord enregistré. Conservez le devis signé par votre client avec vos documents : il vaut commande."}
              {s === "rejected" && "Le client a refusé ce devis. Dupliquez-le pour lui proposer une nouvelle version."}
            </p>
            {s === "sent" && (
              <div className="flex flex-wrap gap-2">
                <Act label="Marquer accepté" icon={Check} variant="primary" size="sm" onClick={openModal("accept")} loading={busy.status} />
                <Act label="Refusé ?" size="sm" onClick={openModal("reject")} />
              </div>
            )}
            {s === "rejected" && (
              <div className="flex flex-wrap gap-2">
                <Act label="Dupliquer" icon={Copy} size="sm" onClick={actions.onDuplicate} loading={busy.duplicate} />
              </div>
            )}
          </section>

          {canConvert && (
            <section aria-label="Suite du devis" className="q-card hidden flex-col gap-3 p-[18px] lg:flex">
              <h2 className="q-h2">Suite du devis</h2>
              <p className="text-[13px] leading-normal text-[var(--q-text-3)]">
                {s === "accepted"
                  ? "Créez la facture en un clic : elle reprend le client et les lignes du devis, en brouillon, pour que vous la relisiez avant de l'envoyer."
                  : "Le client a donné son accord ? Convertissez directement le devis en facture brouillon : il passe alors en « Accepté »."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Act label="Convertir en facture" icon={FileText} variant={s === "accepted" ? "primary" : "secondary"} size="sm" onClick={openModal("convert")} loading={busy.convert} />
              </div>
            </section>
          )}

          {(quote.client || quote.converted_invoice) && (
            <section aria-label="Liés à ce devis" className="q-card overflow-hidden py-1.5">
              <h2 className="q-h2 px-[18px] pb-2 pt-3">Liés à ce devis</h2>
              <div className="flex flex-col">
                {quote.converted_invoice && (
                  <LinkedRow
                    href={quote.converted_invoice.href}
                    icon={<span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-[var(--q-wash)] text-[var(--q-accent-strong)]"><FileText className="size-4" aria-hidden /></span>}
                    title={invoiceNumber ?? "Facture"}
                    sub={`Facture${quote.converted_invoice.status ? ` · ${(INVOICE_PILLS[quote.converted_invoice.status]?.label ?? quote.converted_invoice.status).toLowerCase()}` : ""}`}
                  />
                )}
                {quote.client && (
                  <LinkedRow
                    href={quote.client.href ?? undefined}
                    icon={<Initials name={quote.client.name} />}
                    title={quote.client.name}
                    sub={["Client", quote.client.city].filter(Boolean).join(" · ")}
                  />
                )}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Réserve sous la barre d'actions mobile */}
      <div aria-hidden className="h-[132px] lg:hidden print:hidden" />

      {/* Barre d'actions collée en bas (mobile), au-dessus de la barre de navigation */}
      <div
        className="fixed inset-x-3 z-30 flex flex-col gap-2.5 rounded-3xl border border-[var(--q-line)] bg-[var(--q-surface)] p-3 shadow-[var(--q-shadow-float)] lg:hidden print:hidden"
        style={{ bottom: "calc(96px + env(safe-area-inset-bottom))" }}
      >
        {s === "draft" && (
          <>
            <BarBtn primary label="Envoyer par email" icon={Send} onClick={openModal("send")} loading={busy.send} />
            <div className="grid grid-cols-2 gap-2.5">
              <BarBtn label="Modifier" icon={Pencil} href={actions.editHref} onClick={actions.onEdit} />
              <BarBtn label="PDF" icon={Download} onClick={actions.onDownloadPdf} loading={busy.pdf} />
            </div>
          </>
        )}
        {s === "sent" && (
          <>
            {expired
              ? <BarBtn primary label="Renouveler le devis" icon={Copy} onClick={actions.onDuplicate} loading={busy.duplicate} />
              : <BarBtn primary label="Renvoyer par email" icon={RefreshCw} onClick={openModal("send")} loading={busy.send} />}
            <div className="grid grid-cols-2 gap-2.5">
              <BarBtn label="Marquer accepté" icon={Check} onClick={openModal("accept")} loading={busy.status} />
              <BarBtn label="PDF" icon={Download} onClick={actions.onDownloadPdf} loading={busy.pdf} />
            </div>
          </>
        )}
        {s === "accepted" && (
          <>
            {quote.converted && quote.converted_invoice
              ? <BarBtn primary label={invoiceNumber ? `Voir la facture ${invoiceNumber}` : "Voir la facture"} icon={FileText} href={quote.converted_invoice.href} />
              : <BarBtn primary label="Convertir en facture" icon={FileText} onClick={openModal("convert")} loading={busy.convert} />}
            <BarBtn label="Télécharger le PDF" icon={Download} onClick={actions.onDownloadPdf} loading={busy.pdf} />
          </>
        )}
        {s === "rejected" && (
          <>
            <BarBtn primary label="Dupliquer ce devis" icon={Copy} onClick={actions.onDuplicate} loading={busy.duplicate} />
            <BarBtn label="Télécharger le PDF" icon={Download} onClick={actions.onDownloadPdf} loading={busy.pdf} />
          </>
        )}
      </div>

      {/* ── Fenêtres ── */}
      <QuoteModal
        open={modal === "send"}
        onOpenChange={(o) => !o && closeModal()}
        compact={compact}
        title={s === "draft" ? "Envoyer le devis" : "Renvoyer le devis"}
        description={`${quote.quote_number} · ${formatCurrency(quote.total_ttc)} TTC`}
        actions={[{
          label: busy.send ? "Envoi…" : s === "draft" ? "Envoyer" : "Renvoyer",
          icon: busy.send ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />,
          variant: "primary",
          onClick: send,
          disabled: busy.send || !quote.client?.email,
        }]}
      >
        <div className="q-inset flex flex-col gap-0.5 p-3.5">
          <span className="text-xs text-[var(--q-text-4)]">Destinataire</span>
          <span className="text-sm font-semibold">{clientName ?? "Aucun client"}</span>
          {quote.client?.email
            ? <span className="truncate font-mono text-[13px] text-[var(--q-text-3)]">{quote.client.email}</span>
            : (
              <span className="text-[13px] text-[var(--q-danger)]">
                Aucune adresse email : ajoutez-en une dans la{" "}
                {quote.client?.href ? <Link href={quote.client.href} className="underline">fiche client</Link> : "fiche client"}.
              </span>
            )}
        </div>
        <p className="text-sm leading-relaxed text-[var(--q-text-3)]">
          {s === "draft"
            ? <>Le devis <strong className="font-semibold text-[var(--q-ink)]">{quote.quote_number}</strong> part par email avec son PDF en pièce jointe. Il passe au statut <strong className="font-semibold text-[var(--q-ink)]">Envoyé</strong> et ne se modifie plus.</>
            : <>Le devis <strong className="font-semibold text-[var(--q-ink)]">{quote.quote_number}</strong> est renvoyé par email avec son PDF, sans changer de statut.</>}
        </p>
        <p className="text-xs text-[var(--q-text-4)]">
          Objet : <span className="font-medium text-[var(--q-text-2)]">Devis {quote.quote_number} — {company?.name || "votre entreprise"}</span>
        </p>
      </QuoteModal>

      <QuoteModal
        open={modal === "accept"}
        onOpenChange={(o) => !o && closeModal()}
        compact={compact}
        title="Marquer comme accepté"
        description={`${clientName ?? "Le client"} vous a donné son accord ?`}
        actions={[
          { label: "Oui, il est accepté", icon: busy.status ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />, variant: "primary", onClick: () => setStatus("accepted"), disabled: busy.status },
          { label: "Il a refusé", icon: <X aria-hidden />, variant: "danger", onClick: () => setStatus("rejected"), disabled: busy.status },
        ]}
      >
        <InfoNote>
          Le devis passe en « Accepté » et vous pourrez le convertir en facture. Gardez le devis signé par votre client : il vaut commande.
        </InfoNote>
      </QuoteModal>

      <QuoteModal
        open={modal === "reject"}
        onOpenChange={(o) => !o && closeModal()}
        compact={compact}
        title="Marquer comme refusé"
        description="Le client vous a répondu que non ?"
        actions={[
          { label: "Marquer comme refusé", icon: busy.status ? <Loader2 className="animate-spin" aria-hidden /> : <X aria-hidden />, variant: "danger", onClick: () => setStatus("rejected"), disabled: busy.status },
        ]}
      >
        <p className="text-sm leading-relaxed text-[var(--q-text-3)]">
          Le devis passe en « Refusé » et ne pourra plus être accepté. Vous pourrez le dupliquer pour proposer une nouvelle version.
        </p>
      </QuoteModal>

      <QuoteModal
        open={modal === "convert"}
        onOpenChange={(o) => !o && closeModal()}
        compact={compact}
        title="Convertir en facture"
        description={`${quote.quote_number} · ${formatCurrency(quote.total_ttc)} TTC`}
        actions={[
          { label: busy.convert ? "Conversion…" : "Créer la facture", icon: busy.convert ? <Loader2 className="animate-spin" aria-hidden /> : <FileText aria-hidden />, variant: "primary", onClick: convert, disabled: busy.convert },
        ]}
      >
        <InfoNote>
          Une facture brouillon est créée avec le client et les lignes du devis. Vous la relisez avant de l&apos;envoyer.
          {s === "sent" && " Le devis passe en « Accepté »."}
        </InfoNote>
      </QuoteModal>

      <QuoteModal
        open={modal === "delete"}
        onOpenChange={(o) => !o && closeModal()}
        compact={compact}
        title="Supprimer le brouillon"
        description={`${quote.quote_number} sera définitivement supprimé.`}
        actions={[
          { label: busy.delete ? "Suppression…" : "Supprimer", icon: busy.delete ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />, variant: "danger", onClick: remove, disabled: busy.delete },
        ]}
      />

      {/* Feuille « Plus d'actions » (mobile) */}
      <Sheet open={modal === "more"} onOpenChange={(o) => !o && closeModal()}>
        <SheetContent side="bottom" showCloseButton={false} className="max-h-[85dvh] gap-3 overflow-y-auto px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-2">
          <div className="q-sheet-grip" aria-hidden />
          <div className="flex flex-col gap-0.5 pt-1">
            <SheetTitle className="font-display text-[22px] font-semibold tracking-[-0.02em] text-[var(--q-ink)]">{quote.quote_number}</SheetTitle>
            <SheetDescription className="text-sm text-[var(--q-text-4)]">{clientName ?? "Sans client"}</SheetDescription>
          </div>
          <div className="flex flex-col">
            <MoreRow icon={Download} label="Télécharger le PDF" hint="Document prêt à imprimer" onClick={fromMore(actions.onDownloadPdf)} />
            <MoreRow icon={Printer} label="Imprimer" hint="Depuis votre appareil" onClick={fromMore(actions.onPrint)} />
            <MoreRow icon={Copy} label="Dupliquer le devis" hint="Repartir de ses prestations" onClick={fromMore(actions.onDuplicate)} />
            {s === "draft" && (
              <MoreRow icon={Pencil} label="Modifier" hint="Lignes, client, dates" href={actions.editHref} onClick={actions.onEdit ? fromMore(actions.onEdit) : () => setModal(null)} />
            )}
            {s === "sent" && !expired && (
              <MoreRow icon={RefreshCw} label="Renvoyer par email" hint={quote.client?.email ?? "Avec le PDF en pièce jointe"} onClick={openModal("send")} />
            )}
            {s === "sent" && <MoreRow icon={X} label="Marquer comme refusé" hint="Le client a dit non" onClick={openModal("reject")} />}
            {canConvert && s === "sent" && (
              <MoreRow icon={FileText} label="Convertir en facture" hint="Facture brouillon, devis accepté" onClick={openModal("convert")} />
            )}
            {s === "draft" && <MoreRow icon={Trash2} label="Supprimer le brouillon" hint="Définitivement" danger onClick={openModal("delete")} />}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Aperçu papier (reprend le contenu du PDF, reste blanc en thème sombre) */
/* ------------------------------------------------------------------ */

function QuotePaper({ quote, company, companySettings }: { quote: QuoteDetailData; company: QuoteDetailCompany | null; companySettings?: string }) {
  const companyCity = [company?.zip_code, company?.city].filter(Boolean).join(" ")
  const client = quote.client
  const clientCity = [client?.zip_code, client?.city].filter(Boolean).join(" ")
  const label = "block text-[11px] font-semibold tracking-[.04em] text-[#64748B]"
  const cols = "grid grid-cols-[minmax(0,1fr)_64px_72px_48px_84px] gap-2"

  return (
    <div className="q-paper flex w-full max-w-[640px] flex-col gap-[22px] p-9 text-[12px] leading-normal">
      <div className="flex items-start justify-between gap-4">
        <span className="grid size-11 place-items-center rounded-[10px] bg-[#0F172A] text-[13px] font-semibold text-white">
          {initialsOf(company?.name ?? "Q")}
        </span>
        <span className="flex flex-col items-end gap-[3px] text-right">
          <span className="text-lg font-semibold tracking-[-0.01em]">Devis</span>
          <span className="font-mono text-[#475569]">{quote.quote_number} · {longDate(quote.issue_date, false)}</span>
          <span className="text-[#64748B]">Valable jusqu&apos;au {longDate(quote.valid_until)}</span>
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 leading-[1.55]">
        <span>
          <strong className={label}>ÉMETTEUR</strong>
          {company ? (
            <>
              {company.name}
              {company.address && <><br />{company.address}{companyCity && `, ${companyCity}`}</>}
              {!company.address && companyCity && <><br />{companyCity}</>}
              {(company.siret || company.siren) && <><br />{company.siret ? `SIRET ${fmtSiren(company.siret)}` : `SIREN ${fmtSiren(company.siren!)}`}</>}
              {company.vat_number && <><br />TVA {company.vat_number}</>}
            </>
          ) : (
            <>
              Votre entreprise
              <br />
              <span className="text-[#64748B]">
                À compléter dans {companySettings ? <Link href={companySettings} className="text-[#1D4ED8] underline">Paramètres › Entreprise</Link> : "Paramètres › Entreprise"}
              </span>
            </>
          )}
        </span>
        <span>
          <strong className={label}>CLIENT</strong>
          {client ? (
            <>
              {client.name}
              {client.address && <><br />{client.address}{clientCity && `, ${clientCity}`}</>}
              {!client.address && clientCity && <><br />{clientCity}</>}
              {client.email && <><br />{client.email}</>}
              {client.siren && <><br />SIREN {fmtSiren(client.siren)}</>}
            </>
          ) : "—"}
        </span>
      </div>

      <div className="flex flex-col">
        <div className={cn(cols, "border-b border-[#E6E9F0] py-2 font-semibold text-[#64748B]")}>
          <span>Désignation</span>
          <span className="text-right">Qté</span>
          <span className="text-right">Prix HT</span>
          <span className="text-right">TVA</span>
          <span className="text-right">Total HT</span>
        </div>
        {quote.lines.map((l, i) => (
          <div key={i} className={cn(cols, "border-b border-[#F1F4F8] py-2 tabular-nums")}>
            <span className="min-w-0 break-words">{l.description}</span>
            <span className="text-right">{fmtQty(l.quantity)}{l.unit ? ` ${fmtUnit(l.quantity, l.unit)}` : ""}</span>
            <span className="text-right">{fmtAmount(l.unit_price_ht)}</span>
            <span className="text-right">{fmtRate(l.vat_rate)} %</span>
            <span className="text-right">{fmtAmount(l.total_ht)}</span>
          </div>
        ))}
      </div>

      <div className="ml-auto flex w-[58%] flex-col gap-1.5 tabular-nums">
        <div className="flex justify-between"><span className="text-[#475569]">Total HT</span><span>{formatCurrency(quote.subtotal_ht)}</span></div>
        {vatBreakdown(quote.lines).map((v) => (
          <div key={v.rate} className="flex justify-between"><span className="text-[#475569]">TVA {fmtRate(v.rate)} %</span><span>{formatCurrency(v.amount)}</span></div>
        ))}
        <div className="flex justify-between border-t border-[#E6E9F0] pt-1.5 text-sm font-semibold"><span>Total TTC</span><span>{formatCurrency(quote.total_ttc)}</span></div>
      </div>

      {quote.notes && (
        <div className="border-t border-[#F1F4F8] pt-3 text-[11px] leading-[1.55] text-[#475569]">
          <strong className={cn(label, "mb-1")}>NOTES / CONDITIONS</strong>
          <span className="whitespace-pre-line">{quote.notes}</span>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Briques                                                             */
/* ------------------------------------------------------------------ */

type TimelineEvent = { title: string; sub?: string; state: "done" | "todo" | "refused" }

function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="m-0 flex list-none flex-col p-0">
      {events.map((e, i) => {
        const last = i === events.length - 1
        return (
          <li key={i} className="flex gap-3">
            <span className="flex flex-col items-center">
              {e.state === "done" && (
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[var(--q-accent)] text-white">
                  <Check className="size-3" strokeWidth={3} aria-hidden />
                </span>
              )}
              {e.state === "refused" && (
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[var(--q-danger)] text-white">
                  <X className="size-3" strokeWidth={3} aria-hidden />
                </span>
              )}
              {e.state === "todo" && <span className="size-5 shrink-0 rounded-full border-2 border-dashed border-[var(--q-placeholder)] bg-[var(--q-surface)]" />}
              {!last && <span className={cn("min-h-[18px] w-0.5 flex-1", e.state === "done" ? "bg-[var(--q-accent)]" : "bg-[var(--q-line)]")} />}
            </span>
            <span className={cn("flex min-w-0 flex-col gap-0.5", !last && "pb-3.5")}>
              <span className="text-sm font-semibold text-[var(--q-ink)]">
                <span className="sr-only">{e.state === "todo" ? "À venir : " : "Fait : "}</span>
                {e.title}
              </span>
              {e.sub && <span className="break-words text-xs tabular-nums text-[var(--q-text-4)]">{e.sub}</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

type IconType = LucideIcon

/** Bouton d'action (classes q-btn) : lien ou bouton, avec état de chargement. */
function Act({
  label, icon: Icon, onClick, href, variant = "secondary", size, loading, iconOnly,
}: {
  label: string
  icon?: IconType
  onClick?: () => void
  href?: string
  variant?: "primary" | "secondary" | "danger"
  size?: "sm"
  loading?: boolean
  iconOnly?: boolean
}) {
  const cls = cn(
    "q-btn",
    variant === "primary" ? "q-btn-primary" : variant === "danger" ? "q-btn-danger" : "q-btn-secondary",
    size === "sm" && "q-btn-sm",
    iconOnly && "q-btn-icon",
  )
  const content = (
    <>
      {loading ? <Loader2 className="animate-spin" aria-hidden /> : Icon && <Icon aria-hidden />}
      {iconOnly ? <span className="sr-only">{label}</span> : label}
    </>
  )
  if (href) return <Link href={href} className={cls} title={iconOnly ? label : undefined}>{content}</Link>
  return (
    <button type="button" className={cls} onClick={onClick} disabled={loading} title={iconOnly ? label : undefined}>
      {content}
    </button>
  )
}

/** Bouton de la barre d'actions mobile : 52 px pour l'action principale, 48 px sinon. */
function BarBtn({
  label, icon: Icon, onClick, href, primary, loading,
}: {
  label: string
  icon: IconType
  onClick?: () => void
  href?: string
  primary?: boolean
  loading?: boolean
}) {
  const cls = cn("q-btn w-full", primary ? "q-btn-primary q-btn-xl" : "q-btn-secondary q-btn-lg !px-3 !whitespace-normal")
  const content = (
    <>
      {loading ? <Loader2 className="animate-spin" aria-hidden /> : <Icon aria-hidden />}
      <span className={primary ? "truncate" : "text-center leading-tight"}>{label}</span>
    </>
  )
  if (href) return <Link href={href} className={cls}>{content}</Link>
  return <button type="button" className={cls} onClick={onClick} disabled={loading}>{content}</button>
}

function MoreRow({
  icon: Icon, label, hint, onClick, href, danger,
}: {
  icon: IconType
  label: string
  hint?: string
  onClick?: () => void
  href?: string
  danger?: boolean
}) {
  const cls = "flex min-h-[60px] w-full items-center gap-3 border-b border-[var(--q-line-soft)] px-1 py-2 text-left last:border-b-0"
  const content = (
    <>
      <span className={cn(
        "grid size-10 shrink-0 place-items-center rounded-[11px]",
        danger ? "bg-[var(--q-danger-bg)] text-[var(--q-danger)]" : "bg-[var(--q-wash)] text-[var(--q-accent-strong)]",
      )}>
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("text-base font-semibold", danger ? "text-[var(--q-danger)]" : "text-[var(--q-ink)]")}>{label}</span>
        {hint && <span className="truncate text-[13px] text-[var(--q-text-4)]">{hint}</span>}
      </span>
      <ChevronRight className="size-4 shrink-0 text-[var(--q-text-4)]" aria-hidden />
    </>
  )
  if (href) return <Link href={href} className={cls} onClick={onClick}>{content}</Link>
  return <button type="button" className={cls} onClick={onClick}>{content}</button>
}

function LinkedRow({ href, icon, title, sub }: { href?: string; icon: React.ReactNode; title: string; sub: string }) {
  const content = (
    <>
      {icon}
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="truncate text-sm font-semibold text-[var(--q-ink)]">{title}</span>
        <span className="truncate text-xs text-[var(--q-text-4)]">{sub}</span>
      </span>
      {href && <ChevronRight className="size-4 shrink-0 text-[var(--q-text-4)]" aria-hidden />}
    </>
  )
  const cls = "flex items-center gap-3 border-t border-[var(--q-line-soft)] px-[18px] py-3"
  if (href) return <Link href={href} className={cn(cls, "hover:bg-[var(--q-row-hover)]")}>{content}</Link>
  return <div className={cls}>{content}</div>
}

function TotalRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <span className={cn("flex justify-between gap-3", strong && "font-semibold")}>
      <span className={strong ? "text-[var(--q-ink)]" : "text-[var(--q-text-3)]"}>{label}</span>
      <span>{value}</span>
    </span>
  )
}

function InfoNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-[14px] border border-[var(--q-wash-line)] bg-[var(--q-wash)] px-3.5 py-3 text-sm leading-normal text-[var(--q-accent-ink)]">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Fenêtre : feuille du bas sur mobile, fenêtre centrée sur ordinateur  */
/* ------------------------------------------------------------------ */

type ModalAction = {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  variant?: "primary" | "secondary" | "danger"
  disabled?: boolean
}

function QuoteModal({
  open, onOpenChange, compact, title, description, children, actions,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  compact: boolean
  title: string
  description?: string
  children?: React.ReactNode
  actions: ModalAction[]
}) {
  const btn = (a: ModalAction, big: boolean) => (
    <button
      key={a.label}
      type="button"
      onClick={a.onClick}
      disabled={a.disabled}
      className={cn(
        "q-btn",
        a.variant === "primary" ? "q-btn-primary" : a.variant === "danger" ? "q-btn-danger" : "q-btn-secondary",
        big && (a.variant === "primary" ? "q-btn-xl w-full" : "q-btn-lg w-full"),
      )}
    >
      {a.icon}
      {a.label}
    </button>
  )

  if (compact) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" showCloseButton={false} className="max-h-[85dvh] gap-3 overflow-y-auto px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-2">
          <div className="q-sheet-grip" aria-hidden />
          <div className="flex flex-col gap-1 pt-1">
            <SheetTitle className="font-display text-[22px] font-semibold tracking-[-0.02em] text-[var(--q-ink)]">{title}</SheetTitle>
            {description && <SheetDescription className="text-sm leading-snug text-[var(--q-text-4)]">{description}</SheetDescription>}
          </div>
          {children && <div className="flex flex-col gap-3">{children}</div>}
          <div className="flex flex-col gap-2.5 pt-1">
            {actions.map((a) => btn(a, true))}
            <SheetClose render={<button type="button" className="q-btn q-btn-ghost h-11 w-full text-[15px]" />}>Annuler</SheetClose>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[520px]">
        <div className="flex flex-col gap-1 px-[22px] pr-12 pt-5">
          <DialogTitle className="font-display text-[22px] font-semibold leading-tight tracking-[-0.02em] text-[var(--q-ink)]">{title}</DialogTitle>
          {description && <DialogDescription className="text-sm text-[var(--q-text-4)]">{description}</DialogDescription>}
        </div>
        <div className="flex flex-col gap-3.5 px-[22px] py-[18px]">{children}</div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--q-line-soft)] bg-[var(--q-surface-2)] px-[22px] py-4">
          <DialogClose render={<button type="button" className="q-btn q-btn-ghost q-btn-sm" />}>Annuler</DialogClose>
          {[...actions].reverse().map((a) => btn(a, false))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Vrai sous 1024 px (mise en page mobile de la coque) : feuilles du bas au lieu de fenêtres. */
function useIsCompact(): boolean {
  const [compact, setCompact] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)")
    const update = () => setCompact(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])
  return compact
}
