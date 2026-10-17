import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Check, FileText, Receipt, FileCheck, ClipboardList, Mail, Wand2 } from "lucide-react"
import { MODELES } from "@/lib/pseo/modeles"
import { ChipLinks, ContentCta, ContentHero, ContentPage, FaqList, LinkCard, SectionHeading, WRAP } from "@/components/content/ui"
import { TelechargerModele } from "@/components/content/TelechargerModele"

/*
 * Page la mieux classée du site dans Google (Search Console, 12/07-12/10/2026) :
 * 4,5ᵉ en moyenne sur « devis modele », 6,5ᵉ sur « modele devis », aucun clic.
 * Les pages qui la devancent proposent toutes un fichier à télécharger (Word,
 * Excel, PDF) : le titre le dit et le fichier est en haut de page. Ne pas
 * déplacer ces requêtes vers /modele/devis-travaux, qui reste sur « devis
 * artisan » et « exemple de devis travaux ».
 */
export const metadata: Metadata = {
  title: "Modèle de devis gratuit à télécharger : Word, Excel, PDF",
  description: "Modèle de devis gratuit à télécharger en Word, Excel ou PDF, ou à remplir en ligne. Mentions obligatoires incluses, sans inscription. Factures aussi.",
  keywords: ["modele devis", "devis modele", "modele de devis gratuit", "modele devis word", "modele devis excel", "modele devis pdf", "modele facture gratuit", "modele avoir", "modele bon de commande"],
  alternates: { canonical: "/modele" },
  openGraph: {
    title: "Modèle de devis gratuit à télécharger | Qonforme",
    description: "Modèle de devis en Word, Excel ou PDF, ou à remplir en ligne. Sans inscription.",
    url: "https://qonforme.fr/modele",
    images: [{ url: "/api/og?title=Mod%C3%A8le%20de%20devis%20gratuit&subtitle=Devis%2C%20factures%2C%20avoirs%20et%20bons%20de%20commande", width: 1200, height: 630 }],
  },
}

const TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  facture: { label: "Facture", icon: <Receipt /> },
  devis: { label: "Devis", icon: <FileText /> },
  avoir: { label: "Avoir", icon: <FileCheck /> },
  "bon-de-commande": { label: "Bon de commande", icon: <ClipboardList /> },
  relance: { label: "Relance", icon: <Mail /> },
}

/** Les devis d'abord : c'est ce que cherchent les visiteurs de cette page. */
const MODELES_ORDONNES = [...MODELES].sort((a, b) => Number(b.type === "devis") - Number(a.type === "devis"))

/** Mentions d'un devis de travaux (même liste que /modele/devis-travaux et le guide « Devis obligatoire »). */
const MENTIONS_DEVIS = [
  "La mention « Devis », sa date et sa durée de validité",
  "Vos coordonnées : nom ou raison sociale, adresse, SIRET",
  "Le nom et l'adresse du client, et l'adresse du chantier",
  "Le détail des travaux : fournitures, main-d'œuvre, quantités et prix unitaires",
  "Le taux de TVA de chaque ligne (5,5 %, 10 % ou 20 %), les totaux HT et TTC",
  "Les conditions de paiement : acompte, échéances",
  "Votre assurance décennale : assureur, numéro de contrat, zone couverte",
  "La place pour la date et la signature du client",
]

const FAQ = [
  {
    question: "Ce modèle de devis est-il vraiment gratuit ?",
    answer:
      "Oui. Les fichiers Word, Excel et PDF se téléchargent sans inscription, et le générateur de devis remplit le modèle en ligne et vous donne le PDF tout de suite. Rien n'est enregistré sur nos serveurs : gardez votre fichier.",
  },
  {
    question: "Dans quel format télécharger le modèle de devis ?",
    answer:
      "Trois formats, avec les mêmes mentions : Word (.docx) pour modifier librement le texte, Excel (.xlsx) dont les totaux et la TVA par taux se calculent seuls, et PDF pour imprimer et remplir à la main.",
  },
  {
    question: "Quelles mentions un devis doit-il comporter ?",
    answer:
      "Sa date et sa durée de validité, vos coordonnées et votre SIRET, celles du client, le détail des travaux avec les quantités et les prix, le taux de TVA, les totaux HT et TTC, les conditions de paiement et, pour les travaux du bâtiment, votre assurance décennale.",
  },
  {
    question: "Un devis signé vaut-il contrat ?",
    answer:
      "Oui. Une fois signé par le client, le devis l'engage, comme vous, sur les travaux décrits et sur le prix. Un changement en cours de chantier se règle par un nouveau devis ou un avenant signé.",
  },
  {
    question: "Modèle à remplir ou logiciel : que choisir ?",
    answer:
      "Un modèle se remplit à la main à chaque fois. Avec Qonforme, vos clients, vos prestations et vos mentions sont enregistrés : le devis se prépare plus vite et devient une facture sans rien ressaisir. Les devis sont gratuits et illimités.",
  },
]

export default function ModeleIndexPage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Modèles de devis et de factures gratuits",
      description: "Modèles gratuits de devis, factures, avoirs et bons de commande, avec les mentions obligatoires de la réglementation française.",
      url: "https://qonforme.fr/modele",
      publisher: { "@type": "Organization", name: "Qonforme", url: "https://qonforme.fr" },
      hasPart: MODELES_ORDONNES.map((m) => ({ "@type": "WebPage", name: m.titre, url: `https://qonforme.fr/modele/${m.slug}` })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
    },
  ]

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ContentPage>
        <ContentHero
          eyebrow="Modèles gratuits"
          title="Modèle de devis et de facture,"
          accent="gratuit."
          sub="Téléchargez le modèle de devis en Word, Excel ou PDF, ou remplissez-le en ligne et récupérez le PDF, sans inscription. Chaque modèle liste les mentions obligatoires."
        >
          <div className="mx-auto mt-8 flex w-full max-w-[360px] flex-col items-stretch gap-3 sm:w-auto sm:max-w-none sm:flex-row sm:justify-center">
            <Link href="/outils/generateur-devis-gratuit" className="lp-btn-p">
              Remplir un modèle de devis
              <ArrowRight className="lp-btn-arrow h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
            </Link>
            <Link href="/outils/generateur-facture-gratuite" className="lp-btn-s">
              <span className="lp-btn-s-ic" aria-hidden>
                <Wand2 className="h-[15px] w-[15px]" strokeWidth={2} />
              </span>
              Remplir un modèle de facture
            </Link>
          </div>
          <p className="mt-4 text-[14px] text-q-text-3">Gratuit, sans compte, PDF prêt à envoyer.</p>
        </ContentHero>

        <div className="px-4 pb-14 sm:px-6 sm:pb-16">
          <div className="mx-auto w-full max-w-[860px]">
            <TelechargerModele
              id="telecharger-devis"
              fichier="modele-devis-artisan"
              titre="Télécharger le modèle de devis vierge"
              texte="Un devis de travaux prêt à remplir : lignes de prestations, TVA par taux, mentions de l'artisan et cadre « Bon pour accord ». Sans inscription."
            />
          </div>
        </div>

        <section aria-labelledby="tous-les-modeles" className="px-4 sm:px-6">
          <div className={WRAP}>
            <SectionHeading
              id="tous-les-modeles"
              title="Tous les modèles,"
              accent="avec leurs mentions."
              sub="Devis, factures, avoirs, bons de commande et lettres de relance : ce que chaque document doit contenir et les pièges à éviter."
              className="mb-8"
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
              {MODELES_ORDONNES.map((modele) => {
                const typeInfo = TYPE_LABELS[modele.type] ?? { label: modele.type, icon: <FileText /> }
                return (
                  <LinkCard
                    key={modele.slug}
                    href={`/modele/${modele.slug}`}
                    icon={typeInfo.icon}
                    kicker={<span className="q-pill q-pill-info">{typeInfo.label}</span>}
                    title={modele.titre}
                    text={modele.description}
                    cta="Voir le modèle"
                    as="h3"
                  />
                )
              })}
            </div>
          </div>
        </section>

        {/* Contenu d'un devis : ce que cherche la requête « modèle de devis » */}
        <section aria-labelledby="contenu-devis" className="px-4 pt-16 sm:px-6 sm:pt-20">
          <div className={`${WRAP} grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14`}>
            <div>
              <SectionHeading
                id="contenu-devis"
                title="Ce que doit contenir"
                accent="un devis."
                sub="Un devis complet évite les litiges et se transforme ensuite en facture sans rien oublier. Le modèle de devis travaux reprend chacune de ces mentions."
                className="mb-6"
              />
              <ChipLinks
                links={[
                  { href: "/modele/devis-travaux", label: "Modèle de devis travaux" },
                  { href: "/guide/comment-faire-un-devis", label: "Comment faire un devis" },
                  { href: "/guide/devis-obligatoire", label: "Quand le devis est obligatoire" },
                  { href: "/guide/difference-devis-facture", label: "Devis ou facture ?" },
                  { href: "/guide/mentions-obligatoires-facture", label: "Mentions obligatoires d'une facture" },
                ]}
              />
            </div>
            <ul className="q-card flex flex-col gap-3 p-5 sm:p-6">
              {MENTIONS_DEVIS.map((item) => (
                <li key={item} className="flex items-start gap-3 text-[15px] leading-[1.5] text-q-text-2">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center text-q-ok q-glyph [&>svg]:size-4 [&>svg]:[stroke-width:2]">
                    <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="faq-modeles" className="px-4 pt-16 sm:px-6 sm:pt-20">
          <div className="mx-auto w-full max-w-[860px]">
            <SectionHeading id="faq-modeles" title="Questions" accent="fréquentes." className="mb-6" />
            <FaqList items={FAQ} />
          </div>
        </section>

        <ContentCta
          title="Plutôt qu'un modèle à remplir,"
          accent="vos devis en ligne."
          links={[
            { href: "/facturation", label: "Facturation par métier" },
            { href: "/guide", label: "Guides pratiques" },
            { href: "/glossaire", label: "Glossaire" },
            { href: "/pricing", label: "Tarifs" },
            { href: "/blog", label: "Blog" },
          ]}
        />
      </ContentPage>
    </>
  )
}
