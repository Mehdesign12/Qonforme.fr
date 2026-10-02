import type { Metadata } from "next"
import { EInvoicingView } from "@/components/settings/EInvoicingView"
import { SettingsFrame } from "@/components/settings/SettingsFrame"

export const metadata: Metadata = { title: "Facturation électronique — Démo Qonforme" }

/** Démo de Paramètres › Facturation électronique : même page que l'application. */
export default function DemoPPFSettingsPage() {
  return (
    <SettingsFrame mode="demo">
      <EInvoicingView mode="demo" />
    </SettingsFrame>
  )
}
