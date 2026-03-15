export const dynamic = "force-dynamic"

import { formatCurrency, formatDate } from "@/lib/utils/invoice"

type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "expired"

const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft:    "Brouillon",
  sent:     "Envoyé",
  accepted: "Accepté",
  rejected: "Refusé",
  expired:  "Expiré",
}

const STATUS_STYLE: Record<QuoteStatus, string> = {
  draft:    "bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]",
  sent:     "bg-[#DBEAFE] text-[#1E40AF] border-[#93C5FD]",
  accepted: "bg-[#D1FAE5] text-[#065F46] border-[#6EE7B7]",
  rejected: "bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]",
  expired:  "bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]",
}

const MOCK_QUOTES = [
  { id: "1", quote_number: "D-2026-006", client: "Renovbat SARL",      issue_date: "2026-03-08", validity_date: "2026-04-08", total_ttc: 5200, status: "sent"     as QuoteStatus },
  { id: "2", quote_number: "D-2026-005", client: "Électricité Dupont", issue_date: "2026-02-25", validity_date: "2026-03-25", total_ttc: 3800, status: "accepted"  as QuoteStatus },
  { id: "3", quote_number: "D-2026-004", client: "Martin Plomberie",   issue_date: "2026-02-18", validity_date: "2026-03-18", total_ttc: 1250, status: "draft"     as QuoteStatus },
  { id: "4", quote_number: "D-2026-003", client: "Peinture Leblanc",   issue_date: "2026-01-30", validity_date: "2026-03-01", total_ttc: 4600, status: "expired"   as QuoteStatus },
  { id: "5", quote_number: "D-2026-002", client: "Toiture Martin",     issue_date: "2026-01-20", validity_date: "2026-02-20", total_ttc: 7200, status: "accepted"  as QuoteStatus },
  { id: "6", quote_number: "D-2026-001", client: "Maçonnerie Bernard", issue_date: "2026-01-10", validity_date: "2026-02-10", total_ttc: 2100, status: "rejected"  as QuoteStatus },
]

export default function DemoQuotesPage() {
  return (
    <div className="space-y-5 animate-fade-in">
      {/* Filtres rapides */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["all", "draft", "sent", "accepted", "rejected"] as const).map((s) => (
          <button key={s} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            s === "all"
              ? "bg-[#2563EB] text-white border-[#2563EB]"
              : "bg-white text-slate-600 border-[#E2E8F0] hover:border-[#2563EB] hover:text-[#2563EB]"
          }`}>
            {s === "all" ? "Tous" : QUOTE_STATUS_LABELS[s as QuoteStatus]}
          </button>
        ))}
      </div>

      {/* Vue mobile : cards */}
      <div className="sm:hidden space-y-3">
        {MOCK_QUOTES.map((q) => {
          const styleClass = STATUS_STYLE[q.status]
          return (
            <div key={q.id} className="bg-white rounded-xl border border-[#E2E8F0] px-4 py-3.5 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-sm text-[#2563EB] font-bold">{q.quote_number}</span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styleClass}`}>
                  {QUOTE_STATUS_LABELS[q.status]}
                </span>
              </div>
              <p className="text-sm font-medium text-[#0F172A]">{q.client}</p>
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-xs text-slate-400">Valable jusqu&apos;au {formatDate(q.validity_date)}</p>
                <p className="font-mono text-sm font-semibold text-[#0F172A]">{formatCurrency(q.total_ttc)}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Vue desktop : table */}
      <div className="hidden sm:block bg-white rounded-xl border border-[#E2E8F0] overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">N° devis</th>
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Client</th>
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Émission</th>
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Validité</th>
              <th className="text-right text-xs font-medium text-slate-400 px-5 py-3">Montant TTC</th>
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Statut</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_QUOTES.map((q) => (
              <tr key={q.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors last:border-0">
                <td className="px-5 py-4">
                  <span className="font-mono text-sm text-[#2563EB] font-bold">{q.quote_number}</span>
                </td>
                <td className="px-5 py-4 text-sm text-[#0F172A] font-medium">{q.client}</td>
                <td className="px-5 py-4 text-sm text-slate-500">{formatDate(q.issue_date)}</td>
                <td className="px-5 py-4 text-sm text-slate-500">{formatDate(q.validity_date)}</td>
                <td className="px-5 py-4 text-right font-mono text-sm font-semibold text-[#0F172A]">
                  {formatCurrency(q.total_ttc)}
                </td>
                <td className="px-5 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLE[q.status]}`}>
                    {QUOTE_STATUS_LABELS[q.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
