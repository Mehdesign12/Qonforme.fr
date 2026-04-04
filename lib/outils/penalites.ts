/**
 * Calcul des pénalités de retard sur factures impayées.
 * Réglementation française — Code de commerce art. L441-10.
 */

/** Taux directeur BCE au 1er semestre 2026 (mis à jour) */
export const TAUX_BCE = 4.0

/** Indemnité forfaitaire de recouvrement (art. D441-5) */
export const INDEMNITE_FORFAITAIRE = 40

export interface PenalitesResult {
  montantFacture: number
  joursRetard: number
  tauxAnnuel: number
  interetsRetard: number
  indemniteForfaitaire: number
  totalDu: number
}

/**
 * Calcule les pénalités de retard.
 * @param montant Montant TTC de la facture
 * @param joursRetard Nombre de jours de retard
 * @param tauxAnnuel Taux annuel en % (par défaut : BCE × 3 = 12%)
 */
export function calculerPenalites(
  montant: number,
  joursRetard: number,
  tauxAnnuel?: number
): PenalitesResult {
  const taux = tauxAnnuel ?? TAUX_BCE * 3
  const interetsRetard = Math.round(montant * (taux / 100) * (joursRetard / 365) * 100) / 100

  return {
    montantFacture: montant,
    joursRetard,
    tauxAnnuel: taux,
    interetsRetard,
    indemniteForfaitaire: INDEMNITE_FORFAITAIRE,
    totalDu: Math.round((interetsRetard + INDEMNITE_FORFAITAIRE) * 100) / 100,
  }
}

/**
 * Calcule le nombre de jours entre deux dates.
 */
export function joursEntre(dateEcheance: string, datePaiement: string): number {
  const d1 = new Date(dateEcheance)
  const d2 = new Date(datePaiement)
  const diff = d2.getTime() - d1.getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}
