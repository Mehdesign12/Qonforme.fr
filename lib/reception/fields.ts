/**
 * Petites lectures communes aux formats CII et UBL : montants, dates,
 * identifiants d'entreprise. Fonctions pures.
 */
import type { ReceivedParty } from "@/lib/reception/types"

/** Montant ou quantité décimale (« 1234.56 », « -50 ») ; null si absent ou illisible. */
export function num(value: string | null | undefined): number | null {
  if (value == null) return null
  const v = value.trim()
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(v)) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Arrondi au centime, sans les erreurs de virgule flottante (0,1 + 0,2). */
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** Vrai si la date AAAA-MM-JJ existe au calendrier. */
export function isRealDate(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return false
  const y = +m[1], mo = +m[2], d = +m[3]
  if (y < 1900 || y > 2200 || mo < 1 || mo > 12 || d < 1) return false
  const days = new Date(Date.UTC(y, mo, 0)).getUTCDate()
  return d <= days
}

/** Date CII (format 102 « AAAAMMJJ ») ou ISO (« AAAA-MM-JJ », UBL) vers AAAA-MM-JJ. */
export function isoDate(value: string | null | undefined): string | null {
  if (!value) return null
  const v = value.trim()
  let iso: string | null = null
  if (/^\d{8}$/.test(v)) iso = `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`
  else if (/^\d{4}-\d{2}-\d{2}/.test(v)) iso = v.slice(0, 10)
  return iso && isRealDate(iso) ? iso : null
}

const digits = (s: string | null | undefined) => (s ?? "").replace(/[\s.\-]/g, "")

/** SIREN à 9 chiffres, ou null. */
export function asSiren(value: string | null | undefined): string | null {
  const d = digits(value)
  return /^\d{9}$/.test(d) ? d : null
}

/** SIRET à 14 chiffres, ou null. */
export function asSiret(value: string | null | undefined): string | null {
  const d = digits(value)
  return /^\d{14}$/.test(d) ? d : null
}

/** N° de TVA intracommunautaire nettoyé (« FR32948211375 »). */
export function asVat(value: string | null | undefined): string | null {
  const v = (value ?? "").replace(/\s+/g, "").toUpperCase()
  return /^[A-Z]{2}[0-9A-Z+*.]{2,13}$/.test(v) ? v : null
}

/**
 * SIREN d'une partie, d'après la source la plus sûre :
 * identifiant légal (schéma 0002), SIRET (14 chiffres, les 9 premiers sont le
 * SIREN), n° de TVA français (FR + clé à 2 caractères + SIREN), adresse
 * électronique de schéma 0225 (« SIREN » ou « SIREN_SUFFIXE », norme AFNOR
 * XP Z12-012, règles BR-FR-12/13).
 */
export function deriveSiren(p: Pick<ReceivedParty, "siren" | "siret" | "vat_number" | "electronic_address">): string | null {
  if (p.siren) return p.siren
  if (p.siret) return p.siret.slice(0, 9)
  const vat = p.vat_number ?? ""
  const fr = /^FR[0-9A-Z]{2}(\d{9})$/.exec(vat)
  if (fr) return fr[1]
  const ea = /^0225:(\d{9})(?:\D|$)/.exec(p.electronic_address ?? "")
  if (ea) return ea[1]
  return null
}

/** Texte nettoyé et borné (les champs d'un fichier hostile peuvent être immenses). */
export function clip(value: string | null | undefined, max = 500): string | null {
  if (value == null) return null
  const v = value.replace(/\s+/g, " ").trim()
  if (!v) return null
  return v.length > max ? `${v.slice(0, max - 1)}…` : v
}

/** Texte multiligne nettoyé et borné (notes). */
export function clipBlock(value: string | null | undefined, max = 4000): string | null {
  if (value == null) return null
  const v = value.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim()
  if (!v) return null
  return v.length > max ? `${v.slice(0, max - 1)}…` : v
}
