'use client'

export const dynamic = "force-dynamic"

import { EInvoicingSettings } from "@/components/e-invoicing/EInvoicingSettings"
import { RemoveDialog } from "@/components/e-invoicing/RemoveDialog"
import { useEInvoicing } from "@/components/e-invoicing/useEInvoicing"

/** Paramètres › Facturation électronique : raccordement à Super PDP et notifications. */
export default function PPFSettingsPage() {
  const e = useEInvoicing()
  return (
    <>
      <EInvoicingSettings
        mode="app"
        view={e.view}
        loading={e.loading}
        error={e.error}
        busy={e.busy}
        notice={e.notice}
        hubHref="/facturation-electronique"
        receivedHref="/received-invoices"
        onRetry={e.load}
        onRefresh={e.refresh}
        onRemove={() => e.setConfirmRemove(true)}
        onNotify={e.notify}
      />
      <RemoveDialog open={e.confirmRemove} loading={e.removing} onClose={() => e.setConfirmRemove(false)} onConfirm={e.remove} />
    </>
  )
}
