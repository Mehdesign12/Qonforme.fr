import { ACTIVITES, calculerCharges, type ActiviteId } from "./charges"

/**
 * Simulateur de revenu net d'un micro-entrepreneur (une part fiscale, sans
 * versement libératoire).
 *
 * Barème de l'impôt sur le revenu 2026 (revenus 2025, loi de finances pour 2026),
 * pour une part : service-public.gouv.fr, fiche F1419 (vérifiée le 15 avril 2026).
 * Le barème qui s'appliquera aux revenus 2026 n'est pas encore connu.
 *
 * Décote (CGI, art. 197, I-4) pour l'imposition des revenus 2025 : une personne
 * seule dont l'impôt brut est inférieur à 1 982 € bénéficie d'une décote égale à
 * 897 € − 45,25 % de l'impôt brut. BOFiP BOI-IR-LIQ-20-20-30-20260407, § 1 et 40.
 */
export const TRANCHES_IR = [
  { min: 0, max: 11600, taux: 0 },
  { min: 11600, max: 29579, taux: 11 },
  { min: 29579, max: 84577, taux: 30 },
  { min: 84577, max: 181917, taux: 41 },
  { min: 181917, max: Infinity, taux: 45 },
] as const

export const DECOTE_PERSONNE_SEULE = { plafondImpotBrut: 1982, forfait: 897, taux: 45.25 } as const

/** Impôt brut d'une part, au barème progressif, arrondi à l'euro. */
export function impotBrut(revenuImposable: number): number {
  let impot = 0
  for (const t of TRANCHES_IR) {
    if (revenuImposable <= t.min) break
    impot += (Math.min(revenuImposable, t.max) - t.min) * (t.taux / 100)
  }
  return Math.round(impot)
}

/** Décote d'une personne seule, jamais supérieure à l'impôt brut. */
export function decote(brut: number): number {
  const d = DECOTE_PERSONNE_SEULE
  if (brut <= 0 || brut >= d.plafondImpotBrut) return 0
  return Math.min(brut, Math.max(0, Math.round(d.forfait - (brut * d.taux) / 100)))
}

export interface RevenuNet {
  caAnnuel: number
  charges: number
  tauxCharges: number
  abattement: number
  revenuImposable: number
  impotBrut: number
  decote: number
  impotAnnuel: number
  netAnnuel: number
  /** Net mensuel au centime. */
  netMensuel: number
}

export function calculerRevenuNet(caAnnuel: number, activiteId: ActiviteId): RevenuNet {
  const activite = ACTIVITES.find((a) => a.id === activiteId)!
  const charges = calculerCharges(caAnnuel, activiteId, false)
  const revenuImposable = Math.round(caAnnuel * (1 - activite.abattement / 100))
  const brut = impotBrut(revenuImposable)
  const d = decote(brut)
  const impotAnnuel = brut - d
  const netAnnuel = Math.round((caAnnuel - charges.totalCharges - impotAnnuel) * 100) / 100
  return {
    caAnnuel,
    charges: charges.totalCharges,
    tauxCharges: charges.tauxEffectif,
    abattement: activite.abattement,
    revenuImposable,
    impotBrut: brut,
    decote: d,
    impotAnnuel,
    netAnnuel,
    netMensuel: Math.round((netAnnuel / 12) * 100) / 100,
  }
}

/**
 * Pourcentages entiers qui totalisent exactement 100 (méthode du plus fort
 * reste) : 33,4 / 33,3 / 33,3 → 34 / 33 / 33 et non 33 / 33 / 33.
 */
export function pourcentagesEntiers(valeurs: number[]): number[] {
  const total = valeurs.reduce((s, v) => s + Math.max(0, v), 0)
  if (total <= 0) return valeurs.map(() => 0)
  const bruts = valeurs.map((v) => (Math.max(0, v) / total) * 100)
  const entiers = bruts.map(Math.floor)
  let reste = 100 - entiers.reduce((s, v) => s + v, 0)
  const ordre = bruts.map((b, i) => ({ i, r: b - Math.floor(b) })).sort((a, b) => b.r - a.r)
  for (const { i } of ordre) {
    if (reste <= 0) break
    entiers[i] += 1
    reste -= 1
  }
  return entiers
}
