/**
 * IBAN et BIC : normalisation et contrôle, sans réseau. Module pur, utilisable
 * côté serveur (lien de paiement, page de règlement) comme dans le navigateur
 * (Paramètres › Entreprise).
 *
 * Sources :
 * - IBAN : norme ISO 13616-1 (clé de contrôle « mod 97-10 » de l'ISO 7064),
 *   longueurs par pays du registre IBAN de SWIFT, autorité d'enregistrement de
 *   la norme (https://www.swift.com/standards/data-standards/iban-international-bank-account-number).
 * - Pays de la zone SEPA : liste EPC409-09 du Conseil européen des paiements,
 *   version 7.0 du 22 mai 2025, colonne « IBAN »
 *   (https://www.europeanpaymentscouncil.eu/sites/default/files/kb/file/2025-05/EPC409-09%20EPC%20List%20of%20SEPA%20Scheme%20Countries%20v7.0.pdf).
 *   Les départements et collectivités d'outre-mer utilisent des IBAN « FR »,
 *   Guernesey, Jersey et l'île de Man des IBAN « GB ».
 * - BIC : norme ISO 9362 (8 ou 11 caractères : 4 pour l'établissement, 2 lettres
 *   pour le pays, 2 pour la localisation, 3 facultatifs pour l'agence).
 */

/** Longueur de l'IBAN des pays et territoires de la zone SEPA (registre SWIFT). */
export const SEPA_IBAN_LENGTHS: Readonly<Record<string, number>> = {
  AD: 24, AL: 28, AT: 20, BE: 16, BG: 22, CH: 21, CY: 28, CZ: 24, DE: 22, DK: 18,
  EE: 20, ES: 24, FI: 18, FR: 27, GB: 22, GI: 23, GR: 27, HR: 21, HU: 28, IE: 22,
  IS: 26, IT: 27, LI: 21, LT: 20, LU: 20, LV: 21, MC: 27, MD: 24, ME: 22, MK: 19,
  MT: 31, NL: 18, NO: 15, PL: 28, PT: 25, RO: 24, RS: 22, SE: 24, SI: 19, SK: 24,
  SM: 27, VA: 22,
}

/** Sans espaces ni tirets, en majuscules : « fr76 3000… » → « FR763000… ». */
export function normalizeIban(value: string | null | undefined): string {
  return (value ?? "").replace(/[\s-]+/g, "").toUpperCase()
}

/** Reste de la division par 97 d'un grand nombre écrit en chiffres (calcul par tranches). */
function mod97(digits: string): number {
  let rest = 0
  for (let i = 0; i < digits.length; i += 7) {
    rest = Number(`${rest}${digits.slice(i, i + 7)}`) % 97
  }
  return rest
}

/**
 * Clé ISO 13616 : les 4 premiers caractères passent à la fin, chaque lettre
 * devient un nombre (A = 10 … Z = 35), et le tout doit valoir 1 modulo 97.
 */
function checksumOk(iban: string): boolean {
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  const digits = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55))
  return mod97(digits) === 1
}

/**
 * IBAN valide : structure (pays, clé à deux chiffres, 11 à 30 caractères
 * alphanumériques), longueur du pays quand il est de la zone SEPA, clé mod 97.
 */
export function isValidIban(value: string | null | undefined): boolean {
  const iban = normalizeIban(value)
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false
  const expected = SEPA_IBAN_LENGTHS[iban.slice(0, 2)]
  if (expected !== undefined && iban.length !== expected) return false
  return checksumOk(iban)
}

/** IBAN valide d'un pays de la zone SEPA : seul cas où un virement SEPA (et son QR code) est possible. */
export function isSepaIban(value: string | null | undefined): boolean {
  const iban = normalizeIban(value)
  return iban.slice(0, 2) in SEPA_IBAN_LENGTHS && isValidIban(iban)
}

/** Message d'erreur d'un IBAN saisi, ou null s'il est valide. */
export function ibanError(value: string | null | undefined): string | null {
  const iban = normalizeIban(value)
  if (!iban) return null
  if (!/^[A-Z]{2}\d{2}/.test(iban)) return "Un IBAN commence par le code du pays et deux chiffres (FR76…)"
  const expected = SEPA_IBAN_LENGTHS[iban.slice(0, 2)]
  if (expected !== undefined && iban.length !== expected) {
    return `Un IBAN ${iban.slice(0, 2)} compte ${expected} caractères (${iban.length} saisis)`
  }
  if (!isValidIban(iban)) return "IBAN invalide : vérifiez les caractères (clé de contrôle)"
  return null
}

/** IBAN groupé par quatre caractères : « FR76 3000 6000 … ». */
export function formatIbanGroups(value: string): string {
  return normalizeIban(value).replace(/(.{4})/g, "$1 ").trim()
}

/** Sans espaces, en majuscules. */
export function normalizeBic(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, "").toUpperCase()
}

/** BIC ISO 9362 : 8 ou 11 caractères, le pays en lettres aux positions 5 et 6. */
export function isValidBic(value: string | null | undefined): boolean {
  return /^[A-Z0-9]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(normalizeBic(value))
}

/** Message d'erreur d'un BIC saisi, ou null s'il est valide ou vide. */
export function bicError(value: string | null | undefined): string | null {
  const bic = normalizeBic(value)
  if (!bic) return null
  if (bic.length !== 8 && bic.length !== 11) return `Un BIC compte 8 ou 11 caractères (${bic.length} saisis)`
  if (!isValidBic(bic)) return "BIC invalide : 4 caractères pour la banque, puis le code du pays (FR)…"
  return null
}
