/**
 * Données de la trésorerie de démo : les factures et avoirs de lib/demo/data.ts,
 * les factures fournisseurs de lib/demo/reception.ts — les mêmes que sur les
 * autres écrans de la démo, donc des chiffres qui concordent.
 */
import { DEMO_CREDIT_NOTES, DEMO_INVOICES, DEMO_SUB_INVOICES } from "@/lib/demo/data"
import { DEMO_RECEIVED_LIST } from "@/lib/demo/reception"
import { payablesFromReceived } from "@/lib/treasury/payables"
import type { ForecastInvoice } from "@/lib/treasury/forecast"

export function demoTreasuryInvoices(): ForecastInvoice[] {
  const credited: Record<string, number> = {}
  for (const c of DEMO_CREDIT_NOTES) credited[c.original_invoice_number] = (credited[c.original_invoice_number] || 0) + c.total_ttc
  const all = [...DEMO_INVOICES, ...DEMO_SUB_INVOICES.filter((s) => !DEMO_INVOICES.some((i) => i.id === s.id))]
  return all.map((i) => ({
    id: i.id,
    invoice_number: i.invoice_number,
    client_name: i.client.name,
    due_date: i.due_date,
    total_ttc: i.total_ttc,
    credited_ttc: (i.invoice_number && credited[i.invoice_number]) || 0,
    retention_ttc: i.retention_amount || 0,
    status: i.status,
  }))
}

export const demoTreasuryPayables = () => payablesFromReceived(DEMO_RECEIVED_LIST)
