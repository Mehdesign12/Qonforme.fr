import Link from "next/link"
import { formatCurrency, formatDate, INVOICE_STATUS_LABELS } from "@/lib/utils/invoice"
import { InvoiceStatus } from "@/types"
import { createClient } from "@/lib/supabase/server"
import { FileText, Plus, ArrowRight, Calendar } from "lucide-react"

/* ─────────────────────────────────────────────────────────────────────────
   Status styles
───────────────────────────────────────────────────────────────────────── */
const STATUS_STYLE: Record<InvoiceStatus, { bg: string; text: string; dot: string }> = {
  draft:     { bg: "#F1F5F9", text: "#475569", dot: "#94A3B8" },
  sent:      { bg: "#DBEAFE", text: "#1E40AF", dot: "#3B82F6" },
  pending:   { bg: "#FEF3C7", text: "#92400E", dot: "#D97706" },
  received:  { bg: "#EDE9FE", text: "#5B21B6", dot: "#8B5CF6" },
  accepted:  { bg: "#D1FAE5", text: "#065F46", dot: "#10B981" },
  rejected:  { bg: "#FEE2E2", text: "#991B1B", dot: "#EF4444" },
  paid:      { bg: "#D1FAE5", text: "#065F46", dot: "#10B981" },
  overdue:   { bg: "#FEE2E2", text: "#991B1B", dot: "#EF4444" },
  cancelled: { bg: "#F1F5F9", text: "#64748B", dot: "#94A3B8" },
  credited:  { bg: "#FFF7ED", text: "#C2410C", dot: "#F97316" },
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.draft
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: s.dot }} />
      {INVOICE_STATUS_LABELS[status]}
    </span>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   Avatar initiales client
───────────────────────────────────────────────────────────────────────── */
const AVATAR_COLORS = [
  ['#EFF6FF', '#2563EB'],
  ['#F5F3FF', '#7C3AED'],
  ['#ECFEFF', '#0891B2'],
  ['#ECFDF5', '#059669'],
  ['#FFF7ED', '#EA580C'],
]

function ClientAvatar({ name, index }: { name: string; index: number }) {
  const [bg, text] = AVATAR_COLORS[index % AVATAR_COLORS.length]
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() || '')
    .join('')
  return (
    <div
      className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-bold shrink-0"
      style={{ background: bg, color: text }}
    >
      {initials || '?'}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   Composant principal
───────────────────────────────────────────────────────────────────────── */
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
      <div
        className="rounded-2xl border border-white/60 overflow-hidden"
        style={{
          background:          'rgba(255,255,255,0.80)',
          backdropFilter:      'blur(12px)',
          WebkitBackdropFilter:'blur(12px)',
          boxShadow:           '0 2px 16px rgba(37,99,235,0.06)',
        }}
      >
        <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)' }}
          >
            <FileText className="w-6 h-6 text-[#2563EB]" />
          </div>
          <p className="text-[15px] font-bold text-[#0F172A] mb-1">
            Aucune facture pour l&apos;instant
          </p>
          <p className="text-[13px] text-slate-400 mb-5 max-w-xs">
            Créez votre première facture — elle sera transmise automatiquement à vos clients.
          </p>
          <Link href="/invoices/new">
            <button className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white text-[13px] font-bold px-4 py-2.5 transition-colors shadow-sm">
              <Plus className="w-3.5 h-3.5" />
              Créer une facture
            </button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl border border-white/60 overflow-hidden"
      style={{
        background:          'rgba(255,255,255,0.80)',
        backdropFilter:      'blur(12px)',
        WebkitBackdropFilter:'blur(12px)',
        boxShadow:           '0 2px 16px rgba(37,99,235,0.06)',
      }}
    >
      {/* ── En-tête ── */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#F1F5F9]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
            <FileText className="w-3.5 h-3.5 text-[#2563EB]" />
          </div>
          <h3 className="text-[14px] font-bold text-[#0F172A]">Dernières factures</h3>
        </div>
        <Link
          href="/invoices"
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
        >
          Tout voir
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* ── Vue mobile : cards ── */}
      <div className="sm:hidden divide-y divide-[#F8FAFC]">
        {invoices.map((inv, i) => {
          const client = (inv.client as unknown as { name: string } | null)
          const st     = (inv.status as InvoiceStatus)
          const s      = STATUS_STYLE[st] || STATUS_STYLE.draft
          return (
            <Link
              key={inv.id}
              href={`/invoices/${inv.id}`}
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-[#F8FAFC] active:bg-[#EFF6FF] transition-colors"
            >
              <ClientAvatar name={client?.name || '?'} index={i} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-mono text-[12px] font-bold text-[#2563EB]">{inv.invoice_number}</p>
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{ backgroundColor: s.bg, color: s.text }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.dot }} />
                    {INVOICE_STATUS_LABELS[st]}
                  </span>
                </div>
                <p className="text-[12px] text-slate-500 truncate mt-0.5">
                  {client?.name || <span className="text-slate-300 italic">Client inconnu</span>}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono text-[13px] font-bold text-[#0F172A]">
                  {formatCurrency(inv.total_ttc)}
                </p>
                <p className="text-[10px] text-slate-300 mt-0.5">{formatDate(inv.issue_date)}</p>
              </div>
            </Link>
          )
        })}
      </div>

      {/* ── Vue desktop : table ── */}
      <table className="hidden sm:table w-full">
        <thead>
          <tr className="border-b border-[#F8FAFC] bg-[#FAFBFC]/60">
            <th className="text-left text-[10px] font-bold uppercase tracking-[0.08em] text-slate-300 px-5 py-3">
              N° facture
            </th>
            <th className="text-left text-[10px] font-bold uppercase tracking-[0.08em] text-slate-300 px-5 py-3">
              Client
            </th>
            <th className="text-left text-[10px] font-bold uppercase tracking-[0.08em] text-slate-300 px-5 py-3 hidden md:table-cell">
              Date
            </th>
            <th className="text-right text-[10px] font-bold uppercase tracking-[0.08em] text-slate-300 px-5 py-3">
              Montant TTC
            </th>
            <th className="text-left text-[10px] font-bold uppercase tracking-[0.08em] text-slate-300 px-5 py-3">
              Statut
            </th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv, i) => {
            const client = (inv.client as unknown as { name: string } | null)
            const st     = (inv.status as InvoiceStatus)
            return (
              <tr
                key={inv.id}
                className="border-b border-[#F8FAFC] hover:bg-[#F8FAFC]/60 transition-colors last:border-0 group"
              >
                <td className="px-5 py-3.5">
                  <Link
                    href={`/invoices/${inv.id}`}
                    className="font-mono text-[13px] font-bold text-[#2563EB] hover:text-[#1D4ED8] hover:underline"
                  >
                    {inv.invoice_number}
                  </Link>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <ClientAvatar name={client?.name || '?'} index={i} />
                    <span className="text-[13px] font-medium text-[#0F172A] truncate">
                      {client?.name || <span className="text-slate-300 italic text-[12px]">—</span>}
                    </span>
                  </div>
                </td>
                <td className="px-5 py-3.5 hidden md:table-cell">
                  <div className="flex items-center gap-1.5 text-[12px] text-slate-400">
                    <Calendar className="w-3 h-3 shrink-0" />
                    {formatDate(inv.issue_date)}
                  </div>
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
      <div className="px-5 py-3 border-t border-[#F8FAFC] flex items-center justify-between bg-[#FAFBFC]/40">
        <Link
          href="/invoices"
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
        >
          Voir toutes les factures
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
        <span className="text-[11px] text-slate-300 font-medium">
          {invoices.length} récente{invoices.length > 1 ? "s" : ""}
        </span>
      </div>
    </div>
  )
}
