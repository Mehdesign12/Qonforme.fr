/**
 * Fenêtre « Bienvenue » (components/onboarding/InscriptionDialog.tsx) — calculs
 * purs : affichage d'une entreprise du répertoire Sirene, n° de TVA proposé,
 * prénom d'un entrepreneur individuel, enchaînement des étapes, et champ
 * fautif d'une saisie à la main. Testés dans __tests__/inscription-dialog.test.ts.
 */
import {
  INSCRIPTION_LIMITS, SIREN_INVALID, inscriptionSteps,
  type CompanyInput, type InscriptionStep,
} from "@/lib/onboarding/inscription"
import { isValidSiren, sirenToVAT } from "@/lib/utils/invoice"
import type { SireneCandidate } from "@/lib/utils/sirene"

/** Recherche lancée à partir de 3 caractères, 300 ms après la dernière frappe. */
export const SEARCH_MIN = 3
export const SEARCH_DEBOUNCE_MS = 300

export const SEARCH_UNAVAILABLE =
  "Le répertoire Sirene ne répond pas. Réessayez dans un instant ou saisissez votre entreprise à la main."

/** Écran de la fenêtre : une étape de l'inscription, puis « Votre espace est prêt ». */
export type InscriptionView = InscriptionStep | "done"

/** Entreprise enregistrée, telle que la page la transmet à la fenêtre. */
export interface InscriptionCompany {
  name: string
  siren: string | null
  address: string
  zip_code: string
  city: string
}

const NBSP = "\u00a0"

/** « 948211375 » → « 948 211 375 » (espaces insécables) ; tel quel s'il n'a pas 9 chiffres. */
export function groupSiren(siren: string | null | undefined): string {
  const digits = (siren ?? "").replace(/\D/g, "")
  if (digits.length !== 9) return siren ?? ""
  return `${digits.slice(0, 3)}${NBSP}${digits.slice(3, 6)}${NBSP}${digits.slice(6)}`
}

/**
 * N° de TVA intracommunautaire calculé depuis le SIREN, affiché « à vérifier »
 * à l'étape métier (« FR12 948 211 375 ») ; null sans SIREN valide. La démo
 * utilise des SIREN volontairement invalides : `allowInvalidKey` y garde l'aperçu.
 */
export function vatNumberPreview(siren: string | null | undefined, allowInvalidKey = false): string | null {
  const digits = (siren ?? "").replace(/\D/g, "")
  if (!/^\d{9}$/.test(digits)) return null
  if (!allowInvalidKey && !isValidSiren(digits)) return null
  return `${sirenToVAT(digits).slice(0, 4)}${NBSP}${groupSiren(digits)}`
}

// Constructeur plutôt que littéral : le drapeau « u » n'est pas accepté par la cible TypeScript par défaut
const WORD_START = new RegExp("(^|[\\s'’-])(\\p{L})", "gu")

/** Prénom du répertoire, souvent en capitales (« JEAN-PIERRE ») → « Jean-Pierre ». Laissé tel quel s'il a des minuscules. */
export function displayFirstName(value: string | null | undefined): string {
  const name = (value ?? "").replace(/\s+/g, " ").trim()
  if (!name || name !== name.toUpperCase()) return name
  return name
    .toLowerCase()
    .replace(WORD_START, (_, sep: string, letter: string) => sep + letter.toUpperCase())
}

/** Ville précédée du code postal (« 49100 Angers »). */
export function placeOf(c: { zip_code?: string | null; city?: string | null }): string {
  return [c.zip_code?.trim(), c.city?.trim()].filter(Boolean).join(" ")
}

/** Adresse complète d'une ligne choisie (« 14 rue des Lices, 49100 Angers »). */
export function fullAddressOf(c: { address?: string | null; zip_code?: string | null; city?: string | null }): string {
  return [c.address?.trim(), placeOf(c)].filter(Boolean).join(", ")
}

/** Entreprise du répertoire → saisie de l'étape entreprise (PATCH /api/onboarding/inscription). */
export function candidateToInput(c: SireneCandidate): CompanyInput {
  return {
    name: c.name,
    siren: c.siren,
    siret: c.siret ?? null,
    address: c.address,
    zip_code: c.zip_code,
    city: c.city,
    legal_form: c.legal_form,
    company_type: c.company_type,
  }
}

/** Entreprise enregistrée, présentée comme une ligne de la liste (retour à l'étape entreprise). */
export function companyAsCandidate(company: InscriptionCompany): SireneCandidate {
  return {
    siren: (company.siren ?? "").replace(/\D/g, ""),
    name: company.name,
    legal_form: null,
    company_type: null,
    legal_form_label: "",
    address: company.address,
    zip_code: company.zip_code,
    city: company.city,
    closed: false,
  }
}

/** L'entreprise choisie est-elle déjà celle qui est enregistrée ? (alors rien à réécrire) */
export function sameCompany(saved: InscriptionCompany | null, input: CompanyInput): boolean {
  if (!saved) return false
  const norm = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim().toLowerCase()
  return (
    norm(saved.name) === norm(input.name) &&
    (saved.siren ?? "").replace(/\D/g, "") === (input.siren ?? "").replace(/\D/g, "") &&
    norm(saved.address) === norm(input.address) &&
    norm(saved.zip_code) === norm(input.zip_code) &&
    norm(saved.city) === norm(input.city)
  )
}

/** Écran qui suit `current` : étape suivante parmi celles affichées, ou « prêt ». */
export function nextView(current: InscriptionStep, profileAvailable: boolean): InscriptionView {
  const steps = inscriptionSteps(profileAvailable)
  const i = steps.indexOf(current)
  return i >= 0 && i + 1 < steps.length ? steps[i + 1] : "done"
}

/** Écran qui précède `current`, ou null pour la première étape. */
export function previousStep(current: InscriptionStep, profileAvailable: boolean): InscriptionStep | null {
  const steps = inscriptionSteps(profileAvailable)
  const i = steps.indexOf(current)
  return i > 0 ? steps[i - 1] : null
}

/** Numéro et nombre d'étapes affichées, pour la barre de progression. */
export function stepProgress(step: InscriptionStep, profileAvailable: boolean): { number: number; total: number } {
  const steps = inscriptionSteps(profileAvailable)
  return { number: Math.max(1, steps.indexOf(step) + 1), total: steps.length }
}

/** Champs de la saisie à la main. */
export type CompanyField = "name" | "address" | "zip_code" | "city" | "siren"

/**
 * Champ concerné par un message de validateCompanyInput (lib/onboarding/inscription.ts),
 * pour l'afficher sous ce champ ; null si le message ne vise aucun champ.
 */
export function companyErrorField(message: string): CompanyField | null {
  if (message === SIREN_INVALID) return "siren"
  if (/^Indiquez le nom|^Le nom/.test(message)) return "name"
  if (/^Indiquez l'adresse|^L'adresse/.test(message)) return "address"
  if (/^Code postal/.test(message)) return "zip_code"
  if (/^Indiquez la ville|^La ville/.test(message)) return "city"
  return null
}

/** Longueurs maximales des champs de la saisie à la main (les mêmes que la route). */
export const COMPANY_MAX_LENGTH: Record<CompanyField, number> = {
  name: INSCRIPTION_LIMITS.name,
  address: INSCRIPTION_LIMITS.address,
  zip_code: 5,
  city: INSCRIPTION_LIMITS.city,
  siren: 11, // 9 chiffres, espaces tolérés
}

/** Saisie en chiffres seuls de 9 chiffres (« 948 211 375 ») : un SIREN, repris dans la saisie à la main. */
export function sirenFromQuery(query: string): string {
  const digits = query.replace(/\s/g, "")
  return /^\d{9}$/.test(digits) ? digits : ""
}
