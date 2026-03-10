'use client'

export const dynamic = "force-dynamic"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { formatCurrency, formatDate } from "@/lib/utils/invoice"
import { Plus, Loader2, ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"

type POStatus = "draft" | "sent" | "confirmed" | "cancelled"

const STATUS_STYLE: Record<POStatus, string> = {
  draft:     "bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]",
  sent:      "bg-[#EEF2FF] text-[#3730A3] border-[#A5B4FC]",
  confirmed: "bg-[#D1FAE5] text-[#065F46] border-[#6EE7B7]",
  cancelled: "bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]",
}

const STATUS_LABELS: Record<POStatus, string> = {
  draft:     "Brouillon",
  sent:      "Envoyé",
  confirmed: "Confirmé",
  cancelled: "Annulé",
}

type Filter = "all" | POStatus

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all",       label: "Tous" },
  { key: "draft",     label: "Brouillons" },
  { key: "sent",      label: "Envoyés" },
  { key: "confirmed", label: "Confirmés" },
  { key: "cancelled", label: "Annulés" },
]

// Couleur indigo identitaire des BdC
const INDIGO = "#4F46E5"

interface PurchaseOrder {
  id:            string
  po_number:     string
  status:        POStatus
  issue_date:    string
  delivery_date: string | null
  reference:     string | null
  total_ttc:     number
  client:        { name: string } | null
}

export default function PurchaseOrdersPage() {
  const [pos, setPos]               = useState<PurchaseOrder[]>([])
  const [loading, setLoading]       = useState(true)
  const [activeFilter, setFilter]   = useState<Filter>("all")

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
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                activeFilter === f.key
                  ? "text-white border-transparent"
                  : "bg-white text-slate-600 border-[#E2E8F0] hover:border-[#A5B4FC] hover:text-[#4F46E5]"
              }`}
              style={activeFilter === f.key ? { backgroundColor: INDIGO, borderColor: INDIGO } : {}}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Link href="/purchase-orders/new">
          <Button
            className="text-white gap-2 shrink-0"
            style={{ backgroundColor: INDIGO }}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nouveau bon de commande</span>
            <span className="sm:hidden">Nouveau</span>
          </Button>
        </Link>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: INDIGO }} />
          </div>
        ) : pos.length === 0 ? (
          <div className="py-16 text-center">
            <ShoppingCart className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-sm font-medium text-slate-600 mb-1">
              {activeFilter === "all"
                ? "Aucun bon de commande pour l'instant"
                : `Aucun bon de commande "${STATUS_LABELS[activeFilter as POStatus]}"`}
            </p>
            {activeFilter === "all" && (
              <>
                <p className="text-xs text-slate-400 mb-4">Créez votre premier bon de commande en quelques clics</p>
                <Link href="/purchase-orders/new">
                  <Button size="sm" className="text-white" style={{ backgroundColor: INDIGO }}>
                    Créer un bon de commande
                  </Button>
                </Link>
              </>
            )}
          </div>
        ) : (
          <>
            {/* ── Mobile : cards ── */}
            <div className="sm:hidden divide-y divide-[#F1F5F9]">
              {pos.map(po => (
                <a
                  key={po.id}
                  href={`/purchase-orders/${po.id}`}
                  className="flex items-center justify-between px-4 py-3.5 hover:bg-[#F8FAFC] transition-colors"
                >
                  <div className="min-w-0">
                    <span className="font-mono text-sm font-medium" style={{ color: INDIGO }}>{po.po_number}</span>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{po.client?.name || "—"}</p>
                    {po.reference && (
                      <p className="text-xs font-mono text-slate-400 mt-0.5 truncate">{po.reference}</p>
                    )}
                  </div>
                  <div className="text-right ml-3 shrink-0">
                    <p className="font-mono text-sm font-semibold text-[#0F172A]">{formatCurrency(po.total_ttc)}</p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border mt-1 ${STATUS_STYLE[po.status]}`}>
                      {STATUS_LABELS[po.status]}
                    </span>
                  </div>
                </a>
              ))}
            </div>

            {/* ── Desktop : table ── */}
            <table className="hidden sm:table w-full">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">N° BdC</th>
                <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Client</th>
                <th className="text-left text-xs font-medium text-slate-400 px-5 py-3 hidden sm:table-cell">Émission</th>
                <th className="text-left text-xs font-medium text-slate-400 px-5 py-3 hidden md:table-cell">Livraison</th>
                <th className="text-left text-xs font-medium text-slate-400 px-5 py-3 hidden lg:table-cell">Référence</th>
                <th className="text-right text-xs font-medium text-slate-400 px-5 py-3">Montant TTC</th>
                <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {pos.map(po => (
                <tr
                  key={po.id}
                  onClick={() => window.location.href = `/purchase-orders/${po.id}`}
                  className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors last:border-0 cursor-pointer"
                >
                  <td className="px-5 py-4">
                    <span className="font-mono text-sm font-medium" style={{ color: INDIGO }}>
                      {po.po_number}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm font-medium text-[#0F172A]">
                    {po.client?.name || "—"}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-500 hidden sm:table-cell">
                    {formatDate(po.issue_date)}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-500 hidden md:table-cell">
                    {po.delivery_date ? formatDate(po.delivery_date) : "—"}
                  </td>
                  <td className="px-5 py-4 hidden lg:table-cell">
                    {po.reference
                      ? <span className="font-mono text-xs text-slate-500 bg-[#F8FAFC] border border-[#E2E8F0] px-2 py-1 rounded">{po.reference}</span>
                      : <span className="text-slate-400 text-sm">—</span>
                    }
                  </td>
                  <td className="px-5 py-4 text-right font-mono text-sm font-semibold text-[#0F172A]">
                    {formatCurrency(po.total_ttc)}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLE[po.status]}`}>
                      {STATUS_LABELS[po.status]}
                    </span>
                  </td>
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
