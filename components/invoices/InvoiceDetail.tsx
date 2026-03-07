'use client'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import {
  ArrowLeft, Loader2, Send, CheckCircle2, XCircle,
  Printer, Pencil, Trash2, Download,
  Clock, AlertTriangle, CreditCard
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

const STATUS_BADGE: Record<InvoiceStatus, string> = {
  draft:    "bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]",
  sent:     "bg-[#DBEAFE] text-[#1E40AF] border-[#93C5FD]",
  pending:  "bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]",
  received: "bg-[#EDE9FE] text-[#5B21B6] border-[#C4B5FD]",
  accepted: "bg-[#D1FAE5] text-[#065F46] border-[#6EE7B7]",
  rejected: "bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]",
  paid:     "bg-[#D1FAE5] text-[#065F46] border-[#6EE7B7]",
  overdue:  "bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]",
}

/* Transitions de statut autorisées */
const NEXT_ACTIONS: Partial<Record<InvoiceStatus, { label: string; status: InvoiceStatus; icon: React.ElementType; variant: "default" | "outline" }[]>> = {
  draft: [
    { label: "Marquer comme envoyée", status: "sent", icon: Send, variant: "default" },
  ],
  sent: [
    { label: "Marquer comme payée", status: "paid", icon: CreditCard, variant: "default" },
    { label: "Marquer en retard", status: "overdue", icon: AlertTriangle, variant: "outline" },
  ],
  pending: [
    { label: "Marquer comme payée", status: "paid", icon: CreditCard, variant: "default" },
  ],
  received: [
    { label: "Marquer comme acceptée", status: "accepted", icon: CheckCircle2, variant: "default" },
    { label: "Marquer comme rejetée", status: "rejected", icon: XCircle, variant: "outline" },
  ],
  accepted: [
    { label: "Marquer comme payée", status: "paid", icon: CreditCard, variant: "default" },
  ],
  overdue: [
    { label: "Marquer comme payée", status: "paid", icon: CreditCard, variant: "default" },
  ],
}

/* ------------------------------------------------------------------ */
/* Composant                                                            */
/* ------------------------------------------------------------------ */

export function InvoiceDetail({ invoiceId }: { invoiceId: string }) {
  const router = useRouter()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusLoading, setStatusLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  /* Chargement */
  useEffect(() => {
    fetch(`/api/invoices/${invoiceId}`)
      .then(r => r.json())
      .then(json => { if (json.invoice) setInvoice(json.invoice) })
      .finally(() => setLoading(false))
  }, [invoiceId])

  /* Changement de statut */
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
      toast.success(`Statut mis à jour : ${INVOICE_STATUS_LABELS[newStatus]}`)
    } catch { toast.error("Erreur réseau") }
    finally { setStatusLoading(false) }
  }

  /* Suppression (brouillons uniquement) */
  const deleteInvoice = async () => {
    if (!invoice || !confirm(`Supprimer la facture ${invoice.invoice_number} ?`)) return
    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, { method: "DELETE" })
      if (res.ok) {
        toast.success("Facture supprimée")
        router.push("/invoices")
      } else {
        const json = await res.json()
        toast.error(json.error)
      }
    } catch { toast.error("Erreur réseau") }
    finally { setDeleteLoading(false) }
  }

  /* ---------------------------------------------------------------- */
  /* Render states                                                      */
  /* ---------------------------------------------------------------- */

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

  const actions = NEXT_ACTIONS[invoice.status] ?? []
  const isOverdue = invoice.status === "sent" && new Date(invoice.due_date) < new Date()

  return (
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
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE[invoice.status]}`}>
            {INVOICE_STATUS_LABELS[invoice.status]}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Imprimer / télécharger */}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}>
            <Printer className="w-4 h-4" /> Imprimer
          </Button>
          {invoice.pdf_url && (
            <a href={invoice.pdf_url} download>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Download className="w-4 h-4" /> PDF
              </Button>
            </a>
          )}

          {/* Suppression brouillon */}
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

          {/* Actions de transition de statut */}
          {actions.map(action => (
            <Button
              key={action.status}
              variant={action.variant}
              size="sm"
              className={`gap-1.5 ${action.variant === "default" ? "bg-[#2563EB] hover:bg-[#1D4ED8] text-white" : ""}`}
              onClick={() => changeStatus(action.status)}
              disabled={statusLoading}
            >
              {statusLoading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <action.icon className="w-4 h-4" />
              }
              {action.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Alerte retard */}
      {isOverdue && (
        <div className="bg-[#FEF3C7] border border-[#FCD34D] rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-[#D97706] shrink-0" />
          <p className="text-sm text-[#92400E]">
            Cette facture est <strong>en retard</strong> depuis le {formatDate(invoice.due_date)}.
          </p>
          <Button
            size="sm" variant="outline"
            className="ml-auto border-[#FCD34D] text-[#92400E] hover:bg-[#FEF3C7] shrink-0"
            onClick={() => changeStatus("overdue")} disabled={statusLoading}
          >
            <Clock className="w-3.5 h-3.5 mr-1.5" /> Marquer en retard
          </Button>
        </div>
      )}

      {/* ---- Corps de la facture ---- */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden print:shadow-none">

        {/* En-tête facture */}
        <div className="p-6 sm:p-8 border-b border-[#E2E8F0]">
          <div className="flex flex-wrap justify-between gap-6">
            {/* Émetteur (ton entreprise) */}
            <div>
              <p className="text-xs font-medium text-slate-400 mb-1">DE</p>
              <p className="text-sm font-bold text-[#0F172A]">Votre entreprise</p>
              <p className="text-xs text-slate-500 mt-0.5">Complétez dans Paramètres → Entreprise</p>
            </div>

            {/* Destinataire */}
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
              ) : (
                <p className="text-sm text-slate-400">—</p>
              )}
            </div>

            {/* Dates */}
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

        {/* Lignes de prestation */}
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
                  <td className="px-4 py-4 text-right text-sm font-mono text-slate-600">
                    {line.quantity}
                  </td>
                  <td className="px-4 py-4 text-right text-sm font-mono text-slate-600">
                    {formatCurrency(line.unit_price_ht)}
                  </td>
                  <td className="px-4 py-4 text-right text-sm font-mono text-slate-600">
                    {line.vat_rate}%
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-mono font-semibold text-[#0F172A]">
                    {formatCurrency(line.total_ht)}
                  </td>
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

      {/* ---- Infos techniques ---- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Créée le", value: formatDate(invoice.created_at) },
          { label: "Statut PPF", value: invoice.ppf_status || "Non transmise" },
          { label: "Lignes", value: `${invoice.lines?.length ?? 0} prestation${(invoice.lines?.length ?? 0) > 1 ? "s" : ""}` },
          {
            label: "Statut",
            value: INVOICE_STATUS_LABELS[invoice.status],
            color: INVOICE_STATUS_STYLES[invoice.status].text,
          },
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
  )
}
