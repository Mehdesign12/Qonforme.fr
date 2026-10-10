/**
 * Date de paiement d'une facture (`invoices.paid_at`) : écrite quand
 * l'artisan marque la facture payée, effacée s'il revient sur ce statut
 * (paiement saisi par erreur, lib/utils/document-status.ts : paid → sent ou overdue).
 *
 * C'est elle qui fait l'« encaissé » du tableau de bord : une facture marquée
 * payée sans date n'y est jamais comptée, plutôt que d'être comptée au mauvais
 * mois. Fonction pure, testée dans __tests__/payment-date.test.ts.
 */
import { addDays, isIsoDay } from "@/lib/utils/paris-date"

/** Un virement peut précéder la facture (acompte réglé sur place), dans cette limite (lib/payment-link/rules.ts). */
export const PAID_BEFORE_ISSUE_DAYS = 60

export type PaidAtChange =
  /** Rien à écrire. */
  | { ok: true; value: undefined }
  /** Horodatage ISO à écrire, ou null pour effacer. */
  | { ok: true; value: string | null }
  | { ok: false; error: string }

/**
 * Valeur de `paid_at` pour un changement de statut `from` → `to`.
 * `requested` : jour « AAAA-MM-JJ » choisi par l'artisan (date du virement),
 * sinon aujourd'hui. Un jour passé est enregistré à midi UTC, qui reste le
 * même jour à l'heure de Paris ; aujourd'hui, à l'instant présent.
 */
export function paidAtChange(params: {
  from: string
  to: string
  requested?: unknown
  issueDate?: string | null
  today: string
  now: Date
}): PaidAtChange {
  const { from, to, requested, issueDate, today, now } = params
  if (to === "paid" && from !== "paid") {
    if (requested === undefined || requested === null || requested === "") return { ok: true, value: now.toISOString() }
    if (!isIsoDay(requested)) return { ok: false, error: "Indiquez la date du paiement." }
    if (requested > today) return { ok: false, error: "La date du paiement ne peut pas être dans le futur." }
    const earliest = issueDate ? addDays(issueDate.slice(0, 10), -PAID_BEFORE_ISSUE_DAYS) : null
    if (earliest && requested < earliest) {
      return { ok: false, error: "Cette date est bien antérieure à la facture : vérifiez la date du paiement." }
    }
    return { ok: true, value: requested === today ? now.toISOString() : `${requested}T12:00:00.000Z` }
  }
  if (from === "paid" && to !== "paid") return { ok: true, value: null }
  return { ok: true, value: undefined }
}
