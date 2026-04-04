/**
 * Logique de calcul TVA pour les taux français.
 */

export const TVA_RATES = [
  { label: "20% — Taux normal", value: 20, desc: "Biens et services courants" },
  { label: "10% — Taux intermédiaire", value: 10, desc: "Restauration, travaux, transport" },
  { label: "5,5% — Taux réduit", value: 5.5, desc: "Alimentation, énergie, livres" },
  { label: "2,1% — Taux super-réduit", value: 2.1, desc: "Presse, médicaments remboursés" },
] as const

export function htToTtc(ht: number, rate: number): number {
  return Math.round(ht * (1 + rate / 100) * 100) / 100
}

export function ttcToHt(ttc: number, rate: number): number {
  return Math.round((ttc / (1 + rate / 100)) * 100) / 100
}

export function calculateVat(ht: number, rate: number): number {
  return Math.round(ht * (rate / 100) * 100) / 100
}
