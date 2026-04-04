/**
 * Barèmes URSSAF 2026 pour les auto-entrepreneurs / micro-entrepreneurs.
 * Source : urssaf.fr — barèmes mis à jour pour 2026.
 */

export interface ChargesResult {
  cotisations: number
  cfp: number
  versementLiberatoire: number | null
  totalCharges: number
  revenuNet: number
  tauxEffectif: number
}

export const ACTIVITES = [
  {
    id: "vente",
    label: "Vente de marchandises (BIC)",
    tauxCotisations: 12.3,
    tauxCFP: 0.1,
    tauxVersementLiberatoire: 1.0,
    plafondCA: 188700,
    abattement: 71,
  },
  {
    id: "prestations-bic",
    label: "Prestations de services (BIC)",
    tauxCotisations: 21.2,
    tauxCFP: 0.3,
    tauxVersementLiberatoire: 1.7,
    plafondCA: 77700,
    abattement: 50,
  },
  {
    id: "prestations-bnc",
    label: "Prestations de services (BNC)",
    tauxCotisations: 21.1,
    tauxCFP: 0.2,
    tauxVersementLiberatoire: 2.2,
    plafondCA: 77700,
    abattement: 34,
  },
  {
    id: "liberal",
    label: "Profession libérale (BNC — CIPAV)",
    tauxCotisations: 23.2,
    tauxCFP: 0.2,
    tauxVersementLiberatoire: 2.2,
    plafondCA: 77700,
    abattement: 34,
  },
] as const

export type ActiviteId = (typeof ACTIVITES)[number]["id"]

export function calculerCharges(
  ca: number,
  activiteId: ActiviteId,
  versementLiberatoire: boolean
): ChargesResult {
  const activite = ACTIVITES.find((a) => a.id === activiteId)!

  const cotisations = Math.round(ca * (activite.tauxCotisations / 100) * 100) / 100
  const cfp = Math.round(ca * (activite.tauxCFP / 100) * 100) / 100

  let vl: number | null = null
  if (versementLiberatoire) {
    vl = Math.round(ca * (activite.tauxVersementLiberatoire / 100) * 100) / 100
  }

  const totalCharges = cotisations + cfp + (vl ?? 0)
  const revenuNet = ca - totalCharges
  const tauxEffectif = ca > 0 ? Math.round((totalCharges / ca) * 10000) / 100 : 0

  return {
    cotisations,
    cfp,
    versementLiberatoire: vl,
    totalCharges,
    revenuNet,
    tauxEffectif,
  }
}
