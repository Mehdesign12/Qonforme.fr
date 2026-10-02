/**
 * Bons de commande de la démo, tirés de lib/demo/data.ts. Les horodatages
 * d'envoi et de confirmation (que la base enregistre pour un vrai bon) sont
 * ajoutés ici pour alimenter le suivi et le délai de confirmation.
 */
import { DEMO_COMPANY, DEMO_PURCHASE_ORDERS, type DemoPurchaseOrder } from "@/lib/demo/data"
import type { PurchaseOrderListItem } from "@/components/purchase-orders/PurchaseOrderListView"
import type { PurchaseOrderDetailData } from "@/components/purchase-orders/PurchaseOrderDetailView"
import type { PaperParty } from "@/components/purchase-orders/detail-bits"

export const DEMO_PO_COMPANY: PaperParty = {
  name: DEMO_COMPANY.name,
  address: DEMO_COMPANY.address,
  zip_code: DEMO_COMPANY.zip_code,
  city: DEMO_COMPANY.city,
  siren: DEMO_COMPANY.siren,
  vat_number: DEMO_COMPANY.vat_number,
}

const EXTRA: Record<string, { created_at: string; sent_at?: string; confirmed_at?: string; notes?: string }> = {
  "bc-2026-006": {
    created_at: "2026-10-01T08:40:00+02:00", sent_at: "2026-10-01T09:12:00+02:00", confirmed_at: "2026-10-01T16:05:00+02:00",
    notes: "Intervention prévue le 12 octobre. Accès au chantier par l'entrée de service.",
  },
  "bc-2026-005": { created_at: "2026-09-30T10:05:00+02:00", sent_at: "2026-09-30T10:20:00+02:00" },
  "bc-2026-004": { created_at: "2026-09-29T17:30:00+02:00" },
  "bc-2026-003": { created_at: "2026-08-28T08:50:00+02:00", sent_at: "2026-08-28T09:00:00+02:00", confirmed_at: "2026-08-31T11:30:00+02:00" },
  "bc-2026-002": { created_at: "2026-09-22T14:10:00+02:00", sent_at: "2026-09-22T14:25:00+02:00" },
}

export const DEMO_PO_ITEMS: PurchaseOrderListItem[] = DEMO_PURCHASE_ORDERS.map((p) => ({
  id: p.id,
  po_number: p.po_number,
  status: p.status,
  issue_date: p.issue_date,
  delivery_date: p.delivery_date,
  reference: p.reference,
  total_ttc: p.total_ttc,
  client_name: p.client.name,
  subject: p.subject,
  search_text: p.lines.map((l) => l.description).join(" "),
  sent_at: EXTRA[p.id]?.sent_at ?? null,
  confirmed_at: EXTRA[p.id]?.confirmed_at ?? null,
  href: `/demo/purchase-orders/${p.id}`,
}))

function toDetail(p: DemoPurchaseOrder): PurchaseOrderDetailData {
  const extra = EXTRA[p.id]
  return {
    id: p.id,
    po_number: p.po_number,
    status: p.status,
    subject: p.subject,
    issue_date: p.issue_date,
    delivery_date: p.delivery_date,
    reference: p.reference,
    lines: p.lines,
    subtotal_ht: p.subtotal_ht,
    total_vat: p.total_vat,
    total_ttc: p.total_ttc,
    notes: extra?.notes ?? null,
    sent_at: extra?.sent_at ?? null,
    confirmed_at: extra?.confirmed_at ?? null,
    created_at: extra?.created_at ?? null,
    client: { ...p.client, href: `/demo/clients/${p.client.id}`, editHref: `/demo/clients/${p.client.id}/edit` },
  }
}

export function demoPurchaseOrderDetail(id: string): PurchaseOrderDetailData | null {
  const p = DEMO_PURCHASE_ORDERS.find((x) => x.id === id || x.po_number === id)
  return p ? toDetail(p) : null
}
