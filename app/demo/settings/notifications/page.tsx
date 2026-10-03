import type { Metadata } from "next"
import { DEMO_COMPANY } from "@/lib/demo/data"
import { DEMO_IDENTITY } from "@/components/layout/shell"
import { NotificationsView } from "@/components/settings/NotificationsView"
import { SettingsFrame } from "@/components/settings/SettingsFrame"

export const metadata: Metadata = { title: "Notifications — Démo" }

/** Démo de Paramètres › Notifications : même page que l'application, données fictives. */
export default function DemoNotificationsPage() {
  return (
    <SettingsFrame mode="demo">
      <NotificationsView mode="demo" companyEmail={DEMO_COMPANY.email} accountEmail={DEMO_IDENTITY.email} hasPlan />
    </SettingsFrame>
  )
}
