import type { Metadata } from "next"
import { DEMO_COMPANY, DEMO_REMINDER_SETTINGS } from "@/lib/demo/data"
import { DEMO_IDENTITY } from "@/components/layout/shell"
import { NotificationsView } from "@/components/settings/NotificationsView"
import { SettingsFrame } from "@/components/settings/SettingsFrame"

export const metadata: Metadata = { title: "Relances et notifications — Démo Qonforme" }

/** Démo de Paramètres › Relances : même page que l'application, réglages d'exemple. */
export default function DemoNotificationsPage() {
  return (
    <SettingsFrame mode="demo">
      <NotificationsView
        mode="demo"
        companyEmail={DEMO_COMPANY.email}
        accountEmail={DEMO_IDENTITY.email}
        hasPlan
        company={{ name: DEMO_COMPANY.name, iban: DEMO_COMPANY.iban, accentColor: null }}
        demoSettings={DEMO_REMINDER_SETTINGS}
      />
    </SettingsFrame>
  )
}
