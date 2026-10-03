/**
 * Générateur de numéro de facture : formats proposés et validation des saisies
 * (préfixe, année, compteur). La règle de fond : « un numéro unique basé sur une
 * séquence chronologique et continue » (CGI, annexe II, art. 242 nonies A, I-7°).
 */

export const FORMATS_NUMERO = [
  { id: "standard", label: "F-AAAA-NNN", example: "F-2026-001", desc: "Préfixe, année et compteur", prefixe: true, mois: false },
  { id: "compact", label: "AAAAMMNNN", example: "202604001", desc: "Année, mois et compteur, sans séparateur", prefixe: false, mois: true },
  { id: "prefix", label: "PRE-NNN", example: "FAC-001", desc: "Préfixe et compteur", prefixe: true, mois: false },
  { id: "full", label: "PRE-AAAA-MM-NNN", example: "FAC-2026-04-001", desc: "Préfixe, année, mois et compteur", prefixe: true, mois: true },
] as const

export type FormatNumero = (typeof FORMATS_NUMERO)[number]["id"]

export interface ParametresNumero {
  format: FormatNumero
  prefixe: string
  annee: string
  /** « 01 » à « 12 ». */
  mois: string
  compteur: string
  chiffres: number
}

export interface ErreursNumero {
  prefixe?: string
  annee?: string
  compteur?: string
}

const PREFIXE = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/

export function validerParametresNumero(p: ParametresNumero): ErreursNumero {
  const f = FORMATS_NUMERO.find((x) => x.id === p.format)!
  const e: ErreursNumero = {}
  const usesAnnee = p.format !== "prefix"
  if (f.prefixe) {
    if (!p.prefixe.trim()) e.prefixe = "Saisissez un préfixe, par exemple F ou FAC."
    else if (p.prefixe.length > 12 || !PREFIXE.test(p.prefixe)) e.prefixe = "Lettres et chiffres, tirets entre deux groupes, 12 caractères au plus."
  }
  if (usesAnnee && !/^\d{4}$/.test(p.annee)) e.annee = "Année sur 4 chiffres, par exemple 2026."
  else if (usesAnnee && (Number(p.annee) < 2000 || Number(p.annee) > 2099)) e.annee = "Année entre 2000 et 2099."
  if (!/^\d+$/.test(p.compteur.trim())) e.compteur = "Nombre entier positif, par exemple 1."
  else if (Number(p.compteur) < 1) e.compteur = "Le compteur commence à 1."
  else if (p.compteur.trim().length > 9) e.compteur = "9 chiffres au plus."
  return e
}

/** Les `n` numéros à partir du compteur saisi, ou [] si une saisie est invalide. */
export function genererNumeros(p: ParametresNumero, n = 1): string[] {
  if (Object.keys(validerParametresNumero(p)).length) return []
  const depart = Number(p.compteur)
  return Array.from({ length: n }, (_, i) => {
    const c = String(depart + i).padStart(p.chiffres, "0")
    switch (p.format) {
      case "standard": return `${p.prefixe}-${p.annee}-${c}`
      case "compact": return `${p.annee}${p.mois}${c}`
      case "prefix": return `${p.prefixe}-${c}`
      case "full": return `${p.prefixe}-${p.annee}-${p.mois}-${c}`
    }
  })
}
