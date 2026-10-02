import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight, Wrench, Briefcase, Heart, Scissors, Car, KeyRound } from "lucide-react"
import { METIERS } from "@/lib/pseo/metiers"
import { ContentCta, ContentHero, ContentPage, LinkCard, SectionHeading, WRAP } from "@/components/content/ui"
import { withoutClaims } from "@/components/content/text"
import { TRADE_PHOTOS } from "@/components/content/metier"

export const metadata: Metadata = {
  title: "Logiciel de facturation par métier | Qonforme",
  description: "Découvrez un logiciel de facturation adapté à votre métier : bâtiment, services, santé, artisanat, transport. Devis gratuits et illimités, mentions obligatoires.",
  keywords: ["logiciel facturation", "facturation par metier", "facture BTP", "facture freelance", "facture artisan"],
  alternates: { canonical: "/facturation" },
  openGraph: {
    title: "Logiciel de facturation par métier | Qonforme",
    description: "Une facturation adaptée à chaque métier, du bâtiment aux services.",
    url: "https://qonforme.fr/facturation",
    images: [{ url: "/api/og?title=Facturation%20par%20m%C3%A9tier&subtitle=Logiciel%20adapt%C3%A9%20%C3%A0%20votre%20activit%C3%A9", width: 1200, height: 630 }],
  },
}

const CATEGORIES: { nom: string; icon: React.ReactNode; slugs: string[] }[] = [
  {
    nom: "Bâtiment",
    icon: <Wrench className="w-5 h-5" />,
    slugs: ["plombier", "electricien", "macon", "peintre", "carreleur", "menuisier", "couvreur", "plaquiste", "chauffagiste", "serrurier"],
  },
  {
    nom: "Services et indépendants",
    icon: <Briefcase className="w-5 h-5" />,
    slugs: ["auto-entrepreneur", "consultant", "developpeur-freelance", "graphiste", "photographe", "formateur", "coach", "community-manager", "traducteur", "comptable", "avocat", "agent-immobilier", "informaticien"],
  },
  {
    nom: "Artisanat et commerce",
    icon: <Scissors className="w-5 h-5" />,
    slugs: ["coiffeur", "estheticienne", "paysagiste", "architecte-interieur", "traiteur", "fleuriste", "boulanger", "jardinier"],
  },
  {
    nom: "Transport et services à domicile",
    icon: <Car className="w-5 h-5" />,
    slugs: ["vtc", "taxi", "demenageur", "femme-de-menage"],
  },
  {
    nom: "Santé et bien-être",
    icon: <Heart className="w-5 h-5" />,
    slugs: ["osteopathe", "kinesitherapeute", "infirmier-liberal", "dieteticien"],
  },
]

const metiersBySlug = Object.fromEntries(METIERS.map(m => [m.slug, m]))


export default function FacturationIndexPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Facturation par métier",
    description: "Logiciel de facturation adapté à chaque métier.",
    url: "https://qonforme.fr/facturation",
    publisher: { "@type": "Organization", name: "Qonforme", url: "https://qonforme.fr" },
  }

  const [btp, ...others] = CATEGORIES

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ContentPage>
        <ContentHero
          eyebrow="Facturation par métier"
          title="Un logiciel de facturation"
          accent="adapté à votre métier."
          sub={`${METIERS.length} métiers couverts : devis, factures et obligations légales propres à votre activité.`}
        />

        {/* Bâtiment : galerie de photos (canevas « Main », galerie des métiers) */}
        <section aria-labelledby="cat-batiment" className="px-4 sm:px-6">
          <div className={WRAP}>
            <SectionHeading id="cat-batiment" title="Les métiers" accent="du bâtiment." className="mb-8" />
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
              {btp.slugs.map((slug) => {
                const m = metiersBySlug[slug]
                if (!m) return null
                const photo = TRADE_PHOTOS[slug]
                return (
                  <li key={slug}>
                    <Link
                      href={`/facturation/${slug}`}
                      className="group relative block aspect-[4/5] overflow-hidden rounded-[20px] border border-q-line bg-q-wash focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-q-accent"
                    >
                      {photo ? (
                        <Image
                          src={photo.src}
                          alt=""
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 232px"
                          className="object-cover transition-transform duration-700 group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                        />
                      ) : (
                        <span aria-hidden className="absolute inset-0 grid place-items-center text-q-accent-strong">
                          <KeyRound className="h-10 w-10 opacity-60" strokeWidth={1.5} />
                        </span>
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
            </ul>
          </div>
        </section>

        {/* Autres catégories */}
        {others.map((cat) => (
          <section key={cat.nom} aria-label={cat.nom} className="px-4 pt-16 sm:px-6 sm:pt-20">
            <div className={WRAP}>
              <div className="mb-8 flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-q-wash text-q-accent-strong">{cat.icon}</span>
                <SectionHeading title={cat.nom} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
                {cat.slugs.map((slug) => {
                  const m = metiersBySlug[slug]
                  if (!m) return null
                  return <LinkCard key={slug} href={`/facturation/${slug}`} title={m.nom} text={withoutClaims(m.description)} cta="Voir le métier" as="h3" />
                })}
              </div>
            </div>
          </section>
        ))}

        <ContentCta
          title="Votre métier n'est pas dans la liste&nbsp;?"
          accent="Qonforme s'adapte."
          sub="Vous enregistrez vos prestations et vos mentions une fois pour toutes. Les devis restent gratuits et illimités."
          links={[
            { href: "/guide", label: "Guides pratiques" },
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
