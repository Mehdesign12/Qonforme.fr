'use client'

export const dynamic = "force-dynamic"

import { ReceivedInvoiceList } from "@/components/reception/ReceivedInvoiceList"
import { DEMO_TODAY } from "@/lib/demo/data"
import { DEMO_RECEIVED_LIST } from "@/lib/demo/reception"

/** Miroir de /received-invoices : même liste, factures fournisseurs fictives. */
export default function DemoReceivedInvoicesPage() {
  return (
    <ReceivedInvoiceList
      invoices={DEMO_RECEIVED_LIST}
      today={DEMO_TODAY}
      hrefFor={(id) => `/demo/received-invoices/${id}`}
      importHref="/demo/received-invoices/import"
      settingsHref="/demo/settings/ppf"
    />
  )
}
