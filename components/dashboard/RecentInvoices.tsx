import Link from "next/link"
import { formatCurrency, formatDate, INVOICE_STATUS_LABELS } from "@/lib/utils/invoice"
import { InvoiceStatus } from "@/types"
import { createClient } from "@/lib/supabase/server"
import { FileText, Plus, ArrowRight } from "lucide-react"

/* ─────────────────────────────────────────────────────────────────── */
/* Styles des badges de statut — complets (fond + texte + bordure)    */
/* ─────────────────────────────────────────────────────────────────── */

const STATUS_STYLE: Record<InvoiceStatus, { bg: string; text: string; border: string; dot: string }> = {
  draft:     { bg: "#F1F5F9", text: "#475569", border: "#CBD5E1", dot: "#94A3B8" },
  sent:      { bg: "#DBEAFE", text: "#1E40AF", border: "#93C5FD", dot: "#3B82F6" },
  pending:   { bg: "#FEF3C7", text: "#92400E", border: "#FCD34D", dot: "#D97706" },
  received:  { bg: "#EDE9FE", text: "#5B21B6", border: "#C4B5FD", dot: "#8B5CF6" },
  accepted:  { bg: "#D1FAE5", text: "#065F46", border: "#6EE7B7", dot: "#10B981" },
  rejected:  { bg: "#FEE2E2", text: "#991B1B", border: "#FCA5A5", dot: "#EF4444" },
  paid:      { bg: "#D1FAE5", text: "#065F46", border: "#6EE7B7", dot: "#10B981" },
  overdue:   { bg: "#FEE2E2", text: "#991B1B", border: "#FCA5A5", dot: "#EF4444" },
  cancelled: { bg: "#F1F5F9", text: "#64748B", border: "#CBD5E1", dot: "#94A3B8" },
  credited:  { bg: "#FFF7ED", text: "#C2410C", border: "#FED7AA", dot: "#F97316" },
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.draft
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border"
      style={{ backgroundColor: s.bg, color: s.text, borderColor: s.border }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: s.dot }} />
      {INVOICE_STATUS_LABELS[status]}
    </span>
  )
}

/* ─────────────────────────────────────────────────────────────────── */
/* Composant principal                                                  */
/* ─────────────────────────────────────────────────────────────────── */

export async function RecentInvoices() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: invoices } = await supabase
    .from("invoices")
    .select(`id, invoice_number, status, issue_date, due_date, total_ttc, client:clients(name)`)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5)

  /* ── Empty state ── */
  if (!invoices || invoices.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EFF6FF] mb-4">
            <FileText className="w-6 h-6 text-[#2563EB]" />
          </div>
          <p className="text-[15px] font-semibold text-[#0F172A] mb-1">Aucune facture pour l&apos;instant</p>
          <p className="text-[13px] text-slate-400 mb-5 max-w-xs">
            Créez votre première facture — elle sera transmise automatiquement à vos clients.
          </p>
          <Link href="/invoices/new">
            <button className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[13px] font-semibold px-4 py-2.5 transition-colors">
              <Plus className="w-3.5 h-3.5" />
              Créer une facture
            </button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden shadow-sm">

      {/* ── Vue mobile : cards ── */}
      <div className="sm:hidden divide-y divide-[#F8FAFC]">
        {invoices.map((inv) => {
          const client = (inv.client as unknown as { name: string } | null)
          const st     = (inv.status as InvoiceStatus)
          const s      = STATUS_STYLE[st] || STATUS_STYLE.draft
          return (
            <Link
              key={inv.id}
              href={`/invoices/${inv.id}`}
              className="flex items-center justify-between px-4 py-3.5 hover:bg-[#F8FAFC] transition-colors active:bg-[#EFF6FF]"
            >
              <div className="min-w-0">
                <p className="font-mono text-[13px] font-semibold text-[#2563EB]">{inv.invoice_number}</p>
                <p className="text-[12px] text-slate-500 truncate mt-0.5">
                  {client?.name || <span className="text-slate-300 italic">Client inconnu</span>}
                </p>
              </div>
              <div className="text-right ml-3 shrink-0 flex flex-col items-end gap-1">
                <p className="font-mono text-[13px] font-bold text-[#0F172A]">{formatCurrency(inv.total_ttc)}</p>
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border"
                  style={{ backgroundColor: s.bg, color: s.text, borderColor: s.border }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.dot }} />
                  {INVOICE_STATUS_LABELS[st]}
                </span>
              </div>
            </Link>
          )
        })}
      </div>

      {/* ── Vue desktop : table ── */}
      <table className="hidden sm:table w-full">
        <thead>
          <tr className="border-b border-[#F1F5F9] bg-[#FAFBFC]">
            <th className="text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400 px-5 py-3">N° facture</th>
            <th className="text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400 px-5 py-3">Client</th>
            <th className="text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400 px-5 py-3 hidden md:table-cell">Date</th>
            <th className="text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400 px-5 py-3">Montant TTC</th>
            <th className="text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400 px-5 py-3">Statut</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => {
            const client = (inv.client as unknown as { name: string } | null)
            const st     = (inv.status as InvoiceStatus)
            return (
              <tr
                key={inv.id}
                className="border-b border-[#F8FAFC] hover:bg-[#F8FAFC] transition-colors last:border-0 group"
              >
                <td className="px-5 py-3.5">
                  <Link
                    href={`/invoices/${inv.id}`}
                    className="font-mono text-[13px] font-semibold text-[#2563EB] hover:text-[#1D4ED8] hover:underline"
                  >
                    {inv.invoice_number}
                  </Link>
                </td>
                <td className="px-5 py-3.5 text-[13px] text-[#0F172A] font-medium">
                  {client?.name || <span className="text-slate-300 italic text-[12px]">—</span>}
                </td>
                <td className="px-5 py-3.5 text-[13px] text-slate-400 hidden md:table-cell">
                  {formatDate(inv.issue_date)}
                </td>
                <td className="px-5 py-3.5 text-right font-mono text-[13px] font-bold text-[#0F172A]">
                  {formatCurrency(inv.total_ttc)}
                </td>
                <td className="px-5 py-3.5">
                  <StatusBadge status={st} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-[#F1F5F9] flex items-center justify-between">
        <Link
          href="/invoices"
          className="inline-flex items-center gap-1 text-[13px] font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
        >
          Voir toutes les factures
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
        <span className="text-[12px] text-slate-300">{invoices.length} récente{invoices.length > 1 ? "s" : ""}</span>
      </div>
    </div>
  )
}
