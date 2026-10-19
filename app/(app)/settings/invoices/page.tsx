import type { Metadata } from "next"
import { InvoiceSettingsForm } from "@/components/settings/InvoiceSettingsForm"

export const metadata: Metadata = { title: "Paramètres — Modèles de documents" }
export const dynamic = "force-dynamic"

export default function InvoiceSettingsPage() {
  return <InvoiceSettingsForm />
}
