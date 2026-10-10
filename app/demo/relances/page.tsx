'use client'

import { useEffect, useState } from "react"
import { RemindersView, type RemindResult } from "@/components/reminders/RemindersView"
import { isoDay } from "@/lib/treasury/forecast"
import { demoOpenInvoices } from "@/lib/demo/open-invoices"
import type { ReminderInvoice } from "@/lib/reminders/queue"

export default function DemoRelancesPage() {
  const [invoices, setInvoices] = useState<ReminderInvoice[] | null>(null)
  useEffect(() => setInvoices(demoOpenInvoices(isoDay(new Date()))), [])

  // Démo : aucun email ne part, la relance est simulée
  const remind = async (id: string): Promise<RemindResult> => {
    const inv = invoices?.find((i) => i.id === id)
    await new Promise((r) => setTimeout(r, 500))
    return { ok: true, step: inv?.reminder_1_sent_at ? 2 : 1, sentTo: inv?.client_email ?? "client" }
  }

  return (
    <RemindersView
      invoices={invoices}
      invoiceHref={(id) => `/demo/invoices/${id}`}
      treasuryHref="/demo/tresorerie"
      onRemind={remind}
    />
  )
}
