import type { Metadata } from "next"
import Link from "next/link"
import {
  BellRing, CalendarDays, Check, FileSpreadsheet, FileText, Hammer, HardHat, Receipt, ScanLine, Users,
} from "lucide-react"
import { METIERS } from "@/lib/pseo/metiers"
import { FREE_FEATURES, PAYMENT_METHODS_TEXT, PLANS, TAX_SUFFIX, formatEuros, scanQuotaText } from "@/lib/stripe/plans"
import { ChipLinks, ContentCta, ContentHero, ContentPage, CtaButtons, FaqList, InlineCta, LinkCard, SectionHeading, WRAP } from "@/components/content/ui"
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

/** Ce que gère Qonforme aujourd'hui (une carte par fonction livrée). */
const FONCTIONS = [
  {
    icone: FileText,
    titre: "Devis détaillés",
    texte: "Lignes de main-d'œuvre, de matériaux et de déplacement, TVA à 20 %, 10 % ou 5,5 % par ligne, mentions du bâtiment (statut, assurance décennale) ajoutées à partir de votre profil. Gratuits et illimités.",
    href: "/guide/comment-faire-un-devis",
  },
  {
    icone: Receipt,
    titre: "Du devis à la facture",
    texte: `Avec ${essentiel.name}, un devis accepté devient une facture en un clic, sans ressaisie. Une facture émise ne se modifie pas : vous la corrigez par un avoir, numéroté à la suite.`,
    href: "/guide/premiere-facture",
  },
  {
    icone: Users,
    titre: "Clients et catalogue de votre métier",
    texte: "Fiches clients, particuliers ou entreprises, et catalogue de prestations : importez les prestations courantes de votre métier avec la TVA adaptée au chantier, puis complétez vos prix.",
    href: "/facturation",
  },
  {
    icone: BellRing,
    titre: "Relances et suivi des paiements",
    texte: `Avec ${essentiel.name}, des rappels avant l'échéance et des relances après, réglables, et un tableau de bord : chiffre du mois, encours, retards.`,
    href: "/guide/facture-impayee",
  },
  {
    icone: CalendarDays,
    titre: "Planning et notes",
    texte: "Rendez-vous de visite, de chantier ou de livraison, notes et rappels par client ou par chantier, avec rappel par e-mail. Ouverts à tous les comptes, gratuits compris.",
    href: "/demo",
  },
  {
    icone: ScanLine,
    titre: "Scan de documents",
    texte: `Photographiez vos devis signés, bons de commande et bons de livraison avec le téléphone : ils sont classés dans Documents (${scanQuotaText("free")} sans formule).`,
    href: "/demo",
  },
  {
    icone: Hammer,
    titre: "Chantiers, acomptes et situations",
    texte: artisanEnVente
      ? `Avec la formule ${artisan.name} : factures d'acompte, situations de travaux, retenue de garantie, autoliquidation en sous-traitance et suivi par chantier.`
      : `La formule ${artisan.name}, bientôt disponible, ajoute les factures d'acompte, les situations de travaux, la retenue de garantie, l'autoliquidation en sous-traitance et le suivi par chantier.`,
    href: "/guide/facture-acompte",
  },
  {
    icone: FileSpreadsheet,
    titre: "Export comptable",
    texte: `Avec ${essentiel.name}, l'export FEC (fichier des écritures comptables) de vos factures et de vos avoirs, pour votre expert-comptable.`,
    href: "/glossaire/fec",
  },
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

  const metiers = METIERS.map((m) => ({ href: `/facturation/${m.slug}`, label: `Logiciel pour ${lcFirst(m.nom)}` }))

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

        <section aria-labelledby="definition" className="px-4 pt-16 sm:px-6 sm:pt-20">
          <div className="mx-auto w-full max-w-[860px]">
            <SectionHeading id="definition" title="Qu'est-ce qu'un logiciel" accent="de gestion du bâtiment ?" className="mb-6" />
            <div className="flex flex-col gap-4 text-[16px] leading-[1.7] text-q-text-3">
              <p>
                Un logiciel de gestion pour le bâtiment rassemble, au même endroit, ce qu&apos;un artisan fait chaque semaine hors du chantier : chiffrer un devis, le faire accepter, facturer, suivre ce qui est payé, relancer ce qui ne l&apos;est pas, puis transmettre les pièces au comptable.
              </p>
              <p>
                Il se distingue d&apos;un simple logiciel de devis par le suivi : un devis accepté devient une facture sans ressaisie, les paiements attendus apparaissent dans un tableau de bord, et les retards déclenchent des relances.
              </p>
              <p>
                D&apos;autres logiciels couvrent aussi la paie, les achats ou la planification d&apos;équipes. Qonforme se concentre sur le cycle devis, facture, paiement.
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="fonctions" className="px-4 pt-16 sm:px-6 sm:pt-20">
          <div className={WRAP}>
            <SectionHeading id="fonctions" title="Ce que Qonforme gère" accent="aujourd'hui." sub="Seulement ce qui existe dans l'application : rien d'annoncé qui ne soit pas livré." className="mb-8" />
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FONCTIONS.map((f) => (
                <li key={f.titre} className="flex">
                  <LinkCard
                    as="h3"
                    href={f.href}
                    title={f.titre}
                    text={f.texte}
                    icon={<f.icone className="h-5 w-5" strokeWidth={1.75} aria-hidden />}
                    className="w-full"
                  />
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
            <SectionHeading id="metiers" title="Pour quel" accent="métier ?" sub="Chaque métier a son catalogue de prestations et ses règles de TVA : choisissez le vôtre." className="mb-6" />
            <ChipLinks links={metiers} />
          </div>
        </section>

        <section aria-labelledby="tarifs" className="px-4 pt-16 sm:px-6 sm:pt-20">
          <div className={WRAP}>
            <SectionHeading id="tarifs" title="Combien" accent="ça coûte ?" sub={`Les devis ne coûtent rien. Vous choisissez une formule quand vous envoyez votre première facture. Paiement par ${PAYMENT_METHODS_TEXT}.`} className="mb-8" />
            <div className="grid gap-4 lg:grid-cols-3">
              {[
                { nom: "Devis", prix: "0 €", periode: "sans carte bancaire", liste: FREE_FEATURES, note: undefined },
                { nom: essentiel.name, prix: prix(essentiel.monthlyPrice), periode: `par mois, ou ${prix(essentiel.yearlyPrice)} par an`, liste: essentiel.features, note: undefined },
                {
                  nom: artisan.name,
                  prix: artisanEnVente ? prix(artisan.monthlyPrice) : "Bientôt",
                  periode: artisanEnVente ? `par mois, ou ${prix(artisan.yearlyPrice)} par an` : "pas encore en vente",
                  liste: artisan.features,
                  note: `Tout ${essentiel.name}, plus :`,
                },
              ].map((p) => (
                <article key={p.nom} data-reveal="" data-reveal-item="" className="flex flex-col rounded-[20px] border border-q-line bg-q-surface p-6 shadow-[shadow:var(--q-shadow-card)]">
                  <h3 className="font-display text-[20px] font-semibold tracking-[-0.02em] text-q-ink-strong">{p.nom}</h3>
                  <p className="mt-3 font-display text-[34px] font-semibold leading-none tracking-[-0.03em] text-q-ink-strong tabular-nums">{fr(p.prix)}</p>
                  <p className="mt-1 text-[14px] text-q-text-4">{fr(p.periode)}</p>
                  {p.note && <p className="mt-5 text-[14px] font-semibold text-q-ink-strong">{p.note}</p>}
                  <ul className={`${p.note ? "mt-2" : "mt-5"} flex flex-col gap-2.5 text-[14.5px] leading-[1.5] text-q-text-3`}>
                    {p.liste.map((f) => (
                      <li key={f} className="flex gap-2.5">
                        <Check className="mt-[3px] h-4 w-4 shrink-0 text-q-accent-strong" strokeWidth={2} aria-hidden />
                        <span>{fr(f)}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
            <p className="mt-6 text-[14px] text-q-text-4">
              Tous les détails sont sur la page{" "}
              <Link href="/pricing" className="font-semibold text-q-accent-strong hover:underline">
                Tarifs
              </Link>
              .
            </p>
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
