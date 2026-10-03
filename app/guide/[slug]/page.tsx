import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight, BookOpen } from "lucide-react"
import { GUIDES, getGuideBySlug } from "@/lib/pseo/guides"
import { ChipLinks, ContentCta, ContentHero, ContentPage, FaqList, SectionHeading, WRAP } from "@/components/content/ui"
import { fr } from "@/components/content/text"

export function generateStaticParams() {
  return GUIDES.map(g => ({ slug: g.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const guide = getGuideBySlug(slug)
  if (!guide) return {}
  return {
    title: guide.titre,
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

  // Mêmes textes à l'écran et dans le JSON-LD
  const { sections, faq } = guide

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: guide.titre,
      description: guide.description,
      publisher: { "@type": "Organization", name: "Qonforme", url: "https://qonforme.fr" },
    },
    ...(faq.length > 0 ? [{
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map(f => ({
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
      step: sections.map((s, i) => ({
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

  const toc = [
    ...sections.map((sec, i) => ({ href: `#section-${i}`, label: sec.titre })),
    ...(faq.length > 0 ? [{ href: "#faq", label: "Questions fréquentes" }] : []),
  ]

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ContentPage>
        <ContentHero
          align="start"
          size="md"
          crumbs={[{ label: "Accueil", href: "/" }, { label: "Guides", href: "/guide" }, { label: guide.titre }]}
          eyebrow={<><BookOpen className="h-3.5 w-3.5" aria-hidden />Guide pratique</>}
          title={fr(guide.titre)}
          sub={fr(guide.description)}
        />

        <div className="px-4 sm:px-6">
          <div className={`${WRAP} lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-14`}>
            <article className="min-w-0">
              {/* Sommaire (mobile et tablette) */}
              <details className="group mb-10 rounded-[20px] border border-q-line bg-q-surface lg:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-[15px] font-semibold text-q-ink [&::-webkit-details-marker]:hidden">
                  Sommaire
                  <span className="text-[13px] font-medium text-q-text-4">{toc.length} parties</span>
                </summary>
                <TocList items={toc} className="border-t border-q-line-soft px-5 pb-4 pt-3" />
              </details>

              <div className="blog-prose">
                {sections.map((sec, i) => (
                  <section key={i}>
                    <h2 id={`section-${i}`}>{fr(sec.titre)}</h2>
                    <p>{fr(sec.contenu)}</p>
                  </section>
                ))}
              </div>

              {faq.length > 0 && (
                <section aria-labelledby="faq" className="mt-16 max-w-[68ch]">
                  <SectionHeading id="faq" title="Questions" accent="fréquentes." className="mb-6" />
                  <FaqList items={faq.map((f) => ({ question: f.question, answer: f.reponse }))} />
                </section>
              )}

              {/* Maillage interne */}
              <section aria-labelledby="aller-plus-loin" className="mt-16">
                <h2 id="aller-plus-loin" className="q-eyebrow mb-4">
                  Aller plus loin
                </h2>
                <ChipLinks
                  links={[
                    ...GUIDES.filter((g) => g.slug !== guide.slug)
                      .slice(0, 4)
                      .map((g) => ({ href: `/guide/${g.slug}`, label: g.titre.replace(/ :.*$/, "").replace(/ —.*$/, "") })),
                    { href: "/modele/facture-classique", label: "Modèle de facture gratuit" },
                    { href: "/glossaire", label: "Glossaire" },
                    { href: "/pricing", label: "Voir les tarifs" },
                  ]}
                />
              </section>
            </article>

            {/* Colonne : sommaire collé au défilement + rappel de l'offre */}
            <aside className="hidden lg:block">
              <div className="sticky top-28 flex flex-col gap-4">
                <nav aria-label="Sommaire" className="rounded-[20px] border border-q-line bg-q-surface p-5">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-q-text-4">Sommaire</p>
                  <TocList items={toc} />
                </nav>
                <div className="rounded-[20px] border border-q-wash-line bg-q-wash p-5">
                  <p className="font-display text-[18px] font-semibold leading-[1.25] tracking-[-0.02em] text-q-ink-strong">
                    Vos devis, <span className="q-serif">gratuits et illimités.</span>
                  </p>
                  <p className="mt-2 text-[14px] leading-[1.55] text-q-text-3">Sans carte bancaire. Vous payez à partir de votre première facture.</p>
                  <Link href="/signup" className="q-btn q-btn-primary mt-4 w-full rounded-full">
                    Créer mon premier devis
                    <ArrowRight aria-hidden />
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        </div>

        <ContentCta />
      </ContentPage>
    </>
  )
}

/** Liste numérotée du sommaire (ancres vers les sections et la FAQ). */
function TocList({ items, className }: { items: { href: string; label: string }[]; className?: string }) {
  return (
    <ol className={className}>
      {items.map((item, i) => (
        <li key={item.href}>
          <a href={item.href} className="flex gap-3 rounded-lg py-1.5 text-[14px] leading-snug text-q-text-3 transition-colors hover:text-q-accent-strong">
            <span className="w-5 shrink-0 text-right font-mono text-[12px] leading-[1.6] text-q-text-4 tabular-nums">{i + 1}</span>
            <span>{fr(item.label)}</span>
          </a>
        </li>
      ))}
    </ol>
  )
}
