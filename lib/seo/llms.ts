import { FREE_FEATURES, PLANS, TAX_SUFFIX, formatEuros } from "@/lib/stripe/plans"
import { METIERS } from "@/lib/pseo/metiers"
import { lcFirst } from "@/components/content/text"
import { GUIDES } from "@/lib/pseo/guides"
import { SENDING_SENTENCE } from "@/lib/pa/sending"

/*
 * /llms.txt (proposition llmstxt.org) : résumé du site pour les assistants IA qui le
 * lisent. Aucun moteur ne s'engage à s'en servir ; il ne coûte rien et dit les faits
 * dans le même ordre que les pages de produit. Prix, fonctions et « à venir » lus dans
 * lib/stripe/plans.ts, jamais écrits ici ; aucun concurrent, aucune promesse.
 */


const BASE = "https://qonforme.fr"
const prix = (n: number) => `${formatEuros(n)}${TAX_SUFFIX}`

export function buildLlmsTxt(): string {
  const e = PLANS.starter
  const a = PLANS.pro
  const lines = [
    "# Qonforme",
    "",
    "> Qonforme est le logiciel en ligne qui gère le chantier des artisans du bâtiment en France : chiffrer (devis gratuits et illimités), organiser (chantier, planning, notes, scan) et encaisser (factures conformes à la réforme de la facturation électronique, relances automatiques). L'envoi des factures, les relances et l'export comptable demandent la formule Essentiel ; le suivi par chantier, les acomptes et les situations, la formule Artisan.",
    "",
    "## Faits",
    "",
    `- Pour qui : les artisans du bâtiment (${METIERS.map((m) => m.nom.toLowerCase()).join(", ")}), auto-entrepreneurs compris.`,
    `- Gratuit, sans carte bancaire ni durée d'essai : ${FREE_FEATURES.map(lcFirst).join(", ")}.`,
    `- Formule ${e.name} : ${prix(e.monthlyPrice)} par mois ou ${prix(e.yearlyPrice)} par an, sans engagement : ${e.features.map(lcFirst).join(", ")}.`,
    a.available
      ? `- Formule ${a.name} : ${prix(a.monthlyPrice)} par mois ou ${prix(a.yearlyPrice)} par an. Tout ${e.name}, plus : ${a.features.map(lcFirst).join(", ")}.`
      : `- Formule ${a.name} : bientôt disponible, pas encore en vente.`,
    `- Facturation électronique : Qonforme est « solution compatible », raccordé à une plateforme agréée ; avec ${e.name}, les factures fournisseurs arrivent par cette plateforme. ${SENDING_SENTENCE}`,
    ...(e.upcoming.length ? [`- Pas encore disponible : ${e.upcoming.map(lcFirst).join(", ")}.`] : []),
    "- Factures et avoirs émis au format Factur-X ; une facture émise ne se modifie pas, une erreur se corrige par un avoir.",
    "- Les clients de l'artisan le paient par virement, directement sur son compte : IBAN et QR code de virement sur chaque facture.",
    "- Planning de rendez-vous (visite, chantier, livraison), notes et tâches, scan de documents au téléphone : pour tous les comptes, gratuits compris.",
    "- S'utilise dans le navigateur, sur ordinateur et téléphone, sans installation.",
    "",
    "## Pages produit",
    "",
    `- [Logiciel de gestion bâtiment et devis](${BASE}/logiciel-gestion-batiment) : chiffrer, organiser et encaisser vos chantiers.`,
    `- [Logiciel de devis gratuit pour artisan](${BASE}/logiciel-devis-gratuit) : devis gratuits et illimités, signés en ligne.`,
    `- [Relance des factures impayées](${BASE}/logiciel-relance-factures-impayees) : rappels, relances automatiques, pénalités.`,
    `- [Facturation avec export FEC](${BASE}/logiciel-export-fec) : contenu exact du fichier des écritures comptables.`,
    `- [Situations de travaux et acomptes](${BASE}/logiciel-situations-travaux) : acomptes, situations, retenue de garantie.`,
    `- [Dématérialisation des factures](${BASE}/logiciel-dematerialisation-factures) : factures fournisseurs reçues par la plateforme agréée, factures Factur-X, papier scanné.`,
    `- [Lecteur Factur-X gratuit](${BASE}/outils/lecteur-factur-x) : lire une facture électronique Factur-X, UBL ou CII, dans le navigateur.`,
    `- [Tarifs](${BASE}/pricing)`,
    `- [Démo](${BASE}/demo) : le tableau de bord avec des données d'exemple.`,
    "",
    "## Par métier",
    "",
    ...METIERS.map((m) => `- [Logiciel de devis pour ${m.nom.toLowerCase()}](${BASE}/facturation/${m.slug})`),
    "",
    "## Guides (règles vérifiées sur les sources officielles)",
    "",
    ...GUIDES.map((g) => `- [${g.titre}](${BASE}/guide/${g.slug})`),
    "",
    "## Outils et modèles gratuits",
    "",
    `- [Modèle de devis gratuit](${BASE}/modele) : Word, Excel et PDF.`,
    `- [Outils gratuits](${BASE}/outils) : générateurs de devis et de facture, calculateurs.`,
    "",
  ]
  return lines.join("\n")
}
