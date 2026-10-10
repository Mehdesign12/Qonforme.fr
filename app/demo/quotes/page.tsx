"use client"

import { QuoteListView, type QuoteListItem } from "@/components/quotes/QuoteListView"
import { DEMO_PURCHASE_ORDERS, DEMO_QUOTES, DEMO_TODAY } from "@/lib/demo/data"
import { demoSignaturePanel } from "@/lib/demo/signature"

/** Suivi d'ouverture des devis envoyés, d'après les liens de signature de la démo. */
function demoViews(id: string) {
  const link = demoSignaturePanel("quote", id).link
  return link && link.sent_at ? { count: link.view_count, last: link.last_viewed_at } : null
}

/** Démo : même liste que /quotes, alimentée par les données fictives communes. */
const ITEMS: QuoteListItem[] = DEMO_QUOTES.map((q) => ({
  id: q.id,
  quote_number: q.quote_number,
  status: q.status,
  issue_date: q.issue_date,
  valid_until: q.valid_until,
  total_ttc: q.total_ttc,
  client_name: q.client.name,
  subject: q.subject,
  search_text: q.lines.map((l) => l.description).join(" "),
  converted: !!q.converted_invoice_number,
  converted_invoice_number: q.converted_invoice_number ?? null,
  views: q.status === "sent" ? demoViews(q.id) : null,
  href: `/demo/quotes/${q.id}`,
}))

export default function DemoQuotesPage() {
  return (
    <QuoteListView
      items={ITEMS}
      today={DEMO_TODAY}
      newHref="/demo/quotes/new"
      catalogueHref="/demo/products"
      purchaseOrdersHref="/demo/purchase-orders"
      purchaseOrdersCount={DEMO_PURCHASE_ORDERS.length}
    />
  )
}
