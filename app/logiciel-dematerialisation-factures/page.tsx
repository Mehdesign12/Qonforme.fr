import type { Metadata } from "next"
import { FileSearch, FileSpreadsheet, UserCheck } from "lucide-react"
import { PLANS, TAX_SUFFIX, formatEuros, scanQuotaText } from "@/lib/stripe/plans"
import { PLATFORM_SENDING_LIVE, SENDING_SENTENCE } from "@/lib/pa/sending"
import { FacturationBlock, ReceptionBlock, ScanBlock } from "@/components/home/Features"
import { ProductPage, type ProductFaq } from "@/components/content/ProductPage"
import { SectionHeading, WRAP } from "@/components/content/ui"
import { fr } from "@/components/content/text"
import { SOLUTION_COMPATIBLE, SolutionCompatible } from "@/components/brand/SolutionCompatible"

/*
 * Page « Logiciel de dématérialisation des factures » (07/11/2026).
 *
 * Mots-clés (OpenSEO, 07/11/2026) : « dématérialisation des factures » (1 300 recherches par
 * mois, difficulté 0), « dématérialisation factures fournisseurs » (320, 14 € le clic),
 * « solution compatible facturation électronique » (210, difficulté 0, section dédiée).
 *
 * Honnêteté : réception et envoi par la plateforme avec Essentiel (envoi suivant
 * PLATFORM_SENDING_LIVE), scan ouvert à tous les comptes (quotas de plans.ts), label
 * « Solution compatible » par le seul composant de la charte DGFiP. Faits de la réforme
 * vérifiés sur service-public.gouv.fr (F39785, F31808) et impots.gouv.fr le 07/11/2026.
 */

const PATH = "/logiciel-dematerialisation-factures"
const TITRE = "Logiciel de dématérialisation des factures"
const VERIFIE_LE = "2026-11-07"
const DESCRIPTION = "Dématérialisation des factures pour artisans du bâtiment : factures fournisseurs reçues par plateforme agréée, factures Factur-X, papier scanné et classé."

const essentiel = PLANS.starter
const prix = (montant: number) => `${formatEuros(montant)}${TAX_SUFFIX}`

export const metadata: Metadata = {
  title: "Dématérialisation des factures : logiciel pour artisans",
  description: DESCRIPTION,
  keywords: ["dématérialisation des factures", "dématérialisation factures fournisseurs", "logiciel dématérialisation factures", "solution compatible facturation électronique", "facture dématérialisée"],
  alternates: { canonical: PATH },
  openGraph: {
    title: `${TITRE} | Qonforme`,
    description: "Factures fournisseurs reçues par plateforme agréée, factures Factur-X et papier scanné, pour les artisans du bâtiment.",
    url: `https://qonforme.fr${PATH}`,
    images: [{ url: "/api/og?title=D%C3%A9mat%C3%A9rialisation%20des%20factures&subtitle=Pour%20les%20artisans%20du%20b%C3%A2timent", width: 1200, height: 630 }],
  },
}

const FAQ: ProductFaq[] = [
  {
    question: "Qu'est-ce que la dématérialisation des factures ?",
    reponse: "C'est passer du papier au fichier : recevoir, envoyer et conserver ses factures sous forme numérique. Avec la réforme, elle va plus loin : entre entreprises, la facture devient une facture électronique, un fichier dont les données (lignes, TVA, totaux) se lisent sans ressaisie, transmis par une plateforme agréée.",
  },
  {
    question: "La dématérialisation des factures est-elle obligatoire ?",
    reponse: "Oui, entre entreprises assujetties à la TVA établies en France. Depuis le 1er septembre 2026, toutes doivent pouvoir recevoir des factures électroniques. Les grandes entreprises et les ETI les émettent depuis cette date ; les PME, les TPE et les micro-entreprises, à partir du 1er septembre 2027. Les auto-entrepreneurs en franchise de TVA sont concernés.",
  },
  {
    question: "Facture dématérialisée ou facture électronique : quelle différence ?",
    reponse: "Une facture PDF envoyée par email est dématérialisée, mais ce n'est pas une facture électronique au sens de la réforme. La facture électronique porte ses données dans un format structuré (Factur-X, UBL ou CII) et passe par une plateforme agréée. Notre lecteur Factur-X gratuit vous dit en une seconde de quel type est une facture.",
  },
  {
    question: "Qonforme est-il une solution compatible facturation électronique ?",
    reponse: "Oui : Qonforme porte le label « Solution compatible – Facturation électronique » et il est raccordé à la plateforme agréée Super PDP, qui transmet les factures. Vous gardez un seul logiciel pour vos devis, vos factures et vos factures fournisseurs.",
  },
  {
    question: "Plus besoin d'OCR pour lire les factures fournisseurs ?",
    reponse: "Oui, pour les factures électroniques : leurs données sont dans le fichier, elles arrivent déjà lues, sans reconnaissance de texte ni ressaisie. Lignes, TVA et totaux sont contrôlés à l'arrivée dans Qonforme.",
  },
  {
    question: "Que faire de mes factures et bons de livraison papier ?",
    reponse: `Photographiez-les avec votre téléphone : Qonforme en fait un PDF propre, que vous classez par type, fournisseur, client et chantier. Le scan est inclus dans tous les comptes, avec ${scanQuotaText("free")} pour le compte gratuit.`,
  },
  {
    question: "Combien coûte la dématérialisation des factures avec Qonforme ?",
    reponse: `La réception des factures fournisseurs par la plateforme agréée et l'envoi de vos factures sont inclus dans la formule ${essentiel.name} : ${prix(essentiel.monthlyPrice)} par mois ou ${prix(essentiel.yearlyPrice)} par an, sans engagement, sans frais en plus par facture. Les devis et le scan des documents sont gratuits.`,
  },
]

export default function Page() {
  return (
    <ProductPage
      path={PATH}
      titre={TITRE}
      accent="pour artisans."
      sub={`Qonforme dématérialise vos factures de bout en bout : vos factures fournisseurs arrivent par la plateforme agréée Super PDP, déjà lues, vos factures partent au format Factur-X, et le papier se photographie et se range. Avec la formule ${essentiel.name}.`}
      description={DESCRIPTION}
      verifieLe={VERIFIE_LE}
      photo="entrepriseGrandit"
      essentiel={[
        ["Pour qui", "Les artisans du bâtiment, auto-entrepreneurs compris, qui reçoivent des factures de leurs fournisseurs et facturent des particuliers comme des entreprises."],
        ["Ce qu'il fait", `Il reçoit vos factures fournisseurs par la plateforme agréée Super PDP, les lit et les contrôle, transmet vos décisions, produit vos factures au format Factur-X${PLATFORM_SENDING_LIVE ? " et les envoie par la plateforme à vos clients professionnels" : ""}, et range le papier scanné.`],
        ["Ce qu'il coûte", `Avec ${essentiel.name} : ${prix(essentiel.monthlyPrice)} par mois, ou ${prix(essentiel.yearlyPrice)} par an. Sans engagement. Devis et scan gratuits.`],
        ["Où l'utiliser", "Dans le navigateur, sur ordinateur comme sur téléphone, sans rien installer."],
        ["Pourquoi l'adopter", "Vous êtes prêt pour la réforme sans changer d'outil : un seul logiciel pour vos devis, vos factures et vos factures fournisseurs, sans ressaisie."],
      ]}
      fonctions={{ title: "Des factures qui arrivent,", accent: "partent et se rangent seules." }}
      blocks={
        <>
          <ReceptionBlock reverse={false} />
          <FacturationBlock reverse />
          <ScanBlock reverse={false} />
        </>
      }
      terrain={[
        { photo: "chezLeClient", titre: "Chez le client", texte: "La facture part du téléphone, au format Factur-X, dès la fin du chantier." },
        { photo: "atelierTelephone", titre: "À l'atelier", texte: "Le bon de livraison se photographie et se range avec son chantier." },
        { photo: "finDeJournee", titre: "En fin de journée", texte: "Les factures des fournisseurs sont déjà là, lues et contrôlées, à approuver." },
      ]}
      aussi={[
        { icone: FileSearch, titre: "Lecteur Factur-X gratuit", texte: "Déposez une facture électronique : vendeur, lignes, TVA et totaux s'affichent en clair, sans que le fichier quitte votre appareil.", href: "/outils/lecteur-factur-x", lien: "Ouvrir le lecteur" },
        { icone: FileSpreadsheet, titre: "Export FEC", texte: "Vos ventes et vos avoirs en fichier des écritures comptables, prêt pour votre comptable.", href: "/logiciel-export-fec", lien: "L'export FEC" },
        { icone: UserCheck, titre: "Accès comptable", texte: "Votre comptable consulte vos factures émises et reçues en lecture seule, et télécharge ses exports.", href: "/demo/comptable", lien: "Voir dans la démo" },
      ]}
      etapes={{
        titre: "Dématérialisé",
        accent: "en quatre étapes.",
        items: [
          { titre: "Raccorder", texte: "Vous rattachez votre compte à la plateforme agréée Super PDP depuis Qonforme ; elle vérifie votre entreprise." },
          { titre: "Recevoir", texte: "Vos factures fournisseurs arrivent dans « Factures reçues », lues et contrôlées." },
          { titre: "Envoyer", texte: PLATFORM_SENDING_LIVE ? "Vos factures partent au format Factur-X, par la plateforme vers vos clients professionnels, par email vers les autres." : "Vos factures partent par email, au format Factur-X." },
          { titre: "Ranger", texte: "Le papier se photographie et se classe par fournisseur et par chantier." },
        ],
      }}
      inlineCta={{ title: "Vos factures,", accent: "sans papier ni ressaisie." }}
      faq={FAQ}
      liens={[
        { href: "/outils/lecteur-factur-x", label: "Lecteur Factur-X gratuit" },
        { href: "/guide/facturation-electronique-auto-entrepreneur", label: "Facturation électronique de l'auto-entrepreneur" },
        { href: "/guide/facture-electronique-2026", label: "Calendrier de la facture électronique" },
        { href: "/guide/plateforme-agreee", label: "Choisir sa plateforme agréée" },
        { href: "/guide/conservation-factures", label: "Conservation des factures" },
        { href: "/pricing", label: "Tarifs et formules" },
      ]}
      sources={[
        { label: "Service-public.gouv.fr, « Comment se mettre en conformité avec l'obligation de facturation électronique » (fiche F39785)", href: "https://entreprendre.service-public.gouv.fr/vosdroits/F39785" },
        { label: "Service-public.gouv.fr, « Mentions obligatoires sur une facture » (fiche F31808)", href: "https://entreprendre.service-public.gouv.fr/vosdroits/F31808" },
        { label: "impots.gouv.fr, « Je passe à la facturation électronique »", href: "https://www.impots.gouv.fr/professionnel/je-passe-la-facturation-electronique" },
        { label: "DGFiP, « Présentation de la marque Plateforme agréée et du label Solution compatible » (septembre 2025)", href: "https://www.impots.gouv.fr/presentation-des-logos-plateforme-agreee-et-solution-compatible" },
      ]}
      cta={{ title: "Prêt pour la réforme,", accent: "dès aujourd'hui." }}
    >
      {SOLUTION_COMPATIBLE && (
        <section aria-labelledby="solution-compatible" className="px-4 pt-16 sm:px-6 sm:pt-20">
          <div className={WRAP}>
            <SectionHeading
              id="solution-compatible"
              title="Solution compatible"
              accent="facturation électronique."
              sub="Le label de l'État pour les logiciels raccordés à une plateforme agréée."
              className="mb-8"
            />
            <div data-reveal="" className="flex flex-col items-start gap-6 rounded-[20px] border border-q-line bg-q-surface p-6 shadow-[shadow:var(--q-shadow-card)] sm:flex-row sm:items-center sm:p-8">
              <SolutionCompatible />
              <div className="min-w-0 text-[15px] leading-[1.65] text-q-text-3">
                <p>
                  {fr("Qonforme porte le label « Solution compatible – Facturation électronique » de la DGFiP. Une solution compatible produit des factures au bon format et se raccorde à une plateforme agréée, qui seule les transmet : pour Qonforme, c'est Super PDP.")}
                </p>
                <p className="mt-3">{fr(SENDING_SENTENCE)}</p>
              </div>
            </div>
          </div>
        </section>
      )}
    </ProductPage>
  )
}
