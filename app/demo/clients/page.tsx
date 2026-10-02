"use client"

import { useMemo } from "react"
import { toast } from "sonner"
import { ClientsListView, type ClientRow } from "@/components/clients/ClientsListView"
import { metricsByClient, metricsFor } from "@/components/clients/client-data"
import {
  DEMO_YEAR, demoClientRecords, demoMetricCreditNotes, demoMetricInvoices,
} from "@/components/clients/demo-clients"
import { DEMO_TODAY } from "@/lib/demo/data"

/** Démo : invitation à créer un compte à la place des actions qui enregistrent. */
const demoCta = (message: string) =>
  toast(message, { action: { label: "Créer mon compte", onClick: () => { window.location.href = "/signup" } } })

/** Miroir de /clients alimenté par lib/demo/data.ts. */
export default function DemoClientsPage() {
  const rows = useMemo<ClientRow[]>(() => {
    const metrics = metricsByClient(demoMetricInvoices(), demoMetricCreditNotes(), { year: DEMO_YEAR, today: DEMO_TODAY })
    return demoClientRecords().map((c) => ({ ...c, metrics: metricsFor(metrics, c.id) }))
  }, [])

  return (
    <ClientsListView
      rows={rows}
      hasMetrics
      year={DEMO_YEAR}
      newHref="/demo/clients/new"
      detailHref={(id) => `/demo/clients/${id}`}
      onEdit={() => demoCta("Créez un compte pour modifier vos clients")}
      onArchive={() => { demoCta("Créez un compte pour archiver vos clients"); return true }}
    />
  )
}
