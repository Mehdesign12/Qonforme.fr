'use client'

export const dynamic = "force-dynamic"

import Link from "next/link"
import { ArrowLeft, ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import PurchaseOrderForm from "@/components/purchase-orders/PurchaseOrderForm"

export default function NewPurchaseOrderPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/purchase-orders">
          <Button variant="ghost" size="sm" className="gap-1.5 text-slate-500 hover:text-slate-700">
            <ArrowLeft className="w-4 h-4" /> Bons de commande
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#EEF2FF" }}>
            <ShoppingCart className="w-4 h-4" style={{ color: "#4F46E5" }} />
          </div>
          <h1 className="text-xl font-bold text-[#0F172A]">Nouveau bon de commande</h1>
        </div>
      </div>

      <PurchaseOrderForm />
    </div>
  )
}
