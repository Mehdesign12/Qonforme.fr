import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight, BookOpen } from "lucide-react"
import { GUIDES } from "@/lib/pseo/guides"
import Footer from "@/components/layout/Footer"

const LOGO_URL = "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20long%20simple.png"

export const metadata: Metadata = {
  title: "Guides pratiques facturation | Qonforme",
  description: "Guides complets sur la facturation en France : mentions obligatoires, TVA, delais de paiement, facture electronique 2026. Tout savoir pour etre en conformite.",
  keywords: ["guide facturation", "mentions obligatoires facture", "facture electronique 2026", "TVA facture"],
  alternates: { canonical: "/guide" },
  openGraph: {
    title: "Guides pratiques facturation | Qonforme",
    description: "Tout savoir sur la facturation en France. Guides complets et gratuits.",
    url: "https://qonforme.fr/guide",
    images: [{ url: "/api/og?title=Guides%20pratiques%20facturation&subtitle=R%C3%A8gles%2C%20obligations%20et%20bonnes%20pratiques", width: 1200, height: 630 }],
  },
}

export default function GuideIndexPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Guides pratiques facturation",
    description: "Guides complets sur la facturation en France.",
    url: "https://qonforme.fr/guide",
    publisher: { "@type": "Organization", name: "Qonforme", url: "https://qonforme.fr" },
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="min-h-screen bg-[#F8FAFC]">
        {/* Nav */}
        <nav className="border-b border-[#E2E8F0] bg-white">
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/"><Image src={LOGO_URL} alt="Qonforme" width={130} height={32} className="h-7 w-auto object-contain" sizes="130px" priority /></Link>
            <div className="flex items-center gap-4">
              <Link href="/pricing" className="text-sm text-slate-600 hover:text-[#2563EB]">Tarifs</Link>
              <Link href="/signup" className="px-4 py-2 text-sm font-semibold text-white bg-[#2563EB] rounded-lg hover:bg-[#1D4ED8]">Essayer gratuitement</Link>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <header className="bg-gradient-to-b from-white to-[#F8FAFC] border-b border-[#E2E8F0]">
          <div className="max-w-5xl mx-auto px-4 py-16 text-center">
            <p className="text-sm font-medium text-[#2563EB] mb-3">Ressources</p>
            <h1 className="text-3xl sm:text-4xl font-bold text-[#0F172A] leading-tight">
              Guides pratiques facturation
            </h1>
            <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
              Mentions obligatoires, TVA, delais de paiement, facture electronique... Tout ce qu&apos;il faut savoir pour facturer en conformite en 2026.
            </p>
          </div>
        </header>

        {/* Guides list */}
        <section className="max-w-5xl mx-auto px-4 py-16">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {GUIDES.map((guide) => (
              <Link
                key={guide.slug}
                href={`/guide/${guide.slug}`}
                className="group bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm hover:shadow-md hover:border-[#2563EB]/30 transition-all flex flex-col"
              >
                <div className="w-10 h-10 rounded-lg bg-[#EFF6FF] flex items-center justify-center mb-4">
                  <BookOpen className="w-5 h-5 text-[#2563EB]" />
                </div>
                <h2 className="font-semibold text-[#0F172A] group-hover:text-[#2563EB] transition-colors mb-2">
                  {guide.titre}
                </h2>
                <p className="text-sm text-slate-500 leading-relaxed line-clamp-3 flex-1">{guide.description}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[#2563EB]">
                  Lire le guide <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="bg-[#0F172A] text-white">
          <div className="max-w-5xl mx-auto px-4 py-16 text-center">
            <h2 className="text-2xl font-bold mb-4">Pret a simplifier votre facturation ?</h2>
            <p className="text-slate-300 mb-8 max-w-xl mx-auto">
              Creez vos factures conformes en quelques clics. Qonforme gere les mentions obligatoires pour vous.
            </p>
            <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-3.5 text-sm font-bold bg-[#2563EB] rounded-xl hover:bg-[#1D4ED8] shadow-lg">
              Commencer gratuitement <ArrowRight className="w-4 h-4" />
            </Link>
            <div className="mt-12 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-400">
              <Link href="/facturation" className="hover:text-white">Facturation par metier</Link>
              <Link href="/modele" className="hover:text-white">Modeles gratuits</Link>
              <Link href="/pricing" className="hover:text-white">Tarifs</Link>
              <Link href="/blog" className="hover:text-white">Blog</Link>
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </>
  )
}
