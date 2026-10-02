import type { Metadata } from "next"
import BillingPageClient from "@/components/billing/BillingPageClient"
import { SettingsFrame } from "@/components/settings/SettingsFrame"
import {
  DEMO_BILLING_IDENTITY,
  DEMO_BILLING_INVOICES,
  DEMO_GUARANTEE,
  DEMO_PAYMENT_METHOD,
  DEMO_SUBSCRIPTION,
} from "@/components/settings/demo-data"

export const metadata: Metadata = { title: "Abonnement — Démo Qonforme" }

/** Démo de Paramètres › Abonnement : même page que l'application, formule Essentiel fictive. */
export default function DemoBillingPage() {
  return (
    <SettingsFrame mode="demo">
      <BillingPageClient
        mode="demo"
        subscription={DEMO_SUBSCRIPTION}
        guarantee={DEMO_GUARANTEE}
        cancelAtPeriodEnd={false}
        paymentMethod={DEMO_PAYMENT_METHOD}
        invoices={DEMO_BILLING_INVOICES}
        identity={DEMO_BILLING_IDENTITY}
      />
    </SettingsFrame>
  )
}
