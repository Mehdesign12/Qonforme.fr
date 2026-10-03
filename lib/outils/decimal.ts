/**
 * Calcul décimal exact des outils gratuits, sur des entiers (centimes,
 * millièmes) plutôt que sur des flottants : 9 € HT à 5,5 % donnent bien
 * 0,50 € de TVA (et non 0,49 €), 1,005 € s'arrondit à 1,01 €.
 *
 * Pas de BigInt (absent de Safari avant la version 14) : les appelants bornent
 * les montants pour rester sous Number.MAX_SAFE_INTEGER.
 */

/** Écriture décimale positionnelle de |n| (jamais de notation exponentielle). */
function ecritureDecimale(n: number): string {
  const s = String(Math.abs(n))
  if (!/e/i.test(s)) return s
  // 1e-7 → « 0.0000001 » ; les très grands nombres sont refusés plus haut
  return Math.abs(n).toFixed(20).replace(/0+$/, "").replace(/\.$/, "")
}

/**
 * Entier égal à n × 10^d, arrondi au plus proche, le demi loin de zéro (règle
 * commerciale), d'après l'écriture décimale de n : 1.005 → 101 centimes, là où
 * Math.round(1.005 * 100) donne 100.
 */
export function versEntier(n: number, d: number): number {
  if (!Number.isFinite(n)) throw new RangeError("Nombre non fini")
  const [ent, frac = ""] = ecritureDecimale(n).split(".")
  const chiffres = frac.padEnd(d + 1, "0")
  let v = Number(ent + chiffres.slice(0, d))
  if (Number(chiffres[d]) >= 5) v += 1
  if (!Number.isSafeInteger(v)) throw new RangeError("Nombre trop grand")
  return n < 0 && v !== 0 ? -v : v
}

/** Vrai si n s'écrit avec au plus d décimales (12,5 : oui pour d = 2 ; 10,255 : non). */
export function aAuPlusDecimales(n: number, d: number): boolean {
  try {
    return versEntier(n, d) / 10 ** d === n
  } catch {
    return false
  }
}

/**
 * Division entière arrondie au plus proche, le demi loin de zéro.
 * `den` est strictement positif ; `num` et `den` sont des entiers sûrs.
 */
export function divArrondi(num: number, den: number): number {
  const a = Math.abs(num)
  let q = Math.floor(a / den)
  let r = a - q * den
  // Corrige un éventuel écart d'une unité de la division flottante
  while (r < 0) { q -= 1; r += den }
  while (r >= den) { q += 1; r -= den }
  if (2 * r >= den) q += 1
  return num < 0 && q !== 0 ? -q : q
}

/** Montant en euros (nombre) à partir de centimes entiers : 950 → 9.5. */
export function centimesVersEuros(c: number): number {
  return c / 100
}

/**
 * « 1 234,56 € » à partir de centimes entiers, sans passer par un flottant.
 * `espace` sépare les milliers et précède le symbole (U+00A0 par défaut).
 */
export function formatCentimes(c: number, { espace = " ", symbole = "€" }: { espace?: string; symbole?: string } = {}): string {
  const neg = c < 0
  const abs = Math.abs(c)
  const ent = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, espace)
  const dec = String(abs % 100).padStart(2, "0")
  return `${neg ? "−" : ""}${ent},${dec}${symbole ? `${espace}${symbole}` : ""}`
}

/** Nombre à la française, sans zéros inutiles : 12.5 → « 12,5 », 5.5 → « 5,5 », 3 → « 3 ». */
export function formatNombreFr(n: number, maxDecimales = 3): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: maxDecimales, useGrouping: true }).replace(/ /g, " ")
}
