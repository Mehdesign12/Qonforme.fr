import type { Metadata } from "next"
import { DEMO_COMPANY } from "@/lib/demo/data"
import { DEMO_IDENTITY } from "@/components/layout/shell"
import { SettingsFrame } from "@/components/settings/SettingsFrame"
import { SettingsOverview } from "@/components/settings/SettingsOverview"
import { DEMO_PLAN } from "@/components/settings/demo-data"

export const metadata: Metadata = { title: "Paramètres — Démo Qonforme" }

/** Démo de l'accueil des paramètres : même liste que l'application, données fictives. */
export default function DemoSettingsPage() {
  return (
    <SettingsFrame mode="demo">
      <SettingsOverview
        mode="demo"
        company={{
          name: DEMO_COMPANY.name,
          siren: DEMO_COMPANY.siren,
          city: DEMO_COMPANY.city,
          vat_number: DEMO_COMPANY.vat_number,
          iban: DEMO_COMPANY.iban,
        }}
        plan={DEMO_PLAN}
        email={DEMO_IDENTITY.email}
      />
    </SettingsFrame>
  )
}
