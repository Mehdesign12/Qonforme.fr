import type { Metadata } from "next"
import { CompanySettingsForm } from "@/components/settings/CompanySettingsForm"

export const metadata: Metadata = { title: "Paramètres — Entreprise" }
export const dynamic = "force-dynamic"

export default function CompanySettingsPage() {
  return <CompanySettingsForm />
}
