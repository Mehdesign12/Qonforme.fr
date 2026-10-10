'use client'

export const dynamic = "force-dynamic"

import { TreasuryView } from "@/components/treasury/TreasuryView"
import { DEMO_TODAY } from "@/lib/demo/data"
import { demoTreasuryInvoices, demoTreasuryPayables } from "@/lib/demo/treasury"

/** Miroir de /tresorerie : mêmes calculs, factures émises et reçues de la démo. */
export default function DemoTresoreriePage() {
  return (
    <TreasuryView
      mode="demo"
      today={DEMO_TODAY}
      invoices={demoTreasuryInvoices()}
      payables={demoTreasuryPayables()}
      payablesAvailable
    />
  )
}
