'use client'

export const dynamic = "force-dynamic"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { formatCurrency, formatDate } from "@/lib/utils/invoice"
import { Plus, Loader2, FileCheck2, ChevronRight } from "lucide-react"

type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "expired"

const STATUS_STYLE: Record<QuoteStatus, { bg: string; text: string; dot: string }> = {
  draft:    { bg: "#F1F5F9", text: "#475569", dot: "#94A3B8" },
  sent:     { bg: "#DBEAFE", text: "#1E40AF", dot: "#3B82F6" },
  accepted: { bg: "#D1FAE5", text: "#065F46", dot: "#10B981" },
  rejected: { bg: "#FEE2E2", text: "#991B1B", dot: "#EF4444" },
  expired:  { bg: "#FEF3C7", text: "#92400E", dot: "#D97706" },
}

const STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Brouillon", sent: "Envoyé", accepted: "Accepté", rejected: "Refusé", expired: "Expiré",
}

function StatusBadge({ status }: { status: QuoteStatus }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.draft
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: s.dot }} />
      {STATUS_LABELS[status]}
    </span>
  )
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
  id: string; quote_number: string; status: QuoteStatus
  issue_date: string; valid_until: string; total_ttc: number
  converted_invoice_id: string | null; client: { name: string } | null
}

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.85)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  boxShadow: '0 2px 16px rgba(15,148,87,0.06)',
}

const ACCENT = "#059669"
const ACCENT_HOVER = "#047857"

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
    <div className="space-y-4 max-w-[1200px] mx-auto">

      <div className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 w-full sm:w-auto" style={{ scrollbarWidth: 'none' }}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all whitespace-nowrap ${
                activeFilter === f.key
                  ? "text-white border-transparent shadow-sm"
                  : "bg-white/80 text-slate-600 border-[#E2E8F0] hover:border-[#059669] hover:text-[#059669]"
              }`}
              style={activeFilter === f.key ? { backgroundColor: ACCENT, borderColor: ACCENT } : {}}
            >
              {f.label}
            </button>
          ))}
        </div>

        <Link href="/quotes/new" className="shrink-0 w-full sm:w-auto">
          <button
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-xl transition-colors shadow-sm"
            style={{ backgroundColor: ACCENT }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = ACCENT_HOVER)}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = ACCENT)}
          >
            <Plus className="w-4 h-4" />
            Nouveau devis
          </button>
        </Link>
      </div>

      <div className="rounded-2xl border border-white/60 overflow-hidden" style={cardStyle}>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: ACCENT }} />
          </div>
        ) : quotes.length === 0 ? (
          <div className="py-20 text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-[#ECFDF5] flex items-center justify-center mx-auto mb-4">
              <FileCheck2 className="w-6 h-6" style={{ color: ACCENT }} />
            </div>
            <p className="text-[15px] font-bold text-[#0F172A] mb-1">
              {activeFilter === "all" ? "Aucun devis pour l'instant" : `Aucun devis "${STATUS_LABELS[activeFilter as QuoteStatus]}"`}
            </p>
            {activeFilter === "all" && (
              <>
                <p className="text-sm text-slate-400 mb-5">Créez votre premier devis en quelques clics</p>
                <Link href="/quotes/new">
                  <button
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white rounded-xl transition-colors"
                    style={{ backgroundColor: ACCENT }}
                  >
                    <Plus className="w-4 h-4" />
                    Créer un devis
                  </button>
                </Link>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Mobile */}
            <div className="sm:hidden divide-y divide-[#F8FAFC]">
              {quotes.map((q) => (
                <Link key={q.id} href={`/quotes/${q.id}`}
                  className="flex items-center justify-between px-4 py-4 hover:bg-[#F8FAFC] active:bg-[#ECFDF5] transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[13px] font-bold" style={{ color: ACCENT }}>{q.quote_number}</span>
                      {q.converted_invoice_id && (
                        <span className="text-[10px] bg-[#D1FAE5] text-[#065F46] px-1.5 py-0.5 rounded-full font-bold">Converti</span>
                      )}
                      <StatusBadge status={q.status} />
                    </div>
                    <p className="text-[12px] text-slate-500 truncate">{q.client?.name || "—"}</p>
                    <p className="text-[11px] text-slate-300 mt-0.5">Validité : {formatDate(q.valid_until)}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <p className="font-mono text-[14px] font-bold text-[#0F172A]">{formatCurrency(q.total_ttc)}</p>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop */}
            <table className="hidden sm:table w-full">
              <thead>
                <tr className="border-b border-[#F8FAFC] bg-[#FAFBFC]/60">
                  {["N° devis", "Client", "Émission", "Validité", "Montant TTC", "Statut"].map((h, i) => (
                    <th key={h} className={`text-left text-[10px] font-bold uppercase tracking-wider text-slate-300 px-5 py-3.5 ${
                      i === 2 ? "hidden md:table-cell" : i === 3 ? "hidden lg:table-cell" : i === 4 ? "text-right" : ""
                    }`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr key={q.id} onClick={() => window.location.href = `/quotes/${q.id}`}
                    className="border-b border-[#F8FAFC] hover:bg-[#F8FAFC]/70 transition-colors last:border-0 cursor-pointer"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[13px] font-bold" style={{ color: ACCENT }}>{q.quote_number}</span>
                        {q.converted_invoice_id && (
                          <span className="text-[10px] bg-[#D1FAE5] text-[#065F46] px-1.5 py-0.5 rounded-full font-bold">Converti</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-[13px] font-medium text-[#0F172A]">{q.client?.name || "—"}</td>
                    <td className="px-5 py-3.5 text-[12px] text-slate-400 hidden md:table-cell">{formatDate(q.issue_date)}</td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      <span className={`text-[12px] ${new Date(q.valid_until) < new Date() && q.status === "sent" ? "text-[#EF4444] font-semibold" : "text-slate-400"}`}>
                        {formatDate(q.valid_until)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-[13px] font-bold text-[#0F172A]">{formatCurrency(q.total_ttc)}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={q.status} /></td>
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
