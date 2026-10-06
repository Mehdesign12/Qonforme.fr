/**
 * Fenêtre « Bienvenue » de l'inscription en deux champs (validée par le
 * fondateur le 06/10/2026) : après l'email et le mot de passe, l'entreprise,
 * le métier avec le régime de TVA, puis le prénom se renseignent dans une
 * fenêtre du tableau de bord, que l'artisan peut passer à tout moment.
 *
 * Fonctions pures, sans dépendance serveur : la fenêtre
 * (components/onboarding/InscriptionDialog.tsx), le tableau de bord et la route
 * PATCH /api/onboarding/inscription partagent les mêmes étapes, les mêmes
 * contrôles et les mêmes messages.
 *
 * Le SIREN reste facultatif à l'inscription (entreprise saisie à la main, ou
 * pas encore immatriculée) : il est demandé avant le premier envoi d'un devis
 * ou d'une facture (lib/legal/issuer.ts, 409 `COMPANY_REQUIRED`), car il figure
 * obligatoirement sur les documents (service-public.gouv.fr, F31808).
 */
import {
  COMPANY_TYPES, LIMITS, isTradeId, parseLegalProfile,
  type LegalProfile, type TradeId, type VatRegime,
} from "@/lib/legal/profile"
import type { VatContext } from "@/lib/catalogue/trades"
import { isValidSiren, sirenToVAT } from "@/lib/utils/invoice"

// ─────────────────────────────────────────────────────────────────────────────
// Étapes
// ─────────────────────────────────────────────────────────────────────────────

export type InscriptionStep = "company" | "trade" | "name"

/** Ordre des étapes de la fenêtre. */
export const INSCRIPTION_STEPS: InscriptionStep[] = ["company", "trade", "name"]

/** Ce qui est déjà renseigné pour le compte. */
export interface InscriptionState {
  /** L'entreprise existe (SIREN compris ou non). */
  company: boolean
  /** Métier et régime de TVA déclarés dans le profil légal. */
  trade: boolean
  /** Prénom enregistré dans le compte (`user_metadata.first_name`). */
  firstName: boolean
  /** Faux tant que la colonne `companies.legal_profile` n'existe pas : pas d'étape métier. */
  profileAvailable: boolean
}

/** Étapes affichées : l'étape métier disparaît sans la colonne du profil légal. */
export function inscriptionSteps(profileAvailable: boolean): InscriptionStep[] {
  return profileAvailable ? [...INSCRIPTION_STEPS] : INSCRIPTION_STEPS.filter((s) => s !== "trade")
}

/** Numéro (à partir de 1) d'une étape parmi celles affichées ; null si elle n'est pas affichée. */
export function inscriptionStepNumber(step: InscriptionStep, profileAvailable: boolean): number | null {
  const i = inscriptionSteps(profileAvailable).indexOf(step)
  return i < 0 ? null : i + 1
}

/** Première étape à faire, ou null si tout est fait. L'étape métier est ignorée sans profil légal. */
export function pendingInscriptionStep(s: InscriptionState): InscriptionStep | null {
  const done: Record<InscriptionStep, boolean> = { company: s.company, trade: s.trade, name: s.firstName }
  return inscriptionSteps(s.profileAvailable).find((step) => !done[step]) ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// Saisies
// ─────────────────────────────────────────────────────────────────────────────

/** Entreprise choisie dans le répertoire Sirene ou saisie à la main. */
export interface CompanyInput {
  name: string
  /** 9 chiffres, clé de contrôle vérifiée ; absent (null) tant que l'artisan ne l'a pas. */
  siren?: string | null
  /** SIRET du siège : gardé seulement s'il prolonge le SIREN. */
  siret?: string | null
  address: string
  zip_code: string
  city: string
  /** D'après la catégorie juridique Sirene (lib/legal/from-sirene.ts) ; null à la main. */
  legal_form?: "ei" | "societe" | null
  /** Société : SARL, SAS… (lib/legal/profile.ts, COMPANY_TYPES). */
  company_type?: string | null
}

export interface TradeInput {
  trade: TradeId
  vat_regime: VatRegime
  /** Prestations courantes du métier à importer (prix à compléter), avec le chantier type ; null : rien. */
  catalogue: null | { context: VatContext }
}

export type InscriptionPatch =
  | { step: "company"; company: CompanyInput }
  | { step: "trade"; trade: TradeInput }
  | { step: "name"; first_name: string }
  | { step: "close" }

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

/** Code de la réponse 409 des routes d'envoi quand l'identité de l'émetteur est incomplète. */
export const COMPANY_REQUIRED = "COMPANY_REQUIRED"

/** La réponse d'une route d'envoi demande-t-elle de compléter l'entreprise (409 COMPANY_REQUIRED) ? */
export function isCompanyRequired(status: number, json: { code?: string } | null | undefined): boolean {
  return status === 409 && json?.code === COMPANY_REQUIRED
}

/** Longueurs maximales des saisies de la fenêtre. */
export const INSCRIPTION_LIMITS = {
  name: 120,
  address: 200,
  city: 80,
  first_name: 60,
} as const

export const INVALID_REQUEST = "Requête invalide."
export const SIREN_INVALID = "Ce numéro ne correspond à aucun SIREN : vérifiez les 9 chiffres."

/** Texte d'une ligne : sans caractère de contrôle, espaces normalisés. */
function line(value: unknown): string {
  if (typeof value !== "string") return ""
  return Array.from(value.normalize("NFC"))
    .map((ch) => (ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127 ? " " : ch))
    .join("")
    .replace(/\s+/g, " ")
    .trim()
}

/** Chiffres seuls (« 948 211 375 » → « 948211375 »). */
const digits = (value: unknown): string => (typeof value === "string" ? value.replace(/[\s.  -]/g, "") : "")

/** Entreprise de l'étape 1 : champs requis, SIREN facultatif mais valide s'il est saisi. */
export function validateCompanyInput(x: unknown): Parsed<CompanyInput> {
  if (!x || typeof x !== "object" || Array.isArray(x)) return { ok: false, error: INVALID_REQUEST }
  const v = x as Record<string, unknown>

  const name = line(v.name)
  if (!name) return { ok: false, error: "Indiquez le nom de votre entreprise." }
  if (name.length > INSCRIPTION_LIMITS.name) {
    return { ok: false, error: `Le nom de l'entreprise ne peut pas dépasser ${INSCRIPTION_LIMITS.name} caractères.` }
  }

  const address = line(v.address)
  if (!address) return { ok: false, error: "Indiquez l'adresse de votre entreprise." }
  if (address.length > INSCRIPTION_LIMITS.address) {
    return { ok: false, error: `L'adresse ne peut pas dépasser ${INSCRIPTION_LIMITS.address} caractères.` }
  }

  const zip_code = digits(v.zip_code)
  if (!/^\d{5}$/.test(zip_code)) return { ok: false, error: "Code postal invalide (5 chiffres)." }

  const city = line(v.city)
  if (!city) return { ok: false, error: "Indiquez la ville." }
  if (city.length > INSCRIPTION_LIMITS.city) {
    return { ok: false, error: `La ville ne peut pas dépasser ${INSCRIPTION_LIMITS.city} caractères.` }
  }

  const sirenRaw = digits(v.siren)
  if (sirenRaw && !isValidSiren(sirenRaw)) return { ok: false, error: SIREN_INVALID }
  const siren = sirenRaw || null

  // Le SIRET vient du répertoire, jamais d'une saisie : gardé s'il prolonge le SIREN, ignoré sinon
  const siretRaw = digits(v.siret)
  const siret = siren && /^\d{14}$/.test(siretRaw) && siretRaw.startsWith(siren) ? siretRaw : null

  const legal_form = v.legal_form === "ei" || v.legal_form === "societe" ? v.legal_form : null
  const type = line(v.company_type).slice(0, LIMITS.company_type)
  const knownType = (COMPANY_TYPES as readonly string[]).find((t) => t.toLowerCase() === type.toLowerCase())
  const company_type = legal_form === "societe" && type ? knownType ?? type : null

  return { ok: true, value: { name, siren, siret, address, zip_code, city, legal_form, company_type } }
}

const CONTEXTS_WITH_VAT = new Set<VatContext>(["renovation", "standard"])

/** Métier et TVA de l'étape 2. En franchise, les prestations s'importent toujours à 0 %. */
export function validateTradeInput(x: unknown): Parsed<TradeInput> {
  if (!x || typeof x !== "object" || Array.isArray(x)) return { ok: false, error: INVALID_REQUEST }
  const v = x as Record<string, unknown>
  if (!isTradeId(v.trade)) return { ok: false, error: "Choisissez votre métier." }
  if (v.vat_regime !== "franchise" && v.vat_regime !== "assujetti") {
    return { ok: false, error: "Indiquez si vous facturez la TVA." }
  }
  const vat_regime: VatRegime = v.vat_regime

  let catalogue: TradeInput["catalogue"] = null
  const c = v.catalogue
  if (c !== null && c !== undefined && c !== false) {
    if (typeof c !== "object" || Array.isArray(c)) return { ok: false, error: INVALID_REQUEST }
    if (vat_regime === "franchise") {
      catalogue = { context: "franchise" }
    } else {
      const context = (c as Record<string, unknown>).context
      if (typeof context !== "string" || !CONTEXTS_WITH_VAT.has(context as VatContext)) {
        return { ok: false, error: "Choisissez le type de vos chantiers." }
      }
      catalogue = { context: context as VatContext }
    }
  }
  return { ok: true, value: { trade: v.trade, vat_regime, catalogue } }
}

/** Prénom de l'étape 3 : 1 à 60 caractères. */
export function validateFirstName(x: unknown): Parsed<string> {
  if (x !== undefined && x !== null && typeof x !== "string") return { ok: false, error: INVALID_REQUEST }
  const value = line(x)
  if (!value) return { ok: false, error: "Indiquez votre prénom." }
  if (value.length > INSCRIPTION_LIMITS.first_name) {
    return { ok: false, error: `Le prénom ne peut pas dépasser ${INSCRIPTION_LIMITS.first_name} caractères.` }
  }
  return { ok: true, value }
}

/** Corps de PATCH /api/onboarding/inscription. */
export function parseInscriptionPatch(body: unknown): Parsed<InscriptionPatch> {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: INVALID_REQUEST }
  const b = body as Record<string, unknown>
  switch (b.step) {
    case "company": {
      const r = validateCompanyInput(b.company)
      return r.ok ? { ok: true, value: { step: "company", company: r.value } } : r
    }
    case "trade": {
      const r = validateTradeInput(b.trade)
      return r.ok ? { ok: true, value: { step: "trade", trade: r.value } } : r
    }
    case "name": {
      const r = validateFirstName(b.first_name)
      return r.ok ? { ok: true, value: { step: "name", first_name: r.value } } : r
    }
    case "close":
      return { ok: true, value: { step: "close" } }
    default:
      return { ok: false, error: INVALID_REQUEST }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Écritures (calculées ici, appliquées par la route)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Profil légal après l'étape entreprise : forme juridique du répertoire
 * fusionnée dans le profil existant, le reste (métier, TVA, assurances, RCS)
 * gardé. Sans forme connue (saisie à la main), le profil ne change pas.
 * Une micro-entreprise reste une micro-entreprise : le répertoire ne la
 * distingue pas d'un entrepreneur individuel.
 *
 * Autre entreprise (`sirenChanged` : choisie puis remplacée dans la fenêtre) :
 * forme, type de société, capital et RCS de l'ancienne ne passent jamais à la
 * nouvelle — sinon « Thomas Garnier, SARL » s'imprimerait sur ses documents.
 * Seuls le métier, le régime de TVA et les assurances, propres à l'artisan,
 * sont gardés.
 */
export function mergeCompanyProfile(
  existing: unknown,
  input: CompanyInput,
  opts: { sirenChanged?: boolean } = {},
): LegalProfile | null {
  const current = parseLegalProfile(existing)
  if (opts.sirenChanged) {
    const legal_form = input.legal_form ?? null
    return parseLegalProfile({
      ...current,
      legal_form,
      company_type: legal_form === "societe" ? input.company_type ?? null : null,
      share_capital: null,
      rcs_city: null,
    })
  }
  if (!input.legal_form) return current
  const legal_form = input.legal_form === "ei" && current?.legal_form === "micro" ? "micro" : input.legal_form
  const company_type = legal_form === "societe"
    ? input.company_type ?? (current?.legal_form === "societe" ? current.company_type : null)
    : null
  return parseLegalProfile({ ...current, legal_form, company_type })
}

/** Profil légal après l'étape métier : métier et régime de TVA, le reste gardé. */
export function mergeTradeProfile(existing: unknown, input: Pick<TradeInput, "trade" | "vat_regime">): LegalProfile | null {
  return parseLegalProfile({ ...parseLegalProfile(existing), trade: input.trade, vat_regime: input.vat_regime })
}

const cleanVat = (v: unknown) => (typeof v === "string" ? v.replace(/\s/g, "").toUpperCase() : "")

/** Vrai si le n° de TVA est un numéro français construit sur un autre SIREN que `siren`. */
function vatOfAnotherSiren(vat: string, siren: string): boolean {
  return /^FR[0-9A-Z]{2}\d{9}$/.test(vat) && vat.slice(4) !== siren
}

/**
 * N° de TVA après l'étape métier : aucun en franchise ; sinon celui calculé
 * depuis le SIREN s'il manque ou s'il a été construit sur un autre SIREN (une
 * entreprise choisie puis remplacée dans la fenêtre), sinon celui enregistré.
 * Sans SIREN valide, rien n'est calculé.
 */
export function vatNumberAfterTrade(regime: VatRegime, siren: unknown, current: unknown): string | null {
  const existing = typeof current === "string" && current.trim() ? current.trim() : null
  if (regime === "franchise") return null
  const s = digits(siren)
  if (!isValidSiren(s)) return existing
  const vat = cleanVat(existing)
  if (!vat || vatOfAnotherSiren(vat, s)) return sirenToVAT(s)
  return existing
}

/**
 * N° de TVA quand l'étape entreprise remplace le SIREN : un numéro calculé
 * depuis l'ancien SIREN suit le nouveau (ou disparaît sans SIREN), pour ne
 * jamais imprimer le n° de TVA d'une autre entreprise. `undefined` : rien à
 * changer (numéro saisi à la main, ou SIREN inchangé).
 */
export function vatNumberAfterSirenChange(oldSiren: unknown, newSiren: string | null | undefined, current: unknown): string | null | undefined {
  const before = digits(oldSiren)
  const after = digits(newSiren)
  if (before === after || !isValidSiren(before)) return undefined
  if (cleanVat(current) !== sirenToVAT(before)) return undefined
  return isValidSiren(after) ? sirenToVAT(after) : null
}
