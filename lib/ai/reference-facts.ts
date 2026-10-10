/**
 * Faits juridiques de référence donnés aux générateurs d'articles : l'ancien
 * générateur (lib/ai/gemini.ts, tutoiement du modèle) et l'onglet SEO
 * (lib/seo/articles/prompt.ts, vouvoiement). Un seul texte pour les deux.
 *
 * Construits depuis les constantes vérifiées des outils (sources officielles
 * citées dans ces fichiers) : une mise à jour des barèmes met aussi à jour les
 * articles à venir.
 */
import { SEUILS_FRANCHISE_TVA } from "@/lib/outils/franchise-tva"
import { SEMESTRE_REFERENCE, TAUX_PENALITES_DEFAUT, TAUX_PENALITES_PLANCHER } from "@/lib/outils/penalites"
import { ACTIVITES } from "@/lib/outils/charges"

const fmtEur = (n: number) => `${n.toLocaleString("fr-FR")} €`
const fmtPct = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 1 })} %`
const SEUIL_SERVICES = SEUILS_FRANCHISE_TVA.find((s) => s.id === "services")!
const SEUIL_VENTE = SEUILS_FRANCHISE_TVA.find((s) => s.id === "vente")!

/** Consignes adressées au modèle en « tu » ou en « vous ». */
export function referenceFacts(voice: "tu" | "vous"): string {
  const tu = voice === "tu"
  return `FAITS DE RÉFÉRENCE (vérifiés ; ${tu ? "si tu cites l'un de ces sujets, utilise exactement ces valeurs et n'en donne pas d'autres" : "si vous citez l'un de ces sujets, utilisez exactement ces valeurs et aucune autre"}) :
- Franchise en base de TVA (art. 293 B du CGI) en 2026 : seuils de base ${fmtEur(SEUIL_SERVICES.seuilBase)} (services) et ${fmtEur(SEUIL_VENTE.seuilBase)} (vente, hébergement), appréciés sur l'année précédente ; seuils majorés ${fmtEur(SEUIL_SERVICES.seuilMajore)} et ${fmtEur(SEUIL_VENTE.seuilMajore)} sur l'année en cours. Au-delà du seuil majoré, la TVA s'applique aux opérations réalisées à partir de la date du dépassement ; au-delà du seul seuil de base, au 1er janvier suivant. Activité mixte : ${fmtEur(SEUIL_VENTE.seuilBase)} au total dont ${fmtEur(SEUIL_SERVICES.seuilBase)} au plus de services. Mention : « TVA non applicable, art. 293 B du CGI ».
- Pénalités de retard entre professionnels (art. L441-10 du Code de commerce) : sans taux prévu, taux de refinancement de la BCE majoré de 10 points (${fmtPct(TAUX_PENALITES_DEFAUT)} au ${SEMESTRE_REFERENCE.libelle}) ; un taux prévu ne peut pas être inférieur à 3 fois le taux d'intérêt légal (${fmtPct(TAUX_PENALITES_PLANCHER)} au ${SEMESTRE_REFERENCE.libelle}) ; exigibles sans rappel ; indemnité forfaitaire de recouvrement de 40 € par facture (art. D441-5).
- Micro-entreprise en 2026 : plafonds de chiffre d'affaires 203 100 € (vente, hébergement) et 83 600 € (services, libéral) ; cotisations ${ACTIVITES.map((a) => `${fmtPct(a.tauxCotisations)} (${a.label})`).join(", ")}.
- Facturation électronique : depuis le 1er septembre 2026, toutes les entreprises assujetties à la TVA doivent pouvoir recevoir des factures électroniques ; l'émission est obligatoire depuis cette date pour les grandes entreprises et les ETI, et le sera le 1er septembre 2027 pour les PME et les micro-entreprises. Les factures passent par une « plateforme agréée » (${tu ? "ne dis plus" : "ne dites plus"} « PDP »).
- Vente de biens à un professionnel de l'UE : « Exonération de TVA, article 262 ter I du CGI » ; prestation de services à un professionnel de l'UE : mention « Autoliquidation » ; sous-traitance dans le BTP : autoliquidation (art. 283-2 nonies du CGI).
- Devis : chez un particulier, un devis détaillé est obligatoire avant tout dépannage, toute réparation ou tout entretien dans le bâtiment, quel qu'en soit le montant (arrêté du 24 janvier 2017, en vigueur depuis le 1er avril 2017 : il n'y a plus de montant minimal) ; signé avec « Bon pour accord », il vaut contrat.
- ${tu ? "Si tu n'es pas sûr d'un chiffre ou d'un article de loi, ne le cite pas." : "Si vous n'êtes pas sûr d'un chiffre ou d'un article de loi, ne le citez pas."}`
}
