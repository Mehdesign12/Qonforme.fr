import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight, Wrench, Briefcase, Heart, Scissors, Car } from "lucide-react"
import { METIERS } from "@/lib/pseo/metiers"
import Footer from "@/components/layout/Footer"

const LOGO_URL = "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20long%20bleu.webp"

export const metadata: Metadata = {
  title: "Logiciel de facturation par metier | Qonforme",
  description: "Decouvrez notre logiciel de facturation adapte a votre metier : BTP, freelance, sante, artisanat, transport. Factures et devis conformes Factur-X 2026.",
  keywords: ["logiciel facturation", "facturation par metier", "facture BTP", "facture freelance", "facture artisan"],
  alternates: { canonical: "/facturation" },
  openGraph: {
    title: "Logiciel de facturation par metier | Qonforme",
    description: "Facturation adaptee a chaque metier. Conforme Factur-X 2026.",
    url: "https://qonforme.fr/facturation",
    images: [{ url: "/api/og?title=Facturation%20par%20m%C3%A9tier&subtitle=Logiciel%20adapt%C3%A9%20%C3%A0%20votre%20activit%C3%A9", width: 1200, height: 630 }],
  },
}

const CATEGORIES: { nom: string; icon: React.ReactNode; slugs: string[] }[] = [
  {
    nom: "BTP & Construction",
    icon: <Wrench className="w-5 h-5" />,
    slugs: ["plombier", "electricien", "macon", "peintre", "carreleur", "menuisier", "couvreur", "plaquiste", "chauffagiste", "serrurier"],
  },
  {
    nom: "Services & Freelance",
    icon: <Briefcase className="w-5 h-5" />,
    slugs: ["auto-entrepreneur", "consultant", "developpeur-freelance", "graphiste", "photographe", "formateur", "coach", "community-manager", "traducteur", "comptable", "avocat", "agent-immobilier", "informaticien"],
  },
  {
    nom: "Artisanat & Commerce",
    icon: <Scissors className="w-5 h-5" />,
    slugs: ["coiffeur", "estheticienne", "paysagiste", "architecte-interieur", "traiteur", "fleuriste", "boulanger", "jardinier"],
  },
  {
    nom: "Transport & Services a domicile",
    icon: <Car className="w-5 h-5" />,
    slugs: ["vtc", "taxi", "demenageur", "femme-de-menage"],
  },
  {
    nom: "Sante & Bien-etre",
    icon: <Heart className="w-5 h-5" />,
    slugs: ["osteopathe", "kinesitherapeute", "infirmier-liberal", "dieteticien"],
  },
]

const metiersBySlug = Object.fromEntries(METIERS.map(m => [m.slug, m]))

export default function FacturationIndexPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Facturation par metier",
    description: "Logiciel de facturation adapte a chaque metier professionnel.",
    url: "https://qonforme.fr/facturation",
    publisher: { "@type": "Organization", name: "Qonforme", url: "https://qonforme.fr" },
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
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
            <p className="text-sm font-medium text-[#2563EB] mb-3">Facturation par metier</p>
            <h1 className="text-3xl sm:text-4xl font-bold text-[#0F172A] leading-tight">
              Un logiciel de facturation adapte a votre metier
            </h1>
            <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
              {METIERS.length} professions couvertes. Factures, devis et obligations legales specifiques a votre activite. Conforme Factur-X 2026.
            </p>
          </div>
        </header>

        {/* Categories */}
        <section className="max-w-5xl mx-auto px-4 py-16">
          <div className="space-y-12">
            {CATEGORIES.map((cat) => (
              <div key={cat.nom}>
                <h2 className="text-xl font-bold text-[#0F172A] mb-6 flex items-center gap-2">
                  <span className="w-9 h-9 rounded-lg bg-[#EFF6FF] flex items-center justify-center text-[#2563EB]">{cat.icon}</span>
                  {cat.nom}
                </h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {cat.slugs.map((slug) => {
                    const m = metiersBySlug[slug]
                    if (!m) return null
                    return (
                      <Link
                        key={slug}
                        href={`/facturation/${slug}`}
                        className="group bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm hover:shadow-md hover:border-[#2563EB]/30 transition-all"
                      >
                        <h3 className="font-semibold text-[#0F172A] group-hover:text-[#2563EB] transition-colors flex items-center justify-between">
                          {m.nom}
                          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#2563EB] transition-colors" />
                        </h3>
                        <p className="mt-1.5 text-sm text-slate-500 line-clamp-2">{m.description}</p>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="bg-[#0F172A] text-white">
          <div className="max-w-5xl mx-auto px-4 py-16 text-center">
            <h2 className="text-2xl font-bold mb-4">Votre metier n&apos;est pas dans la liste ?</h2>
            <p className="text-slate-300 mb-8 max-w-xl mx-auto">
              Qonforme s&apos;adapte a toutes les activites. Creez vos factures et devis conformes en quelques clics.
            </p>
            <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-3.5 text-sm font-bold bg-[#2563EB] rounded-xl hover:bg-[#1D4ED8] shadow-lg">
              Commencer gratuitement <ArrowRight className="w-4 h-4" />
            </Link>
            <div className="mt-12 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-400">
              <Link href="/guide" className="hover:text-white">Guides pratiques</Link>
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
