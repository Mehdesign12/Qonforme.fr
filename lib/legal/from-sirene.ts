/**
 * Ce que le répertoire Sirene dit d'une entreprise, traduit dans le profil
 * légal de Qonforme (lib/legal/profile.ts) : forme juridique d'après la
 * catégorie juridique, métier d'après le code d'activité (APE).
 *
 * Sources (vérifiées le 06/10/2026) :
 * - Catégories juridiques : nomenclature de l'INSEE (niveau III, 4 chiffres),
 *   insee.fr › Nomenclatures › Catégories juridiques. 1000 = entrepreneur
 *   individuel ; 5498 = SARL unipersonnelle (EURL) ; 54xx = SARL ;
 *   55xx et 56xx = sociétés anonymes ; 5710 = SAS ; 5720 = SASU ;
 *   5202 = société en nom collectif.
 * - Codes APE : nomenclature NAF rév. 2 (43.xx : travaux de construction
 *   spécialisés ; 81.30Z : services d'aménagement paysager).
 *
 * Une correspondance absente ne devine rien : la forme reste « Société » sans
 * précision, le métier reste à choisir.
 */

import type { LegalForm, TradeId } from "@/lib/legal/profile"

export interface LegalFromCategory {
  /** « ei » pour un entrepreneur individuel, « societe » pour une personne morale. */
  legal_form: Extract<LegalForm, "ei" | "societe"> | null
  /** Forme de société quand la catégorie la donne sans ambiguïté (SARL, SAS…). */
  company_type: string | null
  /** Libellé court affiché : « Entrepreneur individuel », « SARL », « Société »… */
  label: string
}

const INCONNUE: LegalFromCategory = { legal_form: null, company_type: null, label: "" }

function societe(company_type: string | null): LegalFromCategory {
  return { legal_form: "societe", company_type, label: company_type ?? "Société" }
}

/** Forme juridique d'après la catégorie juridique Sirene (4 chiffres, ex. « 5499 »). */
export function legalFromCategory(code?: string | number | null): LegalFromCategory {
  const c = code == null ? "" : String(code).trim()
  if (!/^\d{4}$/.test(c)) return INCONNUE

  if (c === "1000") return { legal_form: "ei", company_type: null, label: "Entrepreneur individuel" }
  if (c === "5498") return societe("EURL")
  if (c.startsWith("54")) return societe("SARL")
  if (c === "5710") return societe("SAS")
  if (c === "5720") return societe("SASU")
  if (c.startsWith("55") || c.startsWith("56")) return societe("SA")
  if (c === "5202") return societe("SNC")
  // Autres sociétés commerciales (5xxx), sociétés civiles et autres personnes
  // morales de droit privé (6xxx), personnes morales de droit administratif (7xxx)
  if (c[0] === "5" || c[0] === "6" || c[0] === "7") return societe(null)
  return INCONNUE
}

/** Code APE → métier proposé à l'inscription (codes NAF rév. 2). */
const TRADE_BY_APE: Record<string, TradeId> = {
  "4331Z": "plaquiste", // Travaux de plâtrerie
  "4334Z": "peintre", // Travaux de peinture et vitrerie
  "4322A": "plombier", // Travaux d'installation d'eau et de gaz en tous locaux
  "4322B": "chauffagiste", // Travaux d'installation d'équipements thermiques et de climatisation
  "4321A": "electricien", // Travaux d'installation électrique dans tous locaux
  "4333Z": "carreleur", // Travaux de revêtement des sols et des murs
  "4399C": "macon", // Travaux de maçonnerie générale et gros œuvre de bâtiment
  "4332A": "menuisier", // Travaux de menuiserie bois et PVC
  "4332B": "serrurier", // Travaux de menuiserie métallique et serrurerie
  "4391B": "couvreur", // Travaux de couverture par éléments
  "8130Z": "paysagiste", // Services d'aménagement paysager
}

/** Métier d'après le code APE, avec ou sans point (« 43.31Z » ou « 4331Z ») ; null si aucun ne correspond. */
export function tradeFromApe(code?: string | null): TradeId | null {
  if (typeof code !== "string") return null
  const c = code.replace(/[\s.]/g, "").toUpperCase()
  return /^\d{4}[A-Z]$/.test(c) ? TRADE_BY_APE[c] ?? null : null
}
