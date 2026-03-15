export const dynamic = "force-dynamic"

import { formatCurrency, formatDate } from "@/lib/utils/invoice"

type POStatus = "draft" | "sent" | "confirmed" | "cancelled"

const PO_STATUS_LABELS: Record<POStatus, string> = {
  draft:     "Brouillon",
  sent:      "Envoyé",
  confirmed: "Confirmé",
  cancelled: "Annulé",
}

const STATUS_STYLE: Record<POStatus, string> = {
  draft:     "bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]",
  sent:      "bg-[#DBEAFE] text-[#1E40AF] border-[#93C5FD]",
  confirmed: "bg-[#D1FAE5] text-[#065F46] border-[#6EE7B7]",
  cancelled: "bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]",
}

const MOCK_POS = [
  { id: "1", po_number: "BC-2026-004", client: "Renovbat SARL",         issue_date: "2026-03-06", delivery_date: "2026-03-20", total_ttc: 3600,  status: "confirmed" as POStatus },
  { id: "2", po_number: "BC-2026-003", client: "Électricité Dupont",    issue_date: "2026-02-22", delivery_date: "2026-03-10", total_ttc: 1980,  status: "sent"      as POStatus },
  { id: "3", po_number: "BC-2026-002", client: "Fournitures Leclerc Pro", issue_date: "2026-02-14", delivery_date: "2026-03-05", total_ttc: 850, status: "draft"     as POStatus },
  { id: "4", po_number: "BC-2026-001", client: "Martin Plomberie",      issue_date: "2026-01-28", delivery_date: "2026-02-15", total_ttc: 2400,  status: "cancelled" as POStatus },
]

export default function DemoPurchaseOrdersPage() {
  return (
    <div className="space-y-5 animate-fade-in">
      {/* Filtres rapides */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["all", "draft", "sent", "confirmed", "cancelled"] as const).map((s) => (
          <button key={s} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            s === "all"
              ? "bg-[#4F46E5] text-white border-[#4F46E5]"
              : "bg-white text-slate-600 border-[#E2E8F0] hover:border-[#4F46E5] hover:text-[#4F46E5]"
          }`}>
            {s === "all" ? "Tous" : PO_STATUS_LABELS[s as POStatus]}
          </button>
        ))}
      </div>

      {/* Vue mobile : cards */}
      <div className="sm:hidden space-y-3">
        {MOCK_POS.map((po) => (
          <div key={po.id} className="bg-white rounded-xl border border-[#E2E8F0] px-4 py-3.5 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-sm text-[#4F46E5] font-bold">{po.po_number}</span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLE[po.status]}`}>
                {PO_STATUS_LABELS[po.status]}
              </span>
            </div>
            <p className="text-sm font-medium text-[#0F172A]">{po.client}</p>
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-xs text-slate-400">Livraison le {formatDate(po.delivery_date)}</p>
              <p className="font-mono text-sm font-semibold text-[#0F172A]">{formatCurrency(po.total_ttc)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Vue desktop : table */}
      <div className="hidden sm:block bg-white rounded-xl border border-[#E2E8F0] overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">N° bon de commande</th>
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Client / Fournisseur</th>
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Émission</th>
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Livraison prévue</th>
              <th className="text-right text-xs font-medium text-slate-400 px-5 py-3">Montant TTC</th>
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Statut</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_POS.map((po) => (
              <tr key={po.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors last:border-0">
                <td className="px-5 py-4">
                  <span className="font-mono text-sm text-[#4F46E5] font-bold">{po.po_number}</span>
                </td>
                <td className="px-5 py-4 text-sm text-[#0F172A] font-medium">{po.client}</td>
                <td className="px-5 py-4 text-sm text-slate-500">{formatDate(po.issue_date)}</td>
                <td className="px-5 py-4 text-sm text-slate-500">{formatDate(po.delivery_date)}</td>
                <td className="px-5 py-4 text-right font-mono text-sm font-semibold text-[#0F172A]">
                  {formatCurrency(po.total_ttc)}
                </td>
                <td className="px-5 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLE[po.status]}`}>
                    {PO_STATUS_LABELS[po.status]}
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
