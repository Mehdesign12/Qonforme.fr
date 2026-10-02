"use client"

import { useMemo } from "react"
import { notFound, useParams } from "next/navigation"
import { toast } from "sonner"
import { SetCrumb } from "@/components/layout/crumb"
import { ClientDetailView } from "@/components/clients/ClientDetailView"
import { buildClientDocs, metricsByClient, metricsFor } from "@/components/clients/client-data"
import {
  DEMO_YEAR, demoClientRecord, demoMetricCreditNotes, demoMetricInvoices, demoMetricQuotes,
} from "@/components/clients/demo-clients"
import { DEMO_CLIENTS, DEMO_TODAY } from "@/lib/demo/data"

const demoCta = (message: string) =>
  toast(message, { action: { label: "Créer mon compte", onClick: () => { window.location.href = "/signup" } } })

/** Miroir de /clients/[id] alimenté par lib/demo/data.ts. */
export default function DemoClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const source = DEMO_CLIENTS.find((c) => c.id === id)

  const data = useMemo(() => {
    if (!source) return null
    const client = demoClientRecord(source)
    const invoices = demoMetricInvoices().filter((i) => i.client_id === client.id)
    const creditNotes = demoMetricCreditNotes().filter((c) => c.client_id === client.id)
    const quotes = demoMetricQuotes(client.id)
    return {
      client,
      metrics: metricsFor(metricsByClient(invoices, creditNotes, { year: DEMO_YEAR, today: DEMO_TODAY }), client.id),
      docs: buildClientDocs({ invoices, quotes, creditNotes }, {
        invoice: (docId) => `/demo/invoices/${docId}`,
        quote: (docId) => `/demo/quotes/${docId}`,
        creditNote: () => "/demo/credit-notes",
      }),
    }
  }, [source])

  if (!data) notFound()

  return (
    <>
      <SetCrumb label={data.client.name} />
      <ClientDetailView
        client={data.client}
        docs={data.docs}
        metrics={data.metrics}
        year={DEMO_YEAR}
        links={{ list: "/demo/clients", newQuote: "/demo/quotes/new", newInvoice: "/demo/invoices/new" }}
        onSave={() => { demoCta("Créez un compte pour modifier vos clients"); return true }}
        onArchive={() => { demoCta("Créez un compte pour archiver vos clients") }}
        onContact={() => demoCta("Démo : les coordonnées sont fictives. Créez un compte pour contacter vos clients")}
      />
    </>
  )
}
