import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight, KeyRound } from "lucide-react"
import { METIERS } from "@/lib/pseo/metiers"
import { ContentCta, ContentHero, ContentPage, SectionHeading, WRAP } from "@/components/content/ui"
import { TRADE_PHOTOS } from "@/components/content/metier"

export const metadata: Metadata = {
  title: "Logiciel de facturation pour les métiers du bâtiment",
  description: "Devis et factures pour plombier, électricien, maçon, peintre et autres métiers du bâtiment : TVA par ligne, décennale, mentions légales. Devis gratuits.",
  keywords: ["logiciel facturation", "facturation par metier", "facture BTP", "devis BTP", "facture artisan"],
  alternates: { canonical: "/facturation" },
  openGraph: {
    title: "Logiciel de facturation pour les métiers du bâtiment | Qonforme",
    description: "Une facturation adaptée à chaque métier du bâtiment.",
    url: "https://qonforme.fr/facturation",
    images: [{ url: "/api/og?title=Facturation%20par%20m%C3%A9tier&subtitle=Logiciel%20adapt%C3%A9%20%C3%A0%20votre%20activit%C3%A9", width: 1200, height: 630 }],
  },
}



export default function FacturationIndexPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Facturation par métier",
    description: "Logiciel de facturation adapté à chaque métier.",
    url: "https://qonforme.fr/facturation",
    publisher: { "@type": "Organization", name: "Qonforme", url: "https://qonforme.fr" },
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ContentPage>
        <ContentHero
          eyebrow="Facturation par métier"
          title="Un logiciel de facturation"
          accent="adapté à votre métier."
          sub={`${METIERS.length} métiers du bâtiment : devis, factures et obligations légales propres à votre activité.`}
        />

        {/* Bâtiment : galerie de photos (canevas « Main », galerie des métiers) */}
        <section aria-labelledby="cat-batiment" className="px-4 sm:px-6">
          <div className={WRAP}>
            <SectionHeading id="cat-batiment" title="Les métiers" accent="du bâtiment." className="mb-8" />
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
              {METIERS.map((m, i) => {
                const slug = m.slug
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
                          // Première rangée sur mobile : visible au chargement, c'est l'élément LCP (PushRank)
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
