'use client'

export const dynamic = "force-dynamic"

import { RemindersView } from "@/components/reminders/RemindersView"
import { DEMO_REMINDER_SETTINGS, DEMO_TODAY } from "@/lib/demo/data"
import { demoQueueInvoices, demoQueueQuotes } from "@/lib/demo/reminders"

/** Miroir de /relances : même file, factures et devis de la démo. */
export default function DemoRelancesPage() {
  return (
    <RemindersView
      mode="demo"
      today={DEMO_TODAY}
      data={{ settings: DEMO_REMINDER_SETTINGS, invoices: demoQueueInvoices(), quotes: demoQueueQuotes(), legacy: false, hasPlan: true }}
    />
  )
}
