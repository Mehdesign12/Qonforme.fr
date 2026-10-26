import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, FileSpreadsheet, Hammer, HardHat, ScanLine } from "lucide-react"
import { METIERS } from "@/lib/pseo/metiers"
import { PHOTOS } from "@/lib/landing/photos"
import { PLANS, TAX_SUFFIX, formatEuros, scanQuotaText } from "@/lib/stripe/plans"
import { ChipLinks, ContentCta, ContentHero, ContentPage, CtaButtons, FaqList, InlineCta, SectionHeading, WRAP } from "@/components/content/ui"
import { TRADE_PHOTOS } from "@/components/content/metier"
import { CatalogueBlock, DevisBlock, FacturationBlock, PilotageBlock, PlanningBlock, RelancesBlock } from "@/components/home/Features"
import { dateFr, fr, lcFirst } from "@/components/content/text"

/*
 * Page « Logiciel de gestion bâtiment et devis » (demande du fondateur, 24/10/2026).
 *
 * Mot-clé : « logiciel de gestion bâtiment » (et « logiciel de gestion pour artisan »,
 * « logiciel devis bâtiment »). Aucune page ne le visait (Search Console, 21/07 au
 * 21/10/2026 : aucune requête « gestion » sur une page de produit), donc pas de
 * concurrence avec l'accueil ni avec les pages métier « Logiciel de devis gratuit pour … ».
 *
 * Honnêteté (CLAUDE.md, DECISIONS-STRATEGIQUES.md § 2 et § 10) :
 * - seules les fonctions livrées sont décrites ; celles de la formule Artisan ne
 *   sont présentées comme disponibles que si la formule est en vente (PLANS.pro.available) ;
 * - les prix, les fonctions et les « à venir » viennent de lib/stripe/plans.ts, jamais écrits ici ;
 * - « gratuit » ne vise que les devis ; aucun concurrent nommé, aucun chiffre ni avis inventé ;
 * - ni « certifié », ni « conforme », ni promesse de raccordement à une plateforme agréée.
 *
 * GEO (visibilité dans les réponses des assistants IA) : définition en une phrase dès
 * le chapeau, bloc « L'essentiel » en liste de faits, questions posées comme on les tape,
 * critères de choix explicites, limites écrites noir sur blanc, date de vérification.
 *
 * Mise en page (retour du fondateur, 24/10/2026) : pas de section « Qu'est-ce que… » ni de
 * grille de tarifs (la page Tarifs et « L'essentiel » suffisent) ; à la place, les mêmes
 * blocs de maquettes que l'accueil (catalogue de prix, devis, facture, relances, agenda,
 * tableau de bord), chacun avec son bouton, des photos de métiers sans dégradé ni élément
 * posé dessus, et le détail des fonctions qui n'ont pas de bloc.
 */

const VERIFIE_LE = "2026-10-24"
const URL_PAGE = "https://qonforme.fr/logiciel-gestion-batiment"
const TITRE = "Logiciel de gestion bâtiment et devis"

const essentiel = PLANS.starter
const artisan = PLANS.pro
const artisanEnVente = artisan.available

const prix = (montant: number) => `${formatEuros(montant)}${TAX_SUFFIX}`

export const metadata: Metadata = {
  title: `${TITRE} pour artisans`,
  description: "Logiciel de gestion pour artisans du bâtiment : devis gratuits et illimités, factures, relances automatiques et export comptable, du devis au paiement.",
  keywords: ["logiciel de gestion bâtiment", "logiciel gestion BTP", "logiciel de gestion pour artisan", "logiciel devis bâtiment", "logiciel devis et facture artisan"],
  alternates: { canonical: "/logiciel-gestion-batiment" },
  openGraph: {
    title: `${TITRE} | Qonforme`,
    description: "Devis gratuits et illimités, factures, relances et export comptable pour les artisans du bâtiment.",
    url: URL_PAGE,
    images: [{ url: "/api/og?title=Logiciel%20de%20gestion%20b%C3%A2timent%20et%20devis&subtitle=Du%20devis%20au%20paiement%2C%20pour%20les%20artisans", width: 1200, height: 630 }],
  },
}

/** Fonctions livrées qui n'ont pas de bloc de maquette. */
const AUSSI = [
  {
    icone: ScanLine,
    titre: "Scan de documents",
    texte: `Photographiez vos devis signés, bons de commande et bons de livraison avec le téléphone : ils sont classés dans Documents (${scanQuotaText("free")} sans formule).`,
    href: "/demo/documents",
    lien: "Voir dans la démo",
  },
  {
    icone: Hammer,
    titre: "Chantiers, acomptes et situations",
    texte: artisanEnVente
      ? `Avec la formule ${artisan.name} : factures d'acompte, situations de travaux, retenue de garantie, autoliquidation en sous-traitance et suivi par chantier.`
      : `La formule ${artisan.name}, bientôt disponible, ajoute les factures d'acompte, les situations de travaux, la retenue de garantie, l'autoliquidation en sous-traitance et le suivi par chantier.`,
    href: "/guide/facture-acompte",
    lien: "La facture d'acompte",
  },
  {
    icone: FileSpreadsheet,
    titre: "Export comptable",
    texte: `Avec ${essentiel.name}, l'export FEC (fichier des écritures comptables) de vos factures et de vos avoirs, pour votre expert-comptable.`,
    href: "/glossaire/fec",
    lien: "Qu'est-ce que le FEC ?",
  },
]

/** Photos du bandeau « Sur le terrain » : légendes sobres, rien de promis. */
const TERRAIN = [
  { photo: PHOTOS.chezLeClient, titre: "Chez le client", texte: "Le devis se prépare à l'avance, puis se présente sur place, en PDF ou sur le téléphone." },
  { photo: PHOTOS.atelierTelephone, titre: "À l'atelier", texte: "Le catalogue, l'agenda et les notes s'ouvrent dans le navigateur du téléphone, sans rien installer." },
  { photo: PHOTOS.finDeJournee, titre: "En fin de journée", texte: `Avec ${essentiel.name}, la facture part d'un clic et les relances suivent vos réglages.` },
]

const ETAPES = [
  { titre: "Vous chiffrez", texte: "Le devis se compose à partir de votre catalogue, avec la TVA par ligne. C'est gratuit, sans limite." },
  { titre: "Vous envoyez", texte: "Le devis part par e-mail, en PDF. Quand votre client accepte, vous le marquez accepté." },
  { titre: "Vous facturez", texte: `Avec ${essentiel.name}, le devis accepté devient une facture en brouillon, que vous relisez. Le numéro est attribué à l'envoi.` },
  { titre: "Vous suivez", texte: "Le tableau de bord montre ce qui est facturé, à encaisser et en retard ; les relances partent selon vos réglages." },
  { titre: "Vous clôturez", texte: "Vous marquez la facture payée avec sa date, puis exportez le tout pour votre comptable." },
]

const FAQ = [
  {
    question: "Qu'est-ce qu'un logiciel de gestion pour le bâtiment ?",
    reponse: "C'est un outil en ligne qui réunit les tâches administratives d'un artisan : devis, factures, avoirs, suivi des paiements, relances, planning et export comptable. Il évite les ressaisies, car chaque document alimente le suivant : le devis accepté devient une facture, la facture payée alimente le tableau de bord.",
  },
  {
    question: "Comment choisir un logiciel de gestion et de devis pour le bâtiment ?",
    reponse: "Vérifiez sept points : des devis détaillés avec la TVA par ligne (20 %, 10 %, 5,5 %) ; un catalogue de prestations de votre métier ; les mentions légales du bâtiment ajoutées pour vous (statut, assurance, TVA) ; le passage du devis à la facture sans ressaisie ; les acomptes et les situations de travaux si vous facturez en plusieurs fois ; la relance des impayés ; l'export pour le comptable. Regardez aussi le prix réel et ce que vous gardez si vous arrêtez.",
  },
  {
    question: "Existe-t-il un logiciel de gestion pour le bâtiment gratuit ?",
    reponse: `Chez Qonforme, les devis sont gratuits et illimités, avec les clients, le catalogue, le planning, les notes et le scan de documents. Les factures se préparent en brouillon sans frais ; leur envoi, les relances et l'export comptable demandent la formule ${essentiel.name}, à ${prix(essentiel.monthlyPrice)} par mois.`,
  },
  {
    question: "Peut-on gérer ses devis et ses factures depuis un téléphone ?",
    reponse: "Oui. Qonforme s'utilise dans le navigateur du téléphone, avec un affichage adapté, et le site peut être ajouté à l'écran d'accueil. Les rendez-vous, les notes et le scan de documents se font aussi depuis le téléphone.",
  },
  {
    question: "Le logiciel gère-t-il les acomptes, les situations de travaux et la retenue de garantie ?",
    reponse: artisanEnVente
      ? `Oui, avec la formule ${artisan.name} : factures d'acompte, situations de travaux cumulées, retenue de garantie suivie et autoliquidation en sous-traitance, rattachées à vos chantiers.`
      : `Ces fonctions font partie de la formule ${artisan.name}, bientôt disponible : factures d'acompte, situations de travaux, retenue de garantie, autoliquidation en sous-traitance et suivi par chantier.`,
  },
  {
    question: "Qonforme convient-il à un auto-entrepreneur du bâtiment ?",
    reponse: "Oui. En franchise en base de TVA, vos devis et vos factures portent la mention « TVA non applicable, art. 293 B du CGI ». Les mentions propres à l'entreprise individuelle et à votre assurance sont ajoutées à partir de votre profil.",
  },
  {
    question: "Une facture émise peut-elle être corrigée ?",
    reponse: "Une facture émise ne se modifie pas et ne se supprime pas : la numérotation reste continue et une erreur se corrige par un avoir, comme le prévoit l'article 242 nonies A de l'annexe II au code général des impôts. Vos documents émis restent consultables et téléchargeables, même sans formule.",
  },
  {
    question: "Mes factures sont-elles prêtes pour la facturation électronique ?",
    reponse: "Les factures et avoirs émis sont des PDF Factur-X, avec leurs données structurées jointes. L'obligation de recevoir des factures électroniques s'applique depuis le 1er septembre 2026, et celle d'en émettre à partir du 1er septembre 2027 pour les PME, TPE et micro-entreprises. Notre guide explique les étapes et le rôle de la plateforme agréée.",
  },
]

export default function LogicielGestionBatimentPage() {
  const description = metadata.description as string
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: TITRE,
      description,
      url: URL_PAGE,
      inLanguage: "fr-FR",
      dateModified: VERIFIE_LE,
      isPartOf: { "@type": "WebSite", name: "Qonforme", url: "https://qonforme.fr" },
      publisher: { "@type": "Organization", name: "Qonforme", url: "https://qonforme.fr" },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: "https://qonforme.fr" },
        { "@type": "ListItem", position: 2, name: TITRE, item: URL_PAGE },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.reponse } })),
    },
  ]

  // Les métiers qui ont une photo en tuile, les autres en liens simples dessous
  const metiersPhoto = METIERS.filter((m) => TRADE_PHOTOS[m.slug])
  const metiersListe = METIERS.filter((m) => !TRADE_PHOTOS[m.slug]).map((m) => ({ href: `/facturation/${m.slug}`, label: `Logiciel pour ${lcFirst(m.nom)}` }))
  const photoHero = PHOTOS.cheffeDeChantier

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ContentPage>
        <ContentHero
          crumbs={[{ label: "Accueil", href: "/" }, { label: TITRE }]}
          eyebrow={<><HardHat className="h-3.5 w-3.5" aria-hidden />Pour les artisans du bâtiment</>}
          title={TITRE}
          accent="pour artisans."
          sub="Qonforme est un logiciel de gestion pour artisans du bâtiment : vos devis, vos factures, vos relances et votre planning au même endroit. Les devis sont gratuits et illimités ; vous choisissez une formule quand vous envoyez votre première facture."
          media={
            photoHero ? (
              <div className="relative aspect-[16/10] overflow-hidden rounded-[24px] border border-q-line bg-q-sunken lg:aspect-[4/5]">
                <Image src={photoHero.src} alt={photoHero.alt} fill priority sizes="(max-width: 1024px) 100vw, 400px" className="object-cover object-[50%_18%]" />
              </div>
            ) : undefined
          }
        >
          <CtaButtons className="mt-8" />
          <p className="mt-5 text-[14px] text-q-text-4">
            Vérifié le <time dateTime={VERIFIE_LE}>{dateFr(VERIFIE_LE)}</time>
          </p>
        </ContentHero>

        {/* Réponse en une lecture : les faits que reprend un assistant IA, et que lit un artisan pressé */}
        <section aria-labelledby="essentiel" className="px-4 sm:px-6">
          <div className={WRAP}>
            <SectionHeading id="essentiel" title="L'essentiel," accent="en cinq lignes." className="mb-8" />
            <dl data-reveal="" className="grid gap-px overflow-hidden rounded-[20px] border border-q-line bg-q-line shadow-[shadow:var(--q-shadow-card)] md:grid-cols-[220px_1fr]">
              {[
                ["Pour qui", `Les artisans du bâtiment, en ${METIERS.length} métiers : ${METIERS.map((m) => lcFirst(m.nom)).join(", ")}.`],
                ["Ce qu'il fait", "Devis, bons de commande, factures et avoirs, clients et catalogue de prestations, planning et notes, scan de documents, relances des impayés, export comptable (FEC)."],
                ["Ce qu'il coûte", `Devis gratuits et illimités. Factures, relances et export avec ${essentiel.name} : ${prix(essentiel.monthlyPrice)} par mois, ou ${prix(essentiel.yearlyPrice)} par an. Sans engagement.`],
                ["Où l'utiliser", "Dans le navigateur, sur ordinateur comme sur téléphone, sans rien installer."],
                ["Ce qu'il ne fait pas", "Ni comptabilité complète, ni paie, ni gestion de stock : il s'arrête à l'envoi de vos documents et au suivi de ce qui est payé."],
              ].map(([terme, texte]) => (
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
            <SectionHeading id="fonctions" title="Ce que Qonforme gère" accent="aujourd'hui." sub="Les vrais écrans de l'application, avec des données d'exemple. Seulement ce qui existe : rien d'annoncé qui ne soit pas livré." />
          </div>
        </section>

        {/* Mêmes blocs et mêmes captures que l'accueil, du chiffrage au suivi, en alternance */}
        <CatalogueBlock reverse={false} />
        <DevisBlock reverse />
        <FacturationBlock reverse={false} />
        <RelancesBlock reverse />
        <PlanningBlock reverse={false} />
        <PilotageBlock reverse />

        <section aria-labelledby="terrain" className="px-4 pt-16 sm:px-6 sm:pt-20">
          <div className={WRAP}>
            <SectionHeading id="terrain" title="Pensé pour" accent="le terrain." sub="Un logiciel qu'on ouvre entre deux chantiers, sur le téléphone comme à l'ordinateur." className="mb-8" />
            <ul className="grid gap-6 md:grid-cols-3">
              {TERRAIN.map((t) =>
                t.photo ? (
                  <li key={t.titre} data-reveal="" data-reveal-item="">
                    <figure>
                      <div className="relative aspect-[16/10] overflow-hidden rounded-[20px] border border-q-line bg-q-sunken">
                        <Image src={t.photo.src} alt={t.photo.alt} fill loading="lazy" sizes="(max-width: 768px) 100vw, 384px" className="object-cover" />
                      </div>
                      <figcaption className="mt-4">
                        <h3 className="font-display text-[19px] font-semibold leading-[1.25] tracking-[-0.02em] text-q-ink-strong">{t.titre}</h3>
                        <p className="mt-1.5 text-[15px] leading-[1.6] text-q-text-3">{fr(t.texte)}</p>
                      </figcaption>
                    </figure>
                  </li>
                ) : null,
              )}
            </ul>
          </div>
        </section>

        <section aria-labelledby="aussi" className="px-4 pt-16 sm:px-6 sm:pt-20">
          <div className={WRAP}>
            <SectionHeading id="aussi" title="Et aussi," accent="pour le reste." className="mb-8" />
            <ul className="grid gap-4 md:grid-cols-3">
              {AUSSI.map((f) => (
                <li key={f.titre} data-reveal="" data-reveal-item="" className="flex flex-col rounded-[20px] border border-q-line bg-q-surface p-6 shadow-[shadow:var(--q-shadow-card)]">
                  <span className="q-glyph mb-5 grid h-10 w-10 shrink-0 place-items-center text-q-accent-strong">
                    <f.icone className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                  </span>
                  <h3 className="font-display text-[19px] font-semibold leading-[1.25] tracking-[-0.02em] text-q-ink-strong">{fr(f.titre)}</h3>
                  {/* Texte entier : une carte-lien tronque à trois lignes, ce qui couperait la phrase en plein milieu */}
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
            <SectionHeading id="parcours" title="Du premier devis" accent="au dernier paiement." className="mb-8" />
            <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {ETAPES.map((e, n) => (
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
          <InlineCta className={WRAP} title="Essayez avec un vrai chantier :" accent="le devis est gratuit." />
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

        {/* Limites écrites : un assistant IA ou un artisan qui compare cherche aussi ce qu'un logiciel ne fait pas */}
        <section aria-labelledby="limites" className="px-4 pt-16 sm:px-6 sm:pt-20">
          <div className="mx-auto w-full max-w-[860px]">
            <SectionHeading id="limites" title="Ce que Qonforme" accent="ne fait pas." className="mb-6" />
            <div className="flex flex-col gap-4 text-[16px] leading-[1.7] text-q-text-3">
              <p>Qonforme ne remplace ni votre comptable ni un logiciel de paie : il prépare l&apos;export de vos écritures et s&apos;arrête là. Il ne gère pas non plus les stocks.</p>
              {essentiel.upcoming.length > 0 && (
                <p>
                  Pas encore disponibles, et donc pas vendues : {essentiel.upcoming.map((u) => lcFirst(u)).join(", ")}.
                </p>
              )}
            </div>
          </div>
        </section>

        <section aria-labelledby="faq" className="px-4 pt-16 sm:px-6 sm:pt-20">
          <div className="mx-auto w-full max-w-[860px]">
            <SectionHeading id="faq" title="Questions" accent="fréquentes." className="mb-6" />
            <FaqList items={FAQ.map((f) => ({ question: f.question, answer: f.reponse }))} />
            <h2 className="q-eyebrow mb-4 mt-12">Pour aller plus loin</h2>
            <ChipLinks
              links={[
                { href: "/pricing", label: "Tarifs et formules" },
                { href: "/guide/devis-obligatoire", label: "Devis obligatoire : les règles" },
                { href: "/guide/tva-travaux", label: "TVA des travaux : 20 %, 10 % ou 5,5 %" },
                { href: "/guide/facture-electronique-2026", label: "Facturation électronique 2026-2027" },
                { href: "/modele/devis-travaux", label: "Modèle de devis de travaux" },
                { href: "/devenir-a-son-compte", label: "S'installer à son compte" },
              ]}
            />
          </div>
        </section>

        <ContentCta
          title="Votre prochain devis,"
          accent="gratuit et sans carte bancaire."
          links={[
            { href: "/facturation", label: "Logiciel par métier" },
            { href: "/guide", label: "Guides pratiques" },
            { href: "/modele", label: "Modèles de devis" },
            { href: "/outils", label: "Outils gratuits" },
          ]}
        />
      </ContentPage>
    </>
  )
}
