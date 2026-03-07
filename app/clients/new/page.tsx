import type { Metadata } from "next"
import { NewClientForm } from "@/components/clients/NewClientForm"

export const metadata: Metadata = { title: "Nouveau client" }
export const dynamic = "force-dynamic"

export default function NewClientPage() {
  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#0F172A]">Nouveau client</h1>
        <p className="text-sm text-slate-500 mt-1">Ajoutez un client en recherchant par SIREN ou en saisissant manuellement.</p>
      </div>
      <NewClientForm />
    </div>
  )
}
