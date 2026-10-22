'use client'

export const dynamic = "force-dynamic"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { DocumentsView } from "@/components/scan/DocumentsView"
import { DEMO_CLIENTS, DEMO_SUB_CHANTIER_ID } from "@/lib/demo/data"
import { demoScanApi } from "@/lib/demo/scan"

const CLIENTS = DEMO_CLIENTS.map((c) => ({ id: c.id, name: c.name }))
const CHANTIERS = [{ id: DEMO_SUB_CHANTIER_ID, name: "Résidence Le Clos Fleuri" }]

/** Miroir de /documents : mêmes composants, documents fictifs gardés en mémoire (rien n'est enregistré). */
function DemoDocumentsPage() {
  const params = useSearchParams()
  return <DocumentsView mode="demo" api={demoScanApi} clients={CLIENTS} chantiers={CHANTIERS} openScanner={params.get("scanner") === "1"} />
}

export default function Page() {
  return <Suspense fallback={null}><DemoDocumentsPage /></Suspense>
}
