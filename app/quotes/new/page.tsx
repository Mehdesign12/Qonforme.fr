import type { Metadata } from "next"
import NewQuoteForm from "@/components/quotes/NewQuoteForm"

export const metadata: Metadata = { title: "Nouveau devis" }
export const dynamic = "force-dynamic"

export default function NewQuotePage() {
  return (
    <div className="max-w-4xl animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#0F172A]">Nouveau devis</h1>
        <p className="text-sm text-slate-400 mt-0.5">Numérotation automatique D-{new Date().getFullYear()}-XXX</p>
      </div>
      <NewQuoteForm />
    </div>
  )
}
