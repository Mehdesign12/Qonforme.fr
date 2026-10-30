'use client'

export const dynamic = "force-dynamic"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import { EInvoicingHub, type HubNotice } from "@/components/e-invoicing/EInvoicingHub"
import { demoEInvoicingState } from "@/lib/demo/e-invoicing"

const HREFS = {
  connect: "/signup",
  pricing: "/signup",
  received: "/demo/received-invoices",
  importHref: "/demo/received-invoices/import",
  settings: "/demo/settings/ppf",
}

/**
 * Miroir de /facturation-electronique : raccordement actif, données d'exemple.
 * `?etat=` montre les autres états (lib/demo/e-invoicing.ts).
 */
function DemoEInvoicing() {
  const params = useSearchParams()
  const etat = params.get("etat")
  const { view, step } = demoEInvoicingState(etat)
  const [notice, setNotice] = useState<HubNotice | null>(null)
  const demoOnly = () => setNotice({ tone: "info", text: "Dans la démo, rien n'est relevé : créez votre compte pour raccorder votre entreprise." })
  return (
    <EInvoicingHub
      key={etat ?? "active"}
      view={view}
      loading={false}
      error={null}
      hrefs={HREFS}
      notice={notice}
      todayLabel="1er octobre 2026"
      initialStep={step}
      onRetry={() => {}}
      onRefresh={demoOnly}
      onRemove={demoOnly}
    />
  )
}

export default function DemoEInvoicingPage() {
  return (
    <Suspense>
      <DemoEInvoicing />
    </Suspense>
  )
}
