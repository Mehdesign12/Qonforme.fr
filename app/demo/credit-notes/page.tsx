"use client"

import { CreditNoteListView } from "@/components/credit-notes/CreditNoteListView"
import { DEMO_CREDIT_NOTE_ITEMS } from "@/components/credit-notes/demo"
import { DEMO_TODAY } from "@/lib/demo/data"

/** Démo : même liste que /credit-notes, alimentée par les données fictives communes. */
export default function DemoCreditNotesPage() {
  return (
    <CreditNoteListView
      items={DEMO_CREDIT_NOTE_ITEMS}
      today={DEMO_TODAY}
      invoicesHref="/demo/invoices"
      newInvoiceHref="/demo/invoices/new"
    />
  )
}
