/**
 * Montants au centime, en entiers : aucun calcul de l'offre Artisan (acomptes,
 * situations, retenue de garantie) ne passe par des euros à virgule flottante.
 */

/** Euros (nombre ou texte de la base) → centimes entiers. Valeur illisible : 0. */
export function toCents(value: unknown): number {
  const n = typeof value === "string" ? parseFloat(value) : Number(value)
  if (!Number.isFinite(n)) return 0
  return roundHalfAwayFromZero(n * 100)
}

/** Centimes → euros (deux décimales exactes). */
export function fromCents(cents: number): number {
  return Math.round(cents) / 100
}

/**
 * Arrondi commercial : la moitié s'éloigne de zéro (2,5 → 3 ; −2,5 → −3).
 * `Math.round` arrondit −2,5 à −2, ce qui décalerait une ligne de déduction
 * d'un centime par rapport à la ligne qu'elle reprend.
 */
export function roundHalfAwayFromZero(n: number): number {
  // Corrige les représentations binaires du type 2,4999999999 pour 2,5
  const fixed = Math.round(n * 1e6) / 1e6
  return Math.sign(fixed) * Math.round(Math.abs(fixed))
}

/** Taux en pourcentage → centièmes de point entiers (5,5 → 550), pour des produits exacts. */
export function rateBasisPoints(rate: number): number {
  return Math.round((Number(rate) || 0) * 100)
}

/** TVA d'un montant HT en centimes, au taux donné (en %), arrondie au centime. */
export function vatOfCents(htCents: number, rate: number): number {
  return roundHalfAwayFromZero((htCents * rateBasisPoints(rate)) / 10_000)
}

/** `cents × numerator / denominator`, arrondi au centime (règle de trois exacte). */
export function prorata(cents: number, numerator: number, denominator: number): number {
  if (denominator === 0) return 0
  return roundHalfAwayFromZero((cents * numerator) / denominator)
}

/** `cents × percent / 100` pour un pourcentage à deux décimales au plus. */
export function percentOf(cents: number, percent: number): number {
  return prorata(cents, Math.round(percent * 100), 10_000)
}

/**
 * Répartit `total` centimes proportionnellement aux poids (plus forts restes) :
 * la somme des parts vaut exactement `total`. Poids nuls partout : tout sur le premier.
 */
export function allocateCents(total: number, weights: number[]): number[] {
  if (weights.length === 0) return []
  const sum = weights.reduce((s, w) => s + Math.max(0, w), 0)
  if (sum <= 0) return weights.map((_, i) => (i === 0 ? total : 0))
  const raw = weights.map((w) => (total * Math.max(0, w)) / sum)
  const parts = raw.map((r) => Math.floor(r))
  let rest = total - parts.reduce((s, p) => s + p, 0)
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (let k = 0; rest > 0 && k < order.length; k++, rest--) parts[order[k].i] += 1
  return parts
}

/** « 1 234,56 € » (espace insécable), pour les libellés générés côté serveur. */
export function formatEurosFr(cents: number): string {
  const sign = cents < 0 ? "−" : ""
  const abs = Math.abs(Math.round(cents))
  const int = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")
  return `${sign}${int},${String(abs % 100).padStart(2, "0")} €`
}

/** « 30 », « 12,5 » : pourcentage à la française, sans zéros inutiles. */
export function formatPercentFr(percent: number): string {
  const r = Math.round(percent * 100) / 100
  return String(r).replace(".", ",")
}
