'use client'

export const dynamic = "force-dynamic"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { formatCurrency, formatDate, INVOICE_STATUS_LABELS } from "@/lib/utils/invoice"
import { InvoiceStatus } from "@/types"
import { Plus, Loader2, FileText, Archive, ChevronRight } from "lucide-react"

/* ── Status styles ── */
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

type StatusFilter = "all" | InvoiceStatus | "archived"

interface Invoice {
  id: string; invoice_number: string; status: InvoiceStatus
  is_archived: boolean; issue_date: string; due_date: string
  total_ttc: number; client: { name: string } | null
}

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all",      label: "Toutes" },
  { key: "draft",    label: "Brouillons" },
  { key: "sent",     label: "Envoyées" },
  { key: "pending",  label: "En attente" },
  { key: "overdue",  label: "En retard" },
  { key: "paid",     label: "Payées" },
  { key: "archived", label: "Archivées" },
]

const cardStyle: React.CSSProperties = {
  background: 'var(--card-glass-bg)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  boxShadow: 'var(--card-glass-shadow)',
}

export default function InvoicesPage() {
  const [invoices, setInvoices]         = useState<Invoice[]>([])
  const [loading, setLoading]           = useState(true)
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("all")

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    let url = "/api/invoices"
    if      (activeFilter === "archived") url = "/api/invoices?archived=true"
    else if (activeFilter !== "all")      url = `/api/invoices?status=${activeFilter}`
    const res  = await fetch(url)
    const json = await res.json()
    if (json.invoices) setInvoices(json.invoices)
    setLoading(false)
  }, [activeFilter])

  useEffect(() => { fetchInvoices() }, [fetchInvoices])

  const isArchiveView = activeFilter === "archived"

  return (
    <div className="space-y-4 max-w-[1200px] mx-auto">

      {/* ── Filtres scrollables (CTA supprimé — déjà dans le Header) ── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all whitespace-nowrap flex items-center gap-1 ${
              activeFilter === f.key
                ? f.key === "archived"
                  ? "bg-slate-600 text-white border-slate-600 shadow-sm"
                  : "bg-[#2563EB] text-white border-[#2563EB] shadow-sm"
                : "bg-white/80 dark:bg-[#0F1E35]/80 text-slate-600 dark:text-slate-400 border-[#E2E8F0] dark:border-[#1E3A5F] hover:border-[#2563EB] hover:text-[#2563EB]"
            }`}
          >
            {f.key === "archived" && <Archive className="w-3 h-3" />}
            {f.label}
          </button>
        ))}
      </div>

      {isArchiveView && (
        <div
          className="flex items-center gap-2.5 rounded-2xl px-4 py-3 border border-white/60"
          style={{ background: 'rgba(248,250,252,0.9)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
        >
          <Archive className="w-4 h-4 text-slate-400 shrink-0" />
          <p className="text-xs text-slate-500">Les factures archivées n&apos;apparaissent pas dans les autres filtres.</p>
        </div>
      )}

      {/* ── Contenu ── */}
      <div className="rounded-2xl border border-white/60 dark:border-[#1E3A5F] overflow-hidden" style={cardStyle}>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-[#2563EB] animate-spin" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="py-20 text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-[#EFF6FF] flex items-center justify-center mx-auto mb-4">
              {isArchiveView
                ? <Archive className="w-6 h-6 text-[#2563EB]" />
                : <FileText className="w-6 h-6 text-[#2563EB]" />
              }
            </div>
            <p className="text-[15px] font-bold text-[#0F172A] dark:text-[#E2E8F0] mb-1">
              {isArchiveView ? "Aucune facture archivée"
                : activeFilter === "all" ? "Aucune facture pour l'instant"
                : `Aucune facture "${INVOICE_STATUS_LABELS[activeFilter as InvoiceStatus]}"`}
            </p>
            {activeFilter === "all" && !isArchiveView && (
              <>
                <p className="text-sm text-slate-400 mb-5">Créez votre première facture en quelques clics</p>
                <Link href="/invoices/new">
                  <button className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-xl transition-colors">
                    <Plus className="w-4 h-4" />
                    Créer une facture
                  </button>
                </Link>
              </>
            )}
          </div>
        ) : (
          <>
            {/* ── Mobile : cards ── */}
            <div className="sm:hidden divide-y divide-[#F8FAFC] dark:divide-[#162032]">
              {invoices.map((inv) => (
                <Link
                  key={inv.id}
                  href={`/invoices/${inv.id}`}
                  className={`flex items-center justify-between px-4 py-4 hover:bg-[#F8FAFC] dark:hover:bg-[#162032] active:bg-[#EFF6FF] dark:active:bg-[#1E3A5F] transition-colors ${inv.is_archived ? "opacity-60" : ""}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {inv.is_archived && <Archive className="w-3 h-3 text-slate-300 shrink-0" />}
                      <span className="font-mono text-[13px] font-bold text-[#2563EB]">{inv.invoice_number}</span>
                      <StatusBadge status={inv.status} />
                    </div>
                    <p className="text-[12px] text-slate-500 truncate">{inv.client?.name || "—"}</p>
                    <p className="text-[11px] text-slate-300 mt-0.5">{formatDate(inv.issue_date)}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <p className="font-mono text-[14px] font-bold text-[#0F172A] dark:text-[#E2E8F0]">{formatCurrency(inv.total_ttc)}</p>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </div>
                </Link>
              ))}
            </div>

            {/* ── Desktop : table ── */}
            <table className="hidden sm:table w-full">
              <thead>
                <tr className="border-b border-[#F8FAFC] dark:border-[#162032] bg-[#FAFBFC]/60 dark:bg-[#162032]/40">
                  {["N° facture", "Client", "Émission", "Échéance", "Montant TTC", "Statut"].map((h, i) => (
                    <th
                      key={h}
                      className={`text-left text-[10px] font-bold uppercase tracking-wider text-slate-300 px-5 py-3.5 ${
                        i === 2 ? "hidden md:table-cell" :
                        i === 3 ? "hidden lg:table-cell" :
                        i === 4 ? "text-right" : ""
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() => window.location.href = `/invoices/${inv.id}`}
                    className={`border-b border-[#F8FAFC] dark:border-[#162032] hover:bg-[#F8FAFC]/70 dark:hover:bg-[#162032]/60 transition-colors last:border-0 cursor-pointer ${inv.is_archived ? "opacity-60" : ""}`}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        {inv.is_archived && <Archive className="w-3 h-3 text-slate-300 shrink-0" />}
                        <span className="font-mono text-[13px] font-bold text-[#2563EB]">{inv.invoice_number}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-[13px] font-medium text-[#0F172A] dark:text-[#E2E8F0]">{inv.client?.name || "—"}</td>
                    <td className="px-5 py-3.5 text-[12px] text-slate-400 hidden md:table-cell">{formatDate(inv.issue_date)}</td>
                    <td className="px-5 py-3.5 text-[12px] text-slate-400 hidden lg:table-cell">{formatDate(inv.due_date)}</td>
                    <td className="px-5 py-3.5 text-right font-mono text-[13px] font-bold text-[#0F172A] dark:text-[#E2E8F0]">{formatCurrency(inv.total_ttc)}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={inv.status} /></td>
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
