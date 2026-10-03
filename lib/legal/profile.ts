/**
 * Profil légal de l'entreprise (Paramètres › Entreprise) : métier principal,
 * régime de TVA, forme juridique et assurance professionnelle. Il alimente les
 * mentions imprimées d'office sur les devis, factures, bons de commande et
 * avoirs (lib/legal/mentions.ts) et le catalogue proposé par métier
 * (lib/legal/catalogue.ts).
 *
 * Stockage : une colonne JSON `companies.legal_profile` (migration
 * 20261003_legal_profile_btp.sql). Tant qu'elle n'existe pas, les réglages
 * restent masqués et les documents gardent leurs mentions d'avant.
 *
 * Toute valeur lue en base passe par `parseLegalProfile` : la ligne s'écrit
 * depuis le navigateur (RLS), on n'en garde que des champs connus, bornés.
 *
 * Sources (vérifiées le 03/10/2026) :
 * - Entrepreneur individuel : nom « précédé ou suivi immédiatement des mots
 *   " entrepreneur individuel " ou des initiales " EI " » sur ses documents
 *   (code de commerce, art. R526-27 ; service-public.gouv.fr, F31808).
 * - Société : forme juridique et montant du capital social (code de commerce,
 *   art. R123-238) ; « RCS » suivi de la ville du greffe pour une personne
 *   immatriculée au RCS (art. R123-237, 2°).
 * - Franchise en base : « TVA non applicable, art. 293 B du CGI ».
 * - Assurance : voir lib/legal/mentions.ts (code de l'artisanat, art. L132-1 ;
 *   code des assurances, art. L243-2).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Métiers
// ─────────────────────────────────────────────────────────────────────────────

export const TRADES = [
  { id: "plaquiste", label: "Plaquiste, plâtrier" },
  { id: "peintre", label: "Peintre en bâtiment" },
  { id: "plombier", label: "Plombier" },
  { id: "chauffagiste", label: "Chauffagiste" },
  { id: "electricien", label: "Électricien" },
  { id: "carreleur", label: "Carreleur" },
  { id: "macon", label: "Maçon" },
  { id: "menuisier", label: "Menuisier" },
  { id: "couvreur", label: "Couvreur" },
  { id: "serrurier", label: "Serrurier" },
  { id: "paysagiste", label: "Paysagiste" },
  { id: "autre", label: "Autre métier du bâtiment" },
] as const

export type TradeId = (typeof TRADES)[number]["id"]

const TRADE_IDS = new Set<string>(TRADES.map((t) => t.id))

export function isTradeId(value: unknown): value is TradeId {
  return typeof value === "string" && TRADE_IDS.has(value)
}

export function tradeLabel(id: TradeId | null | undefined): string | null {
  return TRADES.find((t) => t.id === id)?.label ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// Régime de TVA et forme juridique
// ─────────────────────────────────────────────────────────────────────────────

/** Franchise en base (art. 293 B du CGI) ou TVA collectée. */
export type VatRegime = "franchise" | "assujetti"

export const VAT_REGIMES: { id: VatRegime; label: string; hint: string }[] = [
  { id: "assujetti", label: "Je facture la TVA", hint: "TVA collectée au taux de chaque ligne." },
  { id: "franchise", label: "Franchise en base", hint: "« TVA non applicable, art. 293 B du CGI » sur chaque document." },
]

/** Micro-entreprise : un entrepreneur individuel au régime micro. */
export type LegalForm = "micro" | "ei" | "societe"

export const LEGAL_FORMS: { id: LegalForm; label: string }[] = [
  { id: "micro", label: "Micro-entreprise" },
  { id: "ei", label: "Entrepreneur individuel" },
  { id: "societe", label: "Société" },
]

/** Formes de société proposées ; toute autre forme se saisit en clair. */
export const COMPANY_TYPES = ["EURL", "SARL", "SASU", "SAS", "SA", "SNC"] as const

export const isIndividual = (form: LegalForm | null | undefined) => form === "micro" || form === "ei"

// ─────────────────────────────────────────────────────────────────────────────
// Profil
// ─────────────────────────────────────────────────────────────────────────────

/** Assurance professionnelle : ce que les devis et factures doivent indiquer. */
export interface InsurancePolicy {
  /** Nom de l'assureur ou du garant. */
  insurer: string
  /** Coordonnées de l'assureur (adresse). */
  address: string
  /** Numéro du contrat. */
  policy_number: string
  /** Couverture géographique du contrat (ex. « France métropolitaine »). */
  coverage: string
}

export interface LegalProfile {
  trade: TradeId | null
  vat_regime: VatRegime | null
  legal_form: LegalForm | null
  /** Société : forme (SARL, SAS…). */
  company_type: string | null
  /** Société : capital social, en euros. */
  share_capital: number | null
  /** Ville du greffe, si l'entreprise est immatriculée au RCS. */
  rcs_city: string | null
  /** Assurance de responsabilité décennale. */
  decennale: InsurancePolicy | null
  /** Responsabilité civile professionnelle, si l'entreprise en a une. */
  rc_pro: InsurancePolicy | null
}

export const EMPTY_LEGAL_PROFILE: LegalProfile = {
  trade: null,
  vat_regime: null,
  legal_form: null,
  company_type: null,
  share_capital: null,
  rcs_city: null,
  decennale: null,
  rc_pro: null,
}

/** Longueurs maximales (les mêmes que la saisie). */
export const LIMITS = {
  company_type: 30,
  rcs_city: 60,
  insurer: 80,
  address: 140,
  policy_number: 40,
  coverage: 80,
} as const

/** Texte d'une ligne : espaces normalisés, sans saut de ligne, borné. */
function text(value: unknown, max: number): string {
  if (typeof value !== "string") return ""
  return value.replace(/\s+/g, " ").trim().slice(0, max)
}

const orNull = (s: string): string | null => (s ? s : null)

function parsePolicy(value: unknown): InsurancePolicy | null {
  if (!value || typeof value !== "object") return null
  const v = value as Record<string, unknown>
  const policy: InsurancePolicy = {
    insurer: text(v.insurer, LIMITS.insurer),
    address: text(v.address, LIMITS.address),
    policy_number: text(v.policy_number, LIMITS.policy_number),
    coverage: text(v.coverage, LIMITS.coverage),
  }
  return policy.insurer || policy.address || policy.policy_number || policy.coverage ? policy : null
}

/** Capital : nombre positif, au centime ; « 5 000,50 » accepté. */
export function parseCapital(value: unknown): number | null {
  let n: number
  if (typeof value === "number") n = value
  else if (typeof value === "string") {
    const clean = value.replace(/[\s  €]/g, "").replace(",", ".")
    if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null
    n = Number(clean)
  } else return null
  if (!Number.isFinite(n) || n <= 0 || n > 1e12) return null
  return Math.round(n * 100) / 100
}

/** Profil lu en base (ou envoyé par le formulaire) : champs connus seulement, bornés. */
export function parseLegalProfile(value: unknown): LegalProfile | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const v = value as Record<string, unknown>
  const legal_form = v.legal_form === "micro" || v.legal_form === "ei" || v.legal_form === "societe" ? v.legal_form : null
  const profile: LegalProfile = {
    trade: isTradeId(v.trade) ? v.trade : null,
    vat_regime: v.vat_regime === "franchise" || v.vat_regime === "assujetti" ? v.vat_regime : null,
    legal_form,
    // Forme et capital n'ont de sens que pour une société
    company_type: legal_form === "societe" ? orNull(text(v.company_type, LIMITS.company_type)) : null,
    share_capital: legal_form === "societe" ? parseCapital(v.share_capital) : null,
    rcs_city: orNull(text(v.rcs_city, LIMITS.rcs_city)),
    decennale: parsePolicy(v.decennale),
    rc_pro: parsePolicy(v.rc_pro),
  }
  return isEmptyProfile(profile) ? null : profile
}

export function isEmptyProfile(p: LegalProfile | null | undefined): boolean {
  if (!p) return true
  return !p.trade && !p.vat_regime && !p.legal_form && !p.company_type && p.share_capital == null
    && !p.rcs_city && !p.decennale && !p.rc_pro
}

/** Assurance complète : les quatre informations que le devis et la facture doivent porter. */
export function isCompletePolicy(p: InsurancePolicy | null | undefined): boolean {
  return !!(p && p.insurer && p.address && p.policy_number && p.coverage)
}

/** Erreurs de saisie d'un profil (clé de champ → message), vide si tout va bien. */
export function legalProfileErrors(p: LegalProfile): Partial<Record<LegalProfileField, string>> {
  const e: Partial<Record<LegalProfileField, string>> = {}
  if (p.legal_form === "societe" && !p.company_type) e.company_type = "Indiquez la forme de la société."
  for (const key of ["decennale", "rc_pro"] as const) {
    const policy = p[key]
    if (policy && !isCompletePolicy(policy)) {
      if (!policy.insurer) e[`${key}.insurer`] = "Requis dès qu'une information de l'assurance est saisie."
      if (!policy.address) e[`${key}.address`] = "Coordonnées de l'assureur : obligatoires sur vos devis et factures."
      if (!policy.policy_number) e[`${key}.policy_number`] = "Requis dès qu'une information de l'assurance est saisie."
      if (!policy.coverage) e[`${key}.coverage`] = "Couverture géographique : obligatoire sur vos devis et factures."
    }
  }
  return e
}

export type LegalProfileField =
  | "company_type" | "share_capital" | "rcs_city"
  | `${"decennale" | "rc_pro"}.${keyof InsurancePolicy}`
