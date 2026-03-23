'use client'

import Link from "next/link"
import { toast } from "sonner"
import {
  ArrowLeft, Send, Download, Printer, CheckCircle2, XCircle, Clock
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatCurrency, formatDate } from "@/lib/utils/invoice"

const MOCK_QUOTE = {
  id: "1", quote_number: "D-2026-006", status: "sent",
  issue_date: "2026-03-08", validity_date: "2026-04-08", notes: "Devis valable 30 jours",
  client: { name: "Renovbat SARL", email: "contact@renovbat.fr", address: "12 rue de la Paix", city: "Paris", zip_code: "75002" },
  lines: [
    { description: "Audit énergétique complet", quantity: 1, unit_price_ht: 750, vat_rate: 20, total_ht: 750, total_ttc: 900 },
    { description: "Intervention technique", quantity: 16, unit_price_ht: 85, vat_rate: 20, total_ht: 1360, total_ttc: 1632 },
    { description: "Fournitures et matériaux", quantity: 1, unit_price_ht: 2224, vat_rate: 20, total_ht: 2224, total_ttc: 2668.80 },
  ],
  subtotal_ht: 4334, total_vat: 866, total_ttc: 5200,
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon", sent: "Envoyé", accepted: "Accepté", rejected: "Refusé", expired: "Expiré",
}

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]",
  sent: "bg-[#DBEAFE] text-[#1E40AF] border-[#93C5FD]",
  accepted: "bg-[#D1FAE5] text-[#065F46] border-[#6EE7B7]",
  rejected: "bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]",
  expired: "bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]",
}

const ctaToast = () => toast("Créez un compte pour utiliser cette fonctionnalité", {
  action: { label: "S'inscrire", onClick: () => window.location.href = "/signup" },
})

export default function DemoQuoteDetailPage() {
  const quote = MOCK_QUOTE

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/demo/quotes">
            <Button variant="ghost" size="sm" className="gap-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 -ml-2">
              <ArrowLeft className="w-4 h-4" /> Devis
            </Button>
          </Link>
          <h1 className="text-lg sm:text-xl font-bold text-[#0F172A] dark:text-[#E2E8F0] font-mono">{quote.quote_number}</h1>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE[quote.status] ?? STATUS_BADGE.draft}`}>
            {STATUS_LABELS[quote.status] ?? quote.status}
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={ctaToast}>
            <Download className="w-4 h-4" /> <span className="hidden xs:inline">PDF</span>
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => window.print()}>
            <Printer className="w-4 h-4" /> <span className="hidden xs:inline">Imprimer</span>
          </Button>
          <Button size="sm" className="gap-1.5 shrink-0 bg-[#2563EB] hover:bg-[#1D4ED8] text-white" onClick={ctaToast}>
            <Send className="w-4 h-4" /> Envoyer par email
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={ctaToast}>
            <CheckCircle2 className="w-4 h-4" /> Accepter
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 border-[#FCA5A5] text-[#991B1B] hover:bg-[#FEE2E2]" onClick={ctaToast}>
            <XCircle className="w-4 h-4" /> Refuser
          </Button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Quote lines */}
          <div className="bg-white dark:bg-[#0F1E35] rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#162032]">
              <h2 className="text-sm font-semibold text-[#0F172A] dark:text-[#E2E8F0]">Lignes du devis</h2>
            </div>
            <div className="divide-y divide-[#F1F5F9] dark:divide-[#162032]">
              {quote.lines.map((line, i) => (
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
            <div className="px-5 py-4 border-t border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#162032] space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">Total HT</span>
                <span className="font-mono font-semibold text-[#0F172A] dark:text-[#E2E8F0]">{formatCurrency(quote.subtotal_ht)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">TVA</span>
                <span className="font-mono text-slate-500 dark:text-slate-400">{formatCurrency(quote.total_vat)}</span>
              </div>
              <div className="flex justify-between text-sm pt-1.5 border-t border-[#E2E8F0] dark:border-[#1E3A5F]">
                <span className="font-bold text-[#0F172A] dark:text-[#E2E8F0]">Total TTC</span>
                <span className="font-mono text-lg font-extrabold text-[#2563EB]">{formatCurrency(quote.total_ttc)}</span>
              </div>
            </div>
          </div>

          {quote.notes && (
            <div className="bg-white dark:bg-[#0F1E35] rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] px-5 py-4 shadow-sm">
              <h3 className="text-sm font-semibold text-[#0F172A] dark:text-[#E2E8F0] mb-1">Notes</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{quote.notes}</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white dark:bg-[#0F1E35] rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] px-5 py-4 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold text-[#0F172A] dark:text-[#E2E8F0]">Dates</h3>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-slate-500 dark:text-slate-400">Émission : {formatDate(quote.issue_date)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-slate-500 dark:text-slate-400">Validité : {formatDate(quote.validity_date)}</span>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0F1E35] rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] px-5 py-4 shadow-sm space-y-2">
            <h3 className="text-sm font-semibold text-[#0F172A] dark:text-[#E2E8F0]">Client</h3>
            <p className="text-sm font-medium text-[#0F172A] dark:text-[#E2E8F0]">{quote.client.name}</p>
            <p className="text-xs text-slate-400">{quote.client.address}</p>
            <p className="text-xs text-slate-400">{quote.client.zip_code} {quote.client.city}</p>
            <p className="text-xs text-[#2563EB] font-mono mt-1">{quote.client.email}</p>
          </div>

          <Link href="/signup" className="block">
            <div className="rounded-xl border border-[#2563EB]/20 bg-[#EFF6FF] dark:bg-[#1E3A5F]/50 px-5 py-4 text-center hover:shadow-md transition-all">
              <p className="text-sm font-bold text-[#2563EB]">Essayez Qonforme</p>
              <p className="text-xs text-[#2563EB]/70 mt-0.5">Créez vos devis conformes 2026</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
