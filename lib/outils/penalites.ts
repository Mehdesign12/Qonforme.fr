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

/* ─────────────────────────────────────────────────────────
   Historique des semestres et calcul par période
───────────────────────────────────────────────────────── */

export interface SemestreTaux {
  /** Premier jour du semestre, AAAA-MM-JJ. */
  debut: string
  libelle: string
  /** Taux BCE des opérations principales de refinancement au 1er jour du semestre. */
  tauxBce: number
  /** Taux de l'intérêt légal du semestre, créances des professionnels (« tous les autres cas »). */
  tauxInteretLegalPro: number
}

/**
 * Semestres dont les deux taux sont vérifiés, du plus ancien au plus récent.
 *
 * Taux BCE (BCE, « Key ECB interest rates », tableau consulté le 3 octobre 2026) :
 * 3,15 % depuis le 18 décembre 2024, 2,15 % depuis le 11 juin 2025, 2,40 %
 * depuis le 17 juin 2026.
 * Taux de l'intérêt légal (« tous les autres cas ») :
 * - 1er semestre 2025 : 3,71 %, arrêté du 17 décembre 2024 (JORFTEXT000050793726) ;
 * - 2ᵉ semestre 2025 : 2,76 %, arrêté du 19 juin 2025 (JORFTEXT000051783186) ;
 * - 1er semestre 2026 : 2,62 %, arrêté du 15 décembre 2025, JORF du 26 décembre 2025 (JORFTEXT000053165408) ;
 * - 2ᵉ semestre 2026 : 2,75 %, arrêté du 26 juin 2026, JORF du 30 juin 2026.
 * À compléter chaque 1er janvier et 1er juillet, en même temps que SEMESTRE_REFERENCE.
 */
export const HISTORIQUE_SEMESTRES: readonly SemestreTaux[] = [
  { debut: "2025-01-01", libelle: "1er semestre 2025", tauxBce: 3.15, tauxInteretLegalPro: 3.71 },
  { debut: "2025-07-01", libelle: "2ᵉ semestre 2025", tauxBce: 2.15, tauxInteretLegalPro: 2.76 },
  { debut: "2026-01-01", libelle: "1er semestre 2026", tauxBce: 2.15, tauxInteretLegalPro: 2.62 },
  { debut: "2026-07-01", libelle: SEMESTRE_REFERENCE.libelle, tauxBce: SEMESTRE_REFERENCE.tauxBce, tauxInteretLegalPro: SEMESTRE_REFERENCE.tauxInteretLegalPro },
]

export interface TranchePenalites {
  /** Premier et dernier jour de retard de la tranche (inclus), AAAA-MM-JJ. */
  debut: string
  fin: string
  jours: number
  /** Semestre de la tranche (« 1er semestre 2026 »). */
  semestre: string
  /** Faux si le semestre est hors de l'historique vérifié : taux du semestre connu le plus proche, à vérifier. */
  connu: boolean
  /** Semestre dont le taux est appliqué (différent de `semestre` hors historique). */
  semestreDuTaux: string
  taux: number
  interets: number
}

export interface PenalitesPeriodeResult {
  montantFacture: number
  joursRetard: number
  tranches: TranchePenalites[]
  tauxParDefaut: boolean
  /** Vrai si le taux convenu est sous 3 × le taux d'intérêt légal d'un des semestres de la période. */
  sousLePlancher: boolean
  /** Vrai si une partie de la période sort de l'historique vérifié. */
  horsHistorique: boolean
  interetsRetard: number
  indemniteForfaitaire: number
  /** Intérêts de retard + indemnité forfaitaire (le montant de la facture est dû à part). */
  totalPenalites: number
}

const JOUR = 86_400_000
const versJour = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
const versIso = (t: number) => new Date(t).toISOString().slice(0, 10)

function semestreDe(iso: string): { debut: string; fin: string; libelle: string } {
  const annee = iso.slice(0, 4)
  return Number(iso.slice(5, 7)) <= 6
    ? { debut: `${annee}-01-01`, fin: `${annee}-06-30`, libelle: `1er semestre ${annee}` }
    : { debut: `${annee}-07-01`, fin: `${annee}-12-31`, libelle: `2ᵉ semestre ${annee}` }
}

/**
 * Pénalités de retard découpées par semestre : à défaut de taux convenu, chaque
 * jour de retard porte intérêt au taux BCE + 10 points du semestre où il tombe
 * (Code de commerce, art. L441-10 II). Un taux convenu s'applique à toute la
 * période. Le retard court du lendemain de l'échéance au jour du paiement inclus.
 */
export function calculerPenalitesPeriode(montant: number, dateEcheance: string, datePaiement: string, tauxAnnuel?: number): PenalitesPeriodeResult {
  const convenu = tauxAnnuel !== undefined && Number.isFinite(tauxAnnuel)
  const premier = versJour(dateEcheance) + JOUR
  const dernier = versJour(datePaiement)
  const tranches: TranchePenalites[] = []
  let sousLePlancher = false

  for (let jour = premier; jour <= dernier; ) {
    const sem = semestreDe(versIso(jour))
    const fin = Math.min(versJour(sem.fin), dernier)
    const jours = Math.round((fin - jour) / JOUR) + 1
    const exact = HISTORIQUE_SEMESTRES.find((s) => s.debut === sem.debut)
    const proche = exact ?? (sem.debut < HISTORIQUE_SEMESTRES[0].debut ? HISTORIQUE_SEMESTRES[0] : HISTORIQUE_SEMESTRES[HISTORIQUE_SEMESTRES.length - 1])
    const taux = convenu ? tauxAnnuel! : arrondi2(proche.tauxBce + 10)
    if (convenu && taux < arrondi2(proche.tauxInteretLegalPro * 3)) sousLePlancher = true
    tranches.push({
      debut: versIso(jour),
      fin: versIso(fin),
      jours,
      semestre: sem.libelle,
      connu: Boolean(exact),
      semestreDuTaux: proche.libelle,
      taux,
      interets: arrondi2(montant * (taux / 100) * (jours / 365)),
    })
    jour = fin + JOUR
  }

  const interetsRetard = arrondi2(tranches.reduce((s, t) => s + t.interets, 0))
  return {
    montantFacture: montant,
    joursRetard: tranches.reduce((s, t) => s + t.jours, 0),
    tranches,
    tauxParDefaut: !convenu,
    sousLePlancher,
    horsHistorique: tranches.some((t) => !t.connu),
    interetsRetard,
    indemniteForfaitaire: INDEMNITE_FORFAITAIRE,
    totalPenalites: arrondi2(interetsRetard + INDEMNITE_FORFAITAIRE),
  }
}
