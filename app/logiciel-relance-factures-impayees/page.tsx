import type { Metadata } from "next"
import { Banknote, FileText, LayoutDashboard } from "lucide-react"
import { PLANS, TAX_SUFFIX, formatEuros } from "@/lib/stripe/plans"
import { AFTER_DUE_CHOICES, BEFORE_DUE_CHOICES } from "@/lib/reminders/settings"
import { INDEMNITE_FORFAITAIRE, SEMESTRE_REFERENCE, TAUX_PENALITES_DEFAUT } from "@/lib/outils/penalites"
import { FacturationBlock, PilotageBlock, RelancesBlock } from "@/components/home/Features"
import { ProductPage, type ProductFaq } from "@/components/content/ProductPage"

/*
 * Page « Logiciel de relance des factures impayées » (30/10/2026).
 *
 * Question posée aux assistants IA (relevé OpenSEO du 30/10/2026, ChatGPT) : « Comment
 * suivre les factures impayées d'un artisan du bâtiment ? » : aucun logiciel n'y était
 * cité, seulement service-public.gouv.fr. La page répond à la méthode (sources officielles)
 * et décrit ce que Qonforme fait vraiment : rappels avant échéance, relances après
 * échéance, lien de paiement par virement, retards au tableau de bord.
 *
 * Honnêteté : relances et envoi avec Essentiel (le cron saute les comptes sans formule) ;
 * Qonforme n'encaisse rien (virement sur l'IBAN de l'artisan) et ne fait pas de recouvrement.
 * Taux et indemnité lus dans lib/outils/penalites.ts, jamais écrits ici.
 */

const PATH = "/logiciel-relance-factures-impayees"
const TITRE = "Logiciel de relance des factures impayées"
const VERIFIE_LE = "2026-10-30"
const DESCRIPTION = "Suivre et relancer les factures impayées d'un artisan du bâtiment : rappels avant échéance, relances automatiques, retards au tableau de bord."

const essentiel = PLANS.starter
const prix = (montant: number) => `${formatEuros(montant)}${TAX_SUFFIX}`
const pct = (n: number) => `${n.toLocaleString("fr-FR")} %`
const jours = (l: readonly number[]) => l.map((j) => `J+${j}`).join(", ")

export const metadata: Metadata = {
  title: "Logiciel de relance de factures impayées pour artisans",
  description: DESCRIPTION,
  keywords: ["logiciel relance facture impayée", "relance facture impayée artisan", "suivi factures impayées", "relance automatique facture", "factures impayées bâtiment"],
  alternates: { canonical: PATH },
  openGraph: {
    title: `${TITRE} | Qonforme`,
    description: "Rappels avant échéance, relances automatiques et suivi des retards pour les artisans du bâtiment.",
    url: `https://qonforme.fr${PATH}`,
    images: [{ url: "/api/og?title=Relance%20des%20factures%20impay%C3%A9es&subtitle=Pour%20les%20artisans%20du%20b%C3%A2timent", width: 1200, height: 630 }],
  },
}

const FAQ: ProductFaq[] = [
  {
    question: "Comment suivre les factures impayées d'un artisan du bâtiment ?",
    reponse: "Tenez une liste de chaque facture émise avec son client, son montant, sa date d'échéance, ce qui a été payé et la dernière relance. Relancez dès l'échéance passée, d'abord à l'amiable, puis par une mise en demeure écrite. Un logiciel de facturation tient cette liste pour vous : chaque facture envoyée a une échéance, son retard se calcule seul et les relances partent selon vos réglages.",
  },
  {
    question: "Quand relancer une facture impayée ?",
    reponse: `Un rappel juste avant l'échéance évite beaucoup d'oublis. Après l'échéance, une première relance à une semaine, puis des relances espacées, puis une mise en demeure écrite si rien ne bouge. Dans Qonforme, le rappel part ${BEFORE_DUE_CHOICES.join(", ")} jours avant l'échéance au choix, et les relances à ${jours(AFTER_DUE_CHOICES)} selon vos réglages.`,
  },
  {
    question: "Quelles pénalités appliquer à un client professionnel qui paie en retard ?",
    reponse: `Entre professionnels, des pénalités de retard sont dues de plein droit (Code de commerce, article L441-10) : à défaut de taux prévu, le taux de refinancement de la BCE majoré de 10 points, soit ${pct(TAUX_PENALITES_DEFAUT)} au ${SEMESTRE_REFERENCE.libelle}. S'y ajoute une indemnité forfaitaire de ${INDEMNITE_FORFAITAIRE} € pour frais de recouvrement (article D441-5). Ces mentions doivent figurer sur la facture.`,
  },
  {
    question: "Et si le client est un particulier ?",
    reponse: "Un particulier ne doit ni les pénalités du Code de commerce ni l'indemnité de 40 €. Après une mise en demeure, il doit des intérêts au taux légal (Code civil, article 1231-6). Nos modèles de relance distinguent les deux cas.",
  },
  {
    question: "Que faire si le client ne paie toujours pas ?",
    reponse: "Après les relances amiables, envoyez une mise en demeure par lettre recommandée avec accusé de réception. Si elle reste sans effet, vous pouvez demander une injonction de payer au tribunal, ou, pour une petite créance, passer par la procédure simplifiée de recouvrement auprès d'un commissaire de justice. Gardez la trace de chaque relance.",
  },
  {
    question: "Les relances automatiques sont-elles gratuites dans Qonforme ?",
    reponse: `Non. L'envoi des factures et les relances demandent la formule ${essentiel.name}, à ${prix(essentiel.monthlyPrice)} par mois ou ${prix(essentiel.yearlyPrice)} par an, sans engagement. Les devis, eux, sont gratuits et illimités.`,
  },
  {
    question: "Qonforme encaisse-t-il les paiements de mes clients ?",
    reponse: "Non. Vos clients vous paient par virement, directement sur votre compte. Chaque facture envoyée peut porter un lien vers une page avec votre IBAN, le montant, la référence et un QR code de virement ; le client peut y signaler qu'il a payé, et vous marquez la facture payée avec la date du paiement.",
  },
]

export default function Page() {
  return (
    <ProductPage
      path={PATH}
      titre={TITRE}
      accent="pour artisans."
      sub={`Qonforme suit chaque facture que vous envoyez : un rappel avant l'échéance, des relances automatiques après, et les retards visibles au tableau de bord. Les relances s'arrêtent dès que la facture est marquée payée. Avec la formule ${essentiel.name}.`}
      description={DESCRIPTION}
      verifieLe={VERIFIE_LE}
      photo="finDeJournee"
      photoPosition="object-center"
      essentiel={[
        ["Pour qui", "Les artisans du bâtiment qui facturent des particuliers comme des professionnels et veulent être payés à l'échéance."],
        ["Ce qu'il fait", `Un rappel ${BEFORE_DUE_CHOICES.join(", ")} jours avant l'échéance au choix, des relances par e-mail à ${jours(AFTER_DUE_CHOICES)}, un bouton Relancer, la liste des relances à venir et le montant en retard au tableau de bord.`],
        ["Ce qu'il coûte", `Avec ${essentiel.name} : ${prix(essentiel.monthlyPrice)} par mois, ou ${prix(essentiel.yearlyPrice)} par an. Sans engagement. Les devis restent gratuits.`],
        ["Comment le client paie", "Par virement sur votre compte, avec une page qui donne votre IBAN, le montant, la référence et un QR code."],
        ["Ce qu'il ne fait pas", "Ni encaissement, ni recouvrement judiciaire, ni mise en demeure envoyée à votre place : il relance à l'amiable et vous dit qui est en retard."],
      ]}
      fonctions={{ title: "Ce qui se passe", accent: "après l'envoi." }}
      blocks={
        <>
          <RelancesBlock reverse={false} />
          <PilotageBlock reverse />
          <FacturationBlock reverse={false} />
        </>
      }
      terrain={[
        { photo: "chezLeClient", titre: "Chez le client", texte: "Les conditions de paiement sont sur le devis : le client les connaît avant de signer." },
        { photo: "atelierTelephone", titre: "À l'atelier", texte: "La liste des factures en retard s'ouvre sur le téléphone, avec un bouton Relancer." },
        { photo: "finDeJournee", titre: "En fin de journée", texte: "Les relances sont parties seules ; vous marquez payées celles qui sont réglées." },
      ]}
      aussi={[
        { icone: Banknote, titre: "Lien de paiement par virement", texte: "Une page avec votre IBAN, le montant, la référence et un QR code ; le client y signale son virement, vous êtes prévenu.", href: "/demo/invoices", lien: "Voir dans la démo" },
        { icone: FileText, titre: "Modèles de relance à copier", texte: "Trois e-mails et une lettre de mise en demeure, pour un client professionnel ou particulier, gratuits.", href: "/modele/lettre-relance-impaye", lien: "Le modèle de relance" },
        { icone: LayoutDashboard, titre: "Encaissé et en retard", texte: "Le tableau de bord distingue ce qui est facturé, encaissé, à encaisser et en retard, retenue de garantie à part.", href: "/demo", lien: "Ouvrir la démo" },
      ]}
      etapes={{
        titre: "De l'échéance",
        accent: "au paiement.",
        items: [
          { titre: "Avant l'échéance", texte: "Un rappel courtois part quelques jours avant, avec le lien de paiement." },
          { titre: "Juste après", texte: "Une première relance à une semaine, polie et précise : numéro, montant, échéance." },
          { titre: "Ensuite", texte: "Des relances espacées ; pour un professionnel, elles rappellent les pénalités et l'indemnité de 40 €." },
          { titre: "En dernier recours", texte: "Mise en demeure par lettre recommandée, puis injonction de payer : Qonforme vous donne le modèle et l'historique." },
        ],
      }}
      inlineCta={{ title: "Vos devis sont gratuits,", accent: "vos relances partent seules." }}
      limites={{
        title: "Ce que Qonforme",
        accent: "ne fait pas.",
        paragraphes: [
          "Qonforme n'encaisse pas l'argent de vos clients et ne fait pas de recouvrement : il relance à l'amiable, par e-mail, et vous montre qui est en retard.",
          "Une facture n'est jamais marquée payée automatiquement : c'est vous qui la marquez, avec la date du paiement, quand le virement est arrivé.",
          `Sans formule, aucune relance ne part : l'envoi des factures et les relances demandent ${essentiel.name}.`,
        ],
      }}
      faq={FAQ}
      liens={[
        { href: "/modele/lettre-relance-impaye", label: "Modèle de relance de facture impayée" },
        { href: "/guide/facture-impayee", label: "Que faire d'une facture impayée" },
        { href: "/guide/delai-paiement-facture", label: "Délais de paiement d'une facture" },
        { href: "/outils/calculateur-penalites-retard", label: "Calculateur de pénalités de retard" },
        { href: "/guide/mentions-obligatoires-facture", label: "Mentions obligatoires d'une facture" },
        { href: "/pricing", label: "Tarifs et formules" },
      ]}
      sources={[
        { label: "Service-public.gouv.fr, « Recouvrement amiable : relance et mise en demeure de payer » (fiche F38586)", href: "https://entreprendre.service-public.gouv.fr/vosdroits/F38586" },
        { label: "Service-public.gouv.fr, « Délais de paiement entre professionnels et pénalités de retard » (fiche F23211)", href: "https://entreprendre.service-public.gouv.fr/vosdroits/F23211" },
        { label: "Service-public.gouv.fr, « Recouvrement de dettes en France : injonction de payer et procédure simplifiée » (fiche F1746)", href: "https://www.service-public.gouv.fr/particuliers/vosdroits/F1746" },
        { label: "Code de commerce, articles L441-10 et D441-5 (pénalités de retard et indemnité forfaitaire)" },
        { label: "Code civil, article 1231-6 (intérêts moratoires)" },
      ]}
      cta={{ title: "Envoyez, relancez,", accent: "faites-vous payer." }}
    />
  )
}
