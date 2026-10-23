'use client'

export const dynamic = "force-dynamic"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Loader2, Lock, ShoppingCart } from "lucide-react"
import { EmptyState, PURCHASE_ORDER_PILLS } from "@/components/app/kit"
import { SetCrumb } from "@/components/layout/crumb"
import PurchaseOrderForm from "@/components/purchase-orders/PurchaseOrderForm"
import type { DocClient } from "@/components/documents/model"

export default function EditPurchaseOrderPage() {
  const { id } = useParams<{ id: string }>()

  const [po, setPo]           = useState<null | {
    po_number:     string
    client_id:     string
    client?:       DocClient | null
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
      <Loader2 className="size-8 animate-spin text-[var(--q-accent)]" aria-label="Chargement du bon de commande" />
    </div>
  )

  if (error || !po) return (
    <div className="q-card">
      <EmptyState
        icon={<ShoppingCart className="size-5" aria-hidden />}
        title={error || "Bon de commande introuvable"}
        action={<Link href="/purchase-orders" className="q-btn q-btn-secondary">Retour aux bons de commande</Link>}
      />
    </div>
  )

  // Contenu modifiable seulement en brouillon (la route PATCH le refuse aussi)
  if (po.status !== "draft") return (
    <div className="q-card">
      <SetCrumb label={po.po_number} />
      <EmptyState
        icon={<Lock className="size-5" aria-hidden />}
        title="Ce bon de commande ne se modifie plus"
        text={`Statut : ${PURCHASE_ORDER_PILLS[po.status]?.label.toLowerCase() ?? po.status}. Seul un brouillon peut être modifié.`}
        action={<Link href={`/purchase-orders/${id}`} className="q-btn q-btn-secondary">Retour au bon de commande</Link>}
      />
    </div>
  )

  return (
    <>
      <SetCrumb label={po.po_number} />
      <PurchaseOrderForm initial={po} editId={id} />
    </>
  )
}
