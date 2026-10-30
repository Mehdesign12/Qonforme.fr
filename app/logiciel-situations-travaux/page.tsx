import type { Metadata } from "next"
import { HardHat, Percent, ShieldCheck } from "lucide-react"
import { PLANS, TAX_SUFFIX, formatEuros } from "@/lib/stripe/plans"
import { DevisBlock, FacturationBlock, PilotageBlock } from "@/components/home/Features"
import { ProductPage, type ProductFaq } from "@/components/content/ProductPage"

/*
 * Page « Logiciel de situations de travaux et factures d'acompte » (30/10/2026).
 *
 * Question posée aux assistants IA (relevé OpenSEO du 30/10/2026, ChatGPT) : « Quel outil
 * permet de gérer les acomptes et situations de travaux ? » : aucune marque dominante.
 *
 * Honnêteté : ces fonctions sont celles de la formule Artisan (lib/artisan/). Elles ne sont
 * dites disponibles que si la formule est en vente (PLANS.pro.available, lu au build) ;
 * sinon « bientôt disponible ». Aucun écran de chantier n'a encore de capture : les blocs
 * montrent le devis, la facture et le tableau de bord, et la démo des chantiers est liée.
 */

const PATH = "/logiciel-situations-travaux"
const TITRE = "Logiciel de situations de travaux et d'acomptes"
const VERIFIE_LE = "2026-10-30"
const DESCRIPTION = "Factures d'acompte, situations de travaux, retenue de garantie et facture de solde pour les artisans du bâtiment, rattachées à chaque chantier."

const artisan = PLANS.pro
const enVente = artisan.available
const prix = (montant: number) => `${formatEuros(montant)}${TAX_SUFFIX}`
/** « Avec la formule Artisan » ou « Avec la formule Artisan, bientôt disponible ». */
const avec = enVente ? `avec la formule ${artisan.name}` : `avec la formule ${artisan.name}, bientôt disponible`

export const metadata: Metadata = {
  title: "Logiciel de situations de travaux et factures d'acompte",
  description: DESCRIPTION,
  keywords: ["logiciel situation de travaux", "facture de situation", "logiciel facture acompte bâtiment", "retenue de garantie facture", "situation de travaux BTP"],
  alternates: { canonical: PATH },
  openGraph: {
    title: `${TITRE} | Qonforme`,
    description: "Acomptes, situations de travaux, retenue de garantie et facture de solde, chantier par chantier.",
    url: `https://qonforme.fr${PATH}`,
    images: [{ url: "/api/og?title=Situations%20de%20travaux%20et%20acomptes&subtitle=Pour%20les%20artisans%20du%20b%C3%A2timent", width: 1200, height: 630 }],
  },
}

const FAQ: ProductFaq[] = [
  {
    question: "Qu'est-ce qu'une situation de travaux ?",
    reponse: "C'est une facture intermédiaire émise au fil d'un chantier, selon son avancement : elle facture le pourcentage réalisé depuis la situation précédente. Les situations sont cumulées : chacune rappelle le total déjà facturé, et la dernière, le décompte final, solde le marché.",
  },
  {
    question: "Quel outil permet de gérer les acomptes et les situations de travaux ?",
    reponse: `Qonforme, ${avec} : facture d'acompte à la commande, situations cumulées globales ou ligne par ligne, acomptes déduits au prorata, retenue de garantie suivie et facture de solde, rattachées au chantier et au devis signé.`,
  },
  {
    question: "Comment déduire un acompte d'une situation de travaux ?",
    reponse: "L'acompte déjà facturé se reprend au fil des situations, en proportion de l'avancement, par une ligne négative ; le décompte final reprend ce qui reste. Ainsi, le total facturé ne dépasse jamais le marché et la TVA de l'acompte n'est pas comptée deux fois.",
  },
  {
    question: "Quand la TVA d'un acompte est-elle due pour des travaux ?",
    reponse: "Pour des travaux immobiliers, qui sont des prestations de services, la TVA est exigible à l'encaissement (code général des impôts, article 269-2) : la facture d'acompte porte la TVA de la somme demandée.",
  },
  {
    question: "Comment fonctionne la retenue de garantie ?",
    reponse: "Le client peut retenir au plus 5 % du montant des travaux pour garantir la levée des réserves (loi n° 71-584 du 16 juillet 1971), sauf si l'entreprise fournit une caution bancaire. La somme est libérée un an après la réception, sauf opposition motivée. Elle apparaît à part sur la facture, « à régler à l'échéance », et n'est pas comptée comme un retard.",
  },
  {
    question: "Le logiciel gère-t-il l'autoliquidation en sous-traitance ?",
    reponse: `Oui, ${avec} : la facture d'un sous-traitant du bâtiment est émise hors taxe avec la mention « Autoliquidation » (code général des impôts, article 283-2 nonies), et c'est l'entreprise principale qui déclare la TVA.`,
  },
  {
    question: "Combien coûte la formule qui gère les situations de travaux ?",
    reponse: enVente
      ? `La formule ${artisan.name} coûte ${prix(artisan.monthlyPrice)} par mois ou ${prix(artisan.yearlyPrice)} par an, sans engagement. Elle comprend tout ${PLANS.starter.name} : envoi des factures, relances et export comptable.`
      : `La formule ${artisan.name} est bientôt disponible, à ${prix(artisan.monthlyPrice)} par mois ou ${prix(artisan.yearlyPrice)} par an. En attendant, les devis sont gratuits et ${PLANS.starter.name} permet d'envoyer vos factures.`,
  },
]

export default function Page() {
  return (
    <ProductPage
      path={PATH}
      titre={TITRE}
      accent="pour le bâtiment."
      sub={`Qonforme facture un chantier en plusieurs fois : un acompte à la commande, des situations de travaux au fil de l'avancement, la retenue de garantie à part et la facture de solde à la fin, sans jamais dépasser le devis signé. ${avec.charAt(0).toUpperCase()}${avec.slice(1)}.`}
      description={DESCRIPTION}
      verifieLe={VERIFIE_LE}
      photo="cheffeDeChantier"
      essentiel={[
        ["Pour qui", "Les artisans et petites entreprises du bâtiment dont les chantiers durent plusieurs semaines, pour des particuliers comme pour des professionnels."],
        ["Ce qu'il fait", "Factures d'acompte, situations de travaux cumulées (globales ou par ligne), acomptes repris au prorata, retenue de garantie, facture de solde, autoliquidation en sous-traitance, suivi par chantier."],
        ["Ce qu'il coûte", enVente ? `Avec ${artisan.name} : ${prix(artisan.monthlyPrice)} par mois, ou ${prix(artisan.yearlyPrice)} par an. Sans engagement.` : `Formule ${artisan.name}, bientôt disponible : ${prix(artisan.monthlyPrice)} par mois. Les devis restent gratuits.`],
        ["Par chantier", "Signé, facturé, encaissé, reste à facturer et retenues : sur une seule page, avec les documents rattachés."],
        ["Ce qu'il ne fait pas", "Ni suivi des heures, ni achats de matériaux, ni calcul de marge : il facture le chantier, il ne le pilote pas."],
      ]}
      fonctions={{ title: "Du devis signé", accent: "à la facture de solde." }}
      blocks={
        <>
          <DevisBlock reverse={false} />
          <FacturationBlock reverse />
          <PilotageBlock reverse={false} />
        </>
      }
      terrain={[
        { photo: "chezLeClient", titre: "À la signature", texte: "Le devis signé fixe le marché : chaque situation s'y rapporte, rien ne le dépasse." },
        { photo: "cheffeDeChantier", titre: "En cours de chantier", texte: "L'avancement se saisit globalement ou ligne par ligne ; la situation se calcule." },
        { photo: "finDeJournee", titre: "À la réception", texte: "Le décompte final solde le marché ; la retenue de garantie attend son échéance." },
      ]}
      aussi={[
        { icone: HardHat, titre: "Page du chantier", texte: "Montant signé, facturé, encaissé hors retenue, reste à facturer : tout le chantier au même endroit.", href: "/demo/chantiers", lien: "Voir un chantier dans la démo" },
        { icone: ShieldCheck, titre: "Retenue de garantie", texte: "Suivie jusqu'à sa libération, un an après la réception, avec la lettre de demande de libération prête.", href: "/glossaire/retenue-garantie", lien: "La retenue de garantie" },
        { icone: Percent, titre: "Autoliquidation", texte: "Pour les sous-traitants : facture hors taxe et mention légale, quand l'entreprise principale déclare la TVA.", href: "/guide/tva-autoliquidation-sous-traitance", lien: "L'autoliquidation en sous-traitance" },
      ]}
      etapes={{
        titre: "Un chantier,",
        accent: "en cinq temps.",
        items: [
          { titre: "Le devis signé", texte: "Il fixe le montant du marché et devient le chantier." },
          { titre: "L'acompte", texte: "Une facture d'acompte à la commande, TVA comprise." },
          { titre: "Les situations", texte: "Au fil de l'avancement, cumulées, avec l'acompte déduit au prorata." },
          { titre: "Le solde", texte: "Le décompte final reprend tout ce qui a été facturé et solde le marché." },
          { titre: "La garantie", texte: "La retenue de garantie, à part, se libère un an après la réception." },
        ],
      }}
      inlineCta={{ title: "Commencez par le devis :", accent: "il est gratuit." }}
      limites={{
        title: "Ce que Qonforme",
        accent: "ne fait pas.",
        paragraphes: [
          "Qonforme facture vos chantiers ; il ne les pilote pas. Pas de suivi des heures, pas d'achats de matériaux, pas de calcul de marge ni de planning d'équipe.",
          "Le pourcentage d'avancement est celui que vous saisissez : aucun relevé de chantier n'est fait à votre place.",
          ...(enVente ? [] : [`Ces fonctions appartiennent à la formule ${artisan.name}, qui n'est pas encore en vente.`]),
        ],
      }}
      faq={FAQ}
      liens={[
        { href: "/modele/facture-situation", label: "Modèle de facture de situation" },
        { href: "/modele/facture-acompte", label: "Modèle de facture d'acompte" },
        { href: "/guide/facture-acompte", label: "La facture d'acompte" },
        { href: "/guide/tva-travaux", label: "TVA des travaux : 20 %, 10 % ou 5,5 %" },
        { href: "/pricing", label: "Tarifs et formules" },
      ]}
      sources={[
        { label: "Loi n° 71-584 du 16 juillet 1971 tendant à réglementer les retenues de garantie en matière de marchés de travaux" },
        { label: "Code général des impôts, article 269-2 (exigibilité de la TVA des prestations de services)" },
        { label: "Code général des impôts, article 283-2 nonies (autoliquidation dans le bâtiment)" },
      ]}
      cta={{ title: "Facturez vos chantiers", accent: "au rythme des travaux." }}
    />
  )
}
