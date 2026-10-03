"use client"

/**
 * Fiche d'un bon de commande (canevas « Bon-de-commande-detail »).
 *
 * Composant de présentation partagé par /purchase-orders/[id] (API) et
 * /demo/purchase-orders/[id] (lib/demo/data.ts). Les actions sont fournies
 * par la page : appels d'API réels (statuts contrôlés côté serveur par
 * lib/utils/document-status.ts), ou invitation à créer un compte en démo.
 *
 * Confirmation en ligne : panneau « Signature en ligne » fourni par la page
 * (`signature`) ; sans lui (migration pas encore appliquée), la confirmation
 * s'enregistre à la main. Écarts volontaires avec la planche : pas de
 * « Facturer l'acompte » ni de devis lié (le code ne rattache le bon ni à un
 * devis ni à une facture), pas de notes internes.
 */
import { useState } from "react"
import Link from "next/link"
import {
  AlertTriangle, Check, ChevronLeft, Download, Loader2, MoreHorizontal, Pencil, Printer, RefreshCw, Send, Trash2, Users, XCircle,
} from "lucide-react"
import { DocStatusPill, Initials, Kpi, KpiGrid, PURCHASE_ORDER_PILLS } from "@/components/app/kit"
import { SetCrumb } from "@/components/layout/crumb"
import {
  Act, BarBtn, DocModal, DocPaper, LinkedRow, MobileActionBar, MoreRow, RecipientBox, Timeline, TotalRow,
  useIsCompact, type PaperLine, type PaperParty, type TimelineEvent,
} from "@/components/purchase-orders/detail-bits"
import type { POStatus } from "@/components/purchase-orders/PurchaseOrderListView"
import { formatCurrency } from "@/lib/utils/invoice"
import {
  fmtQty, fmtRate, fmtUnit, longDate, parisDay, shortDate, vatBreakdown, vatRatesLabel,
} from "@/components/quotes/QuoteListHelpers"
import { resolveDocumentMentions } from "@/lib/legal/mentions"

export interface PurchaseOrderDetailData {
  id: string
  po_number: string
  status: POStatus
  /** Objet affiché dans le titre (première ligne du bon). */
  subject: string
  issue_date: string
  delivery_date: string | null
  reference: string | null
  lines: PaperLine[]
  subtotal_ht: number
  total_vat: number
  total_ttc: number
  notes: string | null
  sent_at: string | null
  confirmed_at: string | null
  created_at: string | null
  client: (PaperParty & { href?: string | null; editHref?: string | null }) | null
  /** Mentions de l'entreprise figées à l'envoi (lib/legal/mentions.ts). */
  legal_snapshot?: unknown
}

export interface PurchaseOrderDetailActions {
  onDownloadPdf: () => void
  /** Envoi par email ; vrai si l'envoi a réussi (la fenêtre se ferme). */
  onSend: () => Promise<boolean>
  onChangeStatus: (status: POStatus) => Promise<boolean>
  onDelete: () => Promise<boolean>
  editHref: string
  busy: { pdf: boolean; send: boolean; status: boolean; delete: boolean }
}

type ModalKey = "send" | "cancel" | "delete" | "more"

const dayOf = (iso: string) => (iso.length > 10 ? parisDay(iso) : iso)

export function PurchaseOrderDetailView({
  po,
  company,
  today,
  listHref,
  companySettingsHref,
  actions,
  signature,
}: {
  /** Panneau « Signature en ligne », quand la fonction est disponible. */
  signature?: React.ReactNode
  po: PurchaseOrderDetailData
  company: PaperParty | null
  /** « Aujourd'hui » (AAAA-MM-JJ) : date du navigateur, ou date fixe de la démo. */
  today: string
  listHref: string
  companySettingsHref?: string
  actions: PurchaseOrderDetailActions
}) {
  const compact = useIsCompact()
  const [modal, setModal] = useState<ModalKey | null>(null)
  const close = () => setModal(null)
  const open = (k: ModalKey) => () => setModal(k)

  const s = po.status
  const busy = actions.busy
  const clientName = po.client?.name ?? null
  const late = s === "sent" && !!po.delivery_date && po.delivery_date < today
  const canSendEmail = s === "draft" || s === "sent"

  const run = async (fn: () => Promise<boolean>) => { if (await fn()) close() }
  const setStatus = (next: POStatus) => run(() => actions.onChangeStatus(next))

  /* ── Suivi ── */
  const events: TimelineEvent[] = [
    { title: "Créé", sub: shortDate(po.created_at ? dayOf(po.created_at) : po.issue_date), state: "done" },
  ]
  if (s === "draft") {
    events.push({ title: "Envoi au client", sub: "Pas encore envoyé", state: "todo" })
    events.push({ title: "Confirmation du client", state: "todo" })
  } else {
    events.push(
      po.sent_at
        ? { title: "Envoyé au client", sub: [shortDate(dayOf(po.sent_at)), po.client?.email].filter(Boolean).join(" · "), state: "done" }
        : { title: "Envoyé au client", sub: `Émis le ${shortDate(po.issue_date)}`, state: "done" },
    )
    if (s === "sent") events.push({ title: "Confirmation du client", sub: "En attente", state: "todo" })
    if (s === "confirmed") events.push({ title: "Confirmé par le client", sub: po.confirmed_at ? shortDate(dayOf(po.confirmed_at)) : undefined, state: "done" })
    if (s === "cancelled") {
      if (po.confirmed_at) events.push({ title: "Confirmé par le client", sub: shortDate(dayOf(po.confirmed_at)), state: "done" })
      events.push({ title: "Annulé", sub: "Le bon ne se modifie plus", state: "refused" })
    }
  }

  /* ── Indicateurs ── */
  const statusSub =
    s === "draft" ? "À envoyer au client"
      : s === "sent" ? (late ? "Livraison souhaitée dépassée" : "En attente de confirmation")
        : s === "confirmed" ? (po.confirmed_at ? `Confirmé le ${shortDate(dayOf(po.confirmed_at))}` : "Commande confirmée")
          : "Ne se modifie plus"

  const subLine = [
    po.subject,
    po.reference ? `réf. client ${po.reference}` : null,
    po.delivery_date ? `livraison souhaitée le ${longDate(po.delivery_date, false)}` : null,
  ].filter(Boolean).join(" · ")

  /* ── Boutons (ordinateur) ── */
  const pdfBtn = <Act key="pdf" label={busy.pdf ? "Génération…" : "PDF"} icon={Download} onClick={actions.onDownloadPdf} loading={busy.pdf} />
  const printBtn = <Act key="print" label="Imprimer" icon={Printer} onClick={() => window.print()} iconOnly />
  let headerActions: React.ReactNode[] = [pdfBtn, printBtn]
  if (s === "draft") {
    headerActions = [
      pdfBtn, printBtn,
      <Act key="edit" label="Modifier" icon={Pencil} href={actions.editHref} />,
      <Act key="del" label="Supprimer" icon={Trash2} variant="danger" onClick={open("delete")} loading={busy.delete} />,
      <Act key="send" label="Envoyer par email" icon={Send} variant="primary" onClick={open("send")} loading={busy.send} />,
    ]
  } else if (s === "sent") {
    headerActions = [
      pdfBtn, printBtn,
      <Act key="resend" label="Renvoyer par email" icon={RefreshCw} onClick={open("send")} loading={busy.send} />,
      <Act key="cancel" label="Annuler" icon={XCircle} variant="danger" onClick={open("cancel")} />,
      <Act key="confirm" label="Confirmer la commande" icon={Check} variant="primary" onClick={() => setStatus("confirmed")} loading={busy.status} />,
    ]
  } else if (s === "confirmed") {
    headerActions = [
      printBtn,
      <Act key="cancel" label="Annuler le bon" icon={XCircle} variant="danger" onClick={open("cancel")} />,
      <Act key="pdf" label={busy.pdf ? "Génération…" : "Télécharger le PDF"} icon={Download} variant="primary" onClick={actions.onDownloadPdf} loading={busy.pdf} />,
    ]
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <SetCrumb label={po.po_number} />

      {/* Barre de navigation mobile : retour, numéro, autres actions */}
      <div className="-mx-1 -mt-2 flex items-center justify-between gap-2 lg:hidden print:hidden">
        <Link href={listHref} className="inline-flex min-h-11 items-center gap-0.5 pr-2 text-base font-medium text-[var(--q-accent-strong)]">
          <ChevronLeft className="size-5" strokeWidth={2.25} aria-hidden />
          Bons de commande
        </Link>
        <span className="truncate font-mono text-sm font-medium text-[var(--q-ink)]">{po.po_number}</span>
        <button
          type="button"
          aria-label="Plus d'actions"
          aria-haspopup="dialog"
          onClick={open("more")}
          className="grid size-11 shrink-0 place-items-center rounded-xl text-[var(--q-text-2)] hover:bg-[var(--q-hover)]"
        >
          <MoreHorizontal className="size-5" aria-hidden />
        </button>
      </div>

      {/* Bandeaux */}
      {late && (
        <div role="status" className="q-banner q-banner-warn items-center print:hidden">
          <AlertTriangle className="size-5 shrink-0" aria-hidden />
          <span className="flex-1 text-[15px] leading-snug">
            <strong className="font-semibold">La livraison souhaitée ({longDate(po.delivery_date!)}) est passée.</strong> Pensez à relancer votre client.
          </span>
        </div>
      )}
      {s === "cancelled" && (
        <div role="status" className="q-banner items-center print:hidden">
          <XCircle className="size-5 shrink-0" aria-hidden />
          <span className="flex-1 text-[15px] leading-snug">
            <strong className="font-semibold">Ce bon de commande a été annulé.</strong> Il ne peut plus être modifié.
          </span>
        </div>
      )}

      {/* En-tête (ordinateur) */}
      <div className="hidden flex-wrap items-end justify-between gap-4 lg:flex print:hidden">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-sm text-[var(--q-text-3)]">{po.po_number}</span>
            <DocStatusPill kind="purchase_order" status={s} />
          </div>
          <h1 className="q-h1 !text-[30px]">Bon de commande{clientName ? ` · ${clientName}` : ""}</h1>
          <span className="text-sm text-[var(--q-text-4)]">{subLine}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">{headerActions}</div>
      </div>

      {/* Carte de tête (mobile) */}
      <section className="q-card flex flex-col gap-3.5 rounded-[22px] p-[18px] lg:hidden print:hidden" aria-label="Résumé du bon de commande">
        <div className="flex flex-col gap-1">
          <h1 className="text-[13px] font-normal leading-snug text-[var(--q-text-3)]">
            Bon de commande{clientName ? ` · ${clientName}` : ""}
          </h1>
          <span className="text-[13px] text-[var(--q-text-3)]">Montant TTC</span>
          <span className="font-display text-[38px] font-semibold leading-[1.05] tracking-[-0.04em] tabular-nums text-[var(--q-ink)]">
            {formatCurrency(po.total_ttc)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DocStatusPill kind="purchase_order" status={s} />
          <span className="text-[13px] text-[var(--q-text-3)]">
            {[po.reference && `Réf. ${po.reference}`, po.delivery_date && `Livraison le ${longDate(po.delivery_date, false)}`].filter(Boolean).join(" · ") || po.subject}
          </span>
        </div>
      </section>

      {/* Indicateurs (ordinateur) */}
      <KpiGrid className="hidden lg:grid print:hidden">
        <Kpi label="Total TTC" value={formatCurrency(po.total_ttc)} sub={`${formatCurrency(po.subtotal_ht)} HT · ${vatRatesLabel(po.lines)}`} />
        <Kpi
          label="Référence client"
          value={po.reference ? <span className="font-mono text-[22px] font-medium tracking-normal">{po.reference}</span> : "—"}
          sub={po.reference ? "N° de commande fourni par le client" : "Aucune référence indiquée"}
        />
        <Kpi
          label="Livraison souhaitée"
          value={po.delivery_date ? shortDate(po.delivery_date) : "—"}
          sub={po.delivery_date ? (late ? "Date dépassée" : "Date indiquée sur le bon") : "Aucune date indiquée"}
          tone={late ? "warn" : "default"}
        />
        <Kpi label="Statut" value={PURCHASE_ORDER_PILLS[s]?.label ?? s} sub={statusSub} tone="ink" />
      </KpiGrid>

      {/* Deux colonnes dès 1280 px : à 1024 px, l'aperçu papier tombait à 280 px et les désignations s'écrivaient une lettre par ligne */}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Colonne principale */}
        <div className="flex min-w-0 flex-col gap-4">
          <section aria-label="Aperçu du bon de commande" className="q-paper-bed hidden justify-center lg:flex print:flex print:border-0 print:bg-transparent print:!p-0">
            <DocPaper
              title="Bon de commande"
              meta={[
                `${po.po_number} · ${shortDate(po.issue_date)}${po.reference ? ` · réf. ${po.reference}` : ""}`,
                ...(po.delivery_date ? [`Livraison souhaitée : ${longDate(po.delivery_date)}`] : []),
              ]}
              company={company}
              companySettingsHref={companySettingsHref}
              clientLabel="DESTINATAIRE"
              client={po.client}
              lines={po.lines}
              subtotal_ht={po.subtotal_ht}
              total_ttc={po.total_ttc}
              notes={po.notes}
              mentions={resolveDocumentMentions(company, po, "purchase_order").lines}
            />
          </section>

          {/* Suivi (mobile) */}
          <section aria-label="Suivi du bon" className="q-card rounded-[22px] p-[18px] lg:hidden print:hidden">
            <h2 className="q-h2 mb-3.5">Suivi du bon</h2>
            <Timeline events={events} />
          </section>

          {/* Articles (mobile) */}
          <section aria-label="Articles commandés" className="flex flex-col gap-2 lg:hidden print:hidden">
            <div className="flex items-baseline justify-between">
              <h2 className="q-h2">Articles commandés</h2>
              <span className="text-[13px] tabular-nums text-[var(--q-text-4)]">{po.lines.length}</span>
            </div>
            <div className="q-card q-list overflow-hidden rounded-[18px]">
              {po.lines.map((l, i) => (
                <div key={i} className="q-list-row px-3.5 py-2.5">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[15px] font-semibold">{l.description || "Article"}</span>
                    <span className="truncate text-[13px] tabular-nums text-[var(--q-text-4)]">
                      {fmtQty(l.quantity)}{l.unit ? ` ${fmtUnit(l.quantity, l.unit)}` : ""} × {formatCurrency(l.unit_price_ht)} · TVA {fmtRate(l.vat_rate)} %
                    </span>
                  </span>
                  <span className="shrink-0 text-[15px] font-semibold tabular-nums">{formatCurrency(l.total_ht)}</span>
                </div>
              ))}
              <div className="flex flex-col gap-1.5 bg-[var(--q-surface-2)] px-3.5 py-3 text-sm tabular-nums">
                <TotalRow label="Total HT" value={formatCurrency(po.subtotal_ht)} />
                {vatBreakdown(po.lines).map((v) => (
                  <TotalRow key={v.rate} label={`TVA ${fmtRate(v.rate)} %`} value={formatCurrency(v.amount)} />
                ))}
                <TotalRow label="Total TTC" value={formatCurrency(po.total_ttc)} strong />
              </div>
            </div>
          </section>

          {po.notes && (
            <section aria-label="Notes et conditions" className="q-card flex flex-col gap-2 p-[18px] lg:hidden print:hidden">
              <h2 className="q-h2">Notes et conditions</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--q-text-3)]">{po.notes}</p>
            </section>
          )}
        </div>

        {/* Colonne de droite */}
        <div className="flex min-w-0 flex-col gap-4 print:hidden">
          <section aria-label="Suivi du bon" className="q-card hidden p-[18px] lg:block">
            <h2 className="q-h2 mb-3.5">Suivi du bon</h2>
            <Timeline events={events} />
          </section>

          {signature}

          {/* Avec la signature en ligne, la confirmation reçue par écrit reste possible */}
          {signature && s === "sent" && (
            <section aria-label="Confirmation sur papier" className="q-card hidden flex-col gap-3 p-[18px] lg:flex">
              <h2 className="q-h2">Confirmation sur papier</h2>
              <p className="text-[13px] leading-normal text-[var(--q-text-3)]">
                Votre client vous a retourné le bon signé, ou a confirmé la commande par écrit ? Marquez-le comme confirmé.
              </p>
              <div className="flex flex-wrap gap-2">
                <Act label="Confirmer la commande" icon={Check} size="sm" onClick={() => setStatus("confirmed")} loading={busy.status} />
              </div>
            </section>
          )}

          {/* Accord du client : sans signature en ligne, la confirmation s'enregistre à la main */}
          {(s === "draft" || (!signature && s === "sent")) && (
            <section aria-label="Confirmation du client" className="q-card hidden flex-col gap-3 p-[18px] lg:flex">
              <h2 className="q-h2">Confirmation du client</h2>
              <p className="text-[13px] leading-normal text-[var(--q-text-3)]">
                {s === "draft"
                  ? "Envoyez le bon par email avec son PDF. Quand votre client vous le retourne signé, ou confirme la commande par écrit, marquez-le comme confirmé."
                  : "Quand votre client vous retourne le bon signé, ou confirme la commande par écrit, marquez-le comme confirmé."}
              </p>
              <div className="flex flex-wrap gap-2">
                {s === "sent"
                  ? <Act label="Confirmer la commande" icon={Check} variant="primary" size="sm" onClick={() => setStatus("confirmed")} loading={busy.status} />
                  : <Act label="Marquer comme envoyé" icon={Send} size="sm" onClick={() => setStatus("sent")} loading={busy.status} />}
              </div>
              {s === "draft" && (
                <p className="text-xs leading-normal text-[var(--q-text-4)]">Remis en main propre ? Marquez-le comme envoyé sans passer par l&apos;email.</p>
              )}
            </section>
          )}

          {po.client && (
            <section aria-label="Liés à ce bon" className="q-card overflow-hidden py-1.5">
              <h2 className="q-h2 px-[18px] pb-2 pt-3">Liés à ce document</h2>
              <LinkedRow
                href={po.client.href ?? undefined}
                icon={<Initials name={po.client.name} />}
                title={po.client.name}
                sub={["Client", po.client.city].filter(Boolean).join(" · ")}
              />
            </section>
          )}

          <p className="hidden px-1 text-[13px] leading-normal text-[var(--q-text-4)] lg:block">
            Le bon de commande est facultatif : le devis signé vaut déjà commande. Une fois envoyé, son contenu ne se modifie plus.
          </p>
        </div>
      </div>

      {/* Barre d'actions collée en bas (mobile) */}
      <MobileActionBar>
        {s === "draft" && (
          <>
            <BarBtn primary label="Envoyer par email" icon={Send} onClick={open("send")} loading={busy.send} />
            <div className="grid grid-cols-2 gap-2.5">
              <BarBtn label="Modifier" icon={Pencil} href={actions.editHref} />
              <BarBtn label="PDF" icon={Download} onClick={actions.onDownloadPdf} loading={busy.pdf} />
            </div>
          </>
        )}
        {s === "sent" && (
          <>
            <BarBtn primary label="Confirmer la commande" icon={Check} onClick={() => setStatus("confirmed")} loading={busy.status} />
            <div className="grid grid-cols-2 gap-2.5">
              <BarBtn label="Renvoyer" icon={RefreshCw} onClick={open("send")} loading={busy.send} />
              <BarBtn label="PDF" icon={Download} onClick={actions.onDownloadPdf} loading={busy.pdf} />
            </div>
          </>
        )}
        {(s === "confirmed" || s === "cancelled") && (
          <BarBtn primary label="Télécharger le PDF" icon={Download} onClick={actions.onDownloadPdf} loading={busy.pdf} />
        )}
      </MobileActionBar>

      {/* ── Fenêtres ── */}
      <DocModal
        open={modal === "send"}
        onOpenChange={(o) => !o && close()}
        compact={compact}
        title={s === "draft" ? "Envoyer le bon de commande" : "Renvoyer le bon de commande"}
        description={`${po.po_number} · ${formatCurrency(po.total_ttc)} TTC`}
        actions={[{
          label: busy.send ? "Envoi…" : s === "draft" ? "Envoyer" : "Renvoyer",
          icon: busy.send ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />,
          variant: "primary",
          onClick: () => run(actions.onSend),
          disabled: busy.send || !po.client?.email || !canSendEmail,
        }]}
      >
        <RecipientBox name={clientName} email={po.client?.email} clientHref={po.client?.editHref ?? po.client?.href} />
        <p className="text-sm leading-relaxed text-[var(--q-text-3)]">
          Le bon de commande <span className="font-mono">{po.po_number}</span> part avec son PDF en pièce jointe.
          {s === "draft" && <> Son statut passe alors à «&nbsp;Envoyé&nbsp;».</>}
        </p>
        <p className="q-inset px-3.5 py-2.5 text-[13px] text-[var(--q-text-3)]">
          Objet : <span className="font-medium text-[var(--q-ink)]">Bon de commande {po.po_number} — {company?.name ?? "votre entreprise"}</span>
        </p>
      </DocModal>

      <DocModal
        open={modal === "cancel"}
        onOpenChange={(o) => !o && close()}
        compact={compact}
        title="Annuler le bon de commande ?"
        description={`${po.po_number}${clientName ? ` · ${clientName}` : ""}`}
        actions={[{
          label: busy.status ? "Annulation…" : "Annuler le bon",
          icon: busy.status ? <Loader2 className="animate-spin" aria-hidden /> : <XCircle aria-hidden />,
          variant: "danger",
          onClick: () => setStatus("cancelled"),
          disabled: busy.status,
        }]}
      >
        <p className="text-sm leading-relaxed text-[var(--q-text-3)]">
          Un bon annulé reste dans vos documents, mais il ne peut plus être modifié ni confirmé. Prévenez votre client si la commande ne se fait pas.
        </p>
      </DocModal>

      <DocModal
        open={modal === "delete"}
        onOpenChange={(o) => !o && close()}
        compact={compact}
        title="Supprimer ce brouillon ?"
        description={po.po_number}
        actions={[{
          label: busy.delete ? "Suppression…" : "Supprimer",
          icon: busy.delete ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />,
          variant: "danger",
          onClick: () => run(actions.onDelete),
          disabled: busy.delete,
        }]}
      >
        <p className="text-sm leading-relaxed text-[var(--q-text-3)]">
          Le brouillon n&apos;a jamais été envoyé : il est supprimé définitivement.
        </p>
      </DocModal>

      <DocModal open={modal === "more"} onOpenChange={(o) => !o && close()} compact={compact} title="Actions" description={po.po_number} actions={[]}>
        <div className="flex flex-col">
          {s === "draft" && (
            <MoreRow icon={Send} label="Marquer comme envoyé" hint="Sans l'envoyer par email" onClick={() => setStatus("sent")} />
          )}
          {s !== "draft" && s !== "cancelled" && (
            <MoreRow icon={Download} label="Télécharger le PDF" onClick={() => { close(); actions.onDownloadPdf() }} />
          )}
          <MoreRow icon={Printer} label="Imprimer" onClick={() => { close(); setTimeout(() => window.print(), 300) }} />
          {po.client?.href && <MoreRow icon={Users} label="Fiche client" hint={po.client.name} href={po.client.href} onClick={close} />}
          {(s === "sent" || s === "confirmed") && (
            <MoreRow icon={XCircle} label="Annuler le bon" hint="Il ne pourra plus être modifié" danger onClick={open("cancel")} />
          )}
          {s === "draft" && (
            <MoreRow icon={Trash2} label="Supprimer le brouillon" danger onClick={open("delete")} />
          )}
        </div>
      </DocModal>
    </div>
  )
}
