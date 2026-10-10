/**
 * Factures reçues → sorties de trésorerie (page réelle et démo).
 *
 * Ne comptent que les factures à payer : ni réglées, ni refusées (CLOSED), ni
 * en litige ou suspendues (IN_DISPUTE) — leur paiement attend la résolution.
 */
import { CLOSED, IN_DISPUTE } from "@/lib/reception/lifecycle"
import { isCreditNoteType } from "@/lib/reception/types"
import type { ReceivedListItem } from "@/lib/reception/view"
import type { ForecastPayable } from "@/lib/treasury/forecast"

export function payablesFromReceived(items: ReceivedListItem[]): ForecastPayable[] {
  return items
    .filter((r) => !CLOSED.includes(r.status) && !IN_DISPUTE.includes(r.status) && (r.currency || "EUR") === "EUR")
    .map((r) => ({
      id: r.id,
      invoice_number: r.invoice_number,
      supplier_name: r.supplier_name,
      issue_date: r.issue_date,
      due_date: r.due_date,
      amount_due: r.amount_due,
      credit: isCreditNoteType(r.document_type),
    }))
}
