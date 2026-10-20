'use client'

export const dynamic = "force-dynamic"

import { useCallback, useEffect, useState } from "react"
import { TreasuryView } from "@/components/treasury/TreasuryView"
import { todayInParis } from "@/lib/utils/paris-date"
import type { ForecastInvoice, ForecastPayable } from "@/lib/treasury/forecast"

/** Trésorerie : encaissements et décaissements à venir (lib/treasury/forecast.ts). */
export default function TresoreriePage() {
  const [invoices, setInvoices] = useState<ForecastInvoice[] | null>(null)
  const [payables, setPayables] = useState<ForecastPayable[]>([])
  const [payablesAvailable, setPayablesAvailable] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Date du jour lue après le montage : le serveur et le navigateur peuvent ne pas être le même jour
  const [today, setToday] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    setInvoices(null)
    try {
      const res = await fetch("/api/tresorerie")
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? "Erreur réseau")
      setInvoices(Array.isArray(json.invoices) ? json.invoices : [])
      setPayables(Array.isArray(json.payables) ? json.payables : [])
      setPayablesAvailable(json.payablesAvailable === true)
    } catch {
      setError("Vérifiez votre connexion, puis réessayez.")
    }
  }, [])

  useEffect(() => {
    setToday(todayInParis())
    void load()
  }, [load])

  return (
    <TreasuryView
      mode="app"
      today={today}
      invoices={invoices}
      payables={payables}
      payablesAvailable={payablesAvailable}
      error={error}
      onRetry={load}
    />
  )
}
