'use client'

export const dynamic = "force-dynamic"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { formatCurrency, formatDate } from "@/lib/utils/invoice"
import { Plus, Loader2, ShoppingCart, ChevronRight } from "lucide-react"

type POStatus = "draft" | "sent" | "confirmed" | "cancelled"

const STATUS_STYLE: Record<POStatus, { bg: string; text: string; dot: string }> = {
  draft:     { bg: "#F1F5F9", text: "#475569", dot: "#94A3B8" },
  sent:      { bg: "#EEF2FF", text: "#3730A3", dot: "#818CF8" },
  confirmed: { bg: "#D1FAE5", text: "#065F46", dot: "#10B981" },
  cancelled: { bg: "#FEE2E2", text: "#991B1B", dot: "#EF4444" },
}

const STATUS_LABELS: Record<POStatus, string> = {
  draft: "Brouillon", sent: "Envoyé", confirmed: "Confirmé", cancelled: "Annulé",
}

function StatusBadge({ status }: { status: POStatus }) {
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

type Filter = "all" | POStatus
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all",       label: "Tous" },
  { key: "draft",     label: "Brouillons" },
  { key: "sent",      label: "Envoyés" },
  { key: "confirmed", label: "Confirmés" },
  { key: "cancelled", label: "Annulés" },
]

const INDIGO = "#4F46E5"
const INDIGO_HOVER = "#4338CA"

interface PurchaseOrder {
  id: string; po_number: string; status: POStatus
  issue_date: string; delivery_date: string | null
  reference: string | null; total_ttc: number
  client: { name: string } | null
}

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.85)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  boxShadow: '0 2px 16px rgba(79,70,229,0.06)',
}

export default function PurchaseOrdersPage() {
  const [pos, setPos]             = useState<PurchaseOrder[]>([])
  const [loading, setLoading]     = useState(true)
  const [activeFilter, setFilter] = useState<Filter>("all")

  const fetchPOs = useCallback(async () => {
    setLoading(true)
    const url = activeFilter === "all"
      ? "/api/purchase-orders"
      : `/api/purchase-orders?status=${activeFilter}`
    const res  = await fetch(url)
    const json = await res.json()
    if (json.purchase_orders) setPos(json.purchase_orders)
    setLoading(false)
  }, [activeFilter])

  useEffect(() => { fetchPOs() }, [fetchPOs])

  return (
    <div className="space-y-4 max-w-[1200px] mx-auto">

      {/* ── Filtres scrollables (CTA supprimé — déjà dans le Header) ── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all whitespace-nowrap ${
              activeFilter === f.key
                ? "text-white border-transparent shadow-sm"
                : "bg-white/80 text-slate-600 border-[#E2E8F0] hover:border-[#818CF8] hover:text-[#4F46E5]"
            }`}
            style={activeFilter === f.key ? { backgroundColor: INDIGO, borderColor: INDIGO } : {}}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-white/60 overflow-hidden" style={cardStyle}>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: INDIGO }} />
          </div>
        ) : pos.length === 0 ? (
          <div className="py-20 text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-[#EEF2FF] flex items-center justify-center mx-auto mb-4">
              <ShoppingCart className="w-6 h-6" style={{ color: INDIGO }} />
            </div>
            <p className="text-[15px] font-bold text-[#0F172A] mb-1">
              {activeFilter === "all"
                ? "Aucun bon de commande pour l'instant"
                : `Aucun BdC "${STATUS_LABELS[activeFilter as POStatus]}"`}
            </p>
            {activeFilter === "all" && (
              <>
                <p className="text-sm text-slate-400 mb-5">Créez votre premier bon de commande en quelques clics</p>
                <Link href="/purchase-orders/new">
                  <button
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white rounded-xl transition-colors"
                    style={{ backgroundColor: INDIGO }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = INDIGO_HOVER)}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = INDIGO)}
                  >
                    <Plus className="w-4 h-4" />
                    Créer un bon de commande
                  </button>
                </Link>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Mobile */}
            <div className="sm:hidden divide-y divide-[#F8FAFC]">
              {pos.map(po => (
                <a key={po.id} href={`/purchase-orders/${po.id}`}
                  className="flex items-center justify-between px-4 py-4 hover:bg-[#F8FAFC] active:bg-[#EEF2FF] transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[13px] font-bold" style={{ color: INDIGO }}>{po.po_number}</span>
                      <StatusBadge status={po.status} />
                    </div>
                    <p className="text-[12px] text-slate-500 truncate">{po.client?.name || "—"}</p>
                    {po.reference && (
                      <p className="text-[11px] font-mono text-slate-300 mt-0.5 truncate">{po.reference}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <p className="font-mono text-[14px] font-bold text-[#0F172A]">{formatCurrency(po.total_ttc)}</p>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </div>
                </a>
              ))}
            </div>

            {/* Desktop */}
            <table className="hidden sm:table w-full">
              <thead>
                <tr className="border-b border-[#F8FAFC] bg-[#FAFBFC]/60">
                  {["N° BdC", "Client", "Émission", "Livraison", "Référence", "Montant TTC", "Statut"].map((h, i) => (
                    <th key={h} className={`text-left text-[10px] font-bold uppercase tracking-wider text-slate-300 px-5 py-3.5 ${
                      i === 2 ? "hidden sm:table-cell" :
                      i === 3 ? "hidden md:table-cell" :
                      i === 4 ? "hidden lg:table-cell" :
                      i === 5 ? "text-right" : ""
                    }`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pos.map(po => (
                  <tr key={po.id}
                    onClick={() => window.location.href = `/purchase-orders/${po.id}`}
                    className="border-b border-[#F8FAFC] hover:bg-[#F8FAFC]/70 transition-colors last:border-0 cursor-pointer"
                  >
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-[13px] font-bold" style={{ color: INDIGO }}>{po.po_number}</span>
                    </td>
                    <td className="px-5 py-3.5 text-[13px] font-medium text-[#0F172A]">{po.client?.name || "—"}</td>
                    <td className="px-5 py-3.5 text-[12px] text-slate-400 hidden sm:table-cell">{formatDate(po.issue_date)}</td>
                    <td className="px-5 py-3.5 text-[12px] text-slate-400 hidden md:table-cell">
                      {po.delivery_date ? formatDate(po.delivery_date) : "—"}
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      {po.reference
                        ? <span className="font-mono text-[11px] text-slate-400 bg-[#F8FAFC] border border-[#E2E8F0] px-2 py-0.5 rounded-lg">{po.reference}</span>
                        : <span className="text-slate-300">—</span>
                      }
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-[13px] font-bold text-[#0F172A]">{formatCurrency(po.total_ttc)}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={po.status} /></td>
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
