'use client'

import Link from "next/link"
import { useParams } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft, Send, Download, Printer, FileCode, Bell,
  CheckCircle2, CreditCard, AlertTriangle, Clock
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatCurrency, formatDate, INVOICE_STATUS_LABELS } from "@/lib/utils/invoice"
import { InvoiceStatus } from "@/types"

const MOCK_INVOICES: Record<string, {
  id: string; invoice_number: string; status: InvoiceStatus
  issue_date: string; due_date: string; notes: string | null
  client: { name: string; email: string; address: string; city: string; zip_code: string; siren: string }
  lines: { description: string; quantity: number; unit_price_ht: number; vat_rate: number; total_ht: number; total_ttc: number }[]
  subtotal_ht: number; total_vat: number; total_ttc: number
}> = {
  "1": {
    id: "1", invoice_number: "F-2026-012", status: "sent",
    issue_date: "2026-03-05", due_date: "2026-04-05", notes: "Paiement à 30 jours",
    client: { name: "Renovbat SARL", email: "contact@renovbat.fr", address: "12 rue de la Paix", city: "Paris", zip_code: "75002", siren: "123456789" },
    lines: [
      { description: "Intervention technique sur site", quantity: 8, unit_price_ht: 85, vat_rate: 20, total_ht: 680, total_ttc: 816 },
      { description: "Fournitures électriques", quantity: 1, unit_price_ht: 520, vat_rate: 20, total_ht: 520, total_ttc: 624 },
      { description: "Forfait déplacement", quantity: 2, unit_price_ht: 480, vat_rate: 20, total_ht: 960, total_ttc: 960 },
    ],
    subtotal_ht: 2000, total_vat: 400, total_ttc: 2400,
  },
}

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]",
  sent: "bg-[#DBEAFE] text-[#1E40AF] border-[#93C5FD]",
  paid: "bg-[#D1FAE5] text-[#065F46] border-[#6EE7B7]",
  overdue: "bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]",
  accepted: "bg-[#D1FAE5] text-[#065F46] border-[#6EE7B7]",
  rejected: "bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]",
}

const ctaToast = () => toast("Créez un compte pour utiliser cette fonctionnalité", {
  action: { label: "S'inscrire", onClick: () => window.location.href = "/signup" },
})

export default function DemoInvoiceDetailPage() {
  const params = useParams()
  const id = params.id as string
  const invoice = MOCK_INVOICES[id] ?? MOCK_INVOICES["1"]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/demo/invoices">
            <Button variant="ghost" size="sm" className="gap-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 -ml-2">
              <ArrowLeft className="w-4 h-4" /> Factures
            </Button>
          </Link>
          <h1 className="text-lg sm:text-xl font-bold text-[#0F172A] dark:text-[#E2E8F0] font-mono">{invoice.invoice_number}</h1>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE[invoice.status] ?? STATUS_BADGE.draft}`}>
            {INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
            Factur-X
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={ctaToast}>
            <Download className="w-4 h-4" /> <span className="hidden xs:inline">PDF</span>
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0 border-[#BFDBFE] text-[#2563EB] hover:bg-[#EFF6FF]" onClick={ctaToast}>
            <FileCode className="w-4 h-4" /> <span className="hidden xs:inline">Factur-X</span>
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => window.print()}>
            <Printer className="w-4 h-4" /> <span className="hidden xs:inline">Imprimer</span>
          </Button>
          <Button size="sm" className="gap-1.5 shrink-0 bg-[#2563EB] hover:bg-[#1D4ED8] text-white" onClick={ctaToast}>
            <Send className="w-4 h-4" /> Envoyer par email
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={ctaToast}>
            <Bell className="w-4 h-4" /> <span className="hidden sm:inline">Relancer</span>
          </Button>
        </div>
      </div>

      {/* Status actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={ctaToast}>
          <CreditCard className="w-4 h-4" /> Marquer comme payée
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={ctaToast}>
          <AlertTriangle className="w-4 h-4" /> Marquer en retard
        </Button>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Invoice lines */}
          <div className="bg-white dark:bg-[#0F1E35] rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#162032]">
              <h2 className="text-sm font-semibold text-[#0F172A] dark:text-[#E2E8F0]">Lignes de facture</h2>
            </div>
            <div className="divide-y divide-[#F1F5F9] dark:divide-[#162032]">
              {invoice.lines.map((line, i) => (
                <div key={i} className="px-5 py-3.5 flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#0F172A] dark:text-[#E2E8F0]">{line.description}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {line.quantity} × {formatCurrency(line.unit_price_ht)} HT · TVA {line.vat_rate}%
                    </p>
                  </div>
                  <p className="font-mono text-sm font-semibold text-[#0F172A] dark:text-[#E2E8F0] shrink-0">
                    {formatCurrency(line.total_ht)} HT
                  </p>
                </div>
              ))}
            </div>
            {/* Totals */}
            <div className="px-5 py-4 border-t border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#162032] space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">Total HT</span>
                <span className="font-mono font-semibold text-[#0F172A] dark:text-[#E2E8F0]">{formatCurrency(invoice.subtotal_ht)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">TVA</span>
                <span className="font-mono text-slate-500 dark:text-slate-400">{formatCurrency(invoice.total_vat)}</span>
              </div>
              <div className="flex justify-between text-sm pt-1.5 border-t border-[#E2E8F0] dark:border-[#1E3A5F]">
                <span className="font-bold text-[#0F172A] dark:text-[#E2E8F0]">Total TTC</span>
                <span className="font-mono text-lg font-extrabold text-[#2563EB]">{formatCurrency(invoice.total_ttc)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="bg-white dark:bg-[#0F1E35] rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] px-5 py-4 shadow-sm">
              <h3 className="text-sm font-semibold text-[#0F172A] dark:text-[#E2E8F0] mb-1">Notes</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{invoice.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar info */}
        <div className="space-y-4">
          {/* Dates */}
          <div className="bg-white dark:bg-[#0F1E35] rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] px-5 py-4 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold text-[#0F172A] dark:text-[#E2E8F0]">Dates</h3>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-slate-500 dark:text-slate-400">Émission : {formatDate(invoice.issue_date)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-slate-500 dark:text-slate-400">Échéance : {formatDate(invoice.due_date)}</span>
            </div>
          </div>

          {/* Client */}
          <div className="bg-white dark:bg-[#0F1E35] rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] px-5 py-4 shadow-sm space-y-2">
            <h3 className="text-sm font-semibold text-[#0F172A] dark:text-[#E2E8F0]">Client</h3>
            <p className="text-sm font-medium text-[#0F172A] dark:text-[#E2E8F0]">{invoice.client.name}</p>
            <p className="text-xs text-slate-400">{invoice.client.address}</p>
            <p className="text-xs text-slate-400">{invoice.client.zip_code} {invoice.client.city}</p>
            <p className="text-xs text-[#2563EB] font-mono mt-1">{invoice.client.email}</p>
            <p className="text-xs text-slate-400 font-mono">SIREN {invoice.client.siren}</p>
          </div>

          {/* CTA */}
          <Link href="/signup" className="block">
            <div className="rounded-xl border border-[#2563EB]/20 bg-[#EFF6FF] dark:bg-[#1E3A5F]/50 px-5 py-4 text-center hover:shadow-md transition-all">
              <p className="text-sm font-bold text-[#2563EB]">Essayez Qonforme</p>
              <p className="text-xs text-[#2563EB]/70 mt-0.5">Créez vos factures conformes 2026</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
