import type { Metadata } from "next"
import { InvoiceSettingsForm } from "@/components/settings/InvoiceSettingsForm"

export const metadata: Metadata = { title: "Paramètres — Facturation" }
export const dynamic = "force-dynamic"

export default function InvoiceSettingsPage() {
  return (
    <div className="max-w-2xl animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#0F172A]">Personnalisation des factures</h1>
        <p className="text-sm text-slate-500 mt-1">
          Logo, mentions légales et couleur appliqués sur toutes vos factures.
        </p>
      </div>
      <InvoiceSettingsForm />
    </div>
  )
}
