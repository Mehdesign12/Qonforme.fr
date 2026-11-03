import Image from "next/image"
import Link from "next/link"
import { ArrowRight, HardHat, type LucideIcon } from "lucide-react"
import { METIERS } from "@/lib/pseo/metiers"
import { PHOTOS, type LandingPhotoKey } from "@/lib/landing/photos"
import { ChipLinks, ContentCta, ContentHero, ContentPage, CtaButtons, FaqList, InlineCta, SectionHeading, WRAP } from "@/components/content/ui"
import { TRADE_PHOTOS } from "@/components/content/metier"
import { dateFr, fr, lcFirst } from "@/components/content/text"

/*
 * Page publique de produit sur le modèle de /logiciel-gestion-batiment (règle « Layout des
 * pages publiques de produit » de CLAUDE.md) : en-tête avec photo, « L'essentiel », blocs
 * de maquettes de l'accueil, bandeau photo, « Et aussi », parcours, métiers en tuiles
 * photo, limites, FAQ (JSON-LD bâti sur les mêmes questions), appel final.
 *
 * Chaque page passe son contenu ; le composant ne contient aucun fait, aucun prix et
 * aucune promesse : ils viennent de la page, qui les lit dans lib/stripe/plans.ts.
 */

export interface ProductFaq {
  question: string
  reponse: string
}

export interface ProductPageProps {
  /** Adresse de la page (« /logiciel-devis-gratuit »). */
  path: string
  /** Nom de la page : H1, fil d'Ariane et JSON-LD. */
  titre: string
  accent: string
  /** Chapeau : définit le sujet en une phrase (c'est ce que reprend un assistant IA). */
  sub: string
  description: string
  verifieLe: string
  eyebrow?: string
  photo: LandingPhotoKey
  /** Cadrage de la photo d'en-tête (portrait : le visage reste visible sur téléphone). */
  photoPosition?: string
  /** « L'essentiel » : cinq lignes de faits, terme puis texte. */
  essentiel: [string, string][]
  fonctions: { title: string; accent: string; sub?: string }
  /** Blocs de maquettes de components/home/Features.tsx, en alternance. */
  blocks: React.ReactNode
  /** Contenu propre au sujet (méthode, règles, tableau), entre les blocs et « Et aussi ». */
  children?: React.ReactNode
  terrain?: { photo: LandingPhotoKey; titre: string; texte: string }[]
  aussi: { icone: LucideIcon; titre: string; texte: string; href: string; lien: string }[]
  etapes: { titre: string; accent: string; items: { titre: string; texte: string }[] }
  inlineCta: { title: string; accent: string }
  limites: { title: string; accent: string; paragraphes: string[] }
  faq: ProductFaq[]
  liens: { href: string; label: string }[]
  sources?: { label: string; href?: string }[]
  cta: { title: string; accent: string }
}

export function productJsonLd(p: Pick<ProductPageProps, "path" | "titre" | "description" | "verifieLe" | "faq">) {
  const url = `https://qonforme.fr${p.path}`
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: p.titre,
      description: p.description,
      url,
      inLanguage: "fr-FR",
      dateModified: p.verifieLe,
      isPartOf: { "@type": "WebSite", name: "Qonforme", url: "https://qonforme.fr" },
      publisher: { "@type": "Organization", name: "Qonforme", url: "https://qonforme.fr" },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: "https://qonforme.fr" },
        { "@type": "ListItem", position: 2, name: p.titre, item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: p.faq.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.reponse } })),
    },
  ]
}

export function ProductPage(p: ProductPageProps) {
  const photoHero = PHOTOS[p.photo]
  const metiersPhoto = METIERS.filter((m) => TRADE_PHOTOS[m.slug])
  const metiersListe = METIERS.filter((m) => !TRADE_PHOTOS[m.slug]).map((m) => ({ href: `/facturation/${m.slug}`, label: `Logiciel pour ${lcFirst(m.nom)}` }))

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd(p)) }} />
      <ContentPage>
        <ContentHero
          crumbs={[{ label: "Accueil", href: "/" }, { label: p.titre }]}
          eyebrow={<><HardHat className="h-3.5 w-3.5" aria-hidden />{p.eyebrow ?? "Pour les artisans du bâtiment"}</>}
          title={p.titre}
          accent={p.accent}
          sub={fr(p.sub)}
          media={
            photoHero ? (
              <div className="relative aspect-[16/10] overflow-hidden rounded-[24px] border border-q-line bg-q-sunken lg:aspect-[4/5]">
                <Image src={photoHero.src} alt={photoHero.alt} fill priority sizes="(max-width: 1024px) 100vw, 400px" className={`object-cover ${p.photoPosition ?? "object-[50%_18%]"}`} />
              </div>
            ) : undefined
          }
        >
          <CtaButtons className="mt-8" />
          <p className="mt-5 text-[14px] text-q-text-4">
            Vérifié le <time dateTime={p.verifieLe}>{dateFr(p.verifieLe)}</time>
          </p>
        </ContentHero>

        <section aria-labelledby="essentiel" className="px-4 sm:px-6">
          <div className={WRAP}>
            <SectionHeading id="essentiel" title="L'essentiel," accent="en cinq lignes." className="mb-8" />
            <dl data-reveal="" className="grid gap-px overflow-hidden rounded-[20px] border border-q-line bg-q-line shadow-[shadow:var(--q-shadow-card)] md:grid-cols-[220px_1fr]">
              {p.essentiel.map(([terme, texte]) => (
                <div key={terme} className="contents">
                  <dt className="bg-q-surface-2 px-5 py-4 text-[14px] font-semibold text-q-ink-strong md:py-5">{terme}</dt>
                  <dd className="bg-q-surface px-5 pb-4 text-[15px] leading-[1.6] text-q-text-3 md:py-5">{fr(texte)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section aria-labelledby="fonctions" className="px-4 pb-10 pt-16 sm:px-6 sm:pb-12 sm:pt-20">
          <div className={WRAP}>
            <SectionHeading id="fonctions" title={p.fonctions.title} accent={p.fonctions.accent} sub={p.fonctions.sub ?? "Les vrais écrans de l'application, avec des données d'exemple. Seulement ce qui existe : rien d'annoncé qui ne soit pas livré."} />
          </div>
        </section>

        {p.blocks}

        {p.children}

        {p.terrain && p.terrain.length > 0 && (
          <section aria-labelledby="terrain" className="px-4 pt-16 sm:px-6 sm:pt-20">
            <div className={WRAP}>
              <SectionHeading id="terrain" title="Pensé pour" accent="le terrain." sub="Un logiciel qu'on ouvre entre deux chantiers, sur le téléphone comme à l'ordinateur." className="mb-8" />
              <ul className="grid gap-6 md:grid-cols-3">
                {p.terrain.map((t) => {
                  const photo = PHOTOS[t.photo]
                  return photo ? (
                    <li key={t.titre} data-reveal="" data-reveal-item="">
                      <figure>
                        <div className="relative aspect-[16/10] overflow-hidden rounded-[20px] border border-q-line bg-q-sunken">
                          <Image src={photo.src} alt={photo.alt} fill loading="lazy" sizes="(max-width: 768px) 100vw, 384px" className="object-cover" />
                        </div>
                        <figcaption className="mt-4">
                          <h3 className="font-display text-[19px] font-semibold leading-[1.25] tracking-[-0.02em] text-q-ink-strong">{t.titre}</h3>
                          <p className="mt-1.5 text-[15px] leading-[1.6] text-q-text-3">{fr(t.texte)}</p>
                        </figcaption>
                      </figure>
                    </li>
                  ) : null
                })}
              </ul>
            </div>
          </section>
        )}

        <section aria-labelledby="aussi" className="px-4 pt-16 sm:px-6 sm:pt-20">
          <div className={WRAP}>
            <SectionHeading id="aussi" title="Et aussi," accent="pour le reste." className="mb-8" />
            <ul className="grid gap-4 md:grid-cols-3">
              {p.aussi.map((f) => (
                <li key={f.titre} data-reveal="" data-reveal-item="" className="flex flex-col rounded-[20px] border border-q-line bg-q-surface p-6 shadow-[shadow:var(--q-shadow-card)]">
                  <span className="q-glyph mb-5 grid h-10 w-10 shrink-0 place-items-center text-q-accent-strong">
                    <f.icone className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                  </span>
                  <h3 className="font-display text-[19px] font-semibold leading-[1.25] tracking-[-0.02em] text-q-ink-strong">{fr(f.titre)}</h3>
                  <p className="mt-2 flex-1 text-[14.5px] leading-[1.6] text-q-text-3">{fr(f.texte)}</p>
                  <Link href={f.href} className="mt-5 inline-flex items-center gap-1.5 text-[14px] font-semibold text-q-accent-strong hover:underline">
                    {f.lien}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="parcours" className="px-4 pt-16 sm:px-6 sm:pt-20">
          <div className={WRAP}>
            <SectionHeading id="parcours" title={p.etapes.titre} accent={p.etapes.accent} className="mb-8" />
            <ol className={`grid gap-4 sm:grid-cols-2 ${p.etapes.items.length >= 5 ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
              {p.etapes.items.map((e, n) => (
                <li key={e.titre} className="flex flex-col rounded-[20px] border border-q-line bg-q-surface p-6 shadow-[shadow:var(--q-shadow-card)]">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-[#0A1122] text-[13px] font-semibold text-white tabular-nums dark:bg-q-accent">{n + 1}</span>
                  <h3 className="mt-4 font-display text-[18px] font-semibold leading-[1.3] tracking-[-0.02em] text-q-ink-strong">{e.titre}</h3>
                  <p className="mt-2 text-[15px] leading-[1.6] text-q-text-3">{fr(e.texte)}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <div className="px-4 pt-16 sm:px-6 sm:pt-20">
          <InlineCta className={WRAP} title={p.inlineCta.title} accent={p.inlineCta.accent} />
        </div>

        <section aria-labelledby="metiers" className="px-4 pt-16 sm:px-6 sm:pt-20">
          <div className={WRAP}>
            <SectionHeading id="metiers" title="Pour quel" accent="métier ?" sub="Chaque métier a son catalogue de prestations et ses règles de TVA : choisissez le vôtre." className="mb-8" />
            <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-5">
              {metiersPhoto.map((m) => {
                const photo = TRADE_PHOTOS[m.slug]
                return (
                  <li key={m.slug}>
                    <Link
                      href={`/facturation/${m.slug}`}
                      className="group relative block aspect-[4/5] overflow-hidden rounded-[20px] border border-q-line bg-q-wash focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-q-accent"
                    >
                      {photo && (
                        <Image
                          src={photo.src}
                          alt=""
                          fill
                          loading="lazy"
                          sizes="(max-width: 768px) 50vw, 232px"
                          className="object-cover transition-transform duration-700 group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                        />
                      )}
                      <span className="absolute bottom-3 left-3 right-3 flex">
                        <span className="inline-flex h-8 max-w-full items-center gap-1.5 truncate rounded-full bg-white px-3 text-[13px] font-semibold text-[#0F172A] shadow-[0_1px_2px_rgba(10,17,34,.15)]">
                          {m.nom}
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
                        </span>
                      </span>
                    </Link>
                  </li>
                )
              })}
              <li>
                <Link
                  href="/facturation"
                  className="group flex aspect-[4/5] flex-col items-start justify-end rounded-[20px] border border-q-line bg-q-wash p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-q-accent"
                >
                  <span className="font-display text-[18px] font-semibold leading-[1.2] tracking-[-0.02em] text-q-ink-strong">Tous les métiers</span>
                  <span className="mt-2 inline-flex items-center gap-1.5 text-[14px] font-semibold text-q-accent-strong">
                    Voir la liste
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
                  </span>
                </Link>
              </li>
            </ul>
            {metiersListe.length > 0 && <ChipLinks links={metiersListe} className="mt-6" />}
          </div>
        </section>

        <section aria-labelledby="limites" className="px-4 pt-16 sm:px-6 sm:pt-20">
          <div className="mx-auto w-full max-w-[860px]">
            <SectionHeading id="limites" title={p.limites.title} accent={p.limites.accent} className="mb-6" />
            <div className="flex flex-col gap-4 text-[16px] leading-[1.7] text-q-text-3">
              {p.limites.paragraphes.map((t) => (
                <p key={t}>{fr(t)}</p>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="faq" className="px-4 pt-16 sm:px-6 sm:pt-20">
          <div className="mx-auto w-full max-w-[860px]">
            <SectionHeading id="faq" title="Questions" accent="fréquentes." className="mb-6" />
            <FaqList items={p.faq.map((f) => ({ question: f.question, answer: f.reponse }))} />
            <h2 className="q-eyebrow mb-4 mt-12">Pour aller plus loin</h2>
            <ChipLinks links={p.liens} />
            {p.sources && p.sources.length > 0 && (
              <>
                <h2 className="q-eyebrow mb-4 mt-12">Sources officielles</h2>
                <ul className="flex flex-col gap-2.5 text-[14px] leading-[1.55] text-q-text-3">
                  {p.sources.map((s) => (
                    <li key={s.label}>
                      {s.href ? (
                        <a href={s.href} target="_blank" rel="noopener noreferrer" className="q-link">
                          {fr(s.label)}
                        </a>
                      ) : (
                        fr(s.label)
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </section>

        <ContentCta
          title={p.cta.title}
          accent={p.cta.accent}
          links={[
            { href: "/logiciel-gestion-batiment", label: "Logiciel de gestion bâtiment" },
            { href: "/facturation", label: "Logiciel par métier" },
            { href: "/guide", label: "Guides pratiques" },
            { href: "/outils", label: "Outils gratuits" },
          ]}
        />
      </ContentPage>
    </>
  )
}
