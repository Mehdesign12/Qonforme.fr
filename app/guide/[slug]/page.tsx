import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight, BookOpen, Check, ExternalLink } from "lucide-react"
import { GUIDES, getGuideBySlug } from "@/lib/pseo/guides"
import { ChipLinks, ContentCta, ContentHero, ContentPage, FaqList, SectionHeading, WRAP } from "@/components/content/ui"
import { dateFr, fr } from "@/components/content/text"
import { ExempleDevisCard } from "@/components/content/ExempleDevis"
import { fitDescription, fitTitle } from "@/lib/seo/meta"

export function generateStaticParams() {
  return GUIDES.map(g => ({ slug: g.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const guide = getGuideBySlug(slug)
  if (!guide) return {}
  return {
    title: fitTitle(guide.titreSeo ?? guide.titre),
    description: fitDescription(guide.description),
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
    "facture-auto-entrepreneur",
    "comment-faire-un-devis",
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
      mainEntityOfPage: `https://qonforme.fr/guide/${guide.slug}`,
      ...(guide.verifieLe ? { dateModified: guide.verifieLe } : {}),
      author: { "@type": "Organization", name: "Qonforme", url: "https://qonforme.fr" },
      publisher: { "@type": "Organization", name: "Qonforme", url: "https://qonforme.fr" },
      ...(guide.sources?.some((src) => src.href) ? { citation: guide.sources.filter((src) => src.href).map((src) => src.href) } : {}),
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
        text: [s.contenu, ...(s.liste ?? [])].join(" "),
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
    ...(guide.essentiel ? [{ href: "#essentiel", label: "L'essentiel" }] : []),
    ...sections.map((sec, i) => ({ href: `#section-${i}`, label: sec.titre })),
    ...(guide.exemple ? [{ href: "#exemple", label: "Exemple de devis chiffré" }] : []),
    ...(faq.length > 0 ? [{ href: "#faq", label: "Questions fréquentes" }] : []),
    ...(guide.sources ? [{ href: "#sources", label: "Sources officielles" }] : []),
  ]

  // Liens propres au guide d'abord, puis les autres guides (sans doublon)
  const ownLinks = guide.liens ?? []
  const moreLinks = [
    ...ownLinks,
    ...GUIDES.filter((g) => g.slug !== guide.slug && !ownLinks.some((l) => l.href === `/guide/${g.slug}`))
      .slice(0, Math.max(2, 6 - ownLinks.length))
      .map((g) => ({ href: `/guide/${g.slug}`, label: g.titre.replace(/ :.*$/, "").replace(/ —.*$/, "") })),
    ...(ownLinks.length ? [] : [{ href: "/modele/facture-classique", label: "Modèle de facture gratuit" }]),
    { href: "/glossaire", label: "Glossaire" },
    { href: "/pricing", label: "Voir les tarifs" },
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
        >
          {guide.verifieLe && (
            <p className="mt-4 text-[14px] text-q-text-4">
              Vérifié sur les textes officiels le <time dateTime={guide.verifieLe}>{dateFr(guide.verifieLe)}</time>
            </p>
          )}
        </ContentHero>

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

              {/* Réponse directe en tête de page (extrait de recherche) */}
              {guide.essentiel && (
                <section aria-labelledby="essentiel" className="mb-12 rounded-[20px] border border-q-wash-line bg-q-wash p-6 sm:p-7">
                  <h2 id="essentiel" className="scroll-mt-28 font-display text-[22px] font-semibold tracking-[-0.02em] text-q-ink-strong">
                    L&apos;essentiel
                  </h2>
                  <ul className="mt-4 flex flex-col gap-3">
                    {guide.essentiel.map((item) => (
                      <li key={item} className="flex items-start gap-3 text-[15px] leading-[1.55] text-q-text-2">
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-q-surface text-q-accent-strong">
                          <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                        </span>
                        {fr(item)}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <div className="blog-prose">
                {sections.map((sec, i) => (
                  <section key={i}>
                    <h2 id={`section-${i}`}>{fr(sec.titre)}</h2>
                    <p>{fr(sec.contenu)}</p>
                    {sec.liste && (
                      <ul>
                        {sec.liste.map((item) => (
                          <li key={item}>{fr(item)}</li>
                        ))}
                      </ul>
                    )}
                  </section>
                ))}
              </div>

              {guide.exemple && <ExempleDevisCard exemple={guide.exemple} id="exemple" />}

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
                <ChipLinks links={moreLinks} />
              </section>

              {guide.sources && (
                <section aria-labelledby="sources" className="mt-12 max-w-[68ch]">
                  <h2 id="sources" className="q-eyebrow mb-4 scroll-mt-28">
                    Sources officielles
                  </h2>
                  <ul className="flex flex-col gap-2.5 text-[14px] leading-[1.55] text-q-text-3">
                    {guide.sources.map((src) => (
                      <li key={src.label}>
                        {src.href ? (
                          <a href={src.href} target="_blank" rel="noopener noreferrer" className="q-link inline-flex items-start gap-1.5">
                            {fr(src.label)}
                            <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden />
                          </a>
                        ) : (
                          fr(src.label)
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
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
