/**
 * Franchise en base de TVA en 2026 (CGI, art. 293 B, version en vigueur depuis
 * le 1er mars 2025).
 *
 * Sources : Légifrance, art. 293 B du CGI
 * (https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000045035275) ;
 * BOFiP BOI-TVA-DECLA-40-10-10-20260701, § 140 et 160 ; service-public.gouv.fr,
 * fiche F21746 (vérifiée le 1er janvier 2026).
 *
 * - Seuil de base : chiffre d'affaires de l'année civile précédente.
 * - Seuil majoré : chiffre d'affaires de l'année en cours.
 * - Dépasser le seuil de base sans dépasser le seuil majoré : la franchise
 *   continue jusqu'au 31 décembre, la TVA s'applique au 1er janvier suivant.
 * - Dépasser le seuil majoré : la franchise cesse pour les opérations réalisées
 *   à compter de la date du dépassement.
 *
 * La tolérance qui laissait la franchise une seconde année a été supprimée au
 * 1er mars 2025, et le seuil unique de 25 000 € envisagé a été abandonné
 * (loi n° 2025-1044 du 3 novembre 2025).
 */
export const SEUILS_FRANCHISE_TVA = [
  {
    id: "vente",
    label: "Vente de marchandises, hébergement",
    seuilBase: 85_000,
    seuilMajore: 93_500,
  },
  {
    id: "services",
    label: "Prestations de services, professions libérales",
    seuilBase: 37_500,
    seuilMajore: 41_250,
  },
] as const

export type ActiviteFranchise = (typeof SEUILS_FRANCHISE_TVA)[number]["id"]

export type SituationFranchise = "franchise" | "fin-au-31-decembre" | "tva-des-le-depassement"

/**
 * Situation d'une entreprise selon son chiffre d'affaires de l'année en cours,
 * en supposant qu'elle était en franchise au 1er janvier.
 */
export function situationFranchise(caAnnee: number, activite: ActiviteFranchise): SituationFranchise {
  const seuil = SEUILS_FRANCHISE_TVA.find((s) => s.id === activite)!
  if (caAnnee <= seuil.seuilBase) return "franchise"
  if (caAnnee <= seuil.seuilMajore) return "fin-au-31-decembre"
  return "tva-des-le-depassement"
}
