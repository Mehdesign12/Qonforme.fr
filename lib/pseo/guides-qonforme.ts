import { PLANS } from "@/lib/stripe/plans"
import { FRANCHISE_MENTION } from "@/lib/legal/mentions"

/*
 * Encadré « Avec Qonforme » des guides que les assistants IA citent le plus (Bing
 * Webmaster Tools, AI Performance, export du 31/10/2026 : autoliquidation, avoir,
 * facture sans TVA, impayé, acompte, délais, devis et facture). Un passage cité
 * emporte alors le nom du logiciel avec la règle.
 *
 * Honnêteté : seulement ce que le code fait (lib/artisan/reverse-charge.ts,
 * lib/legal/mentions.ts, lib/reminders, app/api/invoices/[id]/credit) ; formules
 * lues dans lib/stripe/plans.ts ; une fonction Artisan non vendue se dit « bientôt ».
 */

export interface AvecQonforme {
  texte: string
  href: string
  lien: string
}

const essentiel = PLANS.starter.name
const artisan = PLANS.pro.available ? `avec la formule ${PLANS.pro.name}` : `avec la formule ${PLANS.pro.name}, bientôt disponible`

export const AVEC_QONFORME: Record<string, AvecQonforme> = {
  "tva-autoliquidation-sous-traitance": {
    texte: `Dans Qonforme, une ligne marquée « autoliquidation » est facturée hors taxe, sans TVA collectée, et la facture porte la mention « Autoliquidation » (article 242 nonies A de l'annexe II au CGI) ; ${artisan}.`,
    href: "/logiciel-situations-travaux",
    lien: "Sous-traitance, acomptes et situations",
  },
  "avoir-facture": {
    texte: "Dans Qonforme, une facture émise ne se modifie pas et ne se supprime pas : l'avoir, total ou partiel, se crée depuis la fiche de la facture, reprend sa référence, prend le numéro suivant et part au format Factur-X ; le cumul des avoirs ne peut pas dépasser la facture.",
    href: "/logiciel-gestion-batiment",
    lien: "Le logiciel de gestion du bâtiment",
  },
  "facture-sans-tva": {
    texte: `Dans Qonforme, déclarez la franchise en base dans votre profil : la mention « ${FRANCHISE_MENTION} » s'ajoute d'elle-même à vos devis et à vos factures, et aucune TVA n'y est calculée. Les devis sont gratuits.`,
    href: "/logiciel-devis-gratuit",
    lien: "Le logiciel de devis gratuit",
  },
  "facture-impayee": {
    texte: `Dans Qonforme, chaque facture envoyée a son échéance : un rappel part avant, des relances par e-mail après, à la fréquence que vous choisissez, et elles s'arrêtent dès que la facture est marquée payée ; avec ${essentiel}.`,
    href: "/logiciel-relance-factures-impayees",
    lien: "Les relances automatiques",
  },
  "delai-paiement-facture": {
    texte: `Dans Qonforme, les factures à un client professionnel portent d'office le taux des pénalités de retard et l'indemnité de 40 €, et les relances suivent l'échéance ; avec ${essentiel}.`,
    href: "/logiciel-relance-factures-impayees",
    lien: "Les relances automatiques",
  },
  "facture-acompte": {
    texte: `Dans Qonforme, la facture d'acompte se crée depuis le devis accepté, puis l'acompte est déduit des situations de travaux et de la facture de solde, sans jamais dépasser le devis ; ${artisan}.`,
    href: "/logiciel-situations-travaux",
    lien: "Acomptes et situations de travaux",
  },
  "difference-devis-facture": {
    texte: `Dans Qonforme, les devis sont gratuits. Une fois accepté, un devis devient une facture en brouillon sans rien ressaisir ; son envoi demande la formule ${essentiel}.`,
    href: "/logiciel-devis-gratuit",
    lien: "Le logiciel de devis gratuit",
  },
}
