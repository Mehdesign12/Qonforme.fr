import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { notFound } from "next/navigation"
import { ArrowRight, BookOpen } from "lucide-react"
import { GLOSSAIRE, getTermeBySlug } from "@/lib/pseo/glossaire"
import Footer from "@/components/layout/Footer"

const LOGO_URL = "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20long%20bleu.webp"

export function generateStaticParams() {
  return GLOSSAIRE.map(t => ({ slug: t.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const terme = getTermeBySlug(slug)
  if (!terme) return {}
  return {
    title: `${terme.terme} — Definition facturation | Qonforme`,
    description: terme.definition,
    keywords: [terme.slug, `definition ${terme.slug}`, `${terme.slug} facturation`],
    alternates: { canonical: `/glossaire/${terme.slug}` },
    openGraph: {
      title: `${terme.terme} — Definition | Qonforme`,
      description: terme.definition,
      url: `https://qonforme.fr/glossaire/${terme.slug}`,
      images: [{ url: `/api/og?title=${encodeURIComponent(terme.terme)}&subtitle=${encodeURIComponent("Glossaire facturation")}`, width: 1200, height: 630 }],
    },
  }
}

export default async function TermePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const terme = getTermeBySlug(slug)
  if (!terme) notFound()

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "DefinedTerm",
      name: terme.terme,
      description: terme.definition,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: "https://qonforme.fr" },
        { "@type": "ListItem", position: 2, name: "Glossaire", item: "https://qonforme.fr/glossaire" },
        { "@type": "ListItem", position: 3, name: terme.terme, item: `https://qonforme.fr/glossaire/${terme.slug}` },
      ],
    },
  ]

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="min-h-screen bg-[#F8FAFC]">
        <nav className="border-b border-[#E2E8F0] bg-white">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/"><Image src={LOGO_URL} alt="Qonforme" width={130} height={32} className="h-7 w-auto object-contain" sizes="130px" priority /></Link>
            <div className="flex items-center gap-4">
              <Link href="/signup" className="px-3 py-2 text-xs sm:text-sm font-semibold text-white bg-[#2563EB] rounded-lg hover:bg-[#1D4ED8]">Essayer gratuitement</Link>
            </div>
          </div>
        </nav>

        <div className="max-w-3xl mx-auto px-4 pt-6">
          <nav className="flex items-center gap-2 text-sm text-slate-400">
            <Link href="/" className="hover:text-[#2563EB]">Accueil</Link>
            <span>/</span>
            <Link href="/glossaire" className="hover:text-[#2563EB]">Glossaire</Link>
            <span>/</span>
            <span className="text-[#0F172A] font-medium">{terme.terme}</span>
          </nav>
        </div>

        <article className="max-w-3xl mx-auto px-4 py-12">
          <div className="flex items-center gap-2 text-sm font-medium text-[#2563EB] mb-4">
            <BookOpen className="w-4 h-4" />
            Glossaire facturation
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-[#0F172A] mb-4">{terme.terme}</h1>

          {/* Definition */}
          <div className="rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] p-6 mb-8">
            <p className="text-sm font-bold text-[#2563EB] uppercase tracking-wide mb-2">Definition</p>
            <p className="text-[#0F172A] font-medium leading-relaxed">{terme.definition}</p>
          </div>

          {/* Explication */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-[#0F172A] mb-3">Explication detaillee</h2>
            <p className="text-slate-700 leading-relaxed">{terme.explication}</p>
          </section>

          {/* Exemple */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-[#0F172A] mb-3">Exemple concret</h2>
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-700 italic leading-relaxed">{terme.exemple}</p>
            </div>
          </section>

          {/* Liens */}
          {terme.liens.length > 0 && (
            <section className="mb-8">
              <h2 className="text-xl font-bold text-[#0F172A] mb-3">En savoir plus</h2>
              <div className="space-y-2">
                {terme.liens.map((lien) => (
                  <Link key={lien} href={lien} className="flex items-center gap-2 text-sm text-[#2563EB] hover:underline">
                    <ArrowRight className="w-3.5 h-3.5" />
                    {lien}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Autres termes */}
          <section className="mt-12 pt-8 border-t border-[#E2E8F0]">
            <h2 className="text-lg font-bold text-[#0F172A] mb-4">Autres definitions</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {GLOSSAIRE.filter(t => t.slug !== terme.slug).slice(0, 9).map((t) => (
                <Link
                  key={t.slug}
                  href={`/glossaire/${t.slug}`}
                  className="rounded-lg border border-[#E2E8F0] bg-white p-3 text-sm font-medium text-[#0F172A] hover:border-[#2563EB]/30 hover:text-[#2563EB] transition-all"
                >
                  {t.terme}
                </Link>
              ))}
            </div>
            <div className="mt-4 text-center">
              <Link href="/glossaire" className="text-sm font-semibold text-[#2563EB] hover:underline">
                Voir tout le glossaire →
              </Link>
            </div>
          </section>
        </article>

        {/* CTA */}
        <section className="bg-[#0F172A] text-white">
          <div className="max-w-3xl mx-auto px-4 py-16 text-center">
            <h2 className="text-2xl font-bold mb-4">Simplifiez votre facturation</h2>
            <p className="text-slate-300 mb-8">Qonforme gere toutes ces notions pour vous. Conforme Factur-X 2026.</p>
            <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-3.5 text-sm font-bold bg-[#2563EB] rounded-xl hover:bg-[#1D4ED8] shadow-lg">
              Commencer gratuitement <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        <Footer />
      </div>
    </>
  )
}
