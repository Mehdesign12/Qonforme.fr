import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CheckCircle2, ArrowRight, FileText, HelpCircle, Users } from "lucide-react"
import { METIERS, getMetierBySlug } from "@/lib/pseo/metiers"
import Footer from "@/components/layout/Footer"
import PublicHeaderWrapper from "@/components/layout/PublicHeaderWrapper"


export function generateStaticParams() {
  return METIERS.map(m => ({ slug: m.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const metier = getMetierBySlug(slug)
  if (!metier) return {}
  return {
    title: `${metier.titre} | Qonforme`,
    description: metier.description,
    keywords: metier.motsCles,
    alternates: { canonical: `/facturation/${metier.slug}` },
    openGraph: {
      title: metier.titre,
      description: metier.description,
      url: `https://qonforme.fr/facturation/${metier.slug}`,
      images: [{ url: `/api/og?title=${encodeURIComponent(metier.titre)}&subtitle=${encodeURIComponent(`Factures et devis pour ${metier.nom}`)}`, width: 1200, height: 630 }],
    },
  }
}

export default async function MetierPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const metier = getMetierBySlug(slug)
  if (!metier) notFound()

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: metier.faq.map(f => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.reponse },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: "https://qonforme.fr" },
        { "@type": "ListItem", position: 2, name: "Facturation par metier", item: "https://qonforme.fr/facturation" },
        { "@type": "ListItem", position: 3, name: metier.nom, item: `https://qonforme.fr/facturation/${metier.slug}` },
      ],
    },
  ]

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="min-h-screen bg-[#F8FAFC]">
        {/* Nav */}
        <PublicHeaderWrapper />

        {/* Hero */}
        <header className="bg-gradient-to-b from-white to-[#F8FAFC] border-b border-[#E2E8F0]">
          <div className="max-w-5xl mx-auto px-4 py-16 text-center">
            <p className="text-sm font-medium text-[#2563EB] mb-3">Facturation par metier</p>
            <h1 className="text-3xl sm:text-4xl font-bold text-[#0F172A] leading-tight">{metier.titre}</h1>
            <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">{metier.description}</p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/signup" className="px-6 py-3 text-sm font-bold text-white bg-[#2563EB] rounded-xl hover:bg-[#1D4ED8] shadow-sm">
                Creer mon premier document
              </Link>
              <Link href="/demo" className="px-6 py-3 text-sm font-semibold text-slate-600 bg-white border border-[#E2E8F0] rounded-xl hover:bg-[#F8FAFC]">
                Voir la demo
              </Link>
            </div>
          </div>
        </header>

        {/* Features */}
        <section className="max-w-5xl mx-auto px-4 py-16">
          <h2 className="text-2xl font-bold text-[#0F172A] mb-8">Fonctionnalites adaptees aux {metier.nom.toLowerCase()}s</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {metier.features.map((f, i) => (
              <div key={i} className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
                <div className="w-10 h-10 rounded-lg bg-[#EFF6FF] flex items-center justify-center mb-4">
                  <FileText className="w-5 h-5 text-[#2563EB]" />
                </div>
                <h3 className="font-semibold text-[#0F172A] mb-2">{f.titre}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{f.texte}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Obligations */}
        <section className="bg-white border-y border-[#E2E8F0]">
          <div className="max-w-5xl mx-auto px-4 py-16">
            <h2 className="text-2xl font-bold text-[#0F172A] mb-8">Obligations legales pour les {metier.nom.toLowerCase()}s</h2>
            <div className="space-y-3">
              {metier.obligations.map((o, i) => (
                <div key={i} className="flex items-start gap-3 p-4 bg-[#F8FAFC] rounded-xl">
                  <CheckCircle2 className="w-5 h-5 text-[#059669] mt-0.5 shrink-0" />
                  <p className="text-sm text-slate-700">{o}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-5xl mx-auto px-4 py-16">
          <h2 className="text-2xl font-bold text-[#0F172A] mb-8 flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-[#2563EB]" />
            Questions frequentes
          </h2>
          <div className="space-y-4">
            {metier.faq.map((f, i) => (
              <div key={i} className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
                <h3 className="font-semibold text-[#0F172A] mb-2">{f.question}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{f.reponse}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Métiers proches */}
        {metier.metiersProches.length > 0 && (
          <section className="bg-white border-y border-[#E2E8F0]">
            <div className="max-w-5xl mx-auto px-4 py-16">
              <h2 className="text-2xl font-bold text-[#0F172A] mb-8 flex items-center gap-2">
                <Users className="w-6 h-6 text-[#2563EB]" />
                Metiers proches
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {metier.metiersProches.map((slug) => {
                  const proche = getMetierBySlug(slug)
                  if (!proche) return null
                  return (
                    <Link
                      key={slug}
                      href={`/facturation/${slug}`}
                      className="group flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 hover:border-[#2563EB]/30 hover:shadow-md transition-all"
                    >
                      <span className="font-semibold text-[#0F172A] group-hover:text-[#2563EB] transition-colors">{proche.nom}</span>
                      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#2563EB] transition-colors" />
                    </Link>
                  )
                })}
              </div>
              <div className="mt-6 text-center">
                <Link href="/facturation" className="text-sm font-semibold text-[#2563EB] hover:underline">
                  Voir tous les metiers →
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* CTA + maillage */}
        <section className="bg-[#0F172A] text-white">
          <div className="max-w-5xl mx-auto px-4 py-16 text-center">
            <h2 className="text-2xl font-bold mb-4">Pret a simplifier votre facturation ?</h2>
            <p className="text-slate-300 mb-8 max-w-xl mx-auto">Creez vos factures et devis en quelques clics. Conforme Factur-X 2026.</p>
            <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-3.5 text-sm font-bold bg-[#2563EB] rounded-xl hover:bg-[#1D4ED8] shadow-lg">
              Commencer gratuitement <ArrowRight className="w-4 h-4" />
            </Link>
            <div className="mt-12 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-400">
              <Link href="/guide/mentions-obligatoires-facture" className="hover:text-white">Mentions obligatoires</Link>
              <Link href="/guide/facture-electronique-2026" className="hover:text-white">Facture electronique 2026</Link>
              <Link href="/modele/facture-classique" className="hover:text-white">Modele facture gratuit</Link>
              <Link href="/modele/devis-travaux" className="hover:text-white">Modele devis travaux</Link>
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
