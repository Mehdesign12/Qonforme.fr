/**
 * Barèmes 2026 des micro-entrepreneurs (taux sur le chiffre d'affaires encaissé).
 *
 * - Cotisations sociales : service-public.gouv.fr, fiche F36232 (vérifiée le
 *   1er janvier 2026). Libéral non réglementé : 25,6 % au 1er janvier 2026,
 *   décret n° 2025-943 du 8 septembre 2025.
 * - Contribution à la formation professionnelle (CFP) : fiche F23459 (vérifiée
 *   le 1er janvier 2026) : 0,1 % commerce, 0,3 % artisanat, 0,2 % libéral.
 * - Versement libératoire de l'impôt : 1 %, 1,7 % ou 2,2 % (CGI, art. 151-0).
 * - Plafonds de chiffre d'affaires : 203 100 € (vente, hébergement) et 83 600 €
 *   (services, libéral), fiche F32353 (vérifiée le 21 février 2026) ;
 *   CGI, art. 50-0 et 102 ter.
 * - Abattements forfaitaires : 71 %, 50 % ou 34 % (CGI, art. 50-0 et 102 ter).
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
    plafondCA: 203100,
    abattement: 71,
  },
  {
    id: "prestations-bic",
    label: "Prestations de services (BIC)",
    tauxCotisations: 21.2,
    /** CFP d'un artisan ; 0,1 % pour un commerçant. */
    tauxCFP: 0.3,
    tauxVersementLiberatoire: 1.7,
    plafondCA: 83600,
    abattement: 50,
  },
  {
    id: "prestations-bnc",
    label: "Profession libérale non réglementée (BNC)",
    tauxCotisations: 25.6,
    tauxCFP: 0.2,
    tauxVersementLiberatoire: 2.2,
    plafondCA: 83600,
    abattement: 34,
  },
  {
    id: "liberal",
    label: "Profession libérale réglementée (BNC — Cipav)",
    tauxCotisations: 23.2,
    tauxCFP: 0.2,
    tauxVersementLiberatoire: 2.2,
    plafondCA: 83600,
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
