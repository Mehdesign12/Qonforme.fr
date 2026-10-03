/**
 * Dates calendaires « AAAA-MM-JJ » en heure de Paris, pour tout ce qui dépend
 * du jour : retard d'une facture, date d'émission, planning des relances.
 *
 * Les serveurs tournent en UTC : `new Date().toISOString().slice(0, 10)` donne
 * encore la veille entre minuit et 1 h (2 h l'été) à Paris, et une facture
 * échue « aujourd'hui » passerait en retard une à deux heures trop tôt ou trop
 * tard. Les calculs entre deux dates se font en UTC pur, sans dérive d'heure d'été.
 *
 * Module pur, sans réseau : utilisable côté serveur, navigateur et tests.
 */

/** Aujourd'hui à Paris (AAAA-MM-JJ), heure d'été comprise. */
export function todayInParis(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now)
}

/** Jour (AAAA-MM-JJ, heure de Paris) d'un horodatage ISO ; une date seule est rendue telle quelle. */
export function parisDayOf(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value.slice(0, 10) : todayInParis(date)
}

function utcOf(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number)
  return Date.UTC(y, m - 1, d)
}

/** Décale une date AAAA-MM-JJ de `days` jours. */
export function addDays(iso: string, days: number): string {
  return new Date(utcOf(iso) + days * 86_400_000).toISOString().slice(0, 10)
}

/** Jours calendaires de `from` à `to` (positif si `to` est après). */
export function daysBetween(from: string, to: string): number {
  return Math.round((utcOf(to) - utcOf(from)) / 86_400_000)
}

/** Vrai si la chaîne est une date calendaire valide « AAAA-MM-JJ ». */
export function isIsoDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  return new Date(utcOf(value)).toISOString().slice(0, 10) === value
}
