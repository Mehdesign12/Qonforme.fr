import type { Metadata } from "next"
import { BookOpen } from "lucide-react"
import { GUIDES } from "@/lib/pseo/guides"
import { ContentCta, ContentHero, ContentPage, LinkCard, WRAP } from "@/components/content/ui"

export const metadata: Metadata = {
  title: "Guides pratiques facturation",
  description: "Guides pratiques de la facturation en France : mentions obligatoires, TVA, délais de paiement, devis, avoirs, impayés et facture électronique.",
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
      <ContentPage>
        <ContentHero
          eyebrow="Ressources"
          title="Guides pratiques,"
          accent="pour facturer juste."
          sub="Mentions obligatoires, TVA, délais de paiement, facture électronique : les règles expliquées simplement, avec les textes de référence."
        />

        <section aria-label="Guides" className="px-4 sm:px-6">
          <div className={`${WRAP} grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5`}>
            {GUIDES.map((guide) => (
              <LinkCard
                key={guide.slug}
                href={`/guide/${guide.slug}`}
                icon={<BookOpen />}
                kicker={<span className="text-[12.5px] text-q-text-4">{guide.sections.length} sections</span>}
                title={guide.titre}
                text={guide.description}
                cta="Lire le guide"
              />
            ))}
          </div>
        </section>

        <ContentCta
          links={[
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
