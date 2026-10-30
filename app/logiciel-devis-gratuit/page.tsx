import type { Metadata } from "next"
import { CalendarDays, FileDown, ScanLine } from "lucide-react"
import { FREE_FEATURES, PLANS, TAX_SUFFIX, formatEuros, scanQuotaText } from "@/lib/stripe/plans"
import { METIERS } from "@/lib/pseo/metiers"
import { CatalogueBlock, DevisBlock, PlanningBlock } from "@/components/home/Features"
import { ProductPage, type ProductFaq } from "@/components/content/ProductPage"
import { lcFirst } from "@/components/content/text"

/*
 * Page « Logiciel de devis gratuit pour artisan » (30/10/2026).
 *
 * Question posée aux assistants IA (relevé OpenSEO du 30/10/2026, ChatGPT) : « Existe-t-il un
 * logiciel de devis gratuit et illimité pour artisan ? » : la réponse citait cinq outils, pas
 * Qonforme, dont l'offre gratuite répond exactement à la question.
 *
 * Page générale : les pages par métier (« Logiciel de devis gratuit pour plombier »…) gardent
 * leur requête ; celle-ci vise la question sans métier et renvoie vers elles.
 *
 * Honnêteté : « gratuit » ne vise que ce que FREE_FEATURES liste (devis illimités, envoi par
 * e-mail compris, aucune limite dans app/api/quotes) ; les factures s'envoient avec Essentiel.
 * Pas de signature en ligne annoncée (« à venir » dans lib/stripe/plans.ts).
 */

const PATH = "/logiciel-devis-gratuit"
const TITRE = "Logiciel de devis gratuit pour artisan"
const VERIFIE_LE = "2026-10-30"
const DESCRIPTION = "Logiciel de devis gratuit et illimité pour artisans du bâtiment : catalogue, TVA par ligne, mentions légales, envoi par e-mail. Sans carte bancaire."

const essentiel = PLANS.starter
const prix = (montant: number) => `${formatEuros(montant)}${TAX_SUFFIX}`

export const metadata: Metadata = {
  title: "Logiciel de devis gratuit et illimité pour artisan",
  description: DESCRIPTION,
  keywords: ["logiciel devis gratuit", "logiciel de devis gratuit artisan", "logiciel devis gratuit illimité", "logiciel devis bâtiment gratuit", "faire un devis gratuit"],
  alternates: { canonical: PATH },
  openGraph: {
    title: `${TITRE} | Qonforme`,
    description: "Devis gratuits et illimités pour les artisans du bâtiment, sans carte bancaire.",
    url: `https://qonforme.fr${PATH}`,
    images: [{ url: "/api/og?title=Logiciel%20de%20devis%20gratuit&subtitle=Illimit%C3%A9%2C%20pour%20les%20artisans%20du%20b%C3%A2timent", width: 1200, height: 630 }],
  },
}

const FAQ: ProductFaq[] = [
  {
    question: "Existe-t-il un logiciel de devis gratuit et illimité pour artisan ?",
    reponse: "Oui. Avec Qonforme, les devis sont gratuits et sans limite de nombre, sans carte bancaire et sans durée d'essai : vous créez vos clients et votre catalogue, composez vos devis avec la TVA par ligne et les envoyez par e-mail en PDF. Seul l'envoi des factures demande une formule payante.",
  },
  {
    question: "Qu'est-ce qui est gratuit, et qu'est-ce qui est payant ?",
    reponse: `Gratuit : ${FREE_FEATURES.map((f) => lcFirst(f)).join(", ")}. Payant, avec ${essentiel.name} à ${prix(essentiel.monthlyPrice)} par mois : ${essentiel.features.map((f) => lcFirst(f)).join(", ")}.`,
  },
  {
    question: "Faut-il une carte bancaire pour créer un compte ?",
    reponse: "Non. L'inscription demande une adresse e-mail et un mot de passe, ou un compte Google. La carte n'est demandée que si vous choisissez une formule pour envoyer vos factures.",
  },
  {
    question: "Le devis gratuit contient-il les mentions obligatoires ?",
    reponse: "Oui, à partir de votre profil : identité et statut de l'entreprise, numéro SIREN, assurance décennale ou responsabilité civile, mention de franchise de TVA pour un auto-entrepreneur, durée de validité. La TVA se choisit ligne par ligne : 20 %, 10 % ou 5,5 % selon les travaux.",
  },
  {
    question: "Que deviennent mes devis si je ne prends jamais de formule ?",
    reponse: "Ils restent à vous : consultables, modifiables tant qu'ils ne sont pas envoyés, téléchargeables en PDF. Un compte gratuit n'est jamais fermé faute d'abonnement.",
  },
  {
    question: "Un devis accepté peut-il devenir une facture ?",
    reponse: `Oui : il devient une facture en brouillon, sans rien ressaisir. La facture se prépare gratuitement ; son envoi demande ${essentiel.name}. Vous choisissez la formule au moment d'envoyer votre première facture.`,
  },
  {
    question: "Je veux juste faire un devis rapidement, sans compte : c'est possible ?",
    reponse: "Oui, avec notre générateur de devis en ligne : vous remplissez le formulaire et téléchargez le PDF, sans inscription. Rien n'est enregistré : pour retrouver vos devis et vos clients, créez un compte, gratuit lui aussi.",
  },
]

export default function Page() {
  return (
    <ProductPage
      path={PATH}
      titre={TITRE}
      accent="du bâtiment."
      sub={`Qonforme est un logiciel de devis gratuit et illimité pour les artisans du bâtiment : catalogue de prestations, TVA par ligne, mentions légales et envoi par e-mail, sans carte bancaire. Vous ne payez que si vous envoyez des factures, avec ${essentiel.name}.`}
      description={DESCRIPTION}
      verifieLe={VERIFIE_LE}
      photo="nouvelInstalle"
      essentiel={[
        ["Pour qui", `Les artisans du bâtiment, en ${METIERS.length} métiers : ${METIERS.map((m) => lcFirst(m.nom)).join(", ")}.`],
        ["Ce qui est gratuit", `${FREE_FEATURES.join(", ")}.`],
        ["Ce qui est payant", `L'envoi des factures, les relances et l'export comptable, avec ${essentiel.name} : ${prix(essentiel.monthlyPrice)} par mois, sans engagement.`],
        ["Où l'utiliser", "Dans le navigateur, sur ordinateur comme sur téléphone, sans rien installer."],
        ["Ce qu'il ne fait pas", "Pas de prix inventés : le catalogue vous propose les prestations de votre métier, c'est vous qui fixez vos tarifs."],
      ]}
      fonctions={{ title: "Ce que fait", accent: "le compte gratuit." }}
      blocks={
        <>
          <DevisBlock reverse={false} />
          <CatalogueBlock reverse />
          <PlanningBlock reverse={false} />
        </>
      }
      terrain={[
        { photo: "chezLeClient", titre: "Chez le client", texte: "Le devis se prépare à l'avance, puis se présente sur place, en PDF ou sur le téléphone." },
        { photo: "atelierTelephone", titre: "À l'atelier", texte: "Le catalogue et les clients s'ouvrent dans le navigateur du téléphone." },
        { photo: "finDeJournee", titre: "En fin de journée", texte: "Le devis part par e-mail en PDF ; vous le marquez accepté quand le client répond." },
      ]}
      aussi={[
        { icone: ScanLine, titre: "Scan de documents", texte: `Photographiez devis signés et bons de livraison avec le téléphone : ${scanQuotaText("free")} avec le compte gratuit.`, href: "/demo/documents", lien: "Voir dans la démo" },
        { icone: CalendarDays, titre: "Planning et notes", texte: "Visites, chantiers et livraisons, avec un rappel par e-mail ; notes et tâches par client.", href: "/demo/planning", lien: "Voir l'agenda" },
        { icone: FileDown, titre: "Sans compte", texte: "Un devis ponctuel ? Le générateur en ligne fait le PDF sans inscription ; les modèles Word, Excel et PDF sont gratuits.", href: "/outils/generateur-devis-gratuit", lien: "Le générateur de devis" },
      ]}
      etapes={{
        titre: "Votre premier devis,",
        accent: "en quatre étapes.",
        items: [
          { titre: "Votre SIREN", texte: "L'entreprise se remplit seule depuis le répertoire Sirene : nom, adresse, statut." },
          { titre: "Vos prestations", texte: "Importez celles de votre métier, puis fixez vos prix." },
          { titre: "Votre devis", texte: "Les lignes, la TVA par ligne, le total se calcule." },
          { titre: "L'envoi", texte: "Par e-mail, en PDF, gratuitement." },
        ],
      }}
      inlineCta={{ title: "Votre prochain devis,", accent: "gratuit et sans limite." }}
      limites={{
        title: "Ce que le compte gratuit",
        accent: "ne fait pas.",
        paragraphes: [
          `Il n'envoie pas de factures : elles se préparent en brouillon, et leur envoi, les relances et l'export comptable demandent ${essentiel.name}.`,
          "La signature en ligne des devis n'est pas encore disponible : le client signe le PDF, et vous marquez le devis accepté.",
        ],
      }}
      faq={FAQ}
      liens={[
        ...METIERS.slice(0, 6).map((m) => ({ href: `/facturation/${m.slug}`, label: `Logiciel de devis pour ${lcFirst(m.nom)}` })),
        { href: "/guide/comment-faire-un-devis", label: "Comment faire un devis" },
        { href: "/guide/mentions-obligatoires-devis", label: "Mentions obligatoires d'un devis" },
        { href: "/modele", label: "Modèle de devis gratuit" },
        { href: "/pricing", label: "Tarifs et formules" },
      ]}
      cta={{ title: "Votre premier devis,", accent: "gratuit et sans carte bancaire." }}
    />
  )
}
