import type { Metadata } from "next"
import { DEMO_COMPANY } from "@/lib/demo/data"
import { ExportsView } from "@/components/settings/ExportsView"

export const metadata: Metadata = { title: "Exports comptables — Démo" }

/** Démo des exports comptables : même page que l'application, rien n'est téléchargé. */
export default function DemoExportsPage() {
  return <ExportsView mode="demo" siren={DEMO_COMPANY.siren} sirenMissing={false} hasIssued />
}
