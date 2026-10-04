import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight, Briefcase } from "lucide-react"
import { METIERS, getMetierBySlug } from "@/lib/pseo/metiers"
import { getInstallationBySlug } from "@/lib/pseo/installation"
import { ChipLinks, ContentCta, ContentHero, ContentPage, CtaButtons, FaqList, SectionHeading, WRAP } from "@/components/content/ui"
import { MetierFeatures, MetierObligations, tradeHeroPhoto } from "@/components/content/metier"
import { lcFirst } from "@/components/content/text"

export function generateStaticParams() {
  return METIERS.map(m => ({ slug: m.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const metier = getMetierBySlug(slug)
  if (!metier) return {}
  return {
    title: metier.titre,
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

  // Mêmes réponses à l'écran et dans le JSON-LD
  const faq = metier.faq.map((f) => ({ question: f.question, answer: f.reponse }))

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map(f => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: "https://qonforme.fr" },
        { "@type": "ListItem", position: 2, name: "Facturation par métier", item: "https://qonforme.fr/facturation" },
        { "@type": "ListItem", position: 3, name: metier.nom, item: `https://qonforme.fr/facturation/${metier.slug}` },
      ],
    },
  ]

  const installation = getInstallationBySlug(metier.slug)
  const proches = metier.metiersProches.map((slug) => getMetierBySlug(slug)).filter((m): m is NonNullable<typeof m> => m !== undefined)

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ContentPage>
        <ContentHero
          align="start"
          size="md"
          crumbs={[{ label: "Accueil", href: "/" }, { label: "Facturation par métier", href: "/facturation" }, { label: metier.nom }]}
          eyebrow={<><Briefcase className="h-3.5 w-3.5" aria-hidden />Facturation par métier</>}
          title="Logiciel de facturation"
          accent={`pour ${lcFirst(metier.nom)}`}
          sub={metier.description}
          media={tradeHeroPhoto(metier.slug)}
        >
          <CtaButtons align="start" className="mt-8" />
        </ContentHero>

        <MetierFeatures metier={metier} />
        <MetierObligations metier={metier} />

        {/* Intention « je démarre » : guide d'installation du même métier */}
        {installation && (
          <section aria-labelledby="installation" className="px-4 pt-16 sm:px-6 sm:pt-20">
            <div className={WRAP}>
              <Link
                href={`/devenir-a-son-compte/${installation.slug}`}
                className="group flex flex-col gap-3 rounded-[20px] border border-q-wash-line bg-q-wash p-6 transition-colors hover:border-q-accent sm:flex-row sm:items-center sm:justify-between sm:p-8"
              >
                <div className="flex flex-col gap-1">
                  <h2 id="installation" className="font-display text-[20px] font-semibold tracking-[-0.02em] text-q-ink-strong">
                    Vous vous installez ?
                  </h2>
                  <span className="text-[15px] leading-[1.55] text-q-text-3">
                    Devenir {installation.metier} à son compte : qualification, assurance, TVA et premiers devis, étape par étape.
                  </span>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 text-[14px] font-semibold text-q-accent-strong">
                  Voir les étapes
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
                </span>
              </Link>
            </div>
          </section>
        )}

        {faq.length > 0 && (
          <section aria-labelledby="faq" className="px-4 pt-16 sm:px-6 sm:pt-20">
            <div className="mx-auto w-full max-w-[800px]">
              <SectionHeading id="faq" title="Questions" accent="fréquentes." className="mb-8" />
              <FaqList items={faq} />
            </div>
          </section>
        )}

        {/* Métiers proches */}
        {proches.length > 0 && (
          <section aria-labelledby="metiers-proches" className="px-4 pt-16 sm:px-6 sm:pt-20">
            <div className={WRAP}>
              <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <SectionHeading id="metiers-proches" title="Métiers" accent="proches." />
                <Link href="/facturation" className="q-link text-[14px]">
                  Voir tous les métiers
                </Link>
              </div>
              <ChipLinks links={proches.map((p) => ({ href: `/facturation/${p.slug}`, label: p.nom }))} />
            </div>
          </section>
        )}

        <ContentCta
          links={[
            { href: "/guide/mentions-obligatoires-facture", label: "Mentions obligatoires" },
            { href: "/guide/facture-electronique-2026", label: "Facture électronique 2026" },
            { href: "/modele/facture-classique", label: "Modèle de facture gratuit" },
            { href: "/modele/devis-travaux", label: "Modèle de devis travaux" },
            { href: "/pricing", label: "Tarifs" },
            { href: "/blog", label: "Blog" },
          ]}
        />
      </ContentPage>
    </>
  )
}
