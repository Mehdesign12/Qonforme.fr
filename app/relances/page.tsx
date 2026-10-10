'use client'

export const dynamic = "force-dynamic"

import { useEffect, useState } from "react"
import { RemindersView, type RemindResult } from "@/components/reminders/RemindersView"
import type { ReminderInvoice } from "@/lib/reminders/queue"

async function remind(id: string): Promise<RemindResult> {
  try {
    const res = await fetch(`/api/invoices/${id}/remind`, { method: "POST" })
    const json = await res.json()
    if (!res.ok) return { ok: false, message: json.error || "La relance n’a pas pu être envoyée" }
    return { ok: true, step: json.reminderNumber, sentTo: json.sentTo }
  } catch {
    return { ok: false, message: "Connexion impossible, réessayez dans un instant" }
  }
}

export default function RelancesPage() {
  const [invoices, setInvoices] = useState<ReminderInvoice[] | null>(null)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch("/api/relances")
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
    <RemindersView
      invoices={invoices}
      error={error}
      invoiceHref={(id) => `/invoices/${id}`}
      treasuryHref="/tresorerie"
      onRemind={remind}
    />
  )
}
