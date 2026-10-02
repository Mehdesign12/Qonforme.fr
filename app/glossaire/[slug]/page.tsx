import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight, Library } from "lucide-react"
import { GLOSSAIRE, getTermeBySlug } from "@/lib/pseo/glossaire"
import { ChipLinks, ContentCta, ContentHero, ContentPage, SectionHeading } from "@/components/content/ui"
import { fr, resolveContentLink } from "@/components/content/text"

export function generateStaticParams() {
  return GLOSSAIRE.map(t => ({ slug: t.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const terme = getTermeBySlug(slug)
  if (!terme) return {}
  return {
    title: `${terme.terme} — Définition facturation | Qonforme`,
    description: terme.definition,
    keywords: [terme.slug, `definition ${terme.slug}`, `${terme.slug} facturation`],
    alternates: { canonical: `/glossaire/${terme.slug}` },
    openGraph: {
      title: `${terme.terme} — Définition | Qonforme`,
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

  // Liens internes résolus en libellés lisibles
  const { explication, exemple } = terme
  const liens = terme.liens.map(resolveContentLink).filter((l): l is NonNullable<typeof l> => l !== null)

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ContentPage>
        <ContentHero
          align="start"
          size="md"
          crumbs={[{ label: "Accueil", href: "/" }, { label: "Glossaire", href: "/glossaire" }, { label: terme.terme }]}
          eyebrow={<><Library className="h-3.5 w-3.5" aria-hidden />Glossaire de la facturation</>}
          title={terme.terme}
        />

        <article className="px-4 sm:px-6">
          <div className="mx-auto w-full max-w-[1200px]">
            <div className="max-w-[760px]">
              {/* Définition */}
              <div className="rounded-[20px] border border-q-wash-line bg-q-wash p-6 sm:p-8">
                <p className="q-eyebrow mb-3">Définition</p>
                <p className="text-[18px] font-medium leading-[1.6] text-q-ink sm:text-[19px]">{fr(terme.definition)}</p>
              </div>

              {explication && (
                <section aria-labelledby="explication" className="mt-14">
                  <SectionHeading id="explication" title="Explication" accent="détaillée." className="mb-4" />
                  <p className="max-w-[68ch] text-[17px] leading-[1.75] text-q-text-2">{fr(explication)}</p>
                </section>
              )}

              {exemple && (
                <section aria-labelledby="exemple" className="mt-14">
                  <SectionHeading id="exemple" title="Exemple" accent="concret." className="mb-5" />
                  <p className="rounded-2xl border border-q-line border-l-[3px] border-l-q-accent bg-q-surface px-5 py-4 text-[16px] leading-[1.65] text-q-text-2">
                    {fr(exemple)}
                  </p>
                </section>
              )}

              {liens.length > 0 && (
                <section aria-labelledby="en-savoir-plus" className="mt-14">
                  <h2 id="en-savoir-plus" className="q-eyebrow mb-4">
                    En savoir plus
                  </h2>
                  <ul className="flex flex-col gap-2">
                    {liens.map((lien) => (
                      <li key={lien.href}>
                        <Link
                          href={lien.href}
                          className="group flex items-center justify-between gap-4 rounded-2xl border border-q-line bg-q-surface px-5 py-4 text-[15px] font-semibold text-q-ink transition-colors hover:border-q-wash-line hover:text-q-accent-strong"
                        >
                          {fr(lien.label)}
                          <ArrowRight className="h-4 w-4 shrink-0 text-q-accent-strong transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Autres termes */}
              <section aria-labelledby="autres-definitions" className="mt-14">
                <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
                  <h2 id="autres-definitions" className="q-eyebrow">
                    Autres définitions
                  </h2>
                  <Link href="/glossaire" className="q-link text-[14px]">
                    Voir tout le glossaire
                  </Link>
                </div>
                <ChipLinks
                  links={GLOSSAIRE.filter((t) => t.slug !== terme.slug)
                    .slice(0, 9)
                    .map((t) => ({ href: `/glossaire/${t.slug}`, label: t.terme }))}
                />
              </section>
            </div>
          </div>
        </article>

        <ContentCta />
      </ContentPage>
    </>
  )
}
