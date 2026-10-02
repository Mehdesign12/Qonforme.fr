"use client"

import { PurchaseOrderListView } from "@/components/purchase-orders/PurchaseOrderListView"
import { DEMO_PO_ITEMS } from "@/components/purchase-orders/demo"
import { DEMO_QUOTES, DEMO_TODAY } from "@/lib/demo/data"

/** Démo : même liste que /purchase-orders, alimentée par les données fictives communes. */
export default function DemoPurchaseOrdersPage() {
  return (
    <PurchaseOrderListView
      items={DEMO_PO_ITEMS}
      today={DEMO_TODAY}
      newHref="/demo/purchase-orders/new"
      quotesHref="/demo/quotes"
      quotesCount={DEMO_QUOTES.length}
    />
  )
}
