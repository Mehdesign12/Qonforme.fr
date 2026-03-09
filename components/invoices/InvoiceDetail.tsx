'use client'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import {
  ArrowLeft, Loader2, Send, CheckCircle2, XCircle,
  Printer, Pencil, Trash2, Download,
  Clock, AlertTriangle, CreditCard, RotateCcw, X, FileX, Archive, ArchiveX
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  formatCurrency, formatDate,
  INVOICE_STATUS_LABELS, INVOICE_STATUS_STYLES
} from "@/lib/utils/invoice"
import { InvoiceStatus } from "@/types"

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
  invoice_number: string
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

const STATUS_BADGE: Record<string, string> = {
  draft:     "bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]",
  sent:      "bg-[#DBEAFE] text-[#1E40AF] border-[#93C5FD]",
  pending:   "bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]",
  received:  "bg-[#EDE9FE] text-[#5B21B6] border-[#C4B5FD]",
  accepted:  "bg-[#D1FAE5] text-[#065F46] border-[#6EE7B7]",
  rejected:  "bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]",
  paid:      "bg-[#D1FAE5] text-[#065F46] border-[#6EE7B7]",
  overdue:   "bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]",
  cancelled: "bg-[#F1F5F9] text-[#64748B] border-[#CBD5E1]",
  credited:  "bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]",
}

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

/* Transitions autorisées */
const NEXT_ACTIONS: Partial<Record<string, { label: string; status: InvoiceStatus; icon: React.ElementType; variant: "default" | "outline" }[]>> = {
  draft: [
    { label: "Marquer comme envoyée", status: "sent", icon: Send, variant: "default" },
  ],
  sent: [
    { label: "Marquer comme payée",   status: "paid",    icon: CreditCard,   variant: "default" },
    { label: "Marquer en retard",      status: "overdue", icon: AlertTriangle, variant: "outline" },
  ],
  pending: [
    { label: "Marquer comme payée",   status: "paid",    icon: CreditCard, variant: "default" },
  ],
  received: [
    { label: "Marquer comme acceptée", status: "accepted", icon: CheckCircle2, variant: "default" },
    { label: "Marquer comme rejetée",  status: "rejected", icon: XCircle,      variant: "outline" },
  ],
  accepted: [
    { label: "Marquer comme payée",   status: "paid",    icon: CreditCard, variant: "default" },
  ],
  overdue: [
    { label: "Marquer comme payée",   status: "paid",    icon: CreditCard, variant: "default" },
  ],
}

/* Statuts éligibles à un avoir (tout sauf draft, cancelled, credited) */
const CAN_CREDIT = ["sent", "pending", "received", "accepted", "rejected", "paid", "overdue"]

/* ------------------------------------------------------------------ */
/* Composant Modal Avoir                                                */
/* ------------------------------------------------------------------ */

function CreditNoteModal({
  invoice,
  onClose,
  onSuccess,
}: {
  invoice: Invoice
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Header modal */}
        <div className="flex items-center justify-between p-6 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#FFF7ED] flex items-center justify-center">
              <RotateCcw className="w-4 h-4 text-[#C2410C]" />
            </div>
            <div>
              <h2 className="font-bold text-[#0F172A] text-sm">Émettre un avoir</h2>
              <p className="text-xs text-slate-400">sur la facture {invoice.invoice_number}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F1F5F9] transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* Rappel légal */}
          <div className="bg-[#FFF7ED] border border-[#FED7AA] rounded-xl p-3 flex gap-2.5">
            <AlertTriangle className="w-4 h-4 text-[#C2410C] shrink-0 mt-0.5" />
            <p className="text-xs text-[#9A3412]">
              En droit français, une facture émise ne peut pas être supprimée ni modifiée.
              L&apos;avoir est le seul moyen légal d&apos;annuler tout ou partie de cette facture.
            </p>
          </div>

          {/* Motif */}
          <div>
            <label className="text-sm font-medium text-[#0F172A] block mb-2">
              Motif de l&apos;avoir <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {CREDIT_REASONS.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => { setReason(r); setReasonError("") }}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all text-left ${
                    reason === r
                      ? "bg-[#FFF7ED] border-[#FB923C] text-[#C2410C]"
                      : "bg-white border-[#E2E8F0] text-slate-600 hover:border-[#FB923C]"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            {reason === "Autre" && (
              <input
                type="text"
                placeholder="Précisez le motif..."
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FB923C]"
              />
            )}
            {reasonError && <p className="text-xs text-red-500 mt-1">{reasonError}</p>}
          </div>

          {/* Type d'avoir */}
          <div>
            <label className="text-sm font-medium text-[#0F172A] block mb-2">Type d&apos;avoir</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: "total",   label: "Avoir total",   desc: "Annule toute la facture" },
                { value: "partial", label: "Avoir partiel", desc: "Sélectionnez les lignes" },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCreditType(opt.value as "total" | "partial")}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    creditType === opt.value
                      ? "bg-[#FFF7ED] border-[#FB923C]"
                      : "bg-white border-[#E2E8F0] hover:border-[#FB923C]"
                  }`}
                >
                  <p className={`text-xs font-semibold ${creditType === opt.value ? "text-[#C2410C]" : "text-[#0F172A]"}`}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Sélection lignes (avoir partiel) */}
          {creditType === "partial" && (
            <div className="border border-[#E2E8F0] rounded-xl overflow-hidden">
              <div className="bg-[#F8FAFC] px-4 py-2.5 border-b border-[#E2E8F0]">
                <p className="text-xs font-medium text-slate-500">Lignes à créditer</p>
              </div>
              <div className="divide-y divide-[#F1F5F9]">
                {invoice.lines.map((line, i) => (
                  <label key={i} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#F8FAFC]">
                    <input
                      type="checkbox"
                      checked={selectedLines[i]}
                      onChange={() => toggleLine(i)}
                      className="w-4 h-4 rounded accent-[#C2410C]"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#0F172A] truncate">{line.description}</p>
                      <p className="text-xs text-slate-400">{line.quantity} × {formatCurrency(line.unit_price_ht)} HT</p>
                    </div>
                    <p className="text-sm font-mono font-semibold text-[#C2410C] shrink-0">
                      {formatCurrency(line.total_ttc)}
                    </p>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Récapitulatif montant */}
          <div className="bg-[#F8FAFC] rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Montant de l&apos;avoir</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {creditType === "total"
                  ? "Avoir total — annule la facture intégralement"
                  : `${selectedLinesData.length} ligne${selectedLinesData.length > 1 ? "s" : ""} sélectionnée${selectedLinesData.length > 1 ? "s" : ""}`
                }
              </p>
            </div>
            <p className="text-xl font-bold text-[#C2410C] font-mono">
              {formatCurrency(totalAvoir)}
            </p>
          </div>
        </div>

        {/* Footer modal */}
        <div className="flex items-center justify-end gap-3 px-6 pb-6">
          <Button variant="outline" onClick={onClose} disabled={loading} size="sm">
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !finalReason.trim()}
            size="sm"
            className="bg-[#C2410C] hover:bg-[#9A3412] text-white gap-1.5"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
            {loading ? "Émission…" : "Émettre l'avoir"}
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Composant principal InvoiceDetail                                   */
/* ------------------------------------------------------------------ */

export function InvoiceDetail({ invoiceId }: { invoiceId: string }) {
  const router = useRouter()
  const [invoice, setInvoice]           = useState<Invoice | null>(null)
  const [loading, setLoading]           = useState(true)
  const [statusLoading, setStatusLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [pdfLoading, setPdfLoading]     = useState(false)
  const [showCreditModal, setShowCreditModal]   = useState(false)
  const [archiveLoading, setArchiveLoading]     = useState(false)
  const [showSendModal, setShowSendModal]       = useState(false)
  const [sendLoading, setSendLoading]           = useState(false)

  useEffect(() => {
    fetch(`/api/invoices/${invoiceId}`)
      .then(r => r.json())
      .then(json => { if (json.invoice) setInvoice(json.invoice) })
      .finally(() => setLoading(false))
  }, [invoiceId])

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
      if (!res.ok) { toast.error(json.error); return }
      setInvoice(json.invoice)
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
      a.href = url; a.download = `${invoice.invoice_number}.pdf`
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); URL.revokeObjectURL(url)
      toast.success("PDF téléchargé !")
    } catch { toast.error("Erreur lors du téléchargement") }
    finally { setPdfLoading(false) }
  }

  const deleteInvoice = async () => {
    if (!invoice || !confirm(`Supprimer le brouillon ${invoice.invoice_number} ?`)) return
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
      if (!res.ok) { toast.error(json.error ?? "Erreur lors de l'envoi"); return }
      setInvoice({ ...invoice, status: "sent" as InvoiceStatus })
      toast.success(`Facture envoyée à ${json.sentTo}`)
      setShowSendModal(false)
    } catch { toast.error("Erreur réseau") }
    finally { setSendLoading(false) }
  }

  const handleCreditSuccess = (creditNoteId: string) => {
    setShowCreditModal(false)
    // Mettre à jour le statut local
    if (invoice) setInvoice({ ...invoice, status: "credited" as InvoiceStatus })
    router.push(`/credit-notes/${creditNoteId}`)
  }

  /* Render states */
  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-8 h-8 text-[#2563EB] animate-spin" />
    </div>
  )

  if (!invoice) return (
    <div className="py-16 text-center space-y-3">
      <p className="text-slate-500">Facture introuvable</p>
      <Link href="/invoices" className="text-[#2563EB] text-sm hover:underline">← Retour aux factures</Link>
    </div>
  )

  const actions    = NEXT_ACTIONS[invoice.status] ?? []
  const isOverdue  = invoice.status === "sent" && new Date(invoice.due_date) < new Date()
  const canCredit  = CAN_CREDIT.includes(invoice.status)

  return (
    <>
      {/* Modal envoi email */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
                  <Send className="w-4 h-4 text-[#2563EB]" />
                </div>
                <div>
                  <h2 className="font-bold text-[#0F172A] text-sm">Envoyer la facture</h2>
                  <p className="text-xs text-slate-400">{invoice?.invoice_number}</p>
                </div>
              </div>
              <button onClick={() => setShowSendModal(false)} className="p-1.5 rounded-lg hover:bg-[#F1F5F9] transition-colors">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-4">
                <p className="text-sm text-[#1E40AF] font-medium mb-1">Destinataire</p>
                <p className="text-sm text-[#1E293B]">{invoice?.client?.name}</p>
                {invoice?.client?.email
                  ? <p className="text-xs text-[#2563EB] font-mono mt-0.5">{invoice.client.email}</p>
                  : <p className="text-xs text-red-500 mt-0.5">Aucune adresse email — ajoutez-en une dans la fiche client</p>
                }
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                La facture <strong>{invoice?.invoice_number}</strong> sera envoyée avec le PDF Factur-X en pièce jointe.
                Le statut passera automatiquement à <strong>Envoyée</strong>.
              </p>
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3">
                <p className="text-xs text-slate-500">Objet : <span className="font-medium text-slate-700">Facture {invoice?.invoice_number} — votre entreprise</span></p>
              </div>
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <Button variant="outline" className="flex-1" onClick={() => setShowSendModal(false)} disabled={sendLoading}>
                Annuler
              </Button>
              <Button
                className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white gap-2"
                onClick={sendByEmail}
                disabled={sendLoading || !invoice?.client?.email}
              >
                {sendLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sendLoading ? "Envoi en cours…" : "Envoyer"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal avoir */}
      {showCreditModal && (
        <CreditNoteModal
          invoice={invoice}
          onClose={() => setShowCreditModal(false)}
          onSuccess={handleCreditSuccess}
        />
      )}

      <div className="space-y-6">

        {/* ---- Header ---- */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/invoices">
              <Button variant="ghost" size="sm" className="gap-1.5 text-slate-500 hover:text-slate-700">
                <ArrowLeft className="w-4 h-4" /> Factures
              </Button>
            </Link>
            <h1 className="text-xl font-bold text-[#0F172A] font-mono">{invoice.invoice_number}</h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE[invoice.status] ?? STATUS_BADGE.draft}`}>
              {STATUS_LABELS[invoice.status] ?? invoice.status}
            </span>
            {/* Badge Factur-X — visible uniquement si facture non brouillon */}
            {invoice.status !== "draft" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]" title="Facture électronique conforme EN 16931">
                <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5.5" stroke="#2563EB"/><path d="M3.5 6l1.8 1.8L8.5 4" stroke="#2563EB" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Factur-X
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* PDF Factur-X */}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadPDF} disabled={pdfLoading}>
              {pdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {pdfLoading ? "Génération…" : invoice.status !== "draft" ? "Télécharger Factur-X" : "Télécharger PDF"}
            </Button>

            {/* Imprimer */}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}>
              <Printer className="w-4 h-4" /> Imprimer
            </Button>

            {/* Modifier brouillon */}
            {invoice.status === "draft" && (
              <Link href={`/invoices/${invoice.id}/edit`}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Pencil className="w-4 h-4" /> Modifier
                </Button>
              </Link>
            )}

            {/* Supprimer brouillon */}
            {invoice.status === "draft" && (
              <Button
                variant="outline" size="sm"
                className="gap-1.5 border-[#FCA5A5] text-[#991B1B] hover:bg-[#FEE2E2]"
                onClick={deleteInvoice} disabled={deleteLoading}
              >
                {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Supprimer
              </Button>
            )}

            {/* Archiver / Désarchiver */}
            <Button
              variant="outline" size="sm"
              className={`gap-1.5 ${
                invoice.is_archived
                  ? "border-[#93C5FD] text-[#2563EB] hover:bg-[#EFF6FF]"
                  : "border-[#CBD5E1] text-slate-500 hover:bg-[#F1F5F9]"
              }`}
              onClick={toggleArchive}
              disabled={archiveLoading}
            >
              {archiveLoading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : invoice.is_archived
                  ? <ArchiveX className="w-4 h-4" />
                  : <Archive className="w-4 h-4" />
              }
              {invoice.is_archived ? "Désarchiver" : "Archiver"}
            </Button>

            {/* Émettre un avoir */}
            {canCredit && (
              <Button
                variant="outline" size="sm"
                className="gap-1.5 border-[#FED7AA] text-[#C2410C] hover:bg-[#FFF7ED]"
                onClick={() => setShowCreditModal(true)}
              >
                <RotateCcw className="w-4 h-4" /> Émettre un avoir
              </Button>
            )}

            {/* Bouton Envoyer par email (statut draft uniquement) */}
            {invoice.status === "draft" && invoice.client?.email && (
              <Button
                size="sm"
                className="gap-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
                onClick={() => setShowSendModal(true)}
                disabled={sendLoading}
              >
                <Send className="w-4 h-4" />
                Envoyer par email
              </Button>
            )}

            {/* Transitions de statut (manuelles — hors envoi email) */}
            {actions.filter(a => a.status !== "sent" || invoice.status !== "draft").map(action => (
              <Button
                key={action.status}
                variant={action.variant}
                size="sm"
                className={`gap-1.5 ${action.variant === "default" ? "bg-[#2563EB] hover:bg-[#1D4ED8] text-white" : ""}`}
                onClick={() => changeStatus(action.status)}
                disabled={statusLoading}
              >
                {statusLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <action.icon className="w-4 h-4" />}
                {action.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Bandeau archivée */}
        {invoice.is_archived && (
          <div className="bg-[#F1F5F9] border border-[#CBD5E1] rounded-xl p-4 flex items-center gap-3">
            <Archive className="w-5 h-5 text-slate-400 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-600">Facture archivée</p>
              <p className="text-xs text-slate-400 mt-0.5">Cette facture n&apos;apparaît plus dans la liste principale. Vous pouvez la désarchiver à tout moment.</p>
            </div>
            <Button
              size="sm" variant="outline"
              className="shrink-0 border-[#93C5FD] text-[#2563EB] hover:bg-[#EFF6FF] gap-1.5"
              onClick={toggleArchive} disabled={archiveLoading}
            >
              <ArchiveX className="w-3.5 h-3.5" /> Désarchiver
            </Button>
          </div>
        )}

        {/* Alerte retard */}
        {isOverdue && (
          <div className="bg-[#FEF3C7] border border-[#FCD34D] rounded-xl p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-[#D97706] shrink-0" />
            <p className="text-sm text-[#92400E]">
              Cette facture est <strong>en retard</strong> depuis le {formatDate(invoice.due_date)}.
            </p>
            <Button size="sm" variant="outline"
              className="ml-auto border-[#FCD34D] text-[#92400E] hover:bg-[#FEF3C7] shrink-0"
              onClick={() => changeStatus("overdue")} disabled={statusLoading}
            >
              <Clock className="w-3.5 h-3.5 mr-1.5" /> Marquer en retard
            </Button>
          </div>
        )}

        {/* Alerte avoir émis */}
        {invoice.status === "credited" && (
          <div className="bg-[#FFF7ED] border border-[#FED7AA] rounded-xl p-4 flex items-center gap-3">
            <FileX className="w-5 h-5 text-[#C2410C] shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[#9A3412]">Un avoir a été émis sur cette facture</p>
              <p className="text-xs text-[#C2410C] mt-0.5">Cette facture est annulée. Consultez la section Avoirs pour le détail.</p>
            </div>
            <Link href="/credit-notes" className="ml-auto shrink-0">
              <Button size="sm" variant="outline" className="border-[#FED7AA] text-[#C2410C] hover:bg-[#FFF7ED] gap-1.5">
                <RotateCcw className="w-3.5 h-3.5" /> Voir les avoirs
              </Button>
            </Link>
          </div>
        )}

        {/* ---- Corps facture ---- */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">

          <div className="p-6 sm:p-8 border-b border-[#E2E8F0]">
            <div className="flex flex-wrap justify-between gap-6">
              <div>
                <p className="text-xs font-medium text-slate-400 mb-1">DE</p>
                <p className="text-sm font-bold text-[#0F172A]">Votre entreprise</p>
                <p className="text-xs text-slate-500 mt-0.5">Complétez dans Paramètres → Entreprise</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400 mb-1">POUR</p>
                {invoice.client ? (
                  <div>
                    <Link href={`/clients/${invoice.client.id}`} className="text-sm font-bold text-[#2563EB] hover:underline">
                      {invoice.client.name}
                    </Link>
                    {invoice.client.siren && (
                      <p className="text-xs text-slate-400 font-mono mt-0.5">SIREN {invoice.client.siren}</p>
                    )}
                    {invoice.client.address && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        {invoice.client.address}<br />
                        {invoice.client.zip_code} {invoice.client.city}
                      </p>
                    )}
                    {invoice.client.email && (
                      <p className="text-xs text-slate-500 mt-0.5">{invoice.client.email}</p>
                    )}
                  </div>
                ) : <p className="text-sm text-slate-400">—</p>}
              </div>
              <div className="text-right">
                <div className="mb-3">
                  <p className="text-xs font-medium text-slate-400">N° FACTURE</p>
                  <p className="text-sm font-bold font-mono text-[#0F172A]">{invoice.invoice_number}</p>
                </div>
                <div className="mb-3">
                  <p className="text-xs font-medium text-slate-400">DATE D&apos;ÉMISSION</p>
                  <p className="text-sm text-[#0F172A]">{formatDate(invoice.issue_date)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-400">ÉCHÉANCE</p>
                  <p className={`text-sm font-medium ${isOverdue || invoice.status === "overdue" ? "text-[#EF4444]" : "text-[#0F172A]"}`}>
                    {formatDate(invoice.due_date)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Tableau lignes */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className="text-left text-xs font-medium text-slate-400 px-6 py-3">Désignation</th>
                  <th className="text-right text-xs font-medium text-slate-400 px-4 py-3">Qté</th>
                  <th className="text-right text-xs font-medium text-slate-400 px-4 py-3">Prix unitaire HT</th>
                  <th className="text-right text-xs font-medium text-slate-400 px-4 py-3">TVA</th>
                  <th className="text-right text-xs font-medium text-slate-400 px-6 py-3">Total HT</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lines?.map((line, i) => (
                  <tr key={i} className="border-b border-[#F1F5F9] last:border-0">
                    <td className="px-6 py-4 text-sm text-[#0F172A]">{line.description}</td>
                    <td className="px-4 py-4 text-right text-sm font-mono text-slate-600">{line.quantity}</td>
                    <td className="px-4 py-4 text-right text-sm font-mono text-slate-600">{formatCurrency(line.unit_price_ht)}</td>
                    <td className="px-4 py-4 text-right text-sm font-mono text-slate-600">{line.vat_rate}%</td>
                    <td className="px-6 py-4 text-right text-sm font-mono font-semibold text-[#0F172A]">{formatCurrency(line.total_ht)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totaux */}
          <div className="p-6 sm:p-8 border-t border-[#E2E8F0]">
            <div className="flex justify-end">
              <div className="w-64 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Sous-total HT</span>
                  <span className="font-mono text-[#0F172A]">{formatCurrency(invoice.subtotal_ht)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">TVA</span>
                  <span className="font-mono text-slate-600">{formatCurrency(invoice.total_vat)}</span>
                </div>
                <Separator />
                <div className="flex justify-between pt-1">
                  <span className="font-bold text-[#0F172A]">Total TTC</span>
                  <span className="font-mono text-lg font-bold text-[#2563EB]">{formatCurrency(invoice.total_ttc)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="px-6 sm:px-8 pb-6 sm:pb-8">
              <Separator className="mb-4" />
              <p className="text-xs font-medium text-slate-400 mb-1.5">CONDITIONS DE PAIEMENT / NOTES</p>
              <p className="text-sm text-slate-600 whitespace-pre-line">{invoice.notes}</p>
            </div>
          )}
        </div>

        {/* Infos techniques */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Créée le",    value: formatDate(invoice.created_at) },
            { label: "Statut PPF",  value: invoice.ppf_status || "Non transmise" },
            { label: "Lignes",      value: `${invoice.lines?.length ?? 0} prestation${(invoice.lines?.length ?? 0) > 1 ? "s" : ""}` },
            { label: "Statut",      value: STATUS_LABELS[invoice.status] ?? invoice.status,
              color: INVOICE_STATUS_STYLES[invoice.status as InvoiceStatus]?.text },
          ].map(item => (
            <div key={item.label} className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm">
              <p className="text-xs text-slate-400 mb-1">{item.label}</p>
              <p className="text-sm font-semibold" style={item.color ? { color: item.color } : {}}>
                {item.value}
              </p>
            </div>
          ))}
        </div>

        {/* Édition brouillon */}
        {invoice.status === "draft" && (
          <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Pencil className="w-4 h-4 text-[#2563EB] shrink-0" />
              <p className="text-sm text-[#1E40AF]">Ce brouillon peut encore être modifié.</p>
            </div>
            <Link href={`/invoices/${invoiceId}/edit`}>
              <Button size="sm" variant="outline" className="border-[#93C5FD] text-[#2563EB] hover:bg-[#DBEAFE] shrink-0 gap-1.5">
                <Pencil className="w-3.5 h-3.5" /> Modifier
              </Button>
            </Link>
          </div>
        )}
      </div>
    </>
  )
}
