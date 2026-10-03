/**
 * Retenue de garantie des marchés de travaux privés.
 *
 * Loi n° 71-584 du 16 juillet 1971, art. 1er : les paiements des acomptes sur
 * la valeur définitive des marchés de travaux privés (art. 1779-3° du code
 * civil) peuvent être amputés d'une retenue égale au plus à 5 % de leur
 * montant, qui garantit la levée des réserves faites à la réception. Elle n'est
 * pas pratiquée si l'entrepreneur fournit, pour le même montant, une caution
 * personnelle et solidaire d'un établissement financier.
 * https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000039280616
 *
 * Art. 2 : à l'expiration du délai d'une année à compter de la réception,
 * faite avec ou sans réserve, la caution est libérée ou les sommes consignées
 * sont versées à l'entrepreneur, même en l'absence de mainlevée, si le maître
 * de l'ouvrage n'a pas notifié, par lettre recommandée, son opposition motivée
 * par l'inexécution des obligations de l'entrepreneur.
 * https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000006474230
 *
 * Facture électronique : la retenue ne change ni le total TTC ni le montant
 * dû déclaré (BT-112, BT-115) ; elle est portée en note, code sujet « ABU »
 * (UNTDID 4451), et le paiement arrive en deux fois (à l'échéance, puis à la
 * libération). C'est la lecture publique du cas d'usage n° 26 de la norme
 * AFNOR XP Z12-014 (https://www.infos-pa.com/cas-d-usage/clause-reserve-contractuelle).
 * Ici, le PDF et l'aperçu montrent en plus ce qui est à régler à l'échéance
 * (TTC moins la retenue) ; le XML ne déclare rien d'autre que la note.
 */
import { formatEurosFr, formatPercentFr, fromCents, percentOf, toCents } from "./money"
import { longDateFr, type RetentionApplied } from "./billing"

/** Taux maximal de la retenue (loi n° 71-584, art. 1er). */
export const RETENTION_MAX_RATE = 5

export type RetentionMode = "retenue" | "caution" | "aucune"

export const RETENTION_LAW = "loi n° 71-584 du 16 juillet 1971"

/** Taux valide : nombre entre 0 et 5, deux décimales au plus. */
export function parseRetentionRate(value: unknown): number | null {
  const n = typeof value === "string" ? parseFloat(value.replace(",", ".")) : Number(value)
  if (!Number.isFinite(n) || n < 0 || n > RETENTION_MAX_RATE) return null
  return Math.round(n * 100) / 100
}

export function parseRetentionMode(value: unknown): RetentionMode {
  return value === "retenue" || value === "caution" ? value : "aucune"
}

/**
 * Retenue appliquée à une facture : `rate` % de son montant TTC (le
 * « montant » des paiements, art. 1er). Caution bancaire : rien n'est retenu,
 * la facture le mentionne. Aucune retenue : null.
 */
export function applyRetention(ttcCents: number, mode: RetentionMode, rate: number): RetentionApplied | null {
  if (mode === "aucune") return null
  const r = parseRetentionRate(rate)
  if (r === null || r === 0) return mode === "caution" ? { rate: 0, mode: "caution", amount: 0, base_ttc: fromCents(ttcCents) } : null
  if (mode === "caution") return { rate: r, mode: "caution", amount: 0, base_ttc: fromCents(ttcCents) }
  const amount = Math.max(0, percentOf(Math.max(0, ttcCents), r))
  return { rate: r, mode: "retenue", amount: fromCents(amount), base_ttc: fromCents(ttcCents) }
}

/** Montant à régler à l'échéance : TTC moins la retenue (centimes). */
export function dueAtTermCents(totalTtc: unknown, retentionAmount: unknown): number {
  return Math.max(0, toCents(totalTtc) - Math.max(0, toCents(retentionAmount)))
}

/** Note du XML (code sujet ABU) et mention imprimée. */
export function retentionNote(r: RetentionApplied | null | undefined): string | null {
  if (!r) return null
  if (r.mode === "caution") {
    return `Retenue de garantie remplacée par une caution bancaire personnelle et solidaire (${RETENTION_LAW}, art. 1er).`
  }
  if (!(r.amount > 0)) return null
  return `Retenue de garantie de ${formatPercentFr(r.rate)} % (${RETENTION_LAW}) : ${formatEurosFr(toCents(r.amount))} TTC retenus sur cette facture, `
    + `payables à la libération de la garantie, un an après la réception des travaux, sauf opposition motivée notifiée par lettre recommandée (art. 2).`
}

/** Date de libération : un an après la réception (AAAA-MM-JJ). 29 février → 1er mars. */
export function releaseDate(receptionDate: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(receptionDate ?? "")
  if (!m) return null
  const y = Number(m[1]) + 1
  const mo = Number(m[2])
  let d = Number(m[3])
  let month = mo
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate()
  if (d > last) { d = 1; month = mo + 1 }
  return `${y}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}

export type RetentionStatus =
  | { state: "none" }
  | { state: "awaiting_reception"; held: number }
  | { state: "pending"; held: number; releaseDate: string }
  | { state: "releasable"; held: number; releaseDate: string }
  | { state: "released"; held: number; releasedAt: string }

/**
 * Où en est la retenue d'un chantier : rien de retenu, en attente de la
 * réception, libérable à une date, libérable depuis, ou libérée (encaissée).
 * `held` : montant retenu (centimes).
 */
export function retentionStatus(heldCents: number, receptionDate: string | null | undefined, releasedAt: string | null | undefined, today: string): RetentionStatus {
  if (heldCents <= 0) return { state: "none" }
  if (releasedAt) return { state: "released", held: heldCents, releasedAt: releasedAt.slice(0, 10) }
  const date = releaseDate(receptionDate)
  if (!date) return { state: "awaiting_reception", held: heldCents }
  return date <= today ? { state: "releasable", held: heldCents, releaseDate: date } : { state: "pending", held: heldCents, releaseDate: date }
}

/** Phrase d'état pour l'écran du chantier. */
export function retentionStatusText(s: RetentionStatus): string {
  switch (s.state) {
    case "none": return "Aucune retenue sur les factures émises."
    case "awaiting_reception": return "Libérable un an après la réception des travaux : renseignez la date de réception."
    case "pending": return `Libérable le ${longDateFr(s.releaseDate)}, sauf opposition motivée du client par lettre recommandée.`
    case "releasable": return `Libérable depuis le ${longDateFr(s.releaseDate)}, sauf opposition motivée notifiée avant cette date.`
    case "released": return `Libérée le ${longDateFr(s.releasedAt)}.`
  }
}
