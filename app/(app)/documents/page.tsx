'use client'

export const dynamic = "force-dynamic"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { DocumentsView } from "@/components/scan/DocumentsView"
import { appScanApi } from "@/lib/scan/api"

/** Documents scannés : ouverts à tous les comptes (le quota dépend de la formule). */
function DocumentsPage() {
  const params = useSearchParams()
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [chantiers, setChantiers] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    fetch("/api/clients").then((r) => r.json()).then((j) => {
      if (Array.isArray(j.clients)) setClients(j.clients.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })))
    }).catch(() => {})
    // Chantiers : table facultative (formule Artisan), la liste reste vide sans elle
    fetch("/api/chantiers").then((r) => r.json()).then((j) => {
      if (j.available !== false && Array.isArray(j.chantiers)) setChantiers(j.chantiers.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })))
    }).catch(() => {})
  }, [])

  return <DocumentsView mode="app" api={appScanApi} clients={clients} chantiers={chantiers} openScanner={params.get("scanner") === "1"} />
}

export default function Page() {
  return <Suspense fallback={null}><DocumentsPage /></Suspense>
}
