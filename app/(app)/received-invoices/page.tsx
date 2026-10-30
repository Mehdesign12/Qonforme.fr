'use client'

export const dynamic = "force-dynamic"

import { useCallback, useEffect, useState } from "react"
import { ReceivedInvoiceList } from "@/components/reception/ReceivedInvoiceList"
import { todayISO } from "@/components/invoices/invoice-view"
import type { ReceivedListItem } from "@/lib/reception/view"
import type { ReceptionInfo } from "@/components/reception/PlatformNotice"
import { fetchEInvoicingView, receptionInfo } from "@/components/e-invoicing/reception-info"

/** Factures reçues des fournisseurs (plateforme agréée Super PDP et import manuel). */
export default function ReceivedInvoicesPage() {
  const [invoices, setInvoices] = useState<ReceivedListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [today, setToday] = useState<string | null>(null)
  const [reception, setReception] = useState<ReceptionInfo | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/received-invoices")
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? "Erreur réseau")
      setUnavailable(json.available === false)
      setInvoices(Array.isArray(json.invoices) ? json.invoices : [])
    } catch {
      setError("Vérifiez votre connexion, puis réessayez.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setToday(todayISO())
    void load()
    void fetchEInvoicingView().then((v) => setReception(receptionInfo(v, "/facturation-electronique")))
  }, [load])

  return (
    <ReceivedInvoiceList
      invoices={invoices}
      loading={loading || !today}
      error={error}
      onRetry={load}
      unavailable={unavailable}
      today={today ?? "1970-01-01"}
      hrefFor={(id) => `/received-invoices/${id}`}
      importHref="/received-invoices/import"
      settingsHref="/settings/ppf"
      reception={reception}
    />
  )
}
