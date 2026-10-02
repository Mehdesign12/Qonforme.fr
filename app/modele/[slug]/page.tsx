import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Check, FileText, Wand2 } from "lucide-react"
import { MODELES, getModeleBySlug } from "@/lib/pseo/modeles"
import { ChipLinks, ContentCta, ContentHero, ContentPage, CtaButtons, LinkCard, SectionHeading, WRAP } from "@/components/content/ui"
import { fr } from "@/components/content/text"
import ModelePaper from "@/components/content/ModelePaper"

const TYPE_LABELS: Record<string, string> = {
  facture: "Facture",
  devis: "Devis",
  avoir: "Avoir",
  "bon-de-commande": "Bon de commande",
  relance: "Relance",
}

/** Générateur gratuit (/outils) correspondant au type de modèle, s'il existe. */
const GENERATOR: Record<string, { href: string; title: string } | undefined> = {
  facture: { href: "/outils/generateur-facture-gratuite", title: "Générateur de facture gratuit" },
  devis: { href: "/outils/generateur-devis-gratuit", title: "Générateur de devis gratuit" },
}

/** Modèles que le générateur ne sait pas produire (tableau d'avancement, document non numéroté). */
const NO_GENERATOR = new Set(["facture-situation", "facture-proforma"])

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
      images: [{ url: `/api/og?title=${encodeURIComponent(modele.titre)}&subtitle=Mod%C3%A8le%20gratuit%20Qonforme`, width: 1200, height: 630 }],
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
        { "@type": "ListItem", position: 2, name: "Modèles gratuits", item: "https://qonforme.fr/modele" },
        { "@type": "ListItem", position: 3, name: TYPE_NAMES[modele.type] ?? modele.type, item: `https://qonforme.fr/modele/${modele.slug}` },
      ],
    },
  ]

  const generator = NO_GENERATOR.has(modele.slug) ? undefined : GENERATOR[modele.type]

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ContentPage>
        <ContentHero
          align="start"
          size="md"
          crumbs={[{ label: "Accueil", href: "/" }, { label: "Modèles", href: "/modele" }, { label: TYPE_LABELS[modele.type] ?? modele.type }]}
          eyebrow={<><FileText className="h-3.5 w-3.5" aria-hidden />Modèle gratuit</>}
          title={fr(modele.titre)}
          sub={fr(modele.description)}
        >
          <CtaButtons align="start" className="mt-8" />
        </ContentHero>

        <div className="px-4 sm:px-6">
          <div className={`${WRAP} grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12`}>
            {/* Aperçu : feuille schématique sur fond grisé */}
            <div className="q-paper-bed min-w-0 p-4 sm:p-8 lg:col-start-1 lg:row-start-1">
              <ModelePaper modele={modele} />
            </div>

            {/* Colonne : contenu du modèle et remplissage en ligne */}
            <aside className="flex flex-col gap-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
              <div className="flex flex-col gap-4 lg:sticky lg:top-28">
                <section aria-labelledby="contenu-modele" className="q-card overflow-hidden">
                  <h2 id="contenu-modele" className="q-card-head q-h2">
                    Ce que contient ce modèle
                    <span className="text-[13px] font-medium text-q-text-4">{modele.contenu.length} éléments</span>
                  </h2>
                  <ul className="flex flex-col gap-3 px-5 py-4">
                    {modele.contenu.map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-[14px] leading-[1.5] text-q-text-2">
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-q-ok-bg text-q-ok">
                          <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                        </span>
                        {fr(item)}
                      </li>
                    ))}
                  </ul>
                </section>
                {generator && (
                  <LinkCard
                    href={generator.href}
                    icon={<Wand2 />}
                    title={generator.title}
                    text="Remplissez ce modèle en ligne et téléchargez le PDF, sans créer de compte."
                    cta="Ouvrir l'outil"
                    as="h2"
                  />
                )}
              </div>
            </aside>

            <article className="min-w-0 lg:col-start-1 lg:row-start-2">
              <section aria-labelledby="pour-qui">
                <SectionHeading id="pour-qui" title="À qui s'adresse" accent="ce modèle&nbsp;?" className="mb-4" />
                <p className="max-w-[68ch] text-[17px] leading-[1.75] text-q-text-2">{fr(modele.pourQui)}</p>
              </section>

              {modele.mentionsSpecifiques.length > 0 && (
                <section aria-labelledby="mentions" className="mt-14">
                  <SectionHeading id="mentions" title="Mentions spécifiques" accent="à inclure." className="mb-5" />
                  <ul className="flex flex-col gap-2.5">
                    {modele.mentionsSpecifiques.map((m, i) => (
                      <li key={i} className="rounded-2xl border border-q-line border-l-[3px] border-l-q-accent bg-q-surface px-5 py-4 text-[15px] leading-[1.55] text-q-ink">
                        {fr(`« ${m} »`)}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section aria-labelledby="conseils" className="mt-14">
                <SectionHeading id="conseils" title="Conseils" accent="pratiques." className="mb-5" />
                <ol className="flex flex-col gap-3">
                  {modele.conseils.map((c, i) => (
                    <li key={i} className="flex items-start gap-4 rounded-2xl border border-q-line bg-q-surface p-4 sm:p-5">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#0A1122] text-[13px] font-semibold text-white tabular-nums dark:bg-q-accent">
                        {i + 1}
                      </span>
                      <p className="pt-1 text-[15px] leading-[1.6] text-q-text-2">{fr(c)}</p>
                    </li>
                  ))}
                </ol>
              </section>

              {/* Maillage interne */}
              <section aria-labelledby="autres-modeles" className="mt-14">
                <h2 id="autres-modeles" className="q-eyebrow mb-4">
                  Autres modèles
                </h2>
                <ChipLinks
                  links={[
                    ...MODELES.filter((m) => m.slug !== modele.slug)
                      .slice(0, 5)
                      .map((m) => ({ href: `/modele/${m.slug}`, label: m.titre.replace(/^Modèle d(e |')/, "").replace(" gratuit", "") })),
                    { href: "/guide/mentions-obligatoires-facture", label: "Mentions obligatoires" },
                  ]}
                />
              </section>
            </article>
          </div>
        </div>

        <ContentCta />
      </ContentPage>
    </>
  )
}
