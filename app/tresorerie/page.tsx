'use client'

export const dynamic = "force-dynamic"

import { useEffect, useState } from "react"
import { TreasuryView } from "@/components/treasury/TreasuryView"
import type { ForecastInvoice } from "@/lib/treasury/forecast"

export default function TresoreriePage() {
  const [invoices, setInvoices] = useState<ForecastInvoice[] | null>(null)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch("/api/tresorerie")
      .then(async (res) => {
        const json = await res.json()
        if (!alive) return
        if (!res.ok) setError(json.error || "Erreur de chargement")
        else setInvoices(json.invoices ?? [])
      })
      .catch(() => alive && setError("Connexion impossible, réessayez dans un instant"))
    return () => { alive = false }
  }, [])

  return (
    <TreasuryView
      invoices={invoices}
      error={error}
      invoiceHref={(id) => `/invoices/${id}`}
      newInvoiceHref="/invoices/new"
      remindersHref="/relances"
    />
  )
}
