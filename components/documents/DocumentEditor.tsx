'use client'

/**
 * Écran d'édition commun à la facture, au devis et au bon de commande,
 * réels et démo (canevas Nouveau-devis, Nouvelle-facture, Mobile-devis-creation).
 *
 * Ordinateur : titre + état du brouillon + actions ; à gauche les cartes
 * Client, Lignes et Conditions ; à droite l'aperçu en direct et les contrôles
 * avant envoi. Mobile : cartes empilées, champs de 16 px, barre d'actions
 * collée au-dessus de la barre de navigation.
 *
 * Purement présentationnel : chaque formulaire fournit l'état (useDocumentForm)
 * et ses actions (API réelles, ou toasts en démo).
 */
import Link from "next/link"
import { Eye, Loader2, Plus, Send } from "lucide-react"
import { PageHeader } from "@/components/app/kit"
import type { ProductSuggestion } from "@/components/products/ProductCombobox"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils/invoice"
import { ClientPicker } from "./ClientPicker"
import { LinesEditor } from "./LinesEditor"
import { LivePreview } from "./LivePreview"
import { ReadyBanner, ReadyChecklist } from "./ReadyChecklist"
import { DOC_TEXT, buildChecks, daysBetween, type DocClient, type DocCompany, type DocKind } from "./model"
import type { DocumentFormApi } from "./useDocumentForm"

export interface EditorActions {
  onSaveDraft: () => void
  onSend: () => void
  /** Facture seulement : aperçu PDF filigrané, sans écriture (POST /api/invoices/preview-pdf). */
  onPreviewPdf?: () => void
  saving: boolean
  sending: boolean
  previewing?: boolean
  saveLabel?: string
  sendLabel?: string
  /** Modification : retour à la fiche sans enregistrer. */
  cancelHref?: string
}

export function DocumentEditor({
  kind,
  doc,
  title,
  status,
  number,
  backHref,
  backLabel,
  clients,
  clientsLoading,
  newClientHref,
  clientHref,
  company,
  catalog,
  banners,
  actions,
}: {
  kind: DocKind
  doc: DocumentFormApi
  title: string
  /** Ligne d'état sous le titre (honnête : pas d'enregistrement automatique). */
  status: string
  number?: string | null
  backHref: string
  backLabel: string
  clients: DocClient[]
  clientsLoading: boolean
  newClientHref: string
  /** Fiche du client (compléter son e-mail). */
  clientHref?: (id: string) => string
  company: DocCompany | null
  catalog: { products?: ProductSuggestion[]; manageHref: string }
  banners?: React.ReactNode
  actions: EditorActions
}) {
  const text = DOC_TEXT[kind]
  const { form } = doc
  const client = clients.find((c) => c.id === form.client_id) ?? null
  const checks = buildChecks(kind, form, client, company, doc.computed)
  const saveLabel = actions.saveLabel ?? "Enregistrer le brouillon"
  const sendLabel = actions.sendLabel ?? text.sendLabel
  const busy = actions.saving || actions.sending

  const previewButton = actions.onPreviewPdf && (
    <button
      type="button"
      onClick={actions.onPreviewPdf}
      disabled={actions.previewing}
      className="q-btn q-btn-secondary q-btn-sm"
    >
      {actions.previewing ? <Loader2 className="animate-spin" aria-hidden /> : <Eye aria-hidden strokeWidth={1.75} />}
      Aperçu PDF
    </button>
  )

  return (
    <div className="flex flex-col gap-5 pb-[112px] lg:pb-0">
      <PageHeader
        title={title}
        subtitle={<span className="font-mono text-[13px] md:text-sm">{status}</span>}
        backHref={backHref}
        backLabel={backLabel}
        actions={
          <div className="hidden items-center gap-2 lg:flex">
            {actions.cancelHref && (
              <Link href={actions.cancelHref} className="q-btn q-btn-ghost">Annuler</Link>
            )}
            <button type="button" onClick={actions.onSaveDraft} disabled={busy} className="q-btn q-btn-secondary">
              {actions.saving && <Loader2 className="animate-spin" aria-hidden />}
              {saveLabel}
            </button>
            <button type="button" onClick={actions.onSend} disabled={busy} className="q-btn q-btn-primary">
              {actions.sending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden strokeWidth={2} />}
              {sendLabel}
            </button>
          </div>
        }
      />

      {banners}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px] min-[1400px]:grid-cols-[minmax(0,1fr)_460px]">
        {/* ── Colonne de saisie ── */}
        <div className="flex min-w-0 flex-col gap-4">
          <ClientCard
            kind={kind}
            doc={doc}
            clients={clients}
            clientsLoading={clientsLoading}
            client={client}
            newClientHref={newClientHref}
            clientHref={clientHref}
          />

          <LinesEditor doc={doc} title="Prestations" catalog={catalog} />

          <ConditionsCard kind={kind} doc={doc} />

          {/* Mobile : état d'envoi en une ligne, aperçu PDF à portée */}
          <div className="flex flex-col gap-3 md:hidden">
            <ReadyBanner title={text.checklistTitle} checks={checks} />
            {actions.onPreviewPdf && (
              <button type="button" onClick={actions.onPreviewPdf} disabled={actions.previewing} className="q-btn q-btn-secondary q-btn-lg w-full">
                {actions.previewing ? <Loader2 className="animate-spin" aria-hidden /> : <Eye aria-hidden strokeWidth={1.75} />}
                Aperçu PDF
              </button>
            )}
          </div>
        </div>

        {/* ── Aperçu et contrôles (à droite sur grand écran, dessous sinon) ── */}
        <aside className="hidden min-w-0 flex-col gap-3 md:flex" aria-label="Aperçu et contrôles">
          <LivePreview kind={kind} doc={doc} number={number} client={client} company={company} action={previewButton} />
          <ReadyChecklist title={text.checklistTitle} checks={checks} />
          <div className="hidden flex-col items-stretch gap-1 xl:flex">
            <button type="button" onClick={actions.onSend} disabled={busy} className="q-btn q-btn-primary q-btn-lg w-full !rounded-[10px]">
              {actions.sending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden strokeWidth={2} />}
              <span className="truncate">{client ? `${sendLabel} à ${client.name}` : sendLabel}</span>
            </button>
            <button type="button" onClick={actions.onSaveDraft} disabled={busy} className="q-btn q-btn-ghost self-center !text-[var(--q-accent-strong)]">
              {saveLabel}
            </button>
          </div>
        </aside>
      </div>

      {/* ── Barre d'actions mobile, au-dessus de la barre de navigation ── */}
      <div
        className="fixed inset-x-3 z-30 flex flex-col gap-2.5 rounded-3xl border border-[var(--q-line)] bg-[var(--q-surface)] px-3.5 pb-3.5 pt-3 shadow-[var(--q-shadow-float)] lg:hidden"
        style={{ bottom: "calc(96px + env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center justify-between gap-3 text-[13px] tabular-nums text-[var(--q-text-3)]">
          <span className="truncate">
            {formatCurrency(doc.totals.subtotal_ht)} HT · TVA {formatCurrency(doc.totals.total_vat)}
          </span>
          <span className="flex shrink-0 items-baseline gap-2">
            Total
            <span className="text-xl font-semibold tracking-[-0.01em] text-[var(--q-ink)]">{formatCurrency(doc.totals.total_ttc)}</span>
          </span>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={actions.onSaveDraft} disabled={busy} className="q-btn q-btn-secondary q-btn-lg shrink-0 !px-4">
            {actions.saving ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Brouillon
          </button>
          <button type="button" onClick={actions.onSend} disabled={busy} className="q-btn q-btn-primary q-btn-lg min-w-0 flex-1">
            {actions.sending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden strokeWidth={2} />}
            <span className="truncate">{client ? `Envoyer à ${client.name}` : "Envoyer"}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Carte Client                                                         */
/* ------------------------------------------------------------------ */

function ClientCard({
  kind,
  doc,
  clients,
  clientsLoading,
  client,
  newClientHref,
  clientHref,
}: {
  kind: DocKind
  doc: DocumentFormApi
  clients: DocClient[]
  clientsLoading: boolean
  client: DocClient | null
  newClientHref: string
  clientHref?: (id: string) => string
}) {
  const { form, errors } = doc
  return (
    // Mobile : intitulé au-dessus, le sélecteur fait carte (Mobile-devis-creation)
    <section className="flex flex-col gap-2.5 md:q-card md:gap-3.5 md:p-5" aria-labelledby="doc-client-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="doc-client-title" className="q-h2">{kind === "quote" ? "Pour qui ?" : "Client"}</h2>
        {clients.length > 0 && (
          <Link href={newClientHref} className="q-link inline-flex items-center gap-1.5 text-[13px]">
            <Plus className="size-3.5" strokeWidth={2.25} aria-hidden />
            Nouveau client
          </Link>
        )}
      </div>

      {clientsLoading ? (
        <div className="flex h-[60px] items-center gap-3 rounded-xl border border-[var(--q-field)] px-3" aria-busy="true">
          <span className="size-9 animate-pulse rounded-[10px] bg-[var(--q-sunken)]" />
          <span className="h-3 w-40 animate-pulse rounded bg-[var(--q-sunken)]" />
          <span className="sr-only">Chargement des clients…</span>
        </div>
      ) : clients.length === 0 ? (
        <div className="q-banner q-banner-warn items-center">
          <span className="flex-1">Aucun client pour l&apos;instant. Créez-en un pour l&apos;ajouter au document.</span>
          <Link href={newClientHref} className="q-btn q-btn-secondary q-btn-sm shrink-0">
            <Plus aria-hidden strokeWidth={2.25} />
            Créer un client
          </Link>
        </div>
      ) : (
        <ClientPicker
          clients={clients}
          value={form.client_id}
          onChange={(id) => doc.setValue("client_id", id)}
          newClientHref={newClientHref}
          invalid={Boolean(errors.client_id)}
          describedBy={errors.client_id ? "doc-client-error" : undefined}
        />
      )}
      {errors.client_id && <p id="doc-client-error" className="q-field-error -mt-2">{errors.client_id}</p>}

      {client && (
        client.email ? (
          <p className="q-field-ok -mt-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>
            Envoi à {client.email}
          </p>
        ) : (
          <p className="-mt-1.5 text-xs text-[var(--q-warn)]">
            Pas d&apos;adresse e-mail : l&apos;envoi sera refusé.{" "}
            {clientHref && <Link href={clientHref(client.id)} className="font-semibold underline underline-offset-2">Compléter la fiche</Link>}
          </p>
        )
      )}

      {kind === "purchase_order" && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="doc-reference" className="q-label">Référence client / N° de commande</label>
          <input
            id="doc-reference"
            className="q-input font-mono"
            placeholder="Ex. : CMD-2026-001"
            value={form.reference}
            onChange={(e) => doc.setValue("reference", e.target.value)}
          />
          <p className="q-field-hint">Référence fournie par votre client (facultative).</p>
        </div>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Carte Conditions : dates et notes                                   */
/* ------------------------------------------------------------------ */

function ConditionsCard({ kind, doc }: { kind: DocKind; doc: DocumentFormApi }) {
  const { form, errors } = doc
  const text = DOC_TEXT[kind]
  const secondKey = kind === "invoice" ? "due_date" : kind === "quote" ? "valid_until" : "delivery_date"
  const secondValue = form[secondKey]
  const gap = daysBetween(form.issue_date, secondValue)

  let hint: string | null = null
  if (kind === "purchase_order") hint = "Facultative"
  else if (gap !== null) {
    if (gap < 0) hint = "Antérieure à la date d'émission"
    else if (gap === 0) hint = kind === "invoice" ? "À réception" : "Le jour même"
    else hint = kind === "invoice" ? `À ${gap} jour${gap > 1 ? "s" : ""}` : `Validité : ${gap} jour${gap > 1 ? "s" : ""}`
  }

  return (
    // Mobile : intitulé au-dessus de la carte ; ordinateur : une seule carte
    <section className="flex flex-col gap-2.5 md:q-card md:gap-3.5 md:p-5" aria-labelledby="doc-cond-title">
      <h2 id="doc-cond-title" className="q-h2">Conditions</h2>
      <div className="q-card flex flex-col gap-3.5 p-4 md:contents">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="doc-issue" className="q-label">Date d&apos;émission</label>
            <input
              id="doc-issue" type="date" className="q-input"
              value={form.issue_date}
              onChange={(e) => doc.setValue("issue_date", e.target.value)}
              aria-invalid={errors.issue_date ? true : undefined}
            />
            {errors.issue_date && <p className="q-field-error">{errors.issue_date}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="doc-second" className="q-label">{text.secondDateLabel}</label>
            <input
              id="doc-second" type="date" className="q-input"
              value={secondValue}
              onChange={(e) => doc.setValue(secondKey, e.target.value)}
              aria-invalid={errors[secondKey] ? true : undefined}
              aria-describedby="doc-second-hint"
            />
            {errors[secondKey]
              ? <p className="q-field-error">{errors[secondKey]}</p>
              : hint && <p id="doc-second-hint" className={cn("q-field-hint", gap !== null && gap < 0 && "!text-[var(--q-warn)]")}>{hint}</p>}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="doc-notes" className="q-label">
            {kind === "invoice" ? "Notes et conditions de paiement" : "Notes et conditions"}
          </label>
          <textarea
            id="doc-notes"
            rows={4}
            className="q-input"
            placeholder={text.notesPlaceholder}
            value={form.notes}
            onChange={(e) => doc.setValue("notes", e.target.value)}
          />
          <p className="q-field-hint">Imprimées sous les totaux : les trois premières lignes.</p>
        </div>
      </div>
    </section>
  )
}
