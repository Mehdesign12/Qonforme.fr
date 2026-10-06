'use client'

/**
 * Fiche facture réelle : chargement, actions (API) et fenêtres (envoi, avoir,
 * mur de paiement). L'affichage est InvoiceDetailView, partagé avec la démo.
 */
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { toastCompanyRequired } from "@/components/shared/company-required"
import { FileText, Info, RotateCcw, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase/client"
import { selectCompanyWithProfile } from "@/lib/legal/db"
import { cn } from "@/lib/utils"
import { formatCurrency, INVOICE_STATUS_LABELS } from "@/lib/utils/invoice"
import { InvoiceStatus } from "@/types"
import { PaywallDialog, isArtisanPaywall, isSubscriptionRequired } from "@/components/billing/PaywallDialog"
import { EmptyState } from "@/components/app/kit"
import { InvoiceDetailView } from "@/components/invoices/InvoiceDetailView"
import { type CompanyView, todayISO } from "@/components/invoices/invoice-view"
import { invoiceNumberLabel } from "@/lib/utils/document-numbering"
import { describeInvoiceSchedule } from "@/lib/reminders/settings"
import { DeclarationBanner, PaymentLinkPanel } from "@/components/payment-link/PaymentLinkPanel"
import { usePaymentLink } from "@/components/payment-link/usePaymentLink"
import { isPayableStatus } from "@/lib/payment-link/rules"

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

interface InvoiceLine {
  description: string
  quantity: number
  unit_price_ht: number
  vat_rate: number
  total_ht: number
  total_vat: number
  total_ttc: number
}

interface Invoice {
  id: string
  /** Vide pour un brouillon : le numéro est attribué à l'envoi. */
  invoice_number: string | null
  status: InvoiceStatus
  is_archived: boolean
  issue_date: string
  due_date: string
  lines: InvoiceLine[]
  subtotal_ht: number
  total_vat: number
  total_ttc: number
  notes: string | null
  payment_terms: string | null
  pdf_url: string | null
  ppf_status: string | null
  created_at: string
  sent_at?: string | null
  paid_at?: string | null
  reminder_1_sent_at: string | null
  reminder_2_sent_at: string | null
  /** Journal des relances (null tant qu'il n'est pas en place). */
  reminders?: { stage: string; origin: string; sent_at: string }[] | null
  /** Formule Artisan (migration 20261003_artisan_chantiers.sql) : absents avant elle. */
  invoice_kind?: string | null
  billing_context?: unknown
  retention_amount?: number | null
  chantier_id?: string | null
  quote_id?: string | null
  client: {
    id: string
    name: string
    email: string | null
    address: string | null
    zip_code: string | null
    city: string | null
    siren: string | null
    vat_number: string | null
  } | null
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

const STATUS_LABELS: Record<string, string> = {
  ...INVOICE_STATUS_LABELS,
  cancelled: "Annulée",
  credited:  "Avoir émis",
}

const CREDIT_REASONS = [
  "Erreur de facturation",
  "Annulation de commande",
  "Remise commerciale",
  "Prestation non réalisée",
  "Retour de marchandise",
  "Autre",
]

/**
 * Les routes PATCH et relance renvoient le client sans son adresse : on garde
 * les champs déjà chargés pour que l'aperçu ne perde pas ses coordonnées.
 */
function mergeInvoice(prev: Invoice | null, next: Invoice): Invoice {
  // Le journal des relances n'est renvoyé que par GET : on garde celui déjà chargé
  const reminders = next.reminders !== undefined ? next.reminders : prev?.reminders
  if (!prev?.client || !next.client) return { ...next, reminders, client: next.client ?? prev?.client ?? null }
  return { ...next, reminders, client: { ...prev.client, ...next.client } }
}

/* En-tête et pied communs des fenêtres (canevas : titre Bricolage 22 px, pied grisé) */
function DialogHead({ title, sub }: { title: string; sub: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 px-[22px] pr-14 pt-5">
      <DialogTitle className="q-display text-[22px] leading-tight text-[var(--q-ink)]">{title}</DialogTitle>
      <DialogDescription className="text-sm text-[var(--q-text-4)]">{sub}</DialogDescription>
    </div>
  )
}

function DialogFoot({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--q-line-soft)] bg-[var(--q-surface-2)] px-[22px] py-4"
      style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom, 16px))" }}
    >
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Fenêtre Avoir                                                        */
/* ------------------------------------------------------------------ */

function CreditNoteModal({
  invoice,
  open,
  onClose,
  onSuccess,
}: {
  invoice: Invoice
  open: boolean
  onClose: () => void
  onSuccess: (creditNoteId: string) => void
}) {
  const [reason, setReason]           = useState("")
  const [customReason, setCustomReason] = useState("")
  const [creditType, setCreditType]   = useState<"total" | "partial">("total")
  const [selectedLines, setSelectedLines] = useState<boolean[]>(
    invoice.lines.map(() => true)
  )
  const [loading, setLoading]         = useState(false)
  const [reasonError, setReasonError] = useState("")

  const finalReason = reason === "Autre" ? customReason : reason

  const toggleLine = (i: number) => {
    setSelectedLines(prev => prev.map((v, idx) => idx === i ? !v : v))
  }

  const selectedLinesData = creditType === "total"
    ? invoice.lines
    : invoice.lines.filter((_, i) => selectedLines[i])

  const totalAvoir = selectedLinesData.reduce((s, l) => s + l.total_ttc, 0)

  const handleSubmit = async () => {
    if (!finalReason.trim()) { setReasonError("Le motif est obligatoire"); return }
    if (creditType === "partial" && selectedLinesData.length === 0) {
      toast.error("Sélectionnez au moins une ligne"); return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/credit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: finalReason,
          lines: creditType === "partial" ? selectedLinesData : undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      toast.success(`Avoir ${json.credit_note.credit_note_number} émis avec succès`)
      onSuccess(json.credit_note.id)
    } catch { toast.error("Erreur réseau") }
    finally { setLoading(false) }
  }

  const option = (selected: boolean) => cn(
    "rounded-[10px] border text-left transition-colors",
    selected
      ? "border-[var(--q-accent)] bg-[var(--q-wash)] text-[var(--q-accent-strong)]"
      : "border-[var(--q-field)] bg-[var(--q-surface)] text-[var(--q-text-2)] hover:bg-[var(--q-sunken)]",
  )

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !loading) onClose() }}>
      <DialogContent showCloseButton={!loading} className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-[540px]">
        <DialogHead title="Créer un avoir" sub={<>Sur la facture <span className="font-mono">{invoice.invoice_number}</span>{invoice.client ? ` · ${invoice.client.name}` : ""}</>} />

        <div className="flex flex-col gap-5 px-[22px] pb-5 pt-[18px]">
          {/* Rappel légal */}
          <div className="q-banner text-[13px] leading-normal">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              Une facture émise ne peut être ni supprimée ni modifiée. L&apos;avoir est le seul moyen
              légal d&apos;annuler tout ou partie de cette facture.
            </p>
          </div>

          {/* Motif */}
          <fieldset className="flex flex-col gap-2">
            <legend className="q-label mb-2">Motif de l&apos;avoir <span className="text-[var(--q-danger)]">*</span></legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {CREDIT_REASONS.map(r => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={reason === r}
                  onClick={() => { setReason(r); setReasonError("") }}
                  className={cn(option(reason === r), "min-h-[42px] px-3 py-2 text-sm font-medium")}
                >
                  {r}
                </button>
              ))}
            </div>
            {reason === "Autre" && (
              <input
                type="text"
                aria-label="Précisez le motif"
                placeholder="Précisez le motif…"
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                className="q-input"
              />
            )}
            {reasonError && <p className="q-field-error">{reasonError}</p>}
          </fieldset>

          {/* Type d'avoir */}
          <fieldset className="flex flex-col gap-2">
            <legend className="q-label mb-2">Type d&apos;avoir</legend>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: "total",   label: "Avoir total",   desc: "Annule toute la facture" },
                { value: "partial", label: "Avoir partiel", desc: "Sélectionnez les lignes" },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={creditType === opt.value}
                  onClick={() => setCreditType(opt.value as "total" | "partial")}
                  className={cn(option(creditType === opt.value), "p-3")}
                >
                  <span className="block text-sm font-semibold">{opt.label}</span>
                  <span className="mt-0.5 block text-xs text-[var(--q-text-4)]">{opt.desc}</span>
                </button>
              ))}
            </div>
          </fieldset>

          {/* Sélection lignes (avoir partiel) */}
          {creditType === "partial" && (
            <div className="overflow-hidden rounded-xl border border-[var(--q-line)]">
              <p className="border-b border-[var(--q-line-soft)] bg-[var(--q-surface-2)] px-4 py-2.5 text-xs font-medium text-[var(--q-text-4)]">
                Lignes à créditer
              </p>
              <div className="q-list">
                {invoice.lines.map((line, i) => (
                  <label key={i} className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-[var(--q-row-hover)]">
                    <input
                      type="checkbox"
                      checked={selectedLines[i]}
                      onChange={() => toggleLine(i)}
                      className="size-4 shrink-0 accent-[var(--q-accent)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-[var(--q-ink)]">{line.description}</span>
                      <span className="block text-xs tabular-nums text-[var(--q-text-4)]">{line.quantity} × {formatCurrency(line.unit_price_ht)} HT</span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--q-ink)]">
                      {formatCurrency(line.total_ttc)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Récapitulatif montant */}
          <div className="q-inset flex items-center justify-between gap-4 p-4">
            <div>
              <p className="text-[13px] font-semibold text-[var(--q-ink)]">Montant de l&apos;avoir</p>
              <p className="mt-0.5 text-xs text-[var(--q-text-4)]">
                {creditType === "total"
                  ? "Avoir total : annule la facture intégralement"
                  : `${selectedLinesData.length} ligne${selectedLinesData.length > 1 ? "s" : ""} sélectionnée${selectedLinesData.length > 1 ? "s" : ""}`
                }
              </p>
            </div>
            <p className="text-xl font-semibold tabular-nums text-[var(--q-ink)]">
              {formatCurrency(totalAvoir)}
            </p>
          </div>
        </div>

        <DialogFoot>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !finalReason.trim()}>
            <RotateCcw />
            {loading ? "Émission…" : "Émettre l'avoir"}
          </Button>
        </DialogFoot>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/* Composant principal InvoiceDetail                                   */
/* ------------------------------------------------------------------ */

export function InvoiceDetail({ invoiceId }: { invoiceId: string }) {
  const router = useRouter()
  const [invoice, setInvoice]           = useState<Invoice | null>(null)
  const [company, setCompany]           = useState<CompanyView | null>(null)
  const [quote, setQuote]               = useState<{ id: string; quote_number: string } | null>(null)
  const [loading, setLoading]           = useState(true)
  const [today, setToday]               = useState<string | null>(null)
  const [statusLoading, setStatusLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [pdfLoading, setPdfLoading]     = useState(false)
  const [fxLoading, setFxLoading]       = useState(false)
  const [showCreditModal, setShowCreditModal]   = useState(false)
  const [archiveLoading, setArchiveLoading]     = useState(false)
  const [showSendModal, setShowSendModal]       = useState(false)
  const [sendLoading, setSendLoading]           = useState(false)
  const [remindLoading, setRemindLoading]       = useState(false)
  // Mur de paiement : ouvert quand l'émission est refusée faute de formule (402) ;
  // « artisan » pour un acompte, une situation ou un solde (formule Artisan)
  const [paywall, setPaywall]                   = useState<null | "send" | "remind" | "artisan">(null)
  const [chantier, setChantier]                 = useState<{ id: string; name: string } | null>(null)
  // Calendrier des relances automatiques du compte (Paramètres › Relances)
  const [autoReminders, setAutoReminders]       = useState<string | null | undefined>(undefined)
  // Lien de paiement par virement : relu quand la facture change de statut (envoi, paiement)
  const payLink = usePaymentLink(invoiceId, invoice?.status)

  useEffect(() => {
    setToday(todayISO())
    // Réglages des relances : sans réponse (ou avant la migration), le calendrier par défaut
    fetch("/api/reminder-settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => { if (json?.available && json.settings) setAutoReminders(describeInvoiceSchedule(json.settings)) })
      .catch(() => {})
    const supabase = createClient()
    Promise.all([
      fetch(`/api/invoices/${invoiceId}`).then(r => r.json()),
      // Profil légal compris s'il existe : mentions automatiques d'un brouillon
      selectCompanyWithProfile(supabase, "name,address,zip_code,city,siret,siren,vat_number,iban,legal_notice"),
    ]).then(([json, { data: comp }]) => {
      if (json.invoice) setInvoice(json.invoice)
      if (comp) setCompany(comp as CompanyView)
    }).finally(() => setLoading(false))
    // Devis d'origine (conversion devis → facture), simple lien : rien n'est affiché en cas d'erreur
    supabase.from("quotes").select("id,quote_number").eq("converted_invoice_id", invoiceId).maybeSingle()
      .then(({ data }) => { if (data) setQuote(data) }, () => {})
  }, [invoiceId])

  // Chantier de rattachement (lien de la fiche) : rien si la table n'existe pas encore
  const chantierId = invoice?.chantier_id ?? null
  useEffect(() => {
    if (!chantierId) { setChantier(null); return }
    createClient().from("chantiers").select("id,name").eq("id", chantierId).maybeSingle()
      .then(({ data }) => { if (data) setChantier(data as { id: string; name: string }) }, () => {})
  }, [chantierId])

  // Retour du paiement (?send=1) : la formule est active, on rouvre l'envoi
  // de la facture qui attendait, puis on nettoie l'URL.
  useEffect(() => {
    if (!invoice || typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    if (params.get("send") !== "1") return
    router.replace(`/invoices/${invoiceId}`)
    if (invoice.status === "draft" && invoice.client?.email) setShowSendModal(true)
  }, [invoice?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const changeStatus = async (newStatus: InvoiceStatus) => {
    if (!invoice) return
    setStatusLoading(true)
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      const json = await res.json()
      if (isSubscriptionRequired(res.status, json)) { setPaywall("send"); return }
      if (isArtisanPaywall(res.status, json)) { setPaywall("artisan"); return }
      if (toastCompanyRequired(res.status, json)) return
      if (!res.ok) { toast.error(json.error); return }
      setInvoice(prev => mergeInvoice(prev, json.invoice))
      toast.success(`Statut mis à jour : ${STATUS_LABELS[newStatus] ?? newStatus}`)
    } catch { toast.error("Erreur réseau") }
    finally { setStatusLoading(false) }
  }

  const downloadPDF = async () => {
    if (!invoice) return
    setPdfLoading(true)
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/pdf`)
      if (!res.ok) { toast.error("Erreur lors de la génération du PDF"); return }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")
      a.href = url; a.download = `${invoice.status === "draft" ? `brouillon-${invoice.invoice_number ?? "facture"}` : invoice.invoice_number}.pdf`
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); URL.revokeObjectURL(url)
      toast.success("PDF téléchargé")
    } catch { toast.error("Erreur lors du téléchargement") }
    finally { setPdfLoading(false) }
  }

  const downloadFacturX = async () => {
    if (!invoice) return
    setFxLoading(true)
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/facturx`)
      if (!res.ok) { toast.error("Erreur lors de la génération du Factur-X"); return }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")
      a.href = url; a.download = `${invoice.invoice_number}-facturx.xml`
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); URL.revokeObjectURL(url)
      toast.success("XML Factur-X téléchargé")
    } catch { toast.error("Erreur lors du téléchargement") }
    finally { setFxLoading(false) }
  }

  const deleteInvoice = async () => {
    if (!invoice || !confirm(invoice.invoice_number ? `Supprimer le brouillon ${invoice.invoice_number} ?` : "Supprimer ce brouillon ?")) return
    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, { method: "DELETE" })
      if (res.ok) { toast.success("Brouillon supprimé"); router.push("/invoices") }
      else { const json = await res.json(); toast.error(json.error) }
    } catch { toast.error("Erreur réseau") }
    finally { setDeleteLoading(false) }
  }

  const toggleArchive = async () => {
    if (!invoice) return
    const next = !invoice.is_archived
    const label = next ? "archivée" : "désarchivée"
    setArchiveLoading(true)
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_archived: next }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      setInvoice({ ...invoice, is_archived: next })
      toast.success(`Facture ${label}`)
    } catch { toast.error("Erreur réseau") }
    finally { setArchiveLoading(false) }
  }

  const sendByEmail = async () => {
    if (!invoice) return
    setSendLoading(true)
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/send`, { method: "POST" })
      const json = await res.json()
      if (isSubscriptionRequired(res.status, json)) { setShowSendModal(false); setPaywall("send"); return }
      if (isArtisanPaywall(res.status, json)) { setShowSendModal(false); setPaywall("artisan"); return }
      if (toastCompanyRequired(res.status, json)) { setShowSendModal(false); return }
      if (!res.ok) {
        // Facture émise (numérotée) mais email non parti : elle reste émise, à renvoyer
        if (json.issued && json.invoice) { setInvoice(prev => mergeInvoice(prev, json.invoice)); setShowSendModal(false) }
        toast.error(json.error ?? "Erreur lors de l'envoi")
        return
      }
      setInvoice(prev => json.invoice
        ? mergeInvoice(prev, json.invoice)
        : { ...invoice, status: "sent" as InvoiceStatus, sent_at: new Date().toISOString() })
      toast.success(`Facture envoyée à ${json.sentTo}`)
      setShowSendModal(false)
    } catch { toast.error("Erreur réseau") }
    finally { setSendLoading(false) }
  }

  const handleCreditSuccess = (creditNoteId: string) => {
    setShowCreditModal(false)
    if (invoice) setInvoice({ ...invoice, status: "credited" as InvoiceStatus })
    router.push(`/credit-notes/${creditNoteId}`)
  }

  const sendReminder = async () => {
    if (!invoice) return
    setRemindLoading(true)
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/remind`, { method: "POST" })
      const json = await res.json()
      if (isSubscriptionRequired(res.status, json)) { setPaywall("remind"); return }
      if (!res.ok) { toast.error(json.error ?? "Erreur lors de l'envoi de la relance"); return }
      setInvoice(prev => {
        const next = mergeInvoice(prev, json.invoice)
        // Relance notée au journal : on l'ajoute à l'historique affiché
        return json.reminder && Array.isArray(next.reminders) ? { ...next, reminders: [...next.reminders, json.reminder] } : next
      })
      toast.success(`Relance ${json.reminderNumber} envoyée à ${json.sentTo}`)
    } catch { toast.error("Erreur réseau") }
    finally { setRemindLoading(false) }
  }

  /* Render states */
  if (loading || !today) return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <span className="sr-only">Chargement de la facture…</span>
      <div className="flex flex-col gap-2">
        <span className="h-4 w-28 rounded bg-[var(--q-sunken)]" />
        <span className="h-8 w-72 max-w-full rounded-lg bg-[var(--q-sunken)]" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="q-paper-bed h-[420px]" />
        <div className="q-card h-[240px]" />
      </div>
    </div>
  )

  if (!invoice) return (
    <section className="q-card">
      <EmptyState
        icon={<FileText className="size-5" aria-hidden />}
        title="Facture introuvable"
        text="Elle a peut-être été supprimée, ou le lien est incomplet."
        action={<Link href="/invoices" className="q-btn q-btn-secondary">Retour aux factures</Link>}
      />
    </section>
  )

  return (
    <>
      <PaywallDialog
        open={paywall !== null}
        onOpenChange={(o) => { if (!o) setPaywall(null) }}
        invoiceId={invoice.id}
        invoiceNumber={invoice.invoice_number ?? undefined}
        reason={paywall ?? "send"}
        nextPath={`/invoices/${invoice.id}`}
      />

      {/* Fenêtre envoi email */}
      <Dialog open={showSendModal} onOpenChange={(o) => { if (!o && !sendLoading) setShowSendModal(false) }}>
        <DialogContent showCloseButton={!sendLoading} className="gap-0 overflow-hidden p-0 sm:max-w-[500px]">
          <DialogHead
            title={invoice.status === "draft" ? "Envoyer la facture" : "Renvoyer la facture"}
            sub={<><span className={cn(invoice.invoice_number && "font-mono")}>{invoiceNumberLabel(invoice.invoice_number)}</span>{invoice.client ? ` · ${invoice.client.name}` : ""}</>}
          />
          <div className="flex flex-col gap-3.5 px-[22px] pb-5 pt-[18px]">
            <div className="q-inset px-4 py-3.5 text-sm leading-relaxed text-[var(--q-text-2)]">
              {invoice.client?.email ? (
                <span className="mb-1.5 block text-xs text-[var(--q-text-4)]">À : {invoice.client.email}</span>
              ) : (
                <span className="mb-1.5 block text-xs text-[var(--q-danger)]">Aucune adresse email : ajoutez-en une dans la fiche client</span>
              )}
              Objet : <span className="font-medium text-[var(--q-ink)]">Facture {invoice.invoice_number ?? "(numéro attribué à l’envoi)"} — {company?.name ?? "votre entreprise"}</span>
            </div>
            <div className="q-banner text-[13px] leading-normal">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              {invoice.status === "draft" ? (
                <p>
                  Le PDF de la facture est joint à l&apos;email et une copie vous est adressée.
                  {!invoice.invoice_number && " La facture reçoit son numéro définitif, à la date du jour."}
                  {" "}Elle passe au statut <strong>Envoyée</strong> : elle ne pourra plus être modifiée.
                </p>
              ) : (
                <p>
                  Une copie de la facture et de son PDF est renvoyée à votre client, avec une copie pour vous.
                  Son numéro et son statut ne changent pas.
                </p>
              )}
            </div>
          </div>
          <DialogFoot>
            <Button variant="ghost" onClick={() => setShowSendModal(false)} disabled={sendLoading}>
              Annuler
            </Button>
            <Button onClick={sendByEmail} disabled={sendLoading || !invoice.client?.email}>
              <Send />
              {sendLoading ? "Envoi en cours…" : invoice.status === "draft" ? "Envoyer" : "Renvoyer"}
            </Button>
          </DialogFoot>
        </DialogContent>
      </Dialog>

      {/* Fenêtre avoir (montée à l'ouverture pour repartir d'un formulaire vierge) */}
      {showCreditModal && (
        <CreditNoteModal
          invoice={invoice}
          open={showCreditModal}
          onClose={() => setShowCreditModal(false)}
          onSuccess={handleCreditSuccess}
        />
      )}

      <InvoiceDetailView
        invoice={{ ...invoice, chantier: chantier ? { ...chantier, href: `/chantiers/${chantier.id}` } : null }}
        invoiceHref={(ref) => `/invoices/${ref.id}`}
        quoteHref={(id) => `/quotes/${id}`}
        company={company}
        today={today}
        backHref="/invoices"
        clientHref={invoice.client ? `/clients/${invoice.client.id}` : null}
        quote={quote ? { number: quote.quote_number, href: `/quotes/${quote.id}` } : null}
        creditNotesHref="/credit-notes"
        settingsCompanyHref="/settings/company"
        autoReminders={autoReminders}
        payment={payLink.state?.available ? (
          <PaymentLinkPanel
            status={invoice.status}
            state={payLink.state}
            iban={company?.iban ?? null}
            settingsHref="/settings/company#banque"
            handlers={{ create: payLink.create, disable: payLink.disable, enable: payLink.enable, busy: payLink.busy }}
          />
        ) : undefined}
        paymentBanner={payLink.state?.declaration?.status === "open" && isPayableStatus(invoice.status) ? (
          <DeclarationBanner
            declaration={payLink.state.declaration}
            onMarkPaid={() => changeStatus("paid" as InvoiceStatus)}
            onDismiss={() => payLink.dismiss(payLink.state!.declaration!.id)}
            busy={payLink.busy || statusLoading}
          />
        ) : null}
        handlers={{
          downloadPdf: downloadPDF,
          pdfLoading,
          downloadFacturX,
          fxLoading,
          print: () => window.print(),
          editHref: `/invoices/${invoice.id}/edit`,
          deleteDraft: deleteInvoice,
          deleteLoading,
          toggleArchive,
          archiveLoading,
          openCredit: () => setShowCreditModal(true),
          remind: sendReminder,
          remindLoading,
          openSend: () => setShowSendModal(true),
          sendLoading,
          changeStatus,
          statusLoading,
        }}
      />
    </>
  )
}
