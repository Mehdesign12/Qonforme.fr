import type { Metadata } from "next"
import Link from "next/link"
import { formatCurrency, formatDate, INVOICE_STATUS_LABELS } from "@/lib/utils/invoice"
import { InvoiceStatus } from "@/types"

export const metadata: Metadata = { title: "Factures" }
export const dynamic = "force-dynamic"

// Mock data — remplacé par Supabase
const MOCK_INVOICES = [
  { id: "1", invoice_number: "F-2026-012", client: { name: "Renovbat SARL" }, issue_date: "2026-03-05", due_date: "2026-04-05", total_ttc: 2400, status: "sent" as InvoiceStatus },
  { id: "2", invoice_number: "F-2026-011", client: { name: "Martin Plomberie" }, issue_date: "2026-03-02", due_date: "2026-04-02", total_ttc: 850, status: "paid" as InvoiceStatus },
  { id: "3", invoice_number: "F-2026-010", client: { name: "Électricité Dupont" }, issue_date: "2026-02-28", due_date: "2026-03-28", total_ttc: 1650, status: "overdue" as InvoiceStatus },
  { id: "4", invoice_number: "F-2026-009", client: { name: "Maçonnerie Bernard" }, issue_date: "2026-02-20", due_date: "2026-03-20", total_ttc: 3200, status: "accepted" as InvoiceStatus },
  { id: "5", invoice_number: "F-2026-008", client: { name: "Peinture Leblanc" }, issue_date: "2026-02-15", due_date: "2026-03-15", total_ttc: 950, status: "draft" as InvoiceStatus },
]

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

export default function InvoicesPage() {
  return (
    <div className="space-y-5 animate-fade-in">
      {/* Filtres rapides par statut */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["all", "draft", "sent", "pending", "overdue", "paid"] as const).map((s) => (
          <button
            key={s}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              s === "all"
                ? "bg-[#2563EB] text-white border-[#2563EB]"
                : "bg-white text-slate-600 border-[#E2E8F0] hover:border-[#2563EB] hover:text-[#2563EB]"
            }`}
          >
            {s === "all" ? "Toutes" : INVOICE_STATUS_LABELS[s as InvoiceStatus]}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">N° facture</th>
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Client</th>
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Émission</th>
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Échéance</th>
              <th className="text-right text-xs font-medium text-slate-400 px-5 py-3">Montant TTC</th>
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Statut</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_INVOICES.map((inv) => (
              <tr key={inv.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors last:border-0">
                <td className="px-5 py-4">
                  <Link href={`/invoices/${inv.id}`} className="font-mono text-sm text-[#2563EB] hover:underline font-medium">
                    {inv.invoice_number}
                  </Link>
                </td>
                <td className="px-5 py-4 text-sm text-[#0F172A] font-medium">{inv.client?.name}</td>
                <td className="px-5 py-4 text-sm text-slate-500">{formatDate(inv.issue_date)}</td>
                <td className="px-5 py-4 text-sm text-slate-500">{formatDate(inv.due_date)}</td>
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
      </div>
    </div>
  )
}
