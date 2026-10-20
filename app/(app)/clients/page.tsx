'use client'

export const dynamic = "force-dynamic"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { ClientsListView, type ClientRow } from "@/components/clients/ClientsListView"
import {
  localISODate, metricsByClient, metricsFor,
  type ClientRecord, type MetricCreditNote, type MetricInvoice,
} from "@/components/clients/client-data"

/**
 * Liste des clients. Les clients (archivés compris, pour l'onglet « Archivés »)
 * viennent de /api/clients ; ce qui reste à encaisser et le chiffre d'affaires
 * se calculent à partir des factures et des avoirs. Si ces deux lectures
 * échouent, la liste s'affiche quand même, sans les montants.
 */
export default function ClientsPage() {
  const [rows, setRows] = useState<ClientRow[] | null>(null)
  const [hasMetrics, setHasMetrics] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [year] = useState(() => new Date().getFullYear())

  const fetchClients = useCallback(async () => {
    setError(null)
    const [clientsRes, invoicesRes, creditRes] = await Promise.allSettled([
      fetch("/api/clients?archived=true").then((r) => (r.ok ? r.json() : Promise.reject(r))),
      fetch("/api/invoices").then((r) => (r.ok ? r.json() : Promise.reject(r))),
      fetch("/api/credit-notes").then((r) => (r.ok ? r.json() : Promise.reject(r))),
    ])

    if (clientsRes.status !== "fulfilled" || !Array.isArray(clientsRes.value?.clients)) {
      setRows(null)
      setError("Vérifiez votre connexion puis réessayez.")
      return
    }

    const metricsOk =
      invoicesRes.status === "fulfilled" && Array.isArray(invoicesRes.value?.invoices) &&
      creditRes.status === "fulfilled" && Array.isArray(creditRes.value?.credit_notes)
    const metrics = metricsOk
      ? metricsByClient(
          invoicesRes.value.invoices as MetricInvoice[],
          creditRes.value.credit_notes as MetricCreditNote[],
          { year, today: localISODate() },
        )
      : null

    const clients = clientsRes.value.clients as ClientRecord[]
    setHasMetrics(metricsOk)
    setRows(clients.map((c) => ({ ...c, metrics: metrics ? metricsFor(metrics, c.id) : null })))
  }, [year])

  useEffect(() => { fetchClients() }, [fetchClients])

  const archiveClient = async (row: ClientRow) => {
    const res = await fetch(`/api/clients/${row.id}`, { method: "DELETE" })
    if (!res.ok) {
      toast.error("Erreur lors de l'archivage")
      return false
    }
    toast.success("Client archivé")
    fetchClients()
    return true
  }

  return (
    <ClientsListView
      rows={rows}
      hasMetrics={hasMetrics}
      year={year}
      newHref="/clients/new"
      detailHref={(id) => `/clients/${id}`}
      editHref={(id) => `/clients/${id}/edit`}
      onArchive={archiveClient}
      error={error}
      onRetry={() => { setRows(null); fetchClients() }}
    />
  )
}
