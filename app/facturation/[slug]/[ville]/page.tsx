import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { MapPin, Building2 } from "lucide-react"
import { METIERS, getMetierBySlug } from "@/lib/pseo/metiers"
import { VILLES, getVilleBySlug } from "@/lib/pseo/villes"
import { ChipLinks, ContentCta, ContentHero, ContentPage, CtaButtons, FaqList, SectionHeading, WRAP } from "@/components/content/ui"
import { MetierFeatures, MetierObligations, tradeHeroPhoto } from "@/components/content/metier"
import { lcFirst, withoutClaims } from "@/components/content/text"

export function generateStaticParams() {
  const params: { slug: string; ville: string }[] = []
  for (const m of METIERS) {
    for (const v of VILLES) {
      params.push({ slug: m.slug, ville: v.slug })
    }
  }
  return params
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; ville: string }> }): Promise<Metadata> {
  const { slug, ville } = await params
  const metier = getMetierBySlug(slug)
  const v = getVilleBySlug(ville)
  if (!metier || !v) return {}
  const title = `${metier.nom} à ${v.nom} — Facturation | Qonforme`
  const description = `Logiciel de facturation pour ${metier.nom.toLowerCase()} à ${v.nom} (${v.codePostal}). Devis, factures et obligations légales. Devis gratuits et illimités.`
  return {
    title,
    description,
    keywords: [...metier.motsCles, `${metier.nom.toLowerCase()} ${v.nom.toLowerCase()}`, `facturation ${v.nom.toLowerCase()}`],
    alternates: { canonical: `/facturation/${slug}/${ville}` },
    // Pages géo-ciblées (métier × ville) retirées du sitemap le 09/04/2026 — jugées
    // thin content par Google (voir README "Audit SEO"). Noindex,follow le temps
    // d'une refonte avec contenu différencié par ville (voir CLAUDE.md 2026-07-02).
    robots: { index: false, follow: true },
    openGraph: {
      title,
      description,
      url: `https://qonforme.fr/facturation/${slug}/${ville}`,
      images: [{ url: `/api/og?title=${encodeURIComponent(`${metier.nom} à ${v.nom}`)}&subtitle=${encodeURIComponent(`Devis et factures — ${v.region}`)}`, width: 1200, height: 630 }],
    },
  }
}

export default async function MetierVillePage({ params }: { params: Promise<{ slug: string; ville: string }> }) {
  const { slug, ville } = await params
  const metier = getMetierBySlug(slug)
  const v = getVilleBySlug(ville)
  if (!metier || !v) notFound()

  // Villes proches : 4 autres villes de la même région, sinon les premières disponibles
  const villesProches = VILLES
    .filter(vp => vp.slug !== v.slug)
    .sort((a, b) => (a.region === v.region ? -1 : 1) - (b.region === v.region ? -1 : 1))
    .slice(0, 4)

  // Métiers proches dans la même ville
  const metiersProchesVille = metier.metiersProches.slice(0, 4)

  // Réponses sans autopromotion invérifiable, identiques à l'écran et dans le JSON-LD
  const faq = metier.faq.map((f) => ({ question: f.question, answer: withoutClaims(f.reponse) })).filter((f) => f.answer).slice(0, 3)

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map(f => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: "https://qonforme.fr" },
        { "@type": "ListItem", position: 2, name: "Facturation par métier", item: "https://qonforme.fr/facturation" },
        { "@type": "ListItem", position: 3, name: metier.nom, item: `https://qonforme.fr/facturation/${metier.slug}` },
        { "@type": "ListItem", position: 4, name: v.nom, item: `https://qonforme.fr/facturation/${metier.slug}/${v.slug}` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: `${metier.nom} — Facturation Qonforme`,
      description: `Logiciel de facturation pour ${metier.nom.toLowerCase()} à ${v.nom}`,
      areaServed: { "@type": "City", name: v.nom },
    },
  ]

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ContentPage>
        <ContentHero
          align="start"
          size="md"
          crumbs={[
            { label: "Accueil", href: "/" },
            { label: "Facturation", href: "/facturation" },
            { label: metier.nom, href: `/facturation/${metier.slug}` },
            { label: v.nom },
          ]}
          eyebrow={<><MapPin className="h-3.5 w-3.5" aria-hidden />{v.nom} · {v.region}</>}
          title={`Logiciel de facturation pour ${lcFirst(metier.nom)}`}
          accent={`à ${v.nom}.`}
          sub={`Créez et envoyez vos devis et vos factures à ${v.nom} et partout en ${v.region}, avec les mentions obligatoires de votre métier.`}
          media={tradeHeroPhoto(metier.slug)}
        >
          <CtaButtons align="start" className="mt-8" />
        </ContentHero>

        {/* Ressources locales */}
        <section aria-labelledby="ressources-locales" className="px-4 pb-10 sm:px-6">
          <div className={WRAP}>
            <SectionHeading id="ressources-locales" title="Ressources locales" accent={`à ${v.nom}.`} className="mb-8" />
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { label: "Chambre de commerce", name: v.cci, text: `Accompagnement à la création d'entreprise, formalités et formations pour les professionnels du ${v.codePostal}.` },
                { label: "Chambre de métiers", name: v.chambreMetiers, text: `Immatriculation, stage de préparation et accompagnement des artisans en ${v.region}.` },
              ].map((r) => (
                <div key={r.label} className="flex gap-4 rounded-[20px] border border-q-line bg-q-surface p-6 shadow-[var(--q-shadow-card)]">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-q-wash text-q-accent-strong">
                    <Building2 className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <p className="q-eyebrow mb-1.5">{r.label}</p>
                    <p className="text-[16px] font-semibold text-q-ink">{r.name}</p>
                    <p className="mt-1.5 text-[14px] leading-[1.6] text-q-text-3">{r.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <MetierFeatures metier={metier} limit={6} />
        <MetierObligations metier={metier} />

        {faq.length > 0 && (
          <section aria-labelledby="faq" className="px-4 pt-16 sm:px-6 sm:pt-20">
            <div className="mx-auto w-full max-w-[800px]">
              <SectionHeading id="faq" title="Questions" accent="fréquentes." className="mb-8" />
              <FaqList items={faq} />
              <Link href={`/facturation/${metier.slug}`} className="q-link mt-6 inline-block text-[14px]">
                Toutes les questions sur le métier de {lcFirst(metier.nom)}
              </Link>
            </div>
          </section>
        )}

        {/* Maillage : même métier ailleurs, autres métiers dans la ville */}
        <section className="px-4 pt-16 sm:px-6 sm:pt-20">
          <div className={`${WRAP} grid gap-10 lg:grid-cols-2`}>
            <div>
              <h2 className="q-eyebrow mb-4">{metier.nom} dans d&apos;autres villes</h2>
              <ChipLinks links={villesProches.map((vp) => ({ href: `/facturation/${metier.slug}/${vp.slug}`, label: vp.nom }))} />
            </div>
            {metiersProchesVille.length > 0 && (
              <div>
                <h2 className="q-eyebrow mb-4">Autres métiers à {v.nom}</h2>
                <ChipLinks
                  links={metiersProchesVille
                    .map((ms) => getMetierBySlug(ms))
                    .filter((mp): mp is NonNullable<typeof mp> => mp !== undefined)
                    .map((mp) => ({ href: `/facturation/${mp.slug}/${v.slug}`, label: mp.nom }))}
                />
              </div>
            )}
          </div>
        </section>

        <ContentCta
          title="Prêt à facturer"
          accent={`à ${v.nom}\u00A0?`}
          links={[
            { href: `/facturation/${metier.slug}`, label: `${metier.nom} (national)` },
            { href: "/facturation", label: "Tous les métiers" },
            { href: "/guide/mentions-obligatoires-facture", label: "Mentions obligatoires" },
            { href: "/pricing", label: "Tarifs" },
          ]}
        />
      </ContentPage>
    </>
  )
}
