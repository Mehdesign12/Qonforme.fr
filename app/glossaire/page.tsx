import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, BookOpen } from "lucide-react"
import { GLOSSAIRE } from "@/lib/pseo/glossaire"
import Footer from "@/components/layout/Footer"
import PublicHeaderWrapper from "@/components/layout/PublicHeaderWrapper"


export const metadata: Metadata = {
  title: "Glossaire facturation — Definitions et termes cles | Qonforme",
  description: "Glossaire complet de la facturation : acompte, avoir, Factur-X, TVA, FEC, PDP, penalites de retard. Toutes les definitions pour comprendre la facturation en France.",
  keywords: ["glossaire facturation", "definition facture", "termes facturation", "lexique comptabilite"],
  alternates: { canonical: "/glossaire" },
  openGraph: {
    title: "Glossaire facturation | Qonforme",
    description: "Toutes les definitions pour comprendre la facturation en France.",
    url: "https://qonforme.fr/glossaire",
    images: [{ url: "/api/og?title=Glossaire%20facturation&subtitle=D%C3%A9finitions%20et%20termes%20cl%C3%A9s", width: 1200, height: 630 }],
  },
}

export default function GlossaireIndexPage() {
  const sorted = [...GLOSSAIRE].sort((a, b) => a.terme.localeCompare(b.terme, "fr"))

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <PublicHeaderWrapper />

      <header className="bg-gradient-to-b from-white to-[#F8FAFC] border-b border-[#E2E8F0]">
        <div className="max-w-5xl mx-auto px-4 py-16 text-center">
          <p className="text-sm font-medium text-[#2563EB] mb-3">Ressources</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-[#0F172A] leading-tight">Glossaire facturation</h1>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
            {GLOSSAIRE.length} definitions pour comprendre la facturation, la TVA, la conformite et les obligations legales en France.
          </p>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-4 py-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((terme) => (
            <Link
              key={terme.slug}
              href={`/glossaire/${terme.slug}`}
              className="group bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm hover:shadow-md hover:border-[#2563EB]/30 transition-all"
            >
              <div className="flex items-start justify-between mb-2">
                <h2 className="font-bold text-[#0F172A] group-hover:text-[#2563EB] transition-colors">{terme.terme}</h2>
                <BookOpen className="w-4 h-4 text-slate-400 group-hover:text-[#2563EB] transition-colors shrink-0 mt-1" />
              </div>
              <p className="text-sm text-slate-500 leading-relaxed line-clamp-2">{terme.definition}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-[#0F172A] text-white">
        <div className="max-w-5xl mx-auto px-4 py-16 text-center">
          <h2 className="text-2xl font-bold mb-4">Tout est plus simple avec Qonforme</h2>
          <p className="text-slate-300 mb-8 max-w-xl mx-auto">Qonforme gere automatiquement les mentions obligatoires, la TVA, la numerotation et le format Factur-X.</p>
          <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-3.5 text-sm font-bold bg-[#2563EB] rounded-xl hover:bg-[#1D4ED8] shadow-lg">
            Commencer gratuitement <ArrowRight className="w-4 h-4" />
          </Link>
          <div className="mt-12 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-400">
            <Link href="/facturation" className="hover:text-white">Facturation par metier</Link>
            <Link href="/guide" className="hover:text-white">Guides pratiques</Link>
            <Link href="/comparatif" className="hover:text-white">Comparatifs</Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
