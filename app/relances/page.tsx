'use client'

export const dynamic = "force-dynamic"

import { useCallback, useEffect, useState } from "react"
import { RemindersView } from "@/components/reminders/RemindersView"
import { todayInParis } from "@/lib/utils/paris-date"
import type { ReminderSettings } from "@/lib/reminders/settings"
import type { QueueInvoice, QueueQuote } from "@/lib/reminders/queue"

type Data = { settings: ReminderSettings; invoices: QueueInvoice[]; quotes: QueueQuote[]; legacy: boolean; hasPlan: boolean | null }

/** Relances : file d'envoi du cron, factures relancées jusqu'au bout, historique (lib/reminders/queue.ts). */
export default function RelancesPage() {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Date du jour lue après le montage : le serveur et le navigateur peuvent ne pas être le même jour
  const [today, setToday] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    setData(null)
    try {
      const res = await fetch("/api/relances")
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? "Erreur réseau")
      setData({
        settings: json.settings,
        invoices: Array.isArray(json.invoices) ? json.invoices : [],
        quotes: Array.isArray(json.quotes) ? json.quotes : [],
        legacy: json.legacy === true,
        hasPlan: typeof json.hasPlan === "boolean" ? json.hasPlan : null,
      })
    } catch {
      setError("Vérifiez votre connexion, puis réessayez.")
    }
  }, [])

  useEffect(() => {
    setToday(todayInParis())
    void load()
  }, [load])

  return <RemindersView mode="app" today={today} data={data} error={error} onRetry={load} />
}
