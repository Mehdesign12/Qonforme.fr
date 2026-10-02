'use client'

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Users } from "lucide-react"
import { EmptyState } from "@/components/app/kit"
import { SetCrumb } from "@/components/layout/crumb"
import { ClientDetailView, type ClientContactFields } from "./ClientDetailView"
import {
  buildClientDocs, localISODate, metricsByClient, metricsFor,
  type ClientRecord, type MetricCreditNote, type MetricInvoice, type MetricQuote,
} from "./client-data"

/** Réponse de GET /api/clients/[id] : la fiche et ses documents. */
interface ClientWithDocs extends ClientRecord {
  invoices: MetricInvoice[] | null
  quotes: MetricQuote[] | null
  credit_notes: MetricCreditNote[] | null
}

interface Props { clientId: string }

export function ClientDetail({ clientId }: Props) {
  const router = useRouter()
  const [client, setClient] = useState<ClientWithDocs | null>(null)
  const [loading, setLoading] = useState(true)
  const [year] = useState(() => new Date().getFullYear())

  useEffect(() => {
    fetch(`/api/clients/${clientId}`)
      .then((r) => r.json())
      .then((json) => { if (json.client) setClient(json.client) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [clientId])

  const data = useMemo(() => {
    if (!client) return null
    const invoices = client.invoices ?? []
    const quotes = client.quotes ?? []
    const creditNotes = client.credit_notes ?? []
    const metrics = metricsFor(metricsByClient(invoices, creditNotes, { year, today: localISODate() }), client.id)
    const docs = buildClientDocs({ invoices, quotes, creditNotes }, {
      invoice: (id) => `/invoices/${id}`,
      quote: (id) => `/quotes/${id}`,
      creditNote: (id) => `/credit-notes/${id}`,
    })
    return { metrics, docs }
  }, [client, year])

  // PATCH remplace toute la fiche : on renvoie aussi SIREN, TVA et pays inchangés
  const saveContact = async (fields: ClientContactFields) => {
    if (!client) return false
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fields.name.trim(),
          siren: client.siren,
          vat_number: client.vat_number,
          email: fields.email.trim() || null,
          phone: fields.phone.trim() || null,
          address: fields.address.trim() || null,
          zip_code: fields.zip_code.trim() || null,
          city: fields.city.trim() || null,
          country: client.country || "FR",
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(json.error || "Erreur lors de la sauvegarde"); return false }
      // PATCH ne renvoie que la fiche : on garde les documents déjà chargés
      setClient((prev) => prev ? {
        ...json.client,
        invoices: prev.invoices ?? [],
        quotes: prev.quotes ?? [],
        credit_notes: prev.credit_notes ?? [],
      } : prev)
      toast.success("Client mis à jour")
      return true
    } catch {
      toast.error("Erreur réseau")
      return false
    }
  }

  const archive = async () => {
    const res = await fetch(`/api/clients/${clientId}`, { method: "DELETE" })
    if (res.ok) {
      toast.success("Client archivé")
      router.push("/clients")
    } else {
      toast.error("Erreur lors de l'archivage")
    }
  }

  if (loading) {
    return (
      <div className="grid place-items-center py-24" role="status" aria-label="Chargement du client">
        <Loader2 className="size-7 animate-spin text-[var(--q-accent)]" aria-hidden />
      </div>
    )
  }

  if (!client || !data) {
    return (
      <div className="q-card">
        <EmptyState
          icon={<Users className="size-5" aria-hidden />}
          title="Client introuvable"
          text="Ce client n'existe pas ou n'est plus accessible."
          action={<Link href="/clients" className="q-btn q-btn-secondary">Retour aux clients</Link>}
        />
      </div>
    )
  }

  return (
    <>
      <SetCrumb label={client.name} />
      <ClientDetailView
        client={client}
        docs={data.docs}
        metrics={data.metrics}
        year={year}
        links={{
          list: "/clients",
          newQuote: `/quotes/new?client=${clientId}`,
          newInvoice: `/invoices/new?client=${clientId}`,
          edit: `/clients/${clientId}/edit`,
        }}
        onSave={saveContact}
        onArchive={archive}
      />
    </>
  )
}
