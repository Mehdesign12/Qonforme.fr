/**
 * Calcul des pénalités de retard sur factures impayées, entre professionnels.
 *
 * Code de commerce, art. L441-10 II
 * (https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000038414392) :
 * - à défaut de taux convenu, le taux est celui de la Banque centrale européenne
 *   à son opération de refinancement la plus récente, majoré de 10 points ;
 *   on retient le taux en vigueur au 1er janvier pour le premier semestre
 *   et au 1er juillet pour le second ;
 * - un taux convenu ne peut pas être inférieur à trois fois le taux d'intérêt légal ;
 * - les pénalités sont exigibles sans qu'un rappel soit nécessaire.
 */

/**
 * Taux de référence du semestre en cours. À mettre à jour chaque 1er janvier et
 * 1er juillet, avec la source de chaque valeur.
 */
export const SEMESTRE_REFERENCE = {
  libelle: "2ᵉ semestre 2026",
  /**
   * Taux des opérations principales de refinancement de la BCE en vigueur au
   * 1er juillet 2026 : 2,40 %, applicable depuis le 17 juin 2026 (2,65 % depuis
   * le 16 septembre 2026, retenu seulement au 1er janvier 2027 s'il ne change pas).
   * Source : BCE, « Key ECB interest rates »
   * (https://www.ecb.europa.eu/stats/policy_and_exchange_rates/key_ecb_interest_rates/html/index.en.html).
   */
  tauxBce: 2.4,
  /**
   * Taux de l'intérêt légal du second semestre 2026 pour les créances des
   * professionnels (« tous les autres cas ») : 2,75 %. Arrêté du 26 juin 2026
   * relatif à la fixation du taux de l'intérêt légal, JORF du 30 juin 2026.
   */
  tauxInteretLegalPro: 2.75,
} as const

/** Arrondi au centième, sans les erreurs de virgule flottante (2,75 × 3 = 8,25 et non 8,250000000000002). */
const arrondi2 = (n: number) => Math.round(n * 100) / 100

/** Taux appliqué à défaut de taux convenu : taux BCE + 10 points (12,40 % au 2ᵉ semestre 2026). */
export const TAUX_PENALITES_DEFAUT = arrondi2(SEMESTRE_REFERENCE.tauxBce + 10)

/** Taux minimum d'un taux convenu : 3 × le taux d'intérêt légal (8,25 % au 2ᵉ semestre 2026). */
export const TAUX_PENALITES_PLANCHER = arrondi2(SEMESTRE_REFERENCE.tauxInteretLegalPro * 3)

/**
 * Indemnité forfaitaire pour frais de recouvrement, due par un client professionnel
 * pour chaque facture payée en retard. Code de commerce, art. D441-5.
 */
export const INDEMNITE_FORFAITAIRE = 40

/** Vrai si un taux convenu respecte le plancher légal de L441-10. */
export function tauxConformeAuPlancher(tauxAnnuel: number): boolean {
  return tauxAnnuel >= TAUX_PENALITES_PLANCHER
}

export interface PenalitesResult {
  montantFacture: number
  joursRetard: number
  tauxAnnuel: number
  /** Vrai quand aucun taux n'a été convenu : on applique le taux BCE + 10 points. */
  tauxParDefaut: boolean
  /** Vrai si le taux convenu est sous le plancher légal (3 × taux d'intérêt légal). */
  sousLePlancher: boolean
  interetsRetard: number
  indemniteForfaitaire: number
  totalDu: number
}

/**
 * Calcule les pénalités de retard.
 * @param montant Montant TTC de la facture
 * @param joursRetard Nombre de jours de retard
 * @param tauxAnnuel Taux annuel convenu en % ; à défaut, taux BCE + 10 points
 */
export function calculerPenalites(
  montant: number,
  joursRetard: number,
  tauxAnnuel?: number
): PenalitesResult {
  const convenu = tauxAnnuel !== undefined && Number.isFinite(tauxAnnuel)
  const taux = convenu ? tauxAnnuel : TAUX_PENALITES_DEFAUT
  const interetsRetard = arrondi2(montant * (taux / 100) * (joursRetard / 365))

  return {
    montantFacture: montant,
    joursRetard,
    tauxAnnuel: taux,
    tauxParDefaut: !convenu,
    sousLePlancher: convenu && !tauxConformeAuPlancher(taux),
    interetsRetard,
    indemniteForfaitaire: INDEMNITE_FORFAITAIRE,
    totalDu: arrondi2(interetsRetard + INDEMNITE_FORFAITAIRE),
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
