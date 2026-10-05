import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight, ExternalLink, HardHat, KeyRound } from "lucide-react"
import { INSTALLATIONS, SOURCES_COMMUNES, CHIFFRES } from "@/lib/pseo/installation"
import { getMetierBySlug } from "@/lib/pseo/metiers"
import { ContentCta, ContentHero, ContentPage, FaqList, SectionHeading, WRAP } from "@/components/content/ui"
import { TRADE_PHOTOS } from "@/components/content/metier"
import { dateFr, fr } from "@/components/content/text"

const VERIFIE_LE = "2026-10-04"

/* Intention « je démarre » (DECISIONS-STRATEGIQUES.md § 3) : « créer son entreprise dans le bâtiment », « auto-entrepreneur bâtiment ». */
export const metadata: Metadata = {
  title: "S'installer à son compte dans le bâtiment : le guide",
  description: "S'installer à son compte dans le bâtiment : qualification, statut, immatriculation, décennale, TVA et premiers devis, avec un guide pour chaque métier.",
  keywords: ["s'installer à son compte bâtiment", "créer son entreprise dans le bâtiment", "auto entrepreneur bâtiment", "devenir artisan du bâtiment"],
  alternates: { canonical: "/devenir-a-son-compte" },
  openGraph: {
    title: "S'installer à son compte dans le bâtiment | Qonforme",
    description: "Les étapes pour s'installer à son compte dans le bâtiment, métier par métier.",
    url: "https://qonforme.fr/devenir-a-son-compte",
    images: [{ url: "/api/og?title=S%27installer%20%C3%A0%20son%20compte&subtitle=Dans%20le%20b%C3%A2timent%2C%20m%C3%A9tier%20par%20m%C3%A9tier", width: 1200, height: 630 }],
  },
}

const ETAPES = [
  { titre: "Justifier de votre qualification", texte: "Les métiers du bâtiment sont des activités artisanales réglementées : un CAP, un brevet professionnel ou un titre de même niveau dans le métier, ou trois ans d'expérience effective attestés par la chambre de métiers et de l'artisanat. Sans qualification, l'amende atteint 7 500 €." },
  { titre: "Choisir votre statut", texte: `La micro-entreprise pour démarrer simplement : cotisations de ${CHIFFRES.cotisationsServices} du chiffre d'affaires encaissé pour des prestations artisanales, dans la limite de ${CHIFFRES.plafondServices} par an. Une société (EURL, SASU) quand l'activité grandit.` },
  { titre: "Vous immatriculer", texte: "En ligne, sur le guichet des formalités des entreprises, dans le mois qui précède le début de l'activité et au plus tard 15 jours après. Vous recevez vos numéros SIREN et SIRET." },
  { titre: "Vous assurer", texte: "La garantie décennale avant le premier chantier : travailler sans est puni de six mois d'emprisonnement et de 75 000 € d'amende. Son attestation est jointe à vos devis et à vos factures." },
  { titre: "Comprendre votre TVA", texte: `Franchise en base sous ${CHIFFRES.franchiseServices} de prestations par an (« TVA non applicable, art. 293 B du CGI »), puis 20 %, 10 % ou 5,5 % selon les travaux et le logement.` },
  { titre: "Faire vos premiers devis", texte: "Chez un particulier, un devis détaillé est dû avant tout dépannage, toute réparation ou tout entretien, quel qu'en soit le montant. Signé, il vaut contrat." },
]

const FAQ = [
  { question: "Faut-il un diplôme pour s'installer dans le bâtiment ?", reponse: "Oui, ou de l'expérience : les métiers du bâtiment sont réglementés. Il faut un CAP, un brevet professionnel ou un titre de même niveau dans le métier, ou trois ans d'expérience effective attestés par la chambre de métiers et de l'artisanat. Exercer sans qualification est puni d'une amende de 7 500 €." },
  { question: "Quelle assurance est obligatoire pour démarrer dans le bâtiment ?", reponse: "La garantie décennale, avant le premier chantier, pour les travaux de construction. Les fiches officielles des métiers demandent aussi une responsabilité civile professionnelle. L'attestation de décennale est jointe aux devis et aux factures." },
  { question: "Micro-entreprise ou société pour démarrer dans le bâtiment ?", reponse: `La micro-entreprise est la plus simple : cotisations calculées sur le chiffre d'affaires encaissé, comptabilité allégée, dans la limite de ${CHIFFRES.plafondServices} de prestations de services par an. Une société (EURL, SASU) se choisit plutôt quand l'activité grandit, que vous achetez beaucoup de matériel ou que vous embauchez : faites-vous conseiller.` },
]

export default function InstallationIndexPage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "S'installer à son compte dans le bâtiment",
      description: "Les étapes pour s'installer à son compte dans le bâtiment, métier par métier.",
      url: "https://qonforme.fr/devenir-a-son-compte",
      dateModified: VERIFIE_LE,
      publisher: { "@type": "Organization", name: "Qonforme", url: "https://qonforme.fr" },
      hasPart: INSTALLATIONS.map((i) => ({ "@type": "WebPage", name: `Devenir ${i.metier} à son compte`, url: `https://qonforme.fr/devenir-a-son-compte/${i.slug}` })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.reponse } })),
    },
  ]

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ContentPage>
        <ContentHero
          eyebrow={<><HardHat className="h-3.5 w-3.5" aria-hidden />S&apos;installer à son compte</>}
          title="S'installer à son compte"
          accent="dans le bâtiment."
          sub="Qualification, statut, immatriculation, assurance, TVA et premiers devis : les étapes communes, puis ce qui change d'un métier à l'autre."
        >
          <p className="mt-4 text-[14px] text-q-text-4">
            Vérifié sur les textes officiels le <time dateTime={VERIFIE_LE}>{dateFr(VERIFIE_LE)}</time>
          </p>
        </ContentHero>

        <section aria-labelledby="metiers" className="px-4 sm:px-6">
          <div className={WRAP}>
            <SectionHeading id="metiers" title="Choisissez" accent="votre métier." className="mb-8" />
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
              {INSTALLATIONS.map((inst, i) => {
                const photo = TRADE_PHOTOS[inst.slug]
                const nom = getMetierBySlug(inst.slug)?.nom ?? inst.metier
                return (
                  <li key={inst.slug}>
                    <Link
                      href={`/devenir-a-son-compte/${inst.slug}`}
                      className="group relative block aspect-[4/5] overflow-hidden rounded-[20px] border border-q-line bg-q-wash focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-q-accent"
                    >
                      {photo ? (
                        <Image
                          src={photo.src}
                          alt=""
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 232px"
                          priority={i < 2}
                          className="object-cover transition-transform duration-700 group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                        />
                      ) : (
                        <span aria-hidden className="absolute inset-0 grid place-items-center text-q-accent-strong">
                          <KeyRound className="h-10 w-10 opacity-60" strokeWidth={1.5} />
                        </span>
                      )}
                      <span className="absolute bottom-3 left-3 right-3 flex">
                        <span className="inline-flex h-8 max-w-full items-center gap-1.5 truncate rounded-full bg-white px-3 text-[13px] font-semibold text-[#0F172A] shadow-[0_1px_2px_rgba(10,17,34,.15)]">
                          {nom}
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
                        </span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>

        <section aria-labelledby="etapes" className="px-4 pt-16 sm:px-6 sm:pt-20">
          <div className={WRAP}>
            <SectionHeading id="etapes" title="Les six étapes," accent="pour tous les métiers." className="mb-8" />
            <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ETAPES.map((e, n) => (
                <li key={e.titre} className="flex flex-col rounded-[20px] border border-q-line bg-q-surface p-6 shadow-[var(--q-shadow-card)]">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-[#0A1122] text-[13px] font-semibold text-white tabular-nums dark:bg-q-accent">{n + 1}</span>
                  <h3 className="mt-4 font-display text-[18px] font-semibold leading-[1.3] tracking-[-0.02em] text-q-ink-strong">{fr(e.titre)}</h3>
                  <p className="mt-2 text-[15px] leading-[1.6] text-q-text-3">{fr(e.texte)}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="faq" className="px-4 pt-16 sm:px-6 sm:pt-20">
          <div className="mx-auto w-full max-w-[860px]">
            <SectionHeading id="faq" title="Questions" accent="fréquentes." className="mb-6" />
            <FaqList items={FAQ.map((f) => ({ question: f.question, answer: f.reponse }))} />

            <h2 className="q-eyebrow mb-4 mt-12">Sources officielles</h2>
            <ul className="flex flex-col gap-2.5 text-[14px] leading-[1.55] text-q-text-3">
              {[{ label: "Service-public.gouv.fr, « Entrepreneur en bâtiment : conditions d'accès et d'exercice en France »", href: "https://entreprendre.service-public.gouv.fr/vosdroits/F39041" }, ...SOURCES_COMMUNES].map((src) => (
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
          </div>
        </section>

        <ContentCta
          title="Votre activité démarre,"
          accent="vos devis aussi."
          links={[
            { href: "/guide/comment-faire-un-devis", label: "Comment faire un devis" },
            { href: "/guide/mentions-obligatoires-devis", label: "Mentions obligatoires d'un devis" },
            { href: "/guide/premiere-facture", label: "Comment faire une facture" },
            { href: "/guide/tva-travaux", label: "TVA des travaux" },
            { href: "/modele/devis-travaux", label: "Modèle de devis travaux" },
            { href: "/outils/simulateur-charges-auto-entrepreneur", label: "Simuler mes cotisations" },
            { href: "/facturation", label: "Facturation par métier" },
          ]}
        />
      </ContentPage>
    </>
  )
}
