import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { notFound } from "next/navigation"
import { FileText, CheckCircle2, ArrowRight, Lightbulb, AlertTriangle } from "lucide-react"
import { MODELES, getModeleBySlug } from "@/lib/pseo/modeles"
import Footer from "@/components/layout/Footer"

const LOGO_URL = "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20long%20simple.png"

const TYPE_LABELS: Record<string, string> = {
  facture: "Facture",
  devis: "Devis",
  avoir: "Avoir",
  "bon-de-commande": "Bon de commande",
}

export function generateStaticParams() {
  return MODELES.map(m => ({ slug: m.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const modele = getModeleBySlug(slug)
  if (!modele) return {}
  return {
    title: `${modele.titre} | Qonforme`,
    description: modele.description,
    keywords: modele.motsCles,
    alternates: { canonical: `/modele/${modele.slug}` },
    openGraph: {
      title: modele.titre,
      description: modele.description,
      url: `https://qonforme.fr/modele/${modele.slug}`,
      images: [{ url: `/api/og?title=${encodeURIComponent(modele.titre)}&subtitle=Modele%20gratuit%20Qonforme`, width: 1200, height: 630 }],
    },
  }
}

export default async function ModelePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const modele = getModeleBySlug(slug)
  if (!modele) notFound()

  const TYPE_NAMES: Record<string, string> = {
    facture: "Factures",
    devis: "Devis",
    avoir: "Avoirs",
    "bon-de-commande": "Bons de commande",
    relance: "Relances",
  }

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: modele.titre,
      description: modele.description,
      brand: { "@type": "Organization", name: "Qonforme" },
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "EUR",
        availability: "https://schema.org/InStock",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: "https://qonforme.fr" },
        { "@type": "ListItem", position: 2, name: "Modeles gratuits", item: "https://qonforme.fr/modele" },
        { "@type": "ListItem", position: 3, name: TYPE_NAMES[modele.type] ?? modele.type, item: `https://qonforme.fr/modele/${modele.slug}` },
      ],
    },
  ]

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="min-h-screen bg-[#F8FAFC]">
        {/* Nav */}
        <nav className="border-b border-[#E2E8F0] bg-white">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/"><Image src={LOGO_URL} alt="Qonforme" width={130} height={32} className="h-7 w-auto object-contain" sizes="130px" priority /></Link>
            <div className="flex items-center gap-4">
              <Link href="/pricing" className="text-sm text-slate-600 hover:text-[#2563EB]">Tarifs</Link>
              <Link href="/signup" className="px-4 py-2 text-sm font-semibold text-white bg-[#2563EB] rounded-lg hover:bg-[#1D4ED8]">Essayer gratuitement</Link>
            </div>
          </div>
        </nav>

        <div className="max-w-4xl mx-auto px-4 py-12">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-slate-400 mb-8">
            <Link href="/" className="hover:text-[#2563EB]">Accueil</Link>
            <span>/</span>
            <span className="text-slate-600">Modeles</span>
            <span>/</span>
            <span className="text-[#0F172A] font-medium truncate">{TYPE_LABELS[modele.type]}</span>
          </nav>

          {/* Header */}
          <div className="flex items-center gap-2 text-sm font-medium text-[#2563EB] mb-4">
            <FileText className="w-4 h-4" />
            Modele gratuit
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-[#0F172A] leading-tight">{modele.titre}</h1>
          <p className="mt-4 text-lg text-slate-600">{modele.description}</p>

          {/* CTA hero */}
          <div className="mt-8 flex flex-col sm:flex-row items-start gap-3">
            <Link href="/signup" className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-[#2563EB] rounded-xl hover:bg-[#1D4ED8] shadow-sm">
              Creer ce document gratuitement <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/demo" className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-slate-600 bg-white border border-[#E2E8F0] rounded-xl hover:bg-[#F8FAFC]">
              Voir la demo
            </Link>
          </div>

          {/* Preview visuel */}
          <div className="mt-10 rounded-xl border border-[#E2E8F0] overflow-hidden shadow-sm bg-white">
            <Image
              src={`/api/preview?title=${encodeURIComponent(modele.titre)}&type=${encodeURIComponent(modele.type)}&items=${encodeURIComponent(modele.contenu.slice(0, 5).join("|"))}`}
              alt={`Apercu du ${modele.titre}`}
              width={1000}
              height={600}
              className="w-full h-auto"
              sizes="(max-width: 768px) 100vw, 800px"
              priority
            />
          </div>

          {/* Pour qui */}
          <section className="mt-12">
            <h2 className="text-xl font-bold text-[#0F172A] mb-3">A qui s&apos;adresse ce modele ?</h2>
            <p className="text-[15px] text-slate-700 leading-relaxed">{modele.pourQui}</p>
          </section>

          {/* Contenu du modèle */}
          <section className="mt-10">
            <h2 className="text-xl font-bold text-[#0F172A] mb-4">Ce que contient ce modele</h2>
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
              <div className="space-y-2.5">
                {modele.contenu.map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-[#059669] mt-0.5 shrink-0" />
                    <p className="text-sm text-slate-700">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Mentions spécifiques */}
          {modele.mentionsSpecifiques.length > 0 && (
            <section className="mt-10">
              <h2 className="text-xl font-bold text-[#0F172A] mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Mentions specifiques a inclure
              </h2>
              <div className="space-y-2">
                {modele.mentionsSpecifiques.map((m, i) => (
                  <div key={i} className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100">
                    <p className="text-sm text-amber-900 font-mono">&laquo; {m} &raquo;</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Conseils */}
          <section className="mt-10">
            <h2 className="text-xl font-bold text-[#0F172A] mb-4 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-[#2563EB]" />
              Conseils pratiques
            </h2>
            <div className="space-y-2.5">
              {modele.conseils.map((c, i) => (
                <div key={i} className="flex items-start gap-3 p-4 bg-[#EFF6FF] rounded-xl">
                  <span className="text-sm font-bold text-[#2563EB] mt-0.5">{i + 1}.</span>
                  <p className="text-sm text-slate-700">{c}</p>
                </div>
              ))}
            </div>
          </section>

          {/* CTA */}
          <div className="mt-12 p-8 bg-gradient-to-r from-[#EFF6FF] to-[#F8FAFC] rounded-2xl border border-blue-100 text-center">
            <h2 className="text-xl font-bold text-[#0F172A] mb-2">Creez ce document en 2 minutes</h2>
            <p className="text-sm text-slate-600 mb-6">Remplissez les champs, Qonforme genere un PDF conforme Factur-X automatiquement.</p>
            <Link href="/signup" className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-[#2563EB] rounded-xl hover:bg-[#1D4ED8]">
              Commencer gratuitement <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Maillage interne */}
          <div className="mt-12 pt-8 border-t border-[#E2E8F0]">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Autres modeles</h3>
            <div className="flex flex-wrap gap-2">
              {MODELES.filter(m => m.slug !== modele.slug).slice(0, 5).map(m => (
                <Link key={m.slug} href={`/modele/${m.slug}`} className="text-sm text-[#2563EB] bg-[#EFF6FF] px-3 py-1.5 rounded-lg hover:bg-[#DBEAFE]">
                  {m.titre.replace("Modele de ", "").replace("Modele d'", "").replace(" gratuit", "")}
                </Link>
              ))}
              <Link href="/guide/mentions-obligatoires-facture" className="text-sm text-[#2563EB] bg-[#EFF6FF] px-3 py-1.5 rounded-lg hover:bg-[#DBEAFE]">
                Mentions obligatoires
              </Link>
            </div>
          </div>
        </div>

        <Footer />
      </div>
    </>
  )
}
