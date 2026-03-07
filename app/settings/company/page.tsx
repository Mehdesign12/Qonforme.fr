import type { Metadata } from "next"
import { CompanySettingsForm } from "@/components/settings/CompanySettingsForm"

export const metadata: Metadata = { title: "Paramètres — Entreprise" }
export const dynamic = "force-dynamic"

export default function CompanySettingsPage() {
  return (
    <div className="max-w-2xl animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#0F172A]">Mon entreprise</h1>
        <p className="text-sm text-slate-500 mt-1">
          Ces informations apparaissent sur toutes vos factures et devis.
        </p>
      </div>
      <CompanySettingsForm />
    </div>
  )
}
