import type { Metadata } from "next"
import { BookOpen, Compass } from "lucide-react"
import { GUIDES, getGuideBySlug } from "@/lib/pseo/guides"
import { ContentCta, ContentHero, ContentPage, LinkCard, SectionHeading, WRAP } from "@/components/content/ui"
import { dateFr } from "@/components/content/text"

/** Les guides du premier chantier : devis, facture, TVA, mentions (PushRank, 05/10/2026 : page à renforcer). */
const POUR_COMMENCER = ["comment-faire-un-devis", "premiere-facture", "tva-travaux", "mentions-obligatoires-devis"]

export const metadata: Metadata = {
  title: "Guides de facturation pour les artisans du bâtiment",
  description: "Devis, factures, TVA des travaux, mentions obligatoires, facture électronique : les guides des artisans du bâtiment, vérifiés sur les textes officiels.",
  keywords: ["guide facturation artisan", "comment faire un devis", "comment faire une facture", "tva travaux", "mentions obligatoires facture"],
  alternates: { canonical: "/guide" },
  openGraph: {
    title: "Guides de facturation pour les artisans du bâtiment | Qonforme",
    description: "Devis, factures, TVA des travaux et facture électronique, expliqués avec les textes officiels.",
    url: "https://qonforme.fr/guide",
    images: [{ url: "/api/og?title=Guides%20pratiques%20facturation&subtitle=R%C3%A8gles%2C%20obligations%20et%20bonnes%20pratiques", width: 1200, height: 630 }],
  },
}

export default function GuideIndexPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Guides de facturation pour les artisans du bâtiment",
    description: "Devis, factures, TVA des travaux et facture électronique, expliqués avec les textes officiels.",
    url: "https://qonforme.fr/guide",
    publisher: { "@type": "Organization", name: "Qonforme", url: "https://qonforme.fr" },
    hasPart: GUIDES.map((g) => ({ "@type": "Article", name: g.titre, url: `https://qonforme.fr/guide/${g.slug}` })),
  }

  const pourCommencer = POUR_COMMENCER.map((slug) => getGuideBySlug(slug)).filter((g): g is NonNullable<typeof g> => g !== undefined)
  const kicker = (verifieLe?: string, sections?: number) => (
    <span className="text-[12.5px] text-q-text-4">{verifieLe ? `Vérifié le ${dateFr(verifieLe)}` : `${sections} sections`}</span>
  )

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ContentPage>
        <ContentHero
          eyebrow="Ressources"
          title="Guides pratiques,"
          accent="pour facturer juste."
          sub="Devis, factures, TVA des travaux, facture électronique : les règles des artisans du bâtiment, expliquées simplement, avec les textes officiels."
        />

        <section aria-labelledby="pour-commencer" className="px-4 sm:px-6">
          <div className={WRAP}>
            <SectionHeading id="pour-commencer" title="Pour commencer," accent="votre premier chantier." className="mb-6" />
            <div className="grid gap-4 sm:grid-cols-2 lg:gap-5">
              {pourCommencer.map((guide) => (
                <LinkCard
                  key={guide.slug}
                  href={`/guide/${guide.slug}`}
                  icon={<Compass />}
                  kicker={kicker(guide.verifieLe, guide.sections.length)}
                  title={guide.titre}
                  text={guide.description}
                  cta="Lire le guide"
                  as="h3"
                />
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="tous-les-guides" className="px-4 pt-16 sm:px-6 sm:pt-20">
          <div className={WRAP}>
            <SectionHeading id="tous-les-guides" title="Tous" accent="les guides." className="mb-6" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
              {GUIDES.filter((g) => !POUR_COMMENCER.includes(g.slug)).map((guide) => (
                <LinkCard
                  key={guide.slug}
                  href={`/guide/${guide.slug}`}
                  icon={<BookOpen />}
                  kicker={kicker(guide.verifieLe, guide.sections.length)}
                  title={guide.titre}
                  text={guide.description}
                  cta="Lire le guide"
                  as="h3"
                />
              ))}
            </div>
          </div>
        </section>

        <ContentCta
          links={[
            { href: "/devenir-a-son-compte", label: "S'installer à son compte" },
            { href: "/modele/devis-travaux", label: "Modèle de devis travaux" },
            { href: "/facturation", label: "Facturation par métier" },
            { href: "/modele", label: "Modèles gratuits" },
            { href: "/glossaire", label: "Glossaire" },
            { href: "/pricing", label: "Tarifs" },
            { href: "/blog", label: "Blog" },
          ]}
        />
      </ContentPage>
    </>
  )
}
