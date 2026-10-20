'use client'

export const dynamic = "force-dynamic"

import { useCallback, useEffect, useState } from "react"
import { CreditNoteListView, type CreditNoteListItem } from "@/components/credit-notes/CreditNoteListView"
import { todayISO } from "@/components/quotes/QuoteListHelpers"

interface ApiCreditNote {
  id: string
  credit_note_number: string
  issue_date: string
  total_ttc: number
  reason: string
  client: { name: string } | null
  original_invoice: { id: string; invoice_number: string } | null
}

export default function CreditNotesPage() {
  const [today] = useState(todayISO)
  const [items, setItems] = useState<CreditNoteListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCreditNotes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/credit-notes")
      const json = await res.json()
      if (!res.ok || !Array.isArray(json.credit_notes)) throw new Error(json.error ?? "Erreur de chargement")
      setItems((json.credit_notes as ApiCreditNote[]).map((c) => ({
        id: c.id,
        credit_note_number: c.credit_note_number,
        issue_date: c.issue_date,
        total_ttc: Number(c.total_ttc) || 0,
        reason: c.reason,
        client_name: c.client?.name ?? null,
        invoice_number: c.original_invoice?.invoice_number ?? null,
        invoice_href: c.original_invoice ? `/invoices/${c.original_invoice.id}` : null,
        href: `/credit-notes/${c.id}`,
      })))
    } catch {
      setError("Vérifiez votre connexion, puis réessayez.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCreditNotes() }, [fetchCreditNotes])

  return (
    <CreditNoteListView
      items={items}
      loading={loading}
      error={error}
      onRetry={fetchCreditNotes}
      today={today}
      invoicesHref="/invoices"
      newInvoiceHref="/invoices/new"
    />
  )
}
