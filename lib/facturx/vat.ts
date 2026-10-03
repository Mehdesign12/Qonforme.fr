/**
 * Catégories et motifs de TVA d'une facture électronique (EN 16931, règles françaises).
 *
 * Une ligne à 0 % n'est pas un « taux zéro » : la norme veut la raison de
 * l'absence de TVA, sous forme de catégorie (BT-151, BT-118), de code de motif
 * (BT-121, liste VATEX) et de motif en clair (BT-120).
 *
 * Sources :
 * - Liste VATEX (Commission européenne, code list v8.0 du 15/11/2025, reprise
 *   par le schematron EN 16931 v1.3.16 du 30/03/2026, règle BR-CL-22) :
 *   VATEX-FR-FRANCHISE « France domestic VAT franchise in base »,
 *   VATEX-EU-AE « Reverse charge », VATEX-EU-IC « Intra-Community supply »,
 *   VATEX-EU-G « Export outside the EU ».
 *   https://ec.europa.eu/digital-building-blocks/sites/spaces/DIGITAL/pages/467108974/Registry+of+supporting+artefacts+to+implement+EN16931
 * - Norme AFNOR XP Z12-012 (formats de la réforme), règle BR-FR-CO-16 :
 *   « Les factures en franchise en base de TVA comportent un bloc de détail TVA
 *   avec une BT-118 = "E" ET une raison d'exemption en CODE BT-121 =
 *   "VATEX-FR-FRANCHISE". Si le Vendeur n'a pas de n° de TVA, il doit répéter
 *   son n° de SIREN en BT-32. » ; BR-FR-15 : catégories S, E, AE, K, G, O, Z.
 *   https://www.e-invoicing-france.eu/documentation/xp-z12-012/AFNOR-FE-XP-Z12-012-4-Formats-et-profils
 * - DGFiP, spécifications externes v3.2 (30/04/2026), annexe 7 « Règles de
 *   gestion » v1.9 : G1.41 (une ventilation « E » porte un code BT-121 et un
 *   motif BT-120), G2.31 (catégories acceptées).
 *   https://www.impots.gouv.fr/specifications-externes-b2b
 * - Mentions sur la facture : « TVA non applicable, art. 293 B du CGI »
 *   (franchise), « Autoliquidation » (CGI, art. 242 nonies A ; sous-traitance du
 *   BTP : art. 283-2 nonies), exonérations des art. 262 ter I (livraison
 *   intracommunautaire) et 262 I (exportation).
 *   https://entreprendre.service-public.gouv.fr/vosdroits/F31808
 */

/** Catégorie de TVA (UNTDID 5305, sous-ensemble EN 16931 utile en France). */
export type FxVatCategory = "S" | "E" | "AE" | "K" | "G" | "Z"

/**
 * Traitement de TVA d'un document ou d'une ligne.
 *
 * API pour l'autoliquidation de la sous-traitance du BTP : poser
 * `vat_treatment: "autoliquidation_btp"` sur chaque ligne concernée (champ du
 * JSON `lines`, aucune migration nécessaire) ou sur le document entier, avec un
 * taux de 0 %. Le XML porte alors la catégorie AE, le code VATEX-EU-AE et le
 * motif ; le PDF imprime la mention « Autoliquidation ».
 */
export type VatTreatment =
  | "standard"            // TVA collectée au taux de la ligne (catégorie S)
  | "franchise"           // franchise en base, art. 293 B du CGI (E)
  | "autoliquidation_btp" // sous-traitance du BTP, art. 283-2 nonies du CGI (AE)
  | "intracom"            // livraison intracommunautaire de biens, art. 262 ter I du CGI (K)
  | "export"              // exportation hors UE, art. 262 I du CGI (G)

export interface VatExemption {
  category: Exclude<FxVatCategory, "S" | "Z">
  /** Code de motif (BT-121), liste VATEX. */
  code: string
  /** Motif en clair (BT-120). */
  reason: string
  /** Mention à imprimer sur la facture. */
  mention: string
}

export const VAT_EXEMPTIONS: Record<Exclude<VatTreatment, "standard">, VatExemption> = {
  franchise: {
    category: "E",
    code: "VATEX-FR-FRANCHISE",
    reason: "TVA non applicable, art. 293 B du CGI",
    mention: "TVA non applicable, art. 293 B du CGI",
  },
  autoliquidation_btp: {
    category: "AE",
    code: "VATEX-EU-AE",
    reason: "Autoliquidation, art. 283-2 nonies du CGI",
    // BOFiP, BOI-TVA-DECLA-10-10-20, § 536 : la facture fait apparaître que la
    // TVA est due par le preneur et porte la mention « autoliquidation »
    mention: "Autoliquidation : TVA due par le preneur assujetti (art. 283, 2 nonies du CGI).",
  },
  intracom: {
    category: "K",
    code: "VATEX-EU-IC",
    reason: "Exonération de TVA, article 262 ter I du CGI",
    mention: "Exonération de TVA, article 262 ter I du CGI",
  },
  export: {
    category: "G",
    code: "VATEX-EU-G",
    reason: "Exonération de TVA, article 262 I du CGI",
    mention: "Exonération de TVA, article 262 I du CGI",
  },
}

const TREATMENTS = new Set<VatTreatment>(["standard", "franchise", "autoliquidation_btp", "intracom", "export"])

/** Lit un traitement venu de la base ou d'une requête ; inconnu → undefined. */
export function parseVatTreatment(value: unknown): VatTreatment | undefined {
  return typeof value === "string" && TREATMENTS.has(value as VatTreatment) ? (value as VatTreatment) : undefined
}

/**
 * Vrai si l'entreprise se déclare en franchise en base : c'est la mention de
 * l'article 293 B du CGI, que l'application demande d'ajouter aux mentions des
 * factures (Paramètres › Modèles) faute de réglage dédié.
 */
export function declaresVatFranchise(...texts: (string | null | undefined)[]): boolean {
  return texts.some((t) => !!t && /\b293\s*B\b/i.test(t))
}

export interface ResolvedVat {
  category: FxVatCategory
  /** Taux en pourcentage (0 hors catégorie S). */
  rate: number
  exemption?: VatExemption
}

/**
 * Catégorie de TVA d'une ligne. Les montants font foi : une ligne qui facture
 * de la TVA reste en S quel que soit le traitement demandé, et une ligne à 0 %
 * sans motif connu part en Z (taux zéro, accepté en France par BR-FR-15) plutôt
 * qu'avec un motif d'exonération inventé.
 */
export function resolveLineVat(
  vatRate: number,
  lineTreatment: VatTreatment | undefined,
  documentTreatment: VatTreatment,
): ResolvedVat {
  const rate = Number.isFinite(vatRate) ? vatRate : 0
  if (rate > 0) return { category: "S", rate }
  const treatment = lineTreatment ?? documentTreatment
  if (treatment === "standard") return { category: "Z", rate: 0 }
  const exemption = VAT_EXEMPTIONS[treatment]
  return { category: exemption.category, rate: 0, exemption }
}
