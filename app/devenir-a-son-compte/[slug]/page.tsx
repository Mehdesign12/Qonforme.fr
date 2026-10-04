import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight, Check, ExternalLink, HardHat } from "lucide-react"
import { INSTALLATIONS, SOURCES_COMMUNES, CHIFFRES, etapes, getInstallationBySlug } from "@/lib/pseo/installation"
import { getMetierBySlug } from "@/lib/pseo/metiers"
import { ChipLinks, ContentCta, ContentHero, ContentPage, FaqList, SectionHeading, WRAP } from "@/components/content/ui"
import { tradeHeroPhoto } from "@/components/content/metier"
import { dateFr, fr } from "@/components/content/text"
import { fitDescription, fitTitle } from "@/lib/seo/meta"

/** Date de la dernière vérification des règles (sources dans lib/pseo/installation.ts). */
const VERIFIE_LE = "2026-10-04"

export function generateStaticParams() {
  return INSTALLATIONS.map((i) => ({ slug: i.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const inst = getInstallationBySlug(slug)
  if (!inst) return {}
  return {
    title: fitTitle(inst.titreSeo),
    description: fitDescription(inst.description),
    keywords: inst.motsCles,
    alternates: { canonical: `/devenir-a-son-compte/${inst.slug}` },
    openGraph: {
      title: `Devenir ${inst.metier} à son compte | Qonforme`,
      description: inst.description,
      url: `https://qonforme.fr/devenir-a-son-compte/${inst.slug}`,
      images: [{ url: `/api/og?title=${encodeURIComponent(`Devenir ${inst.metier} à son compte`)}&subtitle=${encodeURIComponent("Les étapes, les règles et les obligations")}`, width: 1200, height: 630 }],
    },
  }
}

export default async function InstallationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const inst = getInstallationBySlug(slug)
  if (!inst) notFound()

  const steps = etapes(inst)
  const metierPage = getMetierBySlug(inst.slug)
  const autres = INSTALLATIONS.filter((i) => i.slug !== inst.slug)

  // Réponse directe : une ligne par étape
  const essentiel = [
    `Qualification : un ${inst.diplome}, un brevet professionnel, ou trois ans d'expérience attestés.`,
    `Statut : la micro-entreprise pour démarrer, jusqu'à ${CHIFFRES.plafondServices} de prestations par an.`,
    "Immatriculation : en ligne, dans le mois qui précède le début de l'activité.",
    "Assurance : la décennale avant le premier chantier, avec une responsabilité civile professionnelle.",
    `TVA : franchise sous ${CHIFFRES.franchiseServices} de prestations par an, puis 20 %, 10 % ou 5,5 % selon les travaux.`,
    "Devis : obligatoire chez un particulier avant tout dépannage, quel qu'en soit le montant.",
  ]

  const url = `https://qonforme.fr/devenir-a-son-compte/${inst.slug}`
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: `Devenir ${inst.metier} à son compte`,
      description: inst.description,
      mainEntityOfPage: url,
      dateModified: VERIFIE_LE,
      author: { "@type": "Organization", name: "Qonforme", url: "https://qonforme.fr" },
      publisher: { "@type": "Organization", name: "Qonforme", url: "https://qonforme.fr" },
      citation: [inst.fiche.href, ...SOURCES_COMMUNES.flatMap((s) => (s.href ? [s.href] : []))],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: inst.faq.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.reponse } })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: "https://qonforme.fr" },
        { "@type": "ListItem", position: 2, name: "S'installer à son compte", item: "https://qonforme.fr/devenir-a-son-compte" },
        { "@type": "ListItem", position: 3, name: `Devenir ${inst.metier} à son compte`, item: url },
      ],
    },
  ]

  const toc = [
    { href: "#essentiel", label: "L'essentiel" },
    ...steps.map((s, i) => ({ href: `#etape-${i + 1}`, label: s.titre })),
    { href: "#metier", label: `Propre au métier de ${inst.metier}` },
    { href: "#faq", label: "Questions fréquentes" },
    { href: "#sources", label: "Sources officielles" },
  ]

  const sources = [inst.fiche, ...SOURCES_COMMUNES]

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ContentPage>
        <ContentHero
          align="start"
          size="md"
          crumbs={[{ label: "Accueil", href: "/" }, { label: "S'installer à son compte", href: "/devenir-a-son-compte" }, { label: metierPage?.nom ?? inst.metier }]}
          eyebrow={<><HardHat className="h-3.5 w-3.5" aria-hidden />S&apos;installer à son compte</>}
          title={`Devenir ${inst.metier}`}
          accent="à son compte."
          sub={fr(inst.intro)}
          media={tradeHeroPhoto(inst.slug)}
        >
          <p className="mt-4 text-[14px] text-q-text-4">
            Vérifié sur les textes officiels le <time dateTime={VERIFIE_LE}>{dateFr(VERIFIE_LE)}</time>
          </p>
        </ContentHero>

        <div className="px-4 sm:px-6">
          <div className={`${WRAP} lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-14`}>
            <article className="min-w-0">
              <section aria-labelledby="essentiel" className="mb-12 rounded-[20px] border border-q-wash-line bg-q-wash p-6 sm:p-7">
                <h2 id="essentiel" className="scroll-mt-28 font-display text-[22px] font-semibold tracking-[-0.02em] text-q-ink-strong">
                  L&apos;essentiel en six étapes
                </h2>
                <ol className="mt-4 flex flex-col gap-3">
                  {essentiel.map((item, n) => (
                    <li key={item} className="flex items-start gap-3 text-[15px] leading-[1.55] text-q-text-2">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-q-surface text-[11px] font-semibold text-q-accent-strong tabular-nums">
                        {n + 1}
                      </span>
                      {fr(item)}
                    </li>
                  ))}
                </ol>
              </section>

              <div className="blog-prose">
                {steps.map((step, i) => (
                  <section key={step.titre}>
                    <h2 id={`etape-${i + 1}`}>
                      {i + 1}. {fr(step.titre)}
                    </h2>
                    <p>{fr(step.contenu)}</p>
                    {step.liste && (
                      <ul>
                        {step.liste.map((item) => (
                          <li key={item}>{fr(item)}</li>
                        ))}
                      </ul>
                    )}
                  </section>
                ))}
              </div>

              <section aria-labelledby="metier" className="mt-14">
                <SectionHeading id="metier" title="Ce qui est propre" accent={`au métier de ${inst.metier}.`} className="mb-6" />
                <div className="grid gap-4 sm:grid-cols-2">
                  {inst.specificites.map((s) => (
                    <div key={s.titre} className="rounded-[20px] border border-q-line bg-q-surface p-6 shadow-[var(--q-shadow-card)]">
                      <h3 className="font-display text-[18px] font-semibold leading-[1.3] tracking-[-0.02em] text-q-ink-strong">{fr(s.titre)}</h3>
                      <p className="mt-2 text-[15px] leading-[1.6] text-q-text-3">{fr(s.texte)}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section aria-labelledby="faq" className="mt-16 max-w-[68ch]">
                <SectionHeading id="faq" title="Questions" accent="fréquentes." className="mb-6" />
                <FaqList items={inst.faq.map((f) => ({ question: f.question, answer: f.reponse }))} />
              </section>

              <section aria-labelledby="aller-plus-loin" className="mt-16">
                <h2 id="aller-plus-loin" className="q-eyebrow mb-4">
                  Aller plus loin
                </h2>
                <ChipLinks
                  links={[
                    ...(metierPage ? [{ href: `/facturation/${inst.slug}`, label: `Facturation pour ${inst.metier}` }] : []),
                    { href: "/guide/mentions-obligatoires-devis", label: "Mentions obligatoires d'un devis" },
                    { href: "/modele/devis-travaux", label: "Modèle de devis travaux" },
                    { href: "/guide/mentions-obligatoires-facture", label: "Mentions obligatoires d'une facture" },
                    { href: "/outils/simulateur-charges-auto-entrepreneur", label: "Simuler mes cotisations" },
                    { href: "/devenir-a-son-compte", label: "Tous les métiers" },
                  ]}
                />
                <p className="mt-6 text-[14px] leading-[1.6] text-q-text-3">
                  Les autres métiers :{" "}
                  {autres.map((a, n) => (
                    <span key={a.slug}>
                      <Link href={`/devenir-a-son-compte/${a.slug}`} className="q-link">
                        {a.metier}
                      </Link>
                      {n < autres.length - 1 ? ", " : "."}
                    </span>
                  ))}
                </p>
              </section>

              <section aria-labelledby="sources" className="mt-12 max-w-[68ch]">
                <h2 id="sources" className="q-eyebrow mb-4 scroll-mt-28">
                  Sources officielles
                </h2>
                <ul className="flex flex-col gap-2.5 text-[14px] leading-[1.55] text-q-text-3">
                  {sources.map((src) => (
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
            </article>

            {/* Colonne : sommaire collé au défilement + rappel de l'offre */}
            <aside className="hidden lg:block">
              <div className="sticky top-28 flex flex-col gap-4">
                <nav aria-label="Sommaire" className="rounded-[20px] border border-q-line bg-q-surface p-5">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-q-text-4">Sommaire</p>
                  <ol>
                    {toc.map((item, i) => (
                      <li key={item.href}>
                        <a href={item.href} className="flex gap-3 rounded-lg py-1.5 text-[14px] leading-snug text-q-text-3 transition-colors hover:text-q-accent-strong">
                          <span className="w-5 shrink-0 text-right font-mono text-[12px] leading-[1.6] text-q-text-4 tabular-nums">{i + 1}</span>
                          <span>{fr(item.label)}</span>
                        </a>
                      </li>
                    ))}
                  </ol>
                </nav>
                <div className="rounded-[20px] border border-q-wash-line bg-q-wash p-5">
                  <p className="font-display text-[18px] font-semibold leading-[1.25] tracking-[-0.02em] text-q-ink-strong">
                    Vos premiers devis, <span className="q-serif">gratuits et illimités.</span>
                  </p>
                  <p className="mt-2 text-[14px] leading-[1.55] text-q-text-3">Mentions obligatoires comprises. Vous payez à partir de votre première facture.</p>
                  <Link href="/signup" className="q-btn q-btn-primary mt-4 w-full rounded-full">
                    Créer mon premier devis
                    <ArrowRight aria-hidden />
                  </Link>
                </div>
                <ul className="flex flex-col gap-2 px-1 text-[13px] text-q-text-4">
                  <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-q-accent" aria-hidden />Sans carte bancaire</li>
                </ul>
              </div>
            </aside>
          </div>
        </div>

        <ContentCta />
      </ContentPage>
    </>
  )
}
