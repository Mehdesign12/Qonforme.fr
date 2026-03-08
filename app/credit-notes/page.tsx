'use client'

export const dynamic = "force-dynamic"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Loader2, RotateCcw, FileX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatCurrency, formatDate } from "@/lib/utils/invoice"

interface CreditNote {
  id: string
  credit_note_number: string
  issue_date: string
  total_ttc: number
  reason: string
  client: { name: string } | null
  original_invoice: { invoice_number: string } | null
}

export default function CreditNotesPage() {
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/credit-notes")
      .then(r => r.json())
      .then(json => {
        if (json.credit_notes) setCreditNotes(json.credit_notes)
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A]">Avoirs</h1>
          <p className="text-sm text-slate-400 mt-0.5">Avoirs émis sur vos factures</p>
        </div>
      </div>

      {/* Rappel légal */}
      <div className="bg-[#FFF7ED] border border-[#FED7AA] rounded-xl px-4 py-3 flex items-start gap-3">
        <RotateCcw className="w-4 h-4 text-[#C2410C] shrink-0 mt-0.5" />
        <p className="text-xs text-[#9A3412]">
          En droit français, une facture émise ne peut pas être supprimée ni modifiée.
          Un avoir est le seul moyen légal de corriger ou annuler une facture.
          Les avoirs sont numérotés automatiquement au format <strong>AV-AAAA-NNN</strong>.
        </p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-[#2563EB] animate-spin" />
          </div>
        ) : creditNotes.length === 0 ? (
          <div className="py-16 text-center">
            <FileX className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-sm font-medium text-slate-600 mb-1">Aucun avoir émis</p>
            <p className="text-xs text-slate-400 mb-4">
              Les avoirs apparaissent ici lorsque vous en émettez depuis une facture.
            </p>
            <Link href="/invoices">
              <Button size="sm" variant="outline">Voir les factures</Button>
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">N° avoir</th>
                <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Facture originale</th>
                <th className="text-left text-xs font-medium text-slate-400 px-5 py-3 hidden sm:table-cell">Client</th>
                <th className="text-left text-xs font-medium text-slate-400 px-5 py-3 hidden md:table-cell">Date</th>
                <th className="text-left text-xs font-medium text-slate-400 px-5 py-3 hidden lg:table-cell">Motif</th>
                <th className="text-right text-xs font-medium text-slate-400 px-5 py-3">Montant</th>
                <th className="text-right text-xs font-medium text-slate-400 px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {creditNotes.map((cn) => (
                <tr
                  key={cn.id}
                  className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors last:border-0"
                >
                  <td className="px-5 py-4">
                    <Link
                      href={`/credit-notes/${cn.id}`}
                      className="font-mono text-sm text-[#C2410C] hover:underline font-medium"
                    >
                      {cn.credit_note_number}
                    </Link>
                  </td>
                  <td className="px-5 py-4">
                    {cn.original_invoice ? (
                      <span className="font-mono text-sm text-[#2563EB] font-medium">
                        {cn.original_invoice.invoice_number}
                      </span>
                    ) : (
                      <span className="text-sm text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-sm text-[#0F172A] font-medium hidden sm:table-cell">
                    {cn.client?.name || "—"}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-500 hidden md:table-cell">
                    {formatDate(cn.issue_date)}
                  </td>
                  <td className="px-5 py-4 hidden lg:table-cell">
                    <span className="text-xs text-slate-500 bg-[#F1F5F9] px-2 py-0.5 rounded-full">
                      {cn.reason}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right font-mono text-sm font-semibold text-[#C2410C]">
                    -{formatCurrency(cn.total_ttc)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link href={`/credit-notes/${cn.id}`}>
                      <Button size="sm" variant="outline" className="text-xs h-7">
                        Voir
                      </Button>
                    </Link>
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
