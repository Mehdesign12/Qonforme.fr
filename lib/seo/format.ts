/**
 * Formats de l'onglet SEO (français, espaces insécables comme le reste du site) :
 * taux de clic, positions, évolutions. Module pur.
 */

const NBSP = " "
const NNBSP = " "

/** « 1 234 » (espace fine insécable comme Intl). */
export function fmtCount(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—"
  return Math.round(n).toLocaleString("fr-FR")
}

/** Taux de 0 à 1 → « 0,4 % » (une décimale, deux sous 0,1 %). */
export function fmtRate(rate: number | null | undefined, digits?: number): string {
  if (rate === null || rate === undefined || Number.isNaN(rate)) return "—"
  const pct = rate * 100
  const d = digits ?? (pct !== 0 && Math.abs(pct) < 0.1 ? 2 : pct === Math.round(pct) ? 0 : 1)
  return `${pct.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d })}${NBSP}%`
}

/** Position moyenne → « 17,6 ». */
export function fmtPosition(position: number | null | undefined): string {
  if (position === null || position === undefined || Number.isNaN(position)) return "—"
  return position.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

/** Millisecondes → « 2,7 s ». */
export function fmtSeconds(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return "—"
  return `${(ms / 1000).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}${NBSP}s`
}

/** Octets → « 69 Ko ». */
export function fmtKilobytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return "—"
  return `${Math.round(bytes / 1024).toLocaleString("fr-FR")}${NBSP}Ko`
}

/** Euros → « 3,11 € ». */
export function fmtCpc(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—"
  return `${value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${NBSP}€`
}

export type Trend = "up" | "down" | "flat" | "none"

export interface Delta {
  /** Texte de l'évolution (« +102 % », « +0,4 pt », « 2,3 places de mieux »). */
  text: string
  /** Sens pour la couleur et l'icône : up = mieux, down = moins bien. */
  trend: Trend
}

/** Évolution d'un volume (clics, impressions) en pourcentage. */
export function deltaCount(current: number, previous: number): Delta {
  if (previous === 0 && current === 0) return { text: "—", trend: "none" }
  if (previous === 0) return { text: "nouveau", trend: "up" }
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0) return { text: "stable", trend: "flat" }
  return { text: `${pct > 0 ? "+" : "−"}${Math.abs(pct).toLocaleString("fr-FR")}${NBSP}%`, trend: pct > 0 ? "up" : "down" }
}

/** Évolution d'un taux (taux de clic) en points. */
export function deltaRate(current: number | null, previous: number | null): Delta {
  if (current === null || previous === null) return { text: "—", trend: "none" }
  const pts = Math.round((current - previous) * 1000) / 10
  if (pts === 0) return { text: "stable", trend: "flat" }
  return {
    text: `${pts > 0 ? "+" : "−"}${Math.abs(pts).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}${NBSP}pt`,
    trend: pts > 0 ? "up" : "down",
  }
}

/** Évolution d'une position : une position plus petite est meilleure. */
export function deltaPosition(current: number | null, previous: number | null): Delta {
  if (current === null || previous === null) return { text: "—", trend: "none" }
  const diff = Math.round((previous - current) * 10) / 10
  if (diff === 0) return { text: "stable", trend: "flat" }
  const n = Math.abs(diff).toLocaleString("fr-FR", { maximumFractionDigits: 1 })
  const places = Math.abs(diff) >= 2 ? "places" : "place"
  return diff > 0 ? { text: `${n}${NBSP}${places} de mieux`, trend: "up" } : { text: `${n}${NBSP}${places} de moins bien`, trend: "down" }
}

/** Taux de clic d'un couple clics / impressions (null sans impression). */
export function ctrOf(clicks: number, impressions: number): number | null {
  return impressions > 0 ? clicks / impressions : null
}

const MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]

/** « 2026-10-04 » → « 4 oct. » (avec l'année si `withYear`). */
export function fmtDay(iso: string, withYear = false): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number)
  if (!y || !m || !d) return "—"
  return `${d === 1 ? "1er" : d}${NBSP}${MONTHS_SHORT[m - 1]}${withYear ? `${NBSP}${y}` : ""}`
}

/** « 7 sept. – 4 oct. 2026 ». */
export function fmtRange(from: string, to: string): string {
  const sameYear = from.slice(0, 4) === to.slice(0, 4)
  return `${fmtDay(from, !sameYear)}${NBSP}– ${fmtDay(to, true)}`
}

export { NBSP, NNBSP }
