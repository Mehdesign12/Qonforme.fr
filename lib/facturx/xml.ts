/**
 * Qonforme — XML Factur-X des factures et des avoirs, profil EN 16931.
 *
 * Syntaxe UN/CEFACT Cross Industry Invoice (CII D16B, schémas Factur-X), profil
 * EN 16931 (identifiant de spécification BT-24 « urn:cen.eu:en16931:2017 »),
 * complété des règles françaises de la réforme.
 *
 * Sources :
 * - Factur-X / ZUGFeRD (FNFE-MPE, FeRD) : https://fnfe-mpe.org/factur-x/
 * - Règles EN 16931 : schematron CEN v1.3.16 du 30/03/2026 (BR-*, BR-CO-*, BR-S-*,
 *   BR-E-*, BR-AE-*, BR-IC-*, BR-G-*, BR-DEC-*)
 *   https://github.com/ConnectingEurope/eInvoicing-EN16931
 * - Règles françaises : norme AFNOR XP Z12-012 (BR-FR-*, schematron « BR-FR
 *   Flux 2 CII » v1.3.0 du 16/02/2026) et DGFiP, spécifications externes v3.2
 *   (annexe 7 « Règles de gestion » v1.9, 30/04/2026)
 *   https://www.e-invoicing-france.eu/documentation/xp-z12-012/AFNOR-FE-XP-Z12-012-4-Formats-et-profils
 *   https://www.impots.gouv.fr/specifications-externes-b2b
 *
 * Ce qui est porté :
 * - type de document BT-3 : 380 (facture) ou 381 (avoir) avec la facture
 *   d'origine BT-25/BT-26 (BR-FR-CO-05) ;
 * - cadre de facturation BT-23 (BR-FR-08), S1 par défaut : les travaux du
 *   bâtiment sont des prestations de services ;
 * - vendeur : SIREN en BT-30 (schéma 0002), SIRET en BT-29 (schéma 0009),
 *   n° de TVA en BT-31, à défaut SIREN répété en BT-32 (BR-FR-CO-16), adresse
 *   électronique BT-34 (BR-FR-13 : SIREN, schéma 0225) ;
 * - acheteur : SIREN BT-47, n° de TVA BT-48, adresse postale toujours présente
 *   (BR-10, BR-11), adresse électronique BT-49 (BR-FR-12) ;
 * - échéance BT-9 (BR-CO-25), IBAN BT-84 avec le moyen de paiement 58 (BR-61) ;
 * - notes : conditions d'escompte, pénalités, indemnité forfaitaire (BR-FR-05),
 *   notes de la facture, mentions de l'entreprise ;
 * - une ventilation de TVA par couple catégorie/taux, motif d'exonération et
 *   code VATEX pour E, AE, K, G (voir lib/facturx/vat.ts) ;
 * - montants calculés au centime en entiers, cohérents avec BR-CO-10 à BR-CO-16,
 *   BR-S-08/09 et BR-CO-17.
 *
 * Un brouillon n'a jamais de XML : c'est aux appelants de ne pas en produire.
 */
import { isBusinessBuyer, mentionsToPrint, paymentMentions } from "@/lib/facturx/mentions"
import {
  declaresVatFranchise, parseVatTreatment, resolveLineVat,
  type FxVatCategory, type VatExemption, type VatTreatment,
} from "@/lib/facturx/vat"

// ─────────────────────────────────────────────────────────────────────────────
// Types d'entrée
// ─────────────────────────────────────────────────────────────────────────────

export interface FxParty {
  name: string
  address?: string | null
  zip_code?: string | null
  city?: string | null
  /** Code pays ISO 3166-1 alpha-2, « FR » par défaut. */
  country?: string | null
  siren?: string | null
  siret?: string | null
  vat_number?: string | null
  email?: string | null
}

export interface FxSeller extends FxParty {
  iban?: string | null
  /** Mentions de l'entreprise imprimées en pied de document. */
  legal_notice?: string | null
}

export interface FxLine {
  description: string
  quantity: number
  /** Unité saisie (« h », « m² », « forfait »…), convertie en code UN/ECE Rec. 20. */
  unit?: string | null
  unit_price_ht: number
  vat_rate: number
  total_ht: number
  /** TVA de la ligne ; recalculée depuis le taux si absente. */
  total_vat?: number | null
  /** Traitement de TVA propre à la ligne (ex. autoliquidation). */
  vat_treatment?: VatTreatment | null
}

/** Cadre de facturation (BT-23, BR-FR-08). */
export type BillingFramework = "B1" | "S1" | "M1" | "B2" | "S2" | "M2" | "B4" | "S4" | "M4" | "S5" | "S6" | "B7" | "S7"

export interface FxDocument {
  kind: "invoice" | "credit_note"
  number: string
  issue_date: string            // AAAA-MM-JJ
  due_date?: string | null      // AAAA-MM-JJ
  currency?: "EUR"
  seller: FxSeller
  buyer: FxParty
  lines: FxLine[]
  notes?: string | null
  /** Traitement de TVA du document ; à défaut, franchise si la mention 293 B est présente. */
  vat_treatment?: VatTreatment | null
  /** Avoir : facture d'origine (BT-25, BT-26). */
  preceding_invoice?: { number: string; issue_date?: string | null } | null
  business_process?: BillingFramework
  /** Date de livraison ou de fin d'exécution (BT-72), pays de livraison (BT-80). */
  delivery?: { date?: string | null; country?: string | null } | null
  /** Conditions de paiement en clair (BT-20). */
  payment_terms?: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Montants
// ─────────────────────────────────────────────────────────────────────────────

export interface FxVatBreakdown {
  category: FxVatCategory
  rate: number
  /** Base HT (BT-116), en euros. */
  base: number
  /** TVA (BT-117), en euros. */
  tax: number
  exemption?: VatExemption
}

export interface FxComputedLine {
  index: number
  line: FxLine
  category: FxVatCategory
  rate: number
  netCents: number
  taxCents: number
  exemption?: VatExemption
}

export interface FxTotals {
  /** Somme des montants nets des lignes (BT-106). */
  lineTotal: number
  /** Total HT (BT-109). */
  taxBasis: number
  /** Total TVA (BT-110). */
  taxTotal: number
  /** Total TTC (BT-112). */
  grandTotal: number
  /** Net à payer (BT-115). */
  duePayable: number
  breakdown: FxVatBreakdown[]
  lines: FxComputedLine[]
  /** Traitement de TVA retenu pour le document. */
  treatment: VatTreatment
}

const toCents = (n: number | null | undefined): number => Math.round((Number(n) || 0) * 100)
const fromCents = (c: number): number => c / 100

/** Traitement du document : celui demandé, sinon franchise si la mention 293 B est présente. */
export function documentVatTreatment(doc: Pick<FxDocument, "vat_treatment" | "seller" | "notes">): VatTreatment {
  return parseVatTreatment(doc.vat_treatment)
    ?? (declaresVatFranchise(doc.seller.legal_notice, doc.notes) ? "franchise" : "standard")
}

/**
 * Montants du document, au centime, à partir des lignes : ce sont eux que le XML
 * déclare et que le PDF imprime, pour que les deux ne divergent jamais.
 */
export function computeFacturXTotals(doc: Pick<FxDocument, "lines" | "vat_treatment" | "seller" | "notes">): FxTotals {
  const treatment = documentVatTreatment(doc)
  const lines: FxComputedLine[] = doc.lines.map((line, index) => {
    const vat = resolveLineVat(Number(line.vat_rate), parseVatTreatment(line.vat_treatment), treatment)
    const netCents = toCents(line.total_ht)
    const taxCents = vat.category === "S"
      ? (line.total_vat == null ? Math.round(netCents * vat.rate / 100) : toCents(line.total_vat))
      : 0
    return { index, line, category: vat.category, rate: vat.rate, netCents, taxCents, exemption: vat.exemption }
  })

  // Une ventilation par catégorie et taux (E, AE, K, G, Z : taux 0, une seule chacune)
  const groups = new Map<string, { category: FxVatCategory; rate: number; base: number; tax: number; exemption?: VatExemption }>()
  for (const l of lines) {
    const key = `${l.category}|${l.rate}`
    const g = groups.get(key) ?? { category: l.category, rate: l.rate, base: 0, tax: 0, exemption: l.exemption }
    g.base += l.netCents
    g.tax += l.taxCents
    groups.set(key, g)
  }
  const breakdown: FxVatBreakdown[] = Array.from(groups.values())
    .sort((a, b) => (a.category === b.category ? b.rate - a.rate : a.category === "S" ? -1 : b.category === "S" ? 1 : a.category.localeCompare(b.category)))
    .map((g) => ({ category: g.category, rate: g.rate, base: fromCents(g.base), tax: fromCents(g.tax), exemption: g.exemption }))

  const lineTotalCents = lines.reduce((s, l) => s + l.netCents, 0)
  const taxTotalCents = lines.reduce((s, l) => s + l.taxCents, 0)
  return {
    lineTotal: fromCents(lineTotalCents),
    taxBasis: fromCents(lineTotalCents),
    taxTotal: fromCents(taxTotalCents),
    grandTotal: fromCents(lineTotalCents + taxTotalCents),
    duePayable: fromCents(lineTotalCents + taxTotalCents),
    breakdown,
    lines,
    treatment,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de formatage
// ─────────────────────────────────────────────────────────────────────────────

/** AAAA-MM-JJ (ou ISO complet) → AAAAMMJJ (format 102). */
function ciiDate(d: string): string {
  return (d || "").slice(0, 10).replace(/-/g, "")
}

/** Montant au centime, point décimal (BR-DEC : 2 décimales au plus). */
function amt(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2)
}

/** Nombre décimal sans notation exponentielle, au plus `max` décimales. */
function dec(n: number, max: number): string {
  const s = (Math.round(n * 10 ** max) / 10 ** max).toFixed(max)
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s
}

/** Taux de TVA : « 20 », « 5.5 », « 0 » (BR-FR-16). */
function rate(n: number): string {
  return dec(n, 2)
}

/** Échappe les caractères XML et retire les caractères de contrôle interdits. */
function esc(s: string | null | undefined): string {
  if (!s) return ""
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

const digits = (s: string | null | undefined): string => (s ?? "").replace(/\D/g, "")
const compact = (s: string | null | undefined): string => (s ?? "").replace(/\s+/g, "").toUpperCase()
const country = (c: string | null | undefined): string => (/^[A-Za-z]{2}$/.test(c?.trim() ?? "") ? c!.trim().toUpperCase() : "FR")

/** SIREN (9 chiffres) déclaré, ou déduit du SIRET. */
function sirenOf(p: FxParty): string | undefined {
  const siren = digits(p.siren)
  if (/^\d{9}$/.test(siren)) return siren
  const siret = digits(p.siret)
  return /^\d{14}$/.test(siret) ? siret.slice(0, 9) : undefined
}

/** SIRET (14 chiffres) cohérent avec le SIREN (BR-FR-09). */
function siretOf(p: FxParty, siren: string | undefined): string | undefined {
  const siret = digits(p.siret)
  return /^\d{14}$/.test(siret) && (!siren || siret.startsWith(siren)) ? siret : undefined
}

/**
 * Unité de mesure saisie → code UN/ECE Recommandation 20 (BT-130).
 * Unité inconnue : C62 (« unité »).
 */
export function unitCode(unit: string | null | undefined): string {
  const u = (unit ?? "").trim().toLowerCase().replace(/\.$/, "")
  const map: Record<string, string> = {
    "h": "HUR", "heure": "HUR", "heures": "HUR", "hr": "HUR",
    "min": "MIN", "minute": "MIN", "minutes": "MIN",
    "j": "DAY", "jour": "DAY", "jours": "DAY", "jr": "DAY",
    "sem": "WEE", "semaine": "WEE", "semaines": "WEE",
    "mois": "MON", "an": "ANN", "année": "ANN", "ans": "ANN",
    "m²": "MTK", "m2": "MTK",
    "m³": "MTQ", "m3": "MTQ",
    "m": "MTR", "ml": "MTR", "mètre": "MTR", "mètres": "MTR", "mètre linéaire": "MTR",
    "km": "KMT", "cm": "CMT", "mm": "MMT",
    "kg": "KGM", "g": "GRM", "t": "TNE", "tonne": "TNE", "tonnes": "TNE",
    "l": "LTR", "litre": "LTR", "litres": "LTR",
    "forfait": "LS", "fft": "LS", "ft": "LS",
  }
  return map[u] ?? "C62"
}

/** Client professionnel identifié : SIREN valide ou n° de TVA. */
export function hasBusinessBuyer(doc: Pick<FxDocument, "buyer">): boolean {
  return isBusinessBuyer({ siren: sirenOf(doc.buyer), vat_number: compact(doc.buyer.vat_number) || undefined })
}

/**
 * Mentions à imprimer en pied de document, en plus des mentions de l'entreprise
 * et des notes, pour que le PDF dise ce que dit le XML (motif d'absence de TVA,
 * mentions de règlement entre professionnels).
 */
export function documentMentions(doc: FxDocument, totals: FxTotals = computeFacturXTotals(doc)): string[] {
  return mentionsToPrint(totals.breakdown, hasBusinessBuyer(doc), doc.seller.legal_notice, doc.notes)
}

// ─────────────────────────────────────────────────────────────────────────────
// Génération XML
// ─────────────────────────────────────────────────────────────────────────────

export interface FacturXResult {
  xml: string
  totals: FxTotals
  /** Données manquantes ou incohérentes : le XML est produit, mais une plateforme pourra le refuser. */
  warnings: string[]
}

function addressXml(p: FxParty, indent: string): string {
  const parts = [
    p.zip_code?.trim() ? `${indent}  <ram:PostcodeCode>${esc(p.zip_code.trim())}</ram:PostcodeCode>` : "",
    p.address?.trim() ? `${indent}  <ram:LineOne>${esc(p.address.trim())}</ram:LineOne>` : "",
    p.city?.trim() ? `${indent}  <ram:CityName>${esc(p.city.trim())}</ram:CityName>` : "",
    `${indent}  <ram:CountryID>${country(p.country)}</ram:CountryID>`,
  ].filter(Boolean)
  return `${indent}<ram:PostalTradeAddress>\n${parts.join("\n")}\n${indent}</ram:PostalTradeAddress>`
}

export function buildFacturX(doc: FxDocument): FacturXResult {
  const warnings: string[] = []
  const currency = doc.currency ?? "EUR"
  const totals = computeFacturXTotals(doc)
  const isCredit = doc.kind === "credit_note"
  const label = isCredit ? "l'avoir" : "la facture"

  // ── Parties ───────────────────────────────────────────────────────────────
  const seller = doc.seller
  const buyer = doc.buyer
  const sellerSiren = sirenOf(seller)
  const sellerSiret = siretOf(seller, sellerSiren)
  const sellerVat = compact(seller.vat_number) || undefined
  const buyerSiren = sirenOf(buyer)
  const buyerVat = compact(buyer.vat_number) || undefined
  const b2b = hasBusinessBuyer(doc)

  if (!seller.name?.trim()) warnings.push("Raison sociale de l'entreprise absente (BT-27).")
  if (!sellerSiren) warnings.push("SIREN de l'entreprise absent : obligatoire sur une facture électronique (BT-30, BR-FR-10).")
  if (!seller.address?.trim() || !seller.zip_code?.trim() || !seller.city?.trim()) warnings.push("Adresse de l'entreprise incomplète (BG-5).")
  if (!buyer.name?.trim()) warnings.push("Nom du client absent (BT-44).")
  if (!buyerSiren && !buyerVat && country(buyer.country) === "FR") warnings.push("Client sans SIREN ni n° de TVA : traité comme un particulier ; entre entreprises, le SIREN du client est obligatoire (BT-47, BR-FR-11).")

  const categories = new Set(totals.lines.map((l) => l.category))
  if (categories.has("S") && !sellerVat) warnings.push("La facture applique la TVA mais l'entreprise n'a pas de n° de TVA intracommunautaire (BT-31).")
  if (categories.has("Z")) warnings.push("Ligne à 0 % sans motif d'exonération : déclarée au taux zéro (Z). En franchise en base, ajoutez la mention de l'article 293 B du CGI à vos modèles.")
  if (categories.has("AE") && !(buyerVat || buyerSiren)) warnings.push("Autoliquidation : le n° de TVA ou le SIREN du client est obligatoire (BR-AE-02).")
  if ((categories.has("K") || categories.has("G")) && !sellerVat) warnings.push("Exonération intracommunautaire ou à l'export : le n° de TVA de l'entreprise est obligatoire (BR-IC-02, BR-G-02).")
  if (categories.has("K") && !buyerVat) warnings.push("Livraison intracommunautaire : le n° de TVA du client est obligatoire (BR-IC-02).")
  if (categories.has("K") && !(doc.delivery?.date && doc.delivery?.country)) warnings.push("Livraison intracommunautaire : date et pays de livraison obligatoires (BR-IC-11, BR-IC-12).")
  if (totals.treatment === "franchise" && totals.lines.some((l) => l.category === "S")) warnings.push("Franchise en base déclarée, mais une ligne applique la TVA.")
  for (const l of totals.lines) {
    if (l.category === "S" && Math.abs(l.taxCents - Math.round(l.netCents * l.rate / 100)) > 1) {
      warnings.push(`Ligne ${l.index + 1} : TVA enregistrée incohérente avec son taux (BR-S-09).`)
    }
  }
  if (doc.lines.length === 0) warnings.push(`Aucune ligne sur ${label} (BR-16).`)
  if (!isCredit && !doc.due_date) warnings.push("Date d'échéance absente (BT-9, BR-CO-25).")
  if (doc.due_date && doc.due_date.slice(0, 10) < doc.issue_date.slice(0, 10)) warnings.push("Échéance antérieure à la date de facture (BR-FR-CO-07).")
  if (isCredit && !doc.preceding_invoice?.number) warnings.push("Avoir sans facture d'origine (BT-25, BR-FR-CO-05).")
  if (isCredit && doc.preceding_invoice?.number && !doc.preceding_invoice.issue_date) warnings.push("Date de la facture d'origine absente (BT-26, BR-FR-CO-05).")
  const iban = compact(seller.iban) || undefined
  if (iban && !/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) warnings.push("IBAN de l'entreprise au format inattendu (BT-84).")

  // ── Notes (BG-1) ──────────────────────────────────────────────────────────
  const notes: { content: string; subject: string }[] = []
  if (doc.notes?.trim()) notes.push({ content: doc.notes.trim(), subject: "AAI" })
  for (const m of paymentMentions(b2b, seller.legal_notice, doc.notes)) notes.push({ content: m.text, subject: m.code })
  if (seller.legal_notice?.trim()) notes.push({ content: seller.legal_notice.trim(), subject: "ABL" })
  const notesXml = notes.map((n) => `
    <ram:IncludedNote>
      <ram:Content>${esc(n.content)}</ram:Content>
      <ram:SubjectCode>${n.subject}</ram:SubjectCode>
    </ram:IncludedNote>`).join("")

  // ── Lignes (BG-25) ────────────────────────────────────────────────────────
  const linesXml = totals.lines.map((l) => {
    const line = l.line
    // Prix net jamais négatif (BR-27) : une remise saisie en prix négatif passe en quantité négative
    const price = Number(line.unit_price_ht) || 0
    const qty = (Number(line.quantity) || 0) * (price < 0 ? -1 : 1)
    const name = line.description?.trim() || `Ligne ${l.index + 1}`
    return `
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${l.index + 1}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${esc(name)}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${dec(Math.abs(price), 6)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="${unitCode(line.unit)}">${dec(qty, 4)}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>${l.category}</ram:CategoryCode>
          <ram:RateApplicablePercent>${rate(l.rate)}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${amt(fromCents(l.netCents))}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`
  }).join("")

  // ── Vendeur (BG-4) ────────────────────────────────────────────────────────
  const sellerTax = [
    sellerVat ? `
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${esc(sellerVat)}</ram:ID>
        </ram:SpecifiedTaxRegistration>` : "",
    // Sans n° de TVA, le SIREN est répété en identifiant fiscal (BR-FR-CO-16)
    !sellerVat && sellerSiren ? `
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="FC">${sellerSiren}</ram:ID>
        </ram:SpecifiedTaxRegistration>` : "",
  ].join("")
  const sellerUri = sellerSiren
    ? `<ram:URIID schemeID="0225">${sellerSiren}</ram:URIID>`
    : seller.email?.trim() ? `<ram:URIID schemeID="EM">${esc(seller.email.trim())}</ram:URIID>` : ""
  const sellerXml = `
      <ram:SellerTradeParty>${sellerSiret ? `
        <ram:GlobalID schemeID="0009">${sellerSiret}</ram:GlobalID>` : ""}
        <ram:Name>${esc(seller.name?.trim() || "")}</ram:Name>${sellerSiren ? `
        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${sellerSiren}</ram:ID>
        </ram:SpecifiedLegalOrganization>` : ""}
${addressXml(seller, "        ")}${sellerUri ? `
        <ram:URIUniversalCommunication>
          ${sellerUri}
        </ram:URIUniversalCommunication>` : ""}${sellerTax}
      </ram:SellerTradeParty>`

  // ── Acheteur (BG-7) ───────────────────────────────────────────────────────
  const buyerUri = buyerSiren
    ? `<ram:URIID schemeID="0225">${buyerSiren}</ram:URIID>`
    : buyer.email?.trim() ? `<ram:URIID schemeID="EM">${esc(buyer.email.trim())}</ram:URIID>` : ""
  const buyerXml = `
      <ram:BuyerTradeParty>
        <ram:Name>${esc(buyer.name?.trim() || "")}</ram:Name>${buyerSiren ? `
        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${buyerSiren}</ram:ID>
        </ram:SpecifiedLegalOrganization>` : ""}
${addressXml(buyer, "        ")}${buyerUri ? `
        <ram:URIUniversalCommunication>
          ${buyerUri}
        </ram:URIUniversalCommunication>` : ""}${buyerVat ? `
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${esc(buyerVat)}</ram:ID>
        </ram:SpecifiedTaxRegistration>` : ""}
      </ram:BuyerTradeParty>`

  // ── Livraison (BG-13) ─────────────────────────────────────────────────────
  const delivery = doc.delivery
  const deliveryXml = delivery?.country || delivery?.date ? `
    <ram:ApplicableHeaderTradeDelivery>${delivery.country ? `
      <ram:ShipToTradeParty>
        <ram:PostalTradeAddress>
          <ram:CountryID>${country(delivery.country)}</ram:CountryID>
        </ram:PostalTradeAddress>
      </ram:ShipToTradeParty>` : ""}${delivery.date ? `
      <ram:ActualDeliverySupplyChainEvent>
        <ram:OccurrenceDateTime>
          <udt:DateTimeString format="102">${ciiDate(delivery.date)}</udt:DateTimeString>
        </ram:OccurrenceDateTime>
      </ram:ActualDeliverySupplyChainEvent>` : ""}
    </ram:ApplicableHeaderTradeDelivery>` : `
    <ram:ApplicableHeaderTradeDelivery/>`

  // ── Règlement (BG-16, BG-23, BG-22) ───────────────────────────────────────
  const paymentMeansXml = iban ? `
      <ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>58</ram:TypeCode>
        <ram:PayeePartyCreditorFinancialAccount>
          <ram:IBANID>${esc(iban)}</ram:IBANID>
        </ram:PayeePartyCreditorFinancialAccount>
      </ram:SpecifiedTradeSettlementPaymentMeans>` : ""

  const taxXml = totals.breakdown.map((b) => `
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${amt(b.tax)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>${b.exemption ? `
        <ram:ExemptionReason>${esc(b.exemption.reason)}</ram:ExemptionReason>` : ""}
        <ram:BasisAmount>${amt(b.base)}</ram:BasisAmount>
        <ram:CategoryCode>${b.category}</ram:CategoryCode>${b.exemption ? `
        <ram:ExemptionReasonCode>${b.exemption.code}</ram:ExemptionReasonCode>` : ""}
        <ram:RateApplicablePercent>${rate(b.rate)}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>`).join("")

  // Conditions de paiement : texte fourni, sinon pour un avoir le rappel de la
  // facture d'origine (BR-CO-25 exige BT-9 ou BT-20 quand un montant est dû)
  const termsText = doc.payment_terms?.trim()
    || (isCredit && totals.duePayable > 0 && !doc.due_date
      ? `Avoir${doc.preceding_invoice?.number ? ` sur la facture ${doc.preceding_invoice.number}` : ""} : à déduire du montant dû ou à rembourser.`
      : "")
  const termsXml = termsText || doc.due_date ? `
      <ram:SpecifiedTradePaymentTerms>${termsText ? `
        <ram:Description>${esc(termsText)}</ram:Description>` : ""}${doc.due_date ? `
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">${ciiDate(doc.due_date)}</udt:DateTimeString>
        </ram:DueDateDateTime>` : ""}
      </ram:SpecifiedTradePaymentTerms>` : ""

  const precedingXml = doc.preceding_invoice?.number ? `
      <ram:InvoiceReferencedDocument>
        <ram:IssuerAssignedID>${esc(doc.preceding_invoice.number)}</ram:IssuerAssignedID>${doc.preceding_invoice.issue_date ? `
        <ram:FormattedIssueDateTime>
          <qdt:DateTimeString format="102">${ciiDate(doc.preceding_invoice.issue_date)}</qdt:DateTimeString>
        </ram:FormattedIssueDateTime>` : ""}
      </ram:InvoiceReferencedDocument>` : ""

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:BusinessProcessSpecifiedDocumentContextParameter>
      <ram:ID>${doc.business_process ?? "S1"}</ram:ID>
    </ram:BusinessProcessSpecifiedDocumentContextParameter>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${esc(doc.number)}</ram:ID>
    <ram:TypeCode>${isCredit ? "381" : "380"}</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${ciiDate(doc.issue_date)}</udt:DateTimeString>
    </ram:IssueDateTime>${notesXml}
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>${linesXml}
    <ram:ApplicableHeaderTradeAgreement>${sellerXml}${buyerXml}
    </ram:ApplicableHeaderTradeAgreement>${deliveryXml}
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${currency}</ram:InvoiceCurrencyCode>${paymentMeansXml}${taxXml}${termsXml}
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${amt(totals.lineTotal)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${amt(totals.taxBasis)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${currency}">${amt(totals.taxTotal)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${amt(totals.grandTotal)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${amt(totals.duePayable)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>${precedingXml}
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>
`
  return { xml, totals, warnings }
}

/** XML Factur-X seul (voir buildFacturX pour les montants et les avertissements). */
export function generateFacturXml(doc: FxDocument): string {
  return buildFacturX(doc).xml
}
