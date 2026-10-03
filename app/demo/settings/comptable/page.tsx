import type { Metadata } from "next"
import { AccountantAccessView } from "@/components/accountant/AccountantAccessView"
import { SettingsFrame } from "@/components/settings/SettingsFrame"
import { DEMO_ACCESS_OVERVIEW } from "@/lib/demo/accountant"

export const metadata: Metadata = { title: "Accès comptable — Démo Qonforme" }

/** Démo de Paramètres › Accès comptable : même page que l'application, accès et journal d'exemple. */
export default function DemoAccountantAccessPage() {
  return (
    <SettingsFrame mode="demo">
      <AccountantAccessView mode="demo" demoOverview={DEMO_ACCESS_OVERVIEW} />
    </SettingsFrame>
  )
}
