/**
 * Lecture des nombres saisis dans les outils gratuits, à la française comme à
 * l'anglaise : « 1 234,56 », « 1 234,56 » (espace insécable), « 1.234,56 »,
 * « 1234.56 », « 1,234.56 », « 12,5 ».
 *
 * `parseFloat("1.234,56")` donnait 1,234 et un champ `type="number"` lisait
 * « 12,5 » comme 125 : les outils passent tous par ces deux fonctions.
 */

/** Espaces (y compris insécables et fines), apostrophes de groupement, symbole € et unité %. */
const SEPARATEURS_IGNORES = /[\s   '’]|€|%$/g

/** Groupes de milliers valides : 1 à 3 chiffres, puis des groupes de 3. */
function groupesValides(groupes: string[]): boolean {
  return /^\d{1,3}$/.test(groupes[0]) && groupes.slice(1).every((g) => /^\d{3}$/.test(g))
}

function lire(saisie: string, milliersAuPointSeul: boolean): number | null {
  if (typeof saisie !== "string") return null
  let s = saisie.trim().replace(SEPARATEURS_IGNORES, "")
  let signe = 1
  if (/^[-−]/.test(s)) { signe = -1; s = s.slice(1) }
  else if (s.startsWith("+")) s = s.slice(1)
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null

  const nbPoints = (s.match(/\./g) ?? []).length
  const nbVirgules = (s.match(/,/g) ?? []).length
  let entier: string
  let decimales = ""

  if (nbPoints > 0 && nbVirgules > 0) {
    // Les deux : le dernier séparateur est la virgule décimale, l'autre groupe les milliers
    const dec = s.lastIndexOf(".") > s.lastIndexOf(",") ? "." : ","
    const mil = dec === "." ? "," : "."
    const [avant, apres, ...reste] = s.split(dec)
    if (reste.length || apres.includes(mil) || !groupesValides(avant.split(mil))) return null
    entier = avant.split(mil).join("")
    decimales = apres
  } else if (nbPoints + nbVirgules === 0) {
    entier = s
  } else {
    const sep = nbPoints > 0 ? "." : ","
    const parts = s.split(sep)
    if (parts.length > 2) {
      // « 1.234.567 » ou « 1,234,567 » : séparateurs de milliers
      if (!groupesValides(parts)) return null
      entier = parts.join("")
    } else if (sep === "." && milliersAuPointSeul && /^[1-9]\d{0,2}$/.test(parts[0]) && /^\d{3}$/.test(parts[1])) {
      // « 1.234 » ou « 12.500 » : en France, point des milliers (1 234 €)
      entier = parts.join("")
    } else {
      entier = parts[0]
      decimales = parts[1]
    }
  }
  if (entier === "" && decimales === "") return null
  const n = Number(`${entier || "0"}.${decimales || "0"}`)
  if (!Number.isFinite(n)) return null
  return n === 0 ? 0 : signe * n
}

/**
 * Montant en euros. Une virgule seule est décimale (« 12,5 » → 12,5) ; un point
 * seul suivi de trois chiffres groupe les milliers (« 1.234 » → 1 234), sinon
 * il est décimal (« 12.5 » → 12,5 ; « 0.125 » → 0,125). Renvoie null si la
 * saisie n'est pas un nombre (vide, lettres, séparateurs mal placés).
 */
export function parseMontant(saisie: string): number | null {
  return lire(saisie, true)
}

/**
 * Quantité ou taux : un séparateur seul, point ou virgule, est toujours décimal
 * (« 1.5 » → 1,5 ; « 2,125 » → 2,125). Les espaces de milliers sont acceptés.
 */
export function parseNombre(saisie: string): number | null {
  return lire(saisie, false)
}

/** Caractères acceptés pendant la frappe dans un champ de montant. */
export function filtrerSaisieMontant(v: string): string {
  return v.replace(/[^0-9.,\s  -]/g, "")
}
