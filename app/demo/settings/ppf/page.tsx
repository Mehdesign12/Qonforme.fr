'use client'

import { useState } from "react"
import { EInvoicingSettings } from "@/components/e-invoicing/EInvoicingSettings"
import { SettingsFrame } from "@/components/settings/SettingsFrame"
import type { HubNotice } from "@/components/e-invoicing/EInvoicingHub"
import { DEMO_E_INVOICING } from "@/lib/demo/e-invoicing"

/** Démo de Paramètres › Facturation électronique : même page que l'application, raccordement d'exemple. */
export default function DemoPPFSettingsPage() {
  const [notice, setNotice] = useState<HubNotice | null>(null)
  const demoOnly = () => setNotice({ tone: "info", text: "Dans la démo, rien n'est enregistré : créez votre compte pour raccorder votre entreprise." })
  return (
    <SettingsFrame mode="demo">
      <EInvoicingSettings
        mode="demo"
        view={DEMO_E_INVOICING}
        loading={false}
        error={null}
        notice={notice}
        hubHref="/demo/facturation-electronique"
        receivedHref="/demo/received-invoices"
        onRetry={() => {}}
        onRefresh={demoOnly}
        onRemove={demoOnly}
        onNotify={async () => { demoOnly(); return false }}
      />
    </SettingsFrame>
  )
}
