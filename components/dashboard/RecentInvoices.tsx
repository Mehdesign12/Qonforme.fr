import Link from "next/link"
import { formatCurrency, formatDate, INVOICE_STATUS_LABELS } from "@/lib/utils/invoice"
import { InvoiceStatus } from "@/types"

// Données mock — seront remplacées par Supabase
const MOCK_INVOICES = [
  { id: "1", invoice_number: "F-2026-012", client: { name: "Renovbat SARL" }, issue_date: "2026-03-05", total_ttc: 2400, status: "sent" as InvoiceStatus },
  { id: "2", invoice_number: "F-2026-011", client: { name: "Martin Plomberie" }, issue_date: "2026-03-02", total_ttc: 850, status: "paid" as InvoiceStatus },
  { id: "3", invoice_number: "F-2026-010", client: { name: "Électricité Dupont" }, issue_date: "2026-02-28", total_ttc: 1650, status: "overdue" as InvoiceStatus },
  { id: "4", invoice_number: "F-2026-009", client: { name: "Maçonnerie Bernard" }, issue_date: "2026-02-20", total_ttc: 3200, status: "accepted" as InvoiceStatus },
  { id: "5", invoice_number: "F-2026-008", client: { name: "Peinture Leblanc" }, issue_date: "2026-02-15", total_ttc: 950, status: "draft" as InvoiceStatus },
]

const STATUS_STYLE: Record<InvoiceStatus, string> = {
  draft:    "bg-[#F1F5F9] text-[#475569]",
  sent:     "bg-[#DBEAFE] text-[#1E40AF]",
  pending:  "bg-[#FEF3C7] text-[#92400E]",
  received: "bg-[#EDE9FE] text-[#5B21B6]",
  accepted: "bg-[#D1FAE5] text-[#065F46]",
  rejected: "bg-[#FEE2E2] text-[#991B1B]",
  paid:     "bg-[#D1FAE5] text-[#065F46]",
  overdue:  "bg-[#FEE2E2] text-[#991B1B]",
}

export async function RecentInvoices() {
  const invoices = MOCK_INVOICES

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden shadow-sm">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#E2E8F0]">
            <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">N° facture</th>
            <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Client</th>
            <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Date</th>
            <th className="text-right text-xs font-medium text-slate-400 px-5 py-3">Montant TTC</th>
            <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Statut</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr key={inv.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors">
              <td className="px-5 py-3.5">
                <Link href={`/invoices/${inv.id}`} className="font-mono text-sm text-[#2563EB] hover:underline font-medium">
                  {inv.invoice_number}
                </Link>
              </td>
              <td className="px-5 py-3.5 text-sm text-[#0F172A]">{inv.client?.name}</td>
              <td className="px-5 py-3.5 text-sm text-slate-500">{formatDate(inv.issue_date)}</td>
              <td className="px-5 py-3.5 text-right font-mono text-sm font-semibold text-[#0F172A]">
                {formatCurrency(inv.total_ttc)}
              </td>
              <td className="px-5 py-3.5">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[inv.status]}`}>
                  {INVOICE_STATUS_LABELS[inv.status]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-5 py-3 border-t border-[#E2E8F0]">
        <Link href="/invoices" className="text-sm text-[#2563EB] hover:underline font-medium">
          Voir toutes les factures →
        </Link>
      </div>
    </div>
  )
}
