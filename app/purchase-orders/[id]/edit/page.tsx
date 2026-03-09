'use client'

export const dynamic = "force-dynamic"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import PurchaseOrderForm from "@/components/purchase-orders/PurchaseOrderForm"

export default function EditPurchaseOrderPage() {
  const { id } = useParams<{ id: string }>()

  const [po, setPo]           = useState<null | {
    po_number:     string
    client_id:     string
    issue_date:    string
    delivery_date: string | null
    reference:     string | null
    notes:         string | null
    lines:         { description: string; quantity: number; unit_price_ht: number; vat_rate: number; total_ht: number; total_vat: number; total_ttc: number }[]
    status:        string
  }>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState("")

  useEffect(() => {
    fetch(`/api/purchase-orders/${id}`)
      .then(r => r.json())
      .then(json => {
        if (json.purchase_order) {
          setPo(json.purchase_order)
        } else {
          setError("Bon de commande introuvable")
        }
      })
      .catch(() => setError("Erreur réseau"))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#4F46E5" }} />
    </div>
  )

  if (error || !po) return (
    <div className="py-16 text-center space-y-3">
      <p className="text-slate-500">{error || "Bon de commande introuvable"}</p>
      <Link href="/purchase-orders" className="text-sm hover:underline" style={{ color: "#4F46E5" }}>
        ← Retour aux bons de commande
      </Link>
    </div>
  )

  if (po.status !== "draft") return (
    <div className="py-16 text-center space-y-3">
      <p className="text-slate-500">Ce bon de commande ne peut plus être modifié (statut : {po.status}).</p>
      <Link href={`/purchase-orders/${id}`} className="text-sm hover:underline" style={{ color: "#4F46E5" }}>
        ← Retour au bon de commande
      </Link>
    </div>
  )

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/purchase-orders/${id}`}>
          <Button variant="ghost" size="sm" className="gap-1.5 text-slate-500 hover:text-slate-700">
            <ArrowLeft className="w-4 h-4" /> {po.po_number}
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#EEF2FF" }}>
            <ShoppingCart className="w-4 h-4" style={{ color: "#4F46E5" }} />
          </div>
          <h1 className="text-xl font-bold text-[#0F172A]">Modifier {po.po_number}</h1>
        </div>
      </div>

      <PurchaseOrderForm initial={po} editId={id} />
    </div>
  )
}
