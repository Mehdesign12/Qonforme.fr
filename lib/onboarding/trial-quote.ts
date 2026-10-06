/**
 * Devis d'essai envoyé à soi-même (DECISIONS-STRATEGIQUES.md § 8, choix 2) :
 * un devis d'exemple au nom de l'entreprise de l'artisan, envoyé sur sa propre
 * adresse, qui porte la mention « Exemple » et n'a pas de numéro.
 *
 * Il n'est JAMAIS enregistré : ni ligne dans `quotes`, ni numéro consommé. Il
 * reste donc hors des listes, des compteurs, de la recherche et des chiffres du
 * tableau de bord. Le PDF est généré en mémoire (lib/pdf/quote.ts, filigrane
 * « EXEMPLE ») puis joint à l'email.
 *
 * Fonction pure : la route app/api/onboarding/trial-quote fournit l'entreprise
 * et, s'il y en a, quelques prestations de son catalogue.
 */
import type { QuotePdfInput } from "@/lib/pdf/quote"
import { parseLegalProfile } from "@/lib/legal/profile"
import { addDays } from "@/lib/utils/paris-date"

/** Au plus 3 devis d'essai par période de 24 heures glissantes. */
export const TRIAL_QUOTE_DAILY_LIMIT = 3

/** À la place du numéro, sur le PDF et dans l'email. */
export const TRIAL_QUOTE_LABEL = "Exemple, sans numéro"
export const TRIAL_QUOTE_FILENAME = "Devis-exemple.pdf"
export const TRIAL_QUOTE_NOTE = "Ceci est un exemple envoyé à vous-même : ce devis n'a pas de numéro et n'engage personne."

export interface TrialProduct {
  name: string
  description?: string | null
  unit_price_ht: number | string | null
  vat_rate: number | string | null
}

export interface TrialCompany {
  name?: string | null
  zip_code?: string | null
  city?: string | null
  legal_notice?: string | null
  /** Profil légal (colonne JSON, absente avant la migration) : régime de TVA déclaré. */
  legal_profile?: unknown
}

type Line = NonNullable<QuotePdfInput["quote"]["lines"]>[number]

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Franchise en base de TVA (art. 293 B du CGI) : pas de TVA. Le régime déclaré
 * dans le profil légal (Paramètres › Entreprise, fenêtre « Bienvenue ») fait
 * foi, comme pour les mentions du PDF (lib/legal/mentions.ts) ; sans régime
 * déclaré, la mention « 293 B » des mentions libres.
 */
export function isVatExempt(company: TrialCompany | null | undefined): boolean {
  const regime = parseLegalProfile(company?.legal_profile)?.vat_regime
  if (regime) return regime === "franchise"
  return /293\s*B/i.test(company?.legal_notice ?? "")
}

/** Lignes génériques, quand le catalogue est vide. */
function genericLines(vat: number): Line[] {
  return [
    { description: "Préparation du chantier et protection (exemple)", quantity: 1, unit_price_ht: 150, vat_rate: vat, total_ht: 150 },
    { description: "Fournitures (exemple)", quantity: 1, unit_price_ht: 380, vat_rate: vat, total_ht: 380 },
    { description: "Main-d'œuvre, en heures (exemple)", quantity: 7, unit_price_ht: 45, vat_rate: vat, total_ht: 315 },
  ]
}

/** Contenu du devis d'essai, daté du jour `today` (AAAA-MM-JJ, heure de Paris). */
export function buildTrialQuote({
  company,
  products = [],
  today,
}: {
  company: TrialCompany | null
  products?: TrialProduct[]
  today: string
}): QuotePdfInput["quote"] {
  const exempt = isVatExempt(company)

  const fromCatalogue: Line[] = products
    .map((p) => ({ name: p.name?.trim() ?? "", price: Number(p.unit_price_ht), vat: Number(p.vat_rate) }))
    .filter((p) => p.name && Number.isFinite(p.price) && p.price > 0)
    .slice(0, 3)
    .map((p) => ({
      description: p.name,
      quantity: 1,
      unit_price_ht: round2(p.price),
      vat_rate: exempt ? 0 : Number.isFinite(p.vat) ? p.vat : 20,
      total_ht: round2(p.price),
    }))

  const lines = fromCatalogue.length > 0 ? fromCatalogue : genericLines(exempt ? 0 : 20)
  const subtotal = round2(lines.reduce((s, l) => s + l.total_ht, 0))
  const vat = round2(lines.reduce((s, l) => s + l.total_ht * (l.vat_rate / 100), 0))

  return {
    quote_number: TRIAL_QUOTE_LABEL,
    issue_date: today,
    valid_until: addDays(today, 30),
    subtotal_ht: subtotal,
    total_vat: vat,
    total_ttc: round2(subtotal + vat),
    notes: TRIAL_QUOTE_NOTE,
    lines,
    client: {
      name: "Client d'exemple",
      address: "Adresse du chantier",
      zip_code: company?.zip_code ?? undefined,
      city: company?.city ?? undefined,
    },
  }
}
