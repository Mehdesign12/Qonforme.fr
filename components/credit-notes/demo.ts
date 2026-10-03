/**
 * Avoirs de la démo, tirés de lib/demo/data.ts (mêmes numéros, clients,
 * motifs, dates et montants que la liste des clients et des factures).
 *
 * Chaque avoir reprend des lignes de sa facture d'origine, comme dans
 * l'application : HT, TVA et TTC viennent de ces lignes.
 */
import { DEMO_COMPANY, DEMO_CREDIT_NOTES, demoInvoice, type DemoCreditNote } from "@/lib/demo/data"
import type { CreditNoteListItem } from "@/components/credit-notes/CreditNoteListView"
import type { CreditNoteDetailData } from "@/components/credit-notes/CreditNoteDetailView"
import type { PaperParty } from "@/components/purchase-orders/detail-bits"
import { DEMO_LEGAL_NOTICE, DEMO_LEGAL_PROFILE, DEMO_LEGAL_SNAPSHOT } from "@/lib/demo/legal-profile"

export const DEMO_CREDIT_COMPANY: PaperParty = {
  name: DEMO_COMPANY.name,
  address: DEMO_COMPANY.address,
  zip_code: DEMO_COMPANY.zip_code,
  city: DEMO_COMPANY.city,
  siren: DEMO_COMPANY.siren,
  vat_number: DEMO_COMPANY.vat_number,
  legal_notice: DEMO_LEGAL_NOTICE,
  legal_profile: DEMO_LEGAL_PROFILE,
}

const invoiceHref = (number: string) => {
  const inv = demoInvoice(number)
  return inv ? `/demo/invoices/${inv.id}` : null
}

export const DEMO_CREDIT_NOTE_ITEMS: CreditNoteListItem[] = DEMO_CREDIT_NOTES.map((c) => ({
  id: c.id,
  credit_note_number: c.credit_note_number,
  issue_date: c.issue_date,
  total_ttc: c.total_ttc,
  reason: c.reason,
  client_name: c.client.name,
  invoice_number: c.original_invoice_number,
  invoice_href: invoiceHref(c.original_invoice_number),
  href: `/demo/credit-notes/${c.id}`,
}))

function toDetail(c: DemoCreditNote): CreditNoteDetailData {
  const inv = demoInvoice(c.original_invoice_number)
  return {
    id: c.id,
    credit_note_number: c.credit_note_number,
    issue_date: c.issue_date,
    sent_at: c.issue_date,
    reason: c.reason,
    lines: c.lines.map((l) => ({
      description: l.description, quantity: l.quantity, unit: l.unit, unit_price_ht: l.unit_price_ht,
      vat_rate: l.vat_rate, total_ht: l.total_ht, total_vat: l.total_vat,
    })),
    subtotal_ht: c.subtotal_ht,
    total_vat: c.total_vat,
    total_ttc: c.total_ttc,
    client: { ...c.client, href: `/demo/clients/${c.client.id}`, editHref: `/demo/clients/${c.client.id}/edit` },
    original_invoice: {
      invoice_number: c.original_invoice_number,
      href: inv ? `/demo/invoices/${inv.id}` : null,
      issue_date: inv?.issue_date ?? null,
      total_ttc: inv?.total_ttc ?? null,
    },
    legal_snapshot: DEMO_LEGAL_SNAPSHOT,
  }
}

export function demoCreditNoteDetail(id: string): CreditNoteDetailData | null {
  const c = DEMO_CREDIT_NOTES.find((x) => x.id === id || x.credit_note_number === id)
  return c ? toDetail(c) : null
}
