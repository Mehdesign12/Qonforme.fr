'use client'

export const dynamic = "force-dynamic"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { formatCurrency, formatDate, INVOICE_STATUS_LABELS } from "@/lib/utils/invoice"
import { InvoiceStatus } from "@/types"
import { Plus, Loader2, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"

const STATUS_STYLE: Record<InvoiceStatus, string> = {
  draft:    "bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]",
  sent:     "bg-[#DBEAFE] text-[#1E40AF] border-[#93C5FD]",
  pending:  "bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]",
  received: "bg-[#EDE9FE] text-[#5B21B6] border-[#C4B5FD]",
  accepted: "bg-[#D1FAE5] text-[#065F46] border-[#6EE7B7]",
  rejected: "bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]",
  paid:     "bg-[#D1FAE5] text-[#065F46] border-[#6EE7B7]",
  overdue:  "bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]",
}

type StatusFilter = "all" | InvoiceStatus

interface Invoice {
  id: string
  invoice_number: string
  status: InvoiceStatus
  issue_date: string
  due_date: string
  total_ttc: number
  client: { name: string } | null
}

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "draft", label: "Brouillons" },
  { key: "sent", label: "Envoyées" },
  { key: "pending", label: "En attente" },
  { key: "overdue", label: "En retard" },
  { key: "paid", label: "Payées" },
]

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("all")

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    const url = activeFilter === "all" ? "/api/invoices" : `/api/invoices?status=${activeFilter}`
    const res = await fetch(url)
    const json = await res.json()
    if (json.invoices) setInvoices(json.invoices)
    setLoading(false)
  }, [activeFilter])

  useEffect(() => {
    fetchInvoices()
  }, [fetchInvoices])

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                activeFilter === f.key
                  ? "bg-[#2563EB] text-white border-[#2563EB]"
                  : "bg-white text-slate-600 border-[#E2E8F0] hover:border-[#2563EB] hover:text-[#2563EB]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Link href="/invoices/new">
          <Button className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white gap-2">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nouvelle facture</span>
          </Button>
        </Link>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-[#2563EB] animate-spin" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="py-16 text-center">
            <FileText className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-sm font-medium text-slate-600 mb-1">
              {activeFilter === "all" ? "Aucune facture pour l'instant" : `Aucune facture avec le statut "${INVOICE_STATUS_LABELS[activeFilter as InvoiceStatus]}"`}
            </p>
            {activeFilter === "all" && (
              <>
                <p className="text-xs text-slate-400 mb-4">Créez votre première facture en quelques clics</p>
                <Link href="/invoices/new">
                  <Button size="sm" className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white">
                    Créer une facture
                  </Button>
                </Link>
              </>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">N° facture</th>
                <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Client</th>
                <th className="text-left text-xs font-medium text-slate-400 px-5 py-3 hidden sm:table-cell">Émission</th>
                <th className="text-left text-xs font-medium text-slate-400 px-5 py-3 hidden md:table-cell">Échéance</th>
                <th className="text-right text-xs font-medium text-slate-400 px-5 py-3">Montant TTC</th>
                <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors last:border-0">
                  <td className="px-5 py-4">
                    <Link href={`/invoices/${inv.id}`} className="font-mono text-sm text-[#2563EB] hover:underline font-medium">
                      {inv.invoice_number}
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-sm text-[#0F172A] font-medium">
                    {inv.client?.name || "—"}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-500 hidden sm:table-cell">
                    {formatDate(inv.issue_date)}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-500 hidden md:table-cell">
                    {formatDate(inv.due_date)}
                  </td>
                  <td className="px-5 py-4 text-right font-mono text-sm font-semibold text-[#0F172A]">
                    {formatCurrency(inv.total_ttc)}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLE[inv.status]}`}>
                      {INVOICE_STATUS_LABELS[inv.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
