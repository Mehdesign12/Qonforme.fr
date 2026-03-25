'use client'

export const dynamic = "force-dynamic"

import Link from "next/link"
import { formatCurrency, formatDate, INVOICE_STATUS_LABELS } from "@/lib/utils/invoice"
import { InvoiceStatus } from "@/types"

const MOCK_INVOICES = [
  { id: "1", invoice_number: "F-2026-012", client: { name: "Renovbat SARL" },      issue_date: "2026-03-05", due_date: "2026-04-05", total_ttc: 2400, status: "sent"     as InvoiceStatus },
  { id: "2", invoice_number: "F-2026-011", client: { name: "Martin Plomberie" },   issue_date: "2026-03-02", due_date: "2026-04-02", total_ttc: 850,  status: "paid"     as InvoiceStatus },
  { id: "3", invoice_number: "F-2026-010", client: { name: "Électricité Dupont" }, issue_date: "2026-02-28", due_date: "2026-03-28", total_ttc: 1650, status: "overdue"  as InvoiceStatus },
  { id: "4", invoice_number: "F-2026-009", client: { name: "Maçonnerie Bernard" }, issue_date: "2026-02-20", due_date: "2026-03-20", total_ttc: 3200, status: "accepted" as InvoiceStatus },
  { id: "5", invoice_number: "F-2026-008", client: { name: "Peinture Leblanc" },   issue_date: "2026-02-15", due_date: "2026-03-15", total_ttc: 950,  status: "draft"    as InvoiceStatus },
  { id: "6", invoice_number: "F-2026-007", client: { name: "Toiture Martin" },     issue_date: "2026-02-10", due_date: "2026-03-10", total_ttc: 4800, status: "paid"     as InvoiceStatus },
  { id: "7", invoice_number: "F-2026-006", client: { name: "Renovbat SARL" },      issue_date: "2026-01-28", due_date: "2026-02-28", total_ttc: 1200, status: "rejected" as InvoiceStatus },
]

const STATUS_STYLE: Record<InvoiceStatus, string> = {
  draft:     "bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]",
  sent:      "bg-[#DBEAFE] text-[#1E40AF] border-[#93C5FD]",
  pending:   "bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]",
  received:  "bg-[#EDE9FE] text-[#5B21B6] border-[#C4B5FD]",
  accepted:  "bg-[#D1FAE5] text-[#065F46] border-[#6EE7B7]",
  rejected:  "bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]",
  paid:      "bg-[#D1FAE5] text-[#065F46] border-[#6EE7B7]",
  overdue:   "bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]",
  cancelled: "bg-[#F1F5F9] text-[#64748B] border-[#CBD5E1]",
  credited:  "bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]",
}

const AVATAR_COLORS = [
  ['#EFF6FF', '#2563EB'],
  ['#F5F3FF', '#7C3AED'],
  ['#ECFEFF', '#0891B2'],
  ['#ECFDF5', '#059669'],
  ['#FFF7ED', '#EA580C'],
]

function ClientAvatar({ name, index }: { name: string; index: number }) {
  const [bg, text] = AVATAR_COLORS[index % AVATAR_COLORS.length]
  const initials = name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('')
  return (
    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-bold shrink-0"
      style={{ background: bg, color: text }}>
      {initials || '?'}
    </div>
  )
}

export default function DemoInvoicesPage() {
  return (
    <div className="space-y-5 animate-fade-in">
      {/* Filtres rapides */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["all", "draft", "sent", "pending", "overdue", "paid"] as const).map((s) => (
          <button key={s} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            s === "all"
              ? "bg-[#2563EB] text-white border-[#2563EB]"
              : "bg-white dark:bg-[#162032] text-slate-600 dark:text-slate-400 border-[#E2E8F0] dark:border-[#1E3A5F] hover:border-[#2563EB] hover:text-[#2563EB]"
          }`}>
            {s === "all" ? "Toutes" : INVOICE_STATUS_LABELS[s as InvoiceStatus]}
          </button>
        ))}
      </div>

      {/* Vue mobile : cards */}
      <div className="sm:hidden space-y-3">
        {MOCK_INVOICES.map((inv, i) => (
          <Link key={inv.id} href={`/demo/invoices/${inv.id}`}>
            <div className="bg-white dark:bg-[#0F1E35] rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] px-4 py-3.5 shadow-sm">
              <div className="flex items-center gap-3">
                <ClientAvatar name={inv.client.name} index={i} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-[12px] font-bold text-[#2563EB]">{inv.invoice_number}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_STYLE[inv.status]}`}>
                      {INVOICE_STATUS_LABELS[inv.status]}
                    </span>
                  </div>
                  <p className="text-[12px] text-slate-500 dark:text-slate-400 truncate">{inv.client.name}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono text-[13px] font-bold text-[#0F172A] dark:text-[#E2E8F0]">{formatCurrency(inv.total_ttc)}</p>
                  <p className="text-[10px] text-slate-300 dark:text-slate-500 mt-0.5">éch. {formatDate(inv.due_date)}</p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Vue desktop : table */}
      <div className="hidden sm:block bg-white dark:bg-[#0F1E35] rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#162032]">
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">N° facture</th>
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Client</th>
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Émission</th>
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Échéance</th>
              <th className="text-right text-xs font-medium text-slate-400 px-5 py-3">Montant TTC</th>
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Statut</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_INVOICES.map((inv, i) => (
              <tr key={inv.id} className="border-b border-[#F1F5F9] dark:border-[#162032] hover:bg-[#F8FAFC] dark:hover:bg-[#162032] transition-colors last:border-0 cursor-pointer"
                onClick={() => window.location.href = `/demo/invoices/${inv.id}`}>
                <td className="px-5 py-4">
                  <span className="font-mono text-sm text-[#2563EB] font-bold">{inv.invoice_number}</span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2.5">
                    <ClientAvatar name={inv.client.name} index={i} />
                    <span className="text-sm text-[#0F172A] dark:text-[#E2E8F0] font-medium">{inv.client.name}</span>
                  </div>
                </td>
                <td className="px-5 py-4 text-sm text-slate-500 dark:text-slate-400">{formatDate(inv.issue_date)}</td>
                <td className="px-5 py-4 text-sm text-slate-500 dark:text-slate-400">{formatDate(inv.due_date)}</td>
                <td className="px-5 py-4 text-right font-mono text-sm font-semibold text-[#0F172A] dark:text-[#E2E8F0]">
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
