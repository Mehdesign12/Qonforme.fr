import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight, FileText, Receipt, FileCheck, ClipboardList, Mail } from "lucide-react"
import { MODELES } from "@/lib/pseo/modeles"
import Footer from "@/components/layout/Footer"

const LOGO_URL = "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20long%20simple.png"

export const metadata: Metadata = {
  title: "Modeles de factures et devis gratuits | Qonforme",
  description: "Modeles gratuits de factures, devis, avoirs et bons de commande. Conformes a la reglementation francaise 2026, prets a utiliser.",
  keywords: ["modele facture gratuit", "modele devis gratuit", "modele avoir", "modele bon de commande"],
  alternates: { canonical: "/modele" },
  openGraph: {
    title: "Modeles de factures et devis gratuits | Qonforme",
    description: "Modeles gratuits et conformes. Factures, devis, avoirs, bons de commande.",
    url: "https://qonforme.fr/modele",
    images: [{ url: "/api/og?title=Mod%C3%A8les%20gratuits&subtitle=Factures%2C%20devis%2C%20avoirs%20et%20bons%20de%20commande", width: 1200, height: 630 }],
  },
}

const TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  facture: { label: "Facture", icon: <Receipt className="w-4 h-4" /> },
  devis: { label: "Devis", icon: <FileText className="w-4 h-4" /> },
  avoir: { label: "Avoir", icon: <FileCheck className="w-4 h-4" /> },
  "bon-de-commande": { label: "Bon de commande", icon: <ClipboardList className="w-4 h-4" /> },
  relance: { label: "Relance", icon: <Mail className="w-4 h-4" /> },
}

export default function ModeleIndexPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Modeles de factures et devis gratuits",
    description: "Modeles gratuits conformes a la reglementation francaise.",
    url: "https://qonforme.fr/modele",
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
              Modeles gratuits de factures et devis
            </h1>
            <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
              Telechargez nos modeles conformes a la reglementation francaise 2026. Factures, devis, avoirs et bons de commande prets a utiliser.
            </p>
          </div>
        </header>

        {/* Modeles grid */}
        <section className="max-w-5xl mx-auto px-4 py-16">
          <div className="grid sm:grid-cols-2 gap-6">
            {MODELES.map((modele) => {
              const typeInfo = TYPE_LABELS[modele.type] ?? { label: modele.type, icon: <FileText className="w-4 h-4" /> }
              return (
                <Link
                  key={modele.slug}
                  href={`/modele/${modele.slug}`}
                  className="group bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm hover:shadow-md hover:border-[#2563EB]/30 transition-all"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EFF6FF] text-[#2563EB] text-xs font-medium">
                      {typeInfo.icon}
                      {typeInfo.label}
                    </span>
                  </div>
                  <h2 className="font-semibold text-[#0F172A] group-hover:text-[#2563EB] transition-colors mb-2">
                    {modele.titre}
                  </h2>
                  <p className="text-sm text-slate-500 leading-relaxed line-clamp-2 mb-4">{modele.description}</p>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-[#2563EB]">
                    Voir le modele <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </Link>
              )
            })}
          </div>
        </section>

        {/* CTA */}
        <section className="bg-[#0F172A] text-white">
          <div className="max-w-5xl mx-auto px-4 py-16 text-center">
            <h2 className="text-2xl font-bold mb-4">Creez vos documents en ligne</h2>
            <p className="text-slate-300 mb-8 max-w-xl mx-auto">
              Plutot que de remplir un modele manuellement, utilisez Qonforme pour generer vos factures et devis conformes automatiquement.
            </p>
            <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-3.5 text-sm font-bold bg-[#2563EB] rounded-xl hover:bg-[#1D4ED8] shadow-lg">
              Commencer gratuitement <ArrowRight className="w-4 h-4" />
            </Link>
            <div className="mt-12 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-400">
              <Link href="/facturation" className="hover:text-white">Facturation par metier</Link>
              <Link href="/guide" className="hover:text-white">Guides pratiques</Link>
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
