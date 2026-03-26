import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { BookOpen, ArrowRight, HelpCircle } from "lucide-react"
import { GUIDES, getGuideBySlug } from "@/lib/pseo/guides"
import Footer from "@/components/layout/Footer"

export function generateStaticParams() {
  return GUIDES.map(g => ({ slug: g.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const guide = getGuideBySlug(slug)
  if (!guide) return {}
  return {
    title: `${guide.titre} | Qonforme`,
    description: guide.description,
    keywords: guide.motsCles,
    alternates: { canonical: `/guide/${guide.slug}` },
    openGraph: {
      title: guide.titre,
      description: guide.description,
      url: `https://qonforme.fr/guide/${guide.slug}`,
      images: [{ url: `/api/og?title=${encodeURIComponent(guide.titre)}&subtitle=Guide%20pratique%20Qonforme`, width: 1200, height: 630 }],
    },
  }
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const guide = getGuideBySlug(slug)
  if (!guide) notFound()

  // Guides dont les sections forment des étapes → schema HowTo
  const HOWTO_SLUGS = new Set([
    "premiere-facture",
    "facture-acompte",
    "facture-impayee",
    "avoir-facture",
    "mentions-obligatoires-facture",
    "facture-auto-entrepreneur",
  ])

  const isHowTo = HOWTO_SLUGS.has(guide.slug)

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: guide.titre,
      description: guide.description,
      publisher: { "@type": "Organization", name: "Qonforme", url: "https://qonforme.fr" },
    },
    ...(guide.faq.length > 0 ? [{
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: guide.faq.map(f => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.reponse },
      })),
    }] : []),
    ...(isHowTo ? [{
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: guide.titre,
      description: guide.description,
      step: guide.sections.map((s, i) => ({
        "@type": "HowToStep",
        position: i + 1,
        name: s.titre,
        text: s.contenu,
      })),
    }] : []),
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: "https://qonforme.fr" },
        { "@type": "ListItem", position: 2, name: "Guides pratiques", item: "https://qonforme.fr/guide" },
        { "@type": "ListItem", position: 3, name: guide.titre, item: `https://qonforme.fr/guide/${guide.slug}` },
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
            <Link href="/" className="text-xl font-bold text-[#0F172A]">Qonforme</Link>
            <div className="flex items-center gap-4">
              <Link href="/pricing" className="text-sm text-slate-600 hover:text-[#2563EB]">Tarifs</Link>
              <Link href="/signup" className="px-4 py-2 text-sm font-semibold text-white bg-[#2563EB] rounded-lg hover:bg-[#1D4ED8]">Essayer gratuitement</Link>
            </div>
          </div>
        </nav>

        {/* Article */}
        <article className="max-w-4xl mx-auto px-4 py-12">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-slate-400 mb-8">
            <Link href="/" className="hover:text-[#2563EB]">Accueil</Link>
            <span>/</span>
            <span className="text-slate-600">Guides</span>
            <span>/</span>
            <span className="text-[#0F172A] font-medium truncate">{guide.titre}</span>
          </nav>

          <div className="flex items-center gap-2 text-sm font-medium text-[#2563EB] mb-4">
            <BookOpen className="w-4 h-4" />
            Guide pratique
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-[#0F172A] leading-tight">{guide.titre}</h1>
          <p className="mt-4 text-lg text-slate-600">{guide.description}</p>

          {/* TOC */}
          <div className="mt-8 p-5 bg-white rounded-xl border border-[#E2E8F0] shadow-sm">
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Sommaire</p>
            <ol className="space-y-1.5">
              {guide.sections.map((s, i) => (
                <li key={i}>
                  <a href={`#section-${i}`} className="text-sm text-[#2563EB] hover:underline">
                    {i + 1}. {s.titre}
                  </a>
                </li>
              ))}
              {guide.faq.length > 0 && (
                <li>
                  <a href="#faq" className="text-sm text-[#2563EB] hover:underline">
                    {guide.sections.length + 1}. Questions frequentes
                  </a>
                </li>
              )}
            </ol>
          </div>

          {/* Sections */}
          <div className="mt-10 space-y-10">
            {guide.sections.map((s, i) => (
              <section key={i} id={`section-${i}`}>
                <h2 className="text-xl font-bold text-[#0F172A] mb-3">{s.titre}</h2>
                <p className="text-[15px] text-slate-700 leading-relaxed">{s.contenu}</p>
              </section>
            ))}
          </div>

          {/* FAQ */}
          {guide.faq.length > 0 && (
            <section id="faq" className="mt-12">
              <h2 className="text-xl font-bold text-[#0F172A] mb-6 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-[#2563EB]" />
                Questions frequentes
              </h2>
              <div className="space-y-4">
                {guide.faq.map((f, i) => (
                  <div key={i} className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
                    <h3 className="font-semibold text-[#0F172A] mb-2">{f.question}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{f.reponse}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* CTA inline */}
          <div className="mt-12 p-8 bg-gradient-to-r from-[#EFF6FF] to-[#F8FAFC] rounded-2xl border border-blue-100 text-center">
            <h2 className="text-xl font-bold text-[#0F172A] mb-2">Simplifiez votre facturation</h2>
            <p className="text-sm text-slate-600 mb-6">Qonforme genere des factures conformes Factur-X en quelques clics.</p>
            <Link href="/signup" className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-[#2563EB] rounded-xl hover:bg-[#1D4ED8]">
              Commencer gratuitement <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Maillage interne */}
          <div className="mt-12 pt-8 border-t border-[#E2E8F0]">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Aller plus loin</h3>
            <div className="flex flex-wrap gap-2">
              {GUIDES.filter(g => g.slug !== guide.slug).slice(0, 4).map(g => (
                <Link key={g.slug} href={`/guide/${g.slug}`} className="text-sm text-[#2563EB] bg-[#EFF6FF] px-3 py-1.5 rounded-lg hover:bg-[#DBEAFE]">
                  {g.titre.replace(/ :.*$/, "").replace(/ —.*$/, "")}
                </Link>
              ))}
              <Link href="/modele/facture-classique" className="text-sm text-[#2563EB] bg-[#EFF6FF] px-3 py-1.5 rounded-lg hover:bg-[#DBEAFE]">
                Modele facture gratuit
              </Link>
              <Link href="/pricing" className="text-sm text-[#2563EB] bg-[#EFF6FF] px-3 py-1.5 rounded-lg hover:bg-[#DBEAFE]">
                Voir les tarifs
              </Link>
            </div>
          </div>
        </article>

        <Footer />
      </div>
    </>
  )
}
