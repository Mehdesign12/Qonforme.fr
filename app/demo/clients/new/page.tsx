export const dynamic = "force-dynamic"

import DemoNewClientForm from "@/components/demo/DemoNewClientForm"

export default function DemoNewClientPage() {
  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#0F172A] dark:text-[#E2E8F0]">Nouveau client</h1>
        <p className="text-sm text-slate-500 mt-1">Ajoutez un client en recherchant par SIREN ou en saisissant manuellement.</p>
      </div>
      <DemoNewClientForm />
    </div>
  )
}
