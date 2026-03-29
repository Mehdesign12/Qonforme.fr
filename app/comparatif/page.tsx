import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight, Scale } from "lucide-react"
import { COMPARATIFS } from "@/lib/pseo/comparatifs"
import Footer from "@/components/layout/Footer"

const LOGO_URL = "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20long%20bleu.webp"

export const metadata: Metadata = {
  title: "Comparatifs logiciels de facturation 2026 | Qonforme",
  description: "Comparez Qonforme aux alternatives : Henrri, Facture.net, Tiime, Abby, Pennylane, Indy. Fonctionnalites, prix, conformite Factur-X.",
  keywords: ["comparatif logiciel facturation", "alternative henrri", "alternative facture.net", "meilleur logiciel facturation 2026"],
  alternates: { canonical: "/comparatif" },
  openGraph: {
    title: "Comparatifs logiciels de facturation 2026 | Qonforme",
    description: "Comparez Qonforme aux alternatives. Fonctionnalites, prix, Factur-X.",
    url: "https://qonforme.fr/comparatif",
    images: [{ url: "/api/og?title=Comparatifs%20facturation%202026&subtitle=Qonforme%20vs%20les%20alternatives", width: 1200, height: 630 }],
  },
}

export default function ComparatifIndexPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-[#E2E8F0] bg-white">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/"><Image src={LOGO_URL} alt="Qonforme" width={130} height={32} className="h-7 w-auto object-contain" sizes="130px" priority /></Link>
          <div className="flex items-center gap-4">
            <Link href="/signup" className="px-3 py-2 text-xs sm:text-sm font-semibold text-white bg-[#2563EB] rounded-lg hover:bg-[#1D4ED8]">Essayer gratuitement</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="bg-gradient-to-b from-white to-[#F8FAFC] border-b border-[#E2E8F0]">
        <div className="max-w-5xl mx-auto px-4 py-16 text-center">
          <p className="text-sm font-medium text-[#2563EB] mb-3">Comparatifs</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-[#0F172A] leading-tight">
            Qonforme vs les alternatives
          </h1>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
            Comparez Qonforme aux principaux logiciels de facturation. Fonctionnalites, prix, conformite Factur-X 2026.
          </p>
        </div>
      </header>

      {/* Grid */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <div className="grid sm:grid-cols-2 gap-6">
          {COMPARATIFS.map((comp) => (
            <Link
              key={comp.slug}
              href={`/comparatif/${comp.slug}`}
              className="group bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm hover:shadow-md hover:border-[#2563EB]/30 transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <Scale className="w-5 h-5 text-[#2563EB]" />
                <h2 className="font-bold text-[#0F172A] group-hover:text-[#2563EB] transition-colors">
                  Qonforme vs {comp.nom}
                </h2>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed line-clamp-2 mb-3">{comp.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">A partir de {comp.prix}</span>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-[#2563EB]">
                  Comparer <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#0F172A] text-white">
        <div className="max-w-5xl mx-auto px-4 py-16 text-center">
          <h2 className="text-2xl font-bold mb-4">Convaincu ?</h2>
          <p className="text-slate-300 mb-8 max-w-xl mx-auto">Essayez Qonforme gratuitement. Conforme Factur-X 2026, a partir de 9 €/mois.</p>
          <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-3.5 text-sm font-bold bg-[#2563EB] rounded-xl hover:bg-[#1D4ED8] shadow-lg">
            Commencer gratuitement <ArrowRight className="w-4 h-4" />
          </Link>
          <div className="mt-12 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-400">
            <Link href="/facturation" className="hover:text-white">Facturation par metier</Link>
            <Link href="/guide" className="hover:text-white">Guides pratiques</Link>
            <Link href="/pricing" className="hover:text-white">Tarifs</Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
