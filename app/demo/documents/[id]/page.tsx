'use client'

export const dynamic = "force-dynamic"

import { DocumentDetailView } from "@/components/scan/DocumentDetailView"
import { DEMO_CLIENTS, DEMO_SUB_CHANTIER_ID } from "@/lib/demo/data"
import { demoScanApi } from "@/lib/demo/scan"

const CLIENTS = DEMO_CLIENTS.map((c) => ({ id: c.id, name: c.name }))
const CHANTIERS = [{ id: DEMO_SUB_CHANTIER_ID, name: "Résidence Le Clos Fleuri" }]

/** Miroir de /documents/[id]. */
export default function DemoDocumentPage({ params }: { params: { id: string } }) {
  return <DocumentDetailView mode="demo" api={demoScanApi} id={params.id} clients={CLIENTS} chantiers={CHANTIERS} />
}
