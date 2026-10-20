import type { Metadata } from "next"
import { AccountantAccessView } from "@/components/accountant/AccountantAccessView"

export const metadata: Metadata = { title: "Accès comptable" }
export const dynamic = "force-dynamic"

/** Paramètres › Accès comptable : les données se chargent par /api/accountant-access. */
export default function AccountantAccessPage() {
  return <AccountantAccessView mode="app" />
}
