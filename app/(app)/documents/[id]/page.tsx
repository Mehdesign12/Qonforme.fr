'use client'

export const dynamic = "force-dynamic"

import { useEffect, useState } from "react"
import { DocumentDetailView } from "@/components/scan/DocumentDetailView"
import { appScanApi } from "@/lib/scan/api"

/** Fiche d'un document scanné. */
export default function DocumentPage({ params }: { params: { id: string } }) {
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [chantiers, setChantiers] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    fetch("/api/clients").then((r) => r.json()).then((j) => {
      if (Array.isArray(j.clients)) setClients(j.clients.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })))
    }).catch(() => {})
    fetch("/api/chantiers").then((r) => r.json()).then((j) => {
      if (j.available !== false && Array.isArray(j.chantiers)) setChantiers(j.chantiers.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })))
    }).catch(() => {})
  }, [])

  return <DocumentDetailView mode="app" api={appScanApi} id={params.id} clients={clients} chantiers={chantiers} />
}
