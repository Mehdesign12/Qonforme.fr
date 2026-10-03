import { divArrondi, versEntier } from "./decimal"

/**
 * Taux de TVA français et conversion HT ↔ TTC, au centime près.
 *
 * Cas du bâtiment (travaux dans un logement) :
 * - 5,5 % : travaux d'amélioration de la qualité énergétique d'un logement
 *   achevé depuis plus de deux ans (CGI, art. 278-0 bis A) ;
 * - 10 % : travaux d'amélioration, de transformation, d'aménagement et
 *   d'entretien d'un logement achevé depuis plus de deux ans (CGI, art. 279-0 bis) ;
 * - 20 % : construction neuve, et tout ce qui ne relève pas d'un taux réduit.
 * Source : entreprendre.service-public.gouv.fr, fiche F23568 ; impots.gouv.fr,
 * « Quel taux de TVA appliquer pour les travaux réalisés dans les logements ? »
 * (consultés le 3 octobre 2026).
 *
 * Les abonnements d'électricité et de gaz ne sont plus à 5,5 % depuis le
 * 1er août 2025 (loi n° 2025-127 du 14 février 2025 de finances pour 2025,
 * art. 20 ; BOI-RES-TVA-000209-20250605) : ils ne figurent plus parmi les
 * exemples du taux réduit.
 */
export const TVA_RATES = [
  { label: "20 % — Taux normal", value: 20, desc: "Construction neuve, la plupart des biens et services" },
  { label: "10 % — Taux intermédiaire", value: 10, desc: "Travaux d'amélioration d'un logement de plus de 2 ans, restauration" },
  { label: "5,5 % — Taux réduit", value: 5.5, desc: "Rénovation énergétique d'un logement de plus de 2 ans, alimentation" },
  { label: "2,1 % — Taux super-réduit", value: 2.1, desc: "Presse, médicaments remboursables" },
] as const

/** Taux en centièmes de point : 5,5 % → 550. */
function tauxEnCentiemes(rate: number): number {
  return versEntier(rate, 2)
}

export interface ConversionTva {
  ht: number
  tva: number
  ttc: number
}

/**
 * Montant HT → TVA et TTC. La TVA est arrondie au centime (demi au centime
 * supérieur) et le TTC vaut toujours HT + TVA.
 */
export function depuisHt(ht: number, rate: number): ConversionTva {
  const htC = versEntier(ht, 2)
  const tvaC = divArrondi(htC * tauxEnCentiemes(rate), 10_000)
  return { ht: htC / 100, tva: tvaC / 100, ttc: (htC + tvaC) / 100 }
}

/**
 * Montant TTC → HT et TVA. Le HT est arrondi au centime et la TVA vaut
 * TTC − HT : HT + TVA = TTC, sans écart d'un centime.
 */
export function depuisTtc(ttc: number, rate: number): ConversionTva {
  const ttcC = versEntier(ttc, 2)
  const htC = divArrondi(ttcC * 10_000, 10_000 + tauxEnCentiemes(rate))
  return { ht: htC / 100, tva: (ttcC - htC) / 100, ttc: ttcC / 100 }
}

/** HT → TTC, au centime. */
export function htToTtc(ht: number, rate: number): number {
  return depuisHt(ht, rate).ttc
}

/** TTC → HT, au centime. */
export function ttcToHt(ttc: number, rate: number): number {
  return depuisTtc(ttc, rate).ht
}

/** TVA due sur un montant HT, au centime. */
export function calculateVat(ht: number, rate: number): number {
  return depuisHt(ht, rate).tva
}
