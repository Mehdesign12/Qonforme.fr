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

/* ─────────────────────────────────────────────────────────
   Analyse complète : année précédente et année de création
───────────────────────────────────────────────────────── */

/**
 * « tva-des-le-1er-janvier » : le chiffre d'affaires de l'année précédente
 * dépasse le seuil de base, la franchise ne s'applique pas cette année
 * (CGI, art. 293 B, I ; BOFiP BOI-TVA-DECLA-40-10-10-20260701, § 130 : un
 * dépassement de 37 500 € en 2025 fait perdre la franchise au 1er janvier 2026).
 */
export type SituationFranchiseComplete = SituationFranchise | "tva-des-le-1er-janvier"

export interface ParametresFranchise {
  activite: ActiviteFranchise
  /** Chiffre d'affaires de l'année en cours (réalisé ou prévu). */
  caAnnee: number
  /** Chiffre d'affaires de l'année civile précédente ; null si l'activité a commencé cette année. */
  caAnneePrecedente: number | null
  /** Jours d'activité de l'année précédente, si l'activité a commencé en cours d'année précédente. */
  joursAnneePrecedente?: number
  /** Jours d'activité de cette année, si l'activité a commencé cette année. */
  joursAnneeCreation?: number
}

export interface AnalyseFranchise {
  situation: SituationFranchiseComplete
  /** Seuil de base appliqué au chiffre d'affaires de l'année précédente (ajusté s'il s'agissait de l'année de création). */
  seuilBaseAnneePrecedente: number | null
  /** Seuil de base de l'année en cours (ajusté l'année de création) : au-delà, TVA au 1er janvier suivant. */
  seuilBase: number
  /** Seuil majoré de l'année en cours (ajusté l'année de création) : au-delà, TVA dès le dépassement. */
  seuilMajore: number
}

/**
 * Seuil ajusté à la durée d'activité de l'année de création, « en fonction du
 * nombre de jours d'activité par rapport à 365 » (CGI, art. 293 D, III ; BOFiP
 * BOI-TVA-DECLA-40-10-10-20260701, § 285 et 290), arrondi à l'euro (exemple du
 * § 290 : début le 12 juin, 93 500 € × 203 / 365 = 52 001 €).
 */
export function seuilAjuste(seuil: number, joursActivite: number): number {
  const jours = Math.min(Math.max(Math.round(joursActivite), 1), 365)
  return Math.round((seuil * jours) / 365)
}

/** Jours d'activité de l'année civile, du début d'activité (inclus) au 31 décembre, 365 au plus. */
export function joursActiviteDepuis(dateDebut: string): number {
  const [a, m, j] = dateDebut.split("-").map(Number)
  const jours = (Date.UTC(a, 11, 31) - Date.UTC(a, m - 1, j)) / 86_400_000 + 1
  return Math.min(Math.max(jours, 1), 365)
}

/**
 * Situation au regard de la franchise, d'après les deux années :
 * 1. année précédente au-dessus du seuil de base → TVA depuis le 1er janvier ;
 * 2. année en cours au-dessus du seuil majoré → TVA dès le dépassement ;
 * 3. année en cours au-dessus du seuil de base → franchise jusqu'au 31 décembre ;
 * 4. sinon, franchise.
 * L'année de création, les seuils sont ajustés au prorata des jours d'activité
 * (§ 290) ; l'année suivante, le chiffre d'affaires de l'année de création est
 * comparé au seuil de base ajusté (§ 295).
 */
export function analyserFranchise(p: ParametresFranchise): AnalyseFranchise {
  const s = SEUILS_FRANCHISE_TVA.find((x) => x.id === p.activite)!
  const creation = p.caAnneePrecedente === null && p.joursAnneeCreation !== undefined
  const seuilBase = creation ? seuilAjuste(s.seuilBase, p.joursAnneeCreation!) : s.seuilBase
  const seuilMajore = creation ? seuilAjuste(s.seuilMajore, p.joursAnneeCreation!) : s.seuilMajore
  const seuilBaseAnneePrecedente =
    p.caAnneePrecedente === null ? null : p.joursAnneePrecedente !== undefined ? seuilAjuste(s.seuilBase, p.joursAnneePrecedente) : s.seuilBase

  let situation: SituationFranchiseComplete
  if (seuilBaseAnneePrecedente !== null && p.caAnneePrecedente! > seuilBaseAnneePrecedente) situation = "tva-des-le-1er-janvier"
  else if (p.caAnnee > seuilMajore) situation = "tva-des-le-depassement"
  else if (p.caAnnee > seuilBase) situation = "fin-au-31-decembre"
  else situation = "franchise"

  return { situation, seuilBaseAnneePrecedente, seuilBase, seuilMajore }
}
