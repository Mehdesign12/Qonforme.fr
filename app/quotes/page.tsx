'use client'

export const dynamic = "force-dynamic"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { formatCurrency, formatDate } from "@/lib/utils/invoice"
import { Plus, Loader2, FileCheck2 } from "lucide-react"
import { Button } from "@/components/ui/button"

type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "expired"

const STATUS_STYLE: Record<QuoteStatus, string> = {
  draft:    "bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]",
  sent:     "bg-[#DBEAFE] text-[#1E40AF] border-[#93C5FD]",
  accepted: "bg-[#D1FAE5] text-[#065F46] border-[#6EE7B7]",
  rejected: "bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]",
  expired:  "bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]",
}

const STATUS_LABELS: Record<QuoteStatus, string> = {
  draft:    "Brouillon",
  sent:     "Envoyé",
  accepted: "Accepté",
  rejected: "Refusé",
  expired:  "Expiré",
}

type Filter = "all" | QuoteStatus

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all",      label: "Tous" },
  { key: "draft",    label: "Brouillons" },
  { key: "sent",     label: "Envoyés" },
  { key: "accepted", label: "Acceptés" },
  { key: "rejected", label: "Refusés" },
]

interface Quote {
  id: string
  quote_number: string
  status: QuoteStatus
  issue_date: string
  valid_until: string
  total_ttc: number
  converted_invoice_id: string | null
  client: { name: string } | null
}

export default function QuotesPage() {
  const [quotes, setQuotes]             = useState<Quote[]>([])
  const [loading, setLoading]           = useState(true)
  const [activeFilter, setActiveFilter] = useState<Filter>("all")

  const fetchQuotes = useCallback(async () => {
    setLoading(true)
    const url = activeFilter === "all" ? "/api/quotes" : `/api/quotes?status=${activeFilter}`
    const res  = await fetch(url)
    const json = await res.json()
    if (json.quotes) setQuotes(json.quotes)
    setLoading(false)
  }, [activeFilter])

  useEffect(() => { fetchQuotes() }, [fetchQuotes])

  return (
    <div className="space-y-4 animate-fade-in">

      {/* Filtres + CTA */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                activeFilter === f.key
                  ? "bg-[#0f9457] text-white border-[#0f9457]"
                  : "bg-white text-slate-600 border-[#E2E8F0] hover:border-[#0f9457] hover:text-[#0f9457]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Link href="/quotes/new">
          <Button className="bg-[#0f9457] hover:bg-[#0a7a47] text-white gap-2 shrink-0">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nouveau devis</span>
          </Button>
        </Link>
      </div>

      {/* Contenu */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-[#0f9457] animate-spin" />
          </div>
        ) : quotes.length === 0 ? (
          <div className="py-16 text-center">
            <FileCheck2 className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-sm font-medium text-slate-600 mb-1">
              {activeFilter === "all" ? "Aucun devis pour l'instant" : `Aucun devis "${STATUS_LABELS[activeFilter as QuoteStatus]}"`}
            </p>
            {activeFilter === "all" && (
              <>
                <p className="text-xs text-slate-400 mb-4">Créez votre premier devis en quelques clics</p>
                <Link href="/quotes/new">
                  <Button size="sm" className="bg-[#0f9457] hover:bg-[#0a7a47] text-white">Créer un devis</Button>
                </Link>
              </>
            )}
          </div>
        ) : (
          <>
            {/* ── Mobile : cards ── */}
            <div className="sm:hidden divide-y divide-[#F1F5F9]">
              {quotes.map((q) => (
                <Link
                  key={q.id}
                  href={`/quotes/${q.id}`}
                  className="flex items-center justify-between px-4 py-3.5 hover:bg-[#F8FAFC] transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-sm text-[#0f9457] font-medium">{q.quote_number}</span>
                      {q.converted_invoice_id && (
                        <span className="text-[10px] bg-[#D1FAE5] text-[#065F46] px-1.5 py-0.5 rounded font-medium">Converti</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{q.client?.name || "—"}</p>
                  </div>
                  <div className="text-right ml-3 shrink-0">
                    <p className="font-mono text-sm font-semibold text-[#0F172A]">{formatCurrency(q.total_ttc)}</p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border mt-1 ${STATUS_STYLE[q.status]}`}>
                      {STATUS_LABELS[q.status]}
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            {/* ── Desktop : table ── */}
            <table className="hidden sm:table w-full">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">N° devis</th>
                  <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Client</th>
                  <th className="text-left text-xs font-medium text-slate-400 px-5 py-3 hidden md:table-cell">Émission</th>
                  <th className="text-left text-xs font-medium text-slate-400 px-5 py-3 hidden lg:table-cell">Validité</th>
                  <th className="text-right text-xs font-medium text-slate-400 px-5 py-3">Montant TTC</th>
                  <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Statut</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr
                    key={q.id}
                    onClick={() => window.location.href = `/quotes/${q.id}`}
                    className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors last:border-0 cursor-pointer"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-[#0f9457] font-medium">{q.quote_number}</span>
                        {q.converted_invoice_id && (
                          <span className="text-[10px] bg-[#D1FAE5] text-[#065F46] px-1.5 py-0.5 rounded font-medium">Converti</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-[#0F172A] font-medium">{q.client?.name || "—"}</td>
                    <td className="px-5 py-4 text-sm text-slate-500 hidden md:table-cell">{formatDate(q.issue_date)}</td>
                    <td className="px-5 py-4 text-sm hidden lg:table-cell">
                      <span className={new Date(q.valid_until) < new Date() && q.status === "sent" ? "text-[#EF4444] font-medium" : "text-slate-500"}>
                        {formatDate(q.valid_until)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right font-mono text-sm font-semibold text-[#0F172A]">{formatCurrency(q.total_ttc)}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLE[q.status]}`}>
                        {STATUS_LABELS[q.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  )
}
