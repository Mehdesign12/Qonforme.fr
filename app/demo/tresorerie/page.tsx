'use client'

import { useEffect, useState } from "react"
import { TreasuryView } from "@/components/treasury/TreasuryView"
import { isoDay } from "@/lib/treasury/forecast"
import { demoOpenInvoices } from "@/lib/demo/open-invoices"
import type { ForecastInvoice } from "@/lib/treasury/forecast"

export default function DemoTresoreriePage() {
  const [invoices, setInvoices] = useState<ForecastInvoice[] | null>(null)
  useEffect(() => setInvoices(demoOpenInvoices(isoDay(new Date()))), [])

  return (
    <TreasuryView
      invoices={invoices}
      invoiceHref={(id) => `/demo/invoices/${id}`}
      newInvoiceHref="/demo/invoices/new"
      remindersHref="/demo/relances"
    />
  )
}
