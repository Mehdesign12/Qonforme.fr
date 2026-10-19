import type { Metadata } from "next"
import PurchaseOrderForm from "@/components/purchase-orders/PurchaseOrderForm"

export const metadata: Metadata = { title: "Nouveau bon de commande" }
export const dynamic = "force-dynamic"

export default function NewPurchaseOrderPage() {
  return <PurchaseOrderForm />
}
