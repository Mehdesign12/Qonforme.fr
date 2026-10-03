/**
 * Facture reçue d'un fournisseur, telle que Qonforme la lit dans un fichier
 * Factur-X, CII ou UBL 2.1 (ou la saisie minimale d'un PDF simple).
 *
 * Les champs suivent le modèle sémantique de la norme EN 16931 (identifiants
 * BT-* en commentaire), commun aux deux syntaxes admises par la réforme
 * (DGFiP, spécifications externes v3.2, dossier général § 3.6.3 : « UBL ;
 * CII » ; le Factur-X embarque un CII dans un PDF/A-3).
 * https://www.impots.gouv.fr/specifications-externes-b2b
 *
 * Types purs : partagés par les lecteurs (lib/reception), les routes d'API et
 * l'interface (components/reception), application et démo.
 */

/** Format du fichier d'origine. */
export type ReceivedFormat = "facturx" | "cii" | "ubl" | "pdf"

export const FORMAT_LABELS: Record<ReceivedFormat, string> = {
  facturx: "Factur-X",
  cii: "XML CII",
  ubl: "XML UBL 2.1",
  pdf: "PDF simple",
}

export interface ReceivedAddress {
  line1: string | null
  line2: string | null
  zip: string | null
  city: string | null
  /** Code pays ISO 3166-1 alpha-2. */
  country: string | null
}

export interface ReceivedParty {
  /** Raison sociale (BT-27 vendeur, BT-44 acheteur). */
  name: string | null
  /** SIREN (BT-30 / BT-47), déduit au besoin du SIRET, du n° de TVA ou de l'adresse électronique. */
  siren: string | null
  /** SIRET (BT-29 / BT-46, schéma 0009). */
  siret: string | null
  /** N° de TVA intracommunautaire (BT-31 / BT-48). */
  vat_number: string | null
  address: ReceivedAddress | null
  /** Adresse électronique de facturation (BT-34 / BT-49) : « 0225:123456789 ». */
  electronic_address: string | null
  email: string | null
}

export interface ReceivedLine {
  /** Identifiant de ligne (BT-126). */
  id: string | null
  /** Désignation (BT-153). */
  name: string
  /** Description complémentaire (BT-154). */
  description: string | null
  /** Quantité facturée (BT-129). */
  quantity: number | null
  /** Unité, code UN/ECE Rec. 20 (BT-130). */
  unit_code: string | null
  /** Prix unitaire net HT (BT-146). */
  unit_price: number | null
  /** Montant net HT de la ligne (BT-131). */
  net_amount: number
  /** Catégorie de TVA (BT-151). */
  vat_category: string | null
  /** Taux de TVA en % (BT-152). */
  vat_rate: number | null
}

export interface ReceivedVatBreakdown {
  /** Catégorie (BT-118) : S, E, AE, K, G, O, Z. */
  category: string
  /** Taux en % (BT-119). */
  rate: number | null
  /** Base HT (BT-116). */
  base: number
  /** TVA (BT-117). */
  tax: number
  /** Motif d'exonération en clair (BT-120). */
  exemption_reason: string | null
  /** Code de motif, liste VATEX (BT-121). */
  exemption_code: string | null
}

export interface ReceivedAllowanceCharge {
  /** true : frais (charge) ; false : remise (allowance). */
  charge: boolean
  amount: number
  reason: string | null
  vat_category: string | null
  vat_rate: number | null
}

export interface ReceivedTotals {
  /** Somme des montants nets des lignes (BT-106). */
  line_total: number | null
  /** Remises au niveau du document (BT-107). */
  allowances: number | null
  /** Frais au niveau du document (BT-108). */
  charges: number | null
  /** Total HT (BT-109). */
  tax_basis: number | null
  /** Total TVA (BT-110). */
  tax_total: number | null
  /** Total TTC (BT-112). */
  grand_total: number | null
  /** Montant déjà payé (BT-113). */
  prepaid: number | null
  /** Arrondi (BT-114). */
  rounding: number | null
  /** Net à payer (BT-115). */
  due_payable: number | null
}

export interface ReceivedPayment {
  /** Moyen de paiement, code UNCL 4461 (BT-81) : 30 virement, 58 virement SEPA, 49 prélèvement… */
  means_code: string | null
  /** IBAN du fournisseur (BT-84). */
  iban: string | null
  /** BIC (BT-86). */
  bic: string | null
  /** Référence à rappeler dans le virement (BT-83). */
  reference: string | null
  /** Conditions de paiement en clair (BT-20). */
  terms: string | null
}

/** Facture lue dans un fichier structuré. */
export interface ParsedInvoice {
  syntax: "CII" | "UBL"
  /** Spécification (BT-24), ex. « urn:cen.eu:en16931:2017 ». */
  profile: string | null
  /** Cadre de facturation (BT-23), ex. « S1 ». */
  business_process: string | null
  /** Type de document (BT-3) : 380 facture, 381 avoir, 384 rectificative, 386 acompte… */
  type_code: string
  /** Numéro (BT-1). */
  number: string | null
  /** Date d'émission (BT-2), AAAA-MM-JJ. */
  issue_date: string | null
  /** Échéance (BT-9), AAAA-MM-JJ. */
  due_date: string | null
  /** Devise (BT-5). */
  currency: string
  seller: ReceivedParty
  buyer: ReceivedParty
  lines: ReceivedLine[]
  vat: ReceivedVatBreakdown[]
  allowances_charges: ReceivedAllowanceCharge[]
  totals: ReceivedTotals
  payment: ReceivedPayment
  /** Notes (BT-22). */
  notes: string[]
  /** Référence acheteur (BT-10). */
  buyer_reference: string | null
  /** Bon de commande (BT-13). */
  order_reference: string | null
  /** Facture d'origine d'un avoir (BT-25, BT-26). */
  preceding_invoice: { number: string; issue_date: string | null } | null
  /** Date de livraison ou de fin d'exécution (BT-72). */
  delivery_date: string | null
}

/** Codes de type de document qui désignent un avoir (UNTDID 1001, liste de la réforme). */
export const CREDIT_NOTE_TYPE_CODES = new Set(["381", "261", "262", "396", "502", "503"])

export const isCreditNoteType = (code: string | null | undefined) => !!code && CREDIT_NOTE_TYPE_CODES.has(code)

const TYPE_LABELS: Record<string, string> = {
  "380": "Facture",
  "381": "Avoir",
  "384": "Facture rectificative",
  "386": "Facture d'acompte",
  "389": "Autofacture",
  "393": "Facture affacturée",
  "261": "Autofacture d'avoir",
  "396": "Avoir affacturé",
}

export function documentTypeLabel(code: string | null | undefined): string {
  if (!code) return "Facture"
  return TYPE_LABELS[code] ?? (isCreditNoteType(code) ? "Avoir" : "Facture")
}

/** Libellé lisible de la spécification (BT-24). */
export function profileLabel(profile: string | null | undefined): string | null {
  if (!profile) return null
  const p = profile.toLowerCase()
  if (p.includes("factur-x.eu:1p0:minimum")) return "Factur-X MINIMUM"
  if (p.includes("factur-x.eu:1p0:basicwl")) return "Factur-X BASIC WL"
  if (p.includes("factur-x.eu:1p0:basic")) return "Factur-X BASIC"
  if (p.includes("factur-x.eu:1p0:extended")) return "Factur-X EXTENDED"
  if (p.includes("peppol.eu")) return "Peppol BIS 3.0"
  if (p.startsWith("urn:cen.eu:en16931:2017")) return "EN 16931"
  return profile.length > 60 ? `${profile.slice(0, 57)}…` : profile
}

/** Profils sans lignes de détail (MINIMUM, BASIC WL). */
export function isSummaryProfile(profile: string | null | undefined): boolean {
  const p = (profile ?? "").toLowerCase()
  return p.includes("factur-x.eu:1p0:minimum") || p.includes("factur-x.eu:1p0:basicwl")
}

/* ------------------------------------------------------------------ */
/* Résultat d'analyse et contrôles                                      */
/* ------------------------------------------------------------------ */

export type CheckLevel = "ok" | "warning" | "error"

/** Un contrôle à l'import : « error » empêche l'enregistrement. */
export interface ReceptionCheck {
  id: string
  level: CheckLevel
  title: string
  detail?: string
  /** Facture déjà enregistrée (doublon). */
  duplicate_of?: { id: string; created_at: string | null } | null
}

/** Saisie minimale d'un PDF sans données structurées. */
export interface ManualEntry {
  document_type: "380" | "381"
  supplier_name: string
  supplier_siren: string | null
  number: string
  issue_date: string
  due_date: string | null
  total_ht: number
  total_vat: number
  total_ttc: number
}

/** Résultat de la lecture d'un fichier, avant les contrôles liés au compte. */
export type FileAnalysis =
  | { ok: true; kind: "structured"; format: Exclude<ReceivedFormat, "pdf">; invoice: ParsedInvoice; has_pdf: boolean }
  | { ok: true; kind: "pdf_only"; format: "pdf"; has_pdf: true; note: string | null }
  | { ok: false; code: string; message: string }
