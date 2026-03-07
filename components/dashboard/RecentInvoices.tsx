import Link from "next/link"
import { formatCurrency, formatDate, INVOICE_STATUS_LABELS } from "@/lib/utils/invoice"
import { InvoiceStatus } from "@/types"
import { createClient } from "@/lib/supabase/server"
import { FileText } from "lucide-react"

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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: invoices } = await supabase
    .from("invoices")
    .select(`id, invoice_number, status, issue_date, total_ttc, client:clients(name)`)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5)

  if (!invoices || invoices.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-12 shadow-sm text-center">
        <FileText className="w-12 h-12 text-slate-200 mx-auto mb-4" />
        <p className="text-sm font-medium text-slate-600 mb-1">Aucune facture pour l&apos;instant</p>
        <p className="text-xs text-slate-400 mb-4">Créez votre première facture pour commencer</p>
        <Link
          href="/invoices/new"
          className="inline-flex items-center px-4 py-2 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1D4ED8] transition-colors"
        >
          Créer une facture
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden shadow-sm">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#E2E8F0]">
            <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">N° facture</th>
            <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Client</th>
            <th className="text-left text-xs font-medium text-slate-400 px-5 py-3 hidden sm:table-cell">Date</th>
            <th className="text-right text-xs font-medium text-slate-400 px-5 py-3">Montant TTC</th>
            <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Statut</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr key={inv.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors last:border-0">
              <td className="px-5 py-3.5">
                <Link href={`/invoices/${inv.id}`} className="font-mono text-sm text-[#2563EB] hover:underline font-medium">
                  {inv.invoice_number}
                </Link>
              </td>
              <td className="px-5 py-3.5 text-sm text-[#0F172A]">
                {(inv.client as unknown as { name: string } | null)?.name || "—"}
              </td>
              <td className="px-5 py-3.5 text-sm text-slate-500 hidden sm:table-cell">
                {formatDate(inv.issue_date)}
              </td>
              <td className="px-5 py-3.5 text-right font-mono text-sm font-semibold text-[#0F172A]">
                {formatCurrency(inv.total_ttc)}
              </td>
              <td className="px-5 py-3.5">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[inv.status as InvoiceStatus]}`}>
                  {INVOICE_STATUS_LABELS[inv.status as InvoiceStatus]}
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
