/**
 * Qonforme — Génération XML Factur-X (profil EN 16931 / EXTENDED)
 * Norme : UN/CEFACT Cross Industry Invoice (CII) D16B
 * Référence : https://www.fnfe-mpe.org/factur-x/
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types d'entrée
// ─────────────────────────────────────────────────────────────────────────────

export interface FxSeller {
  name: string
  address: string
  zip_code: string
  city: string
  country?: string        // défaut "FR"
  siren?: string
  siret?: string
  vat_number?: string
  iban?: string
  legal_notice?: string
}

export interface FxBuyer {
  name: string
  address?: string
  zip_code?: string
  city?: string
  country?: string        // défaut "FR"
  siren?: string
  vat_number?: string
  email?: string
}

export interface FxLine {
  id: number              // numéro de ligne 1-based
  description: string
  quantity: number
  unit_price_ht: number
  vat_rate: number        // 0 | 5.5 | 10 | 20
  total_ht: number
  total_vat: number
  total_ttc: number
}

export interface FxInvoice {
  invoice_number: string
  issue_date: string      // YYYY-MM-DD
  due_date: string        // YYYY-MM-DD
  currency?: string       // défaut "EUR"
  seller: FxSeller
  buyer: FxBuyer
  lines: FxLine[]
  subtotal_ht: number
  total_vat: number
  total_ttc: number
  notes?: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Formate une date YYYY-MM-DD → YYYYMMDD (format CII) */
function ciiDate(d: string): string {
  return (d || "").replace(/-/g, "")
}

/** Arrondi 2 décimales → string */
function amt(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2)
}

/** Échappe les caractères XML */
function esc(s: string | null | undefined): string {
  if (!s) return ""
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

/** Calcule le code catégorie TVA Factur-X selon le taux */
function vatCategory(rate: number): string {
  if (rate === 0) return "Z"   // zero-rated
  return "S"                    // standard
}

// ─────────────────────────────────────────────────────────────────────────────
// Génération XML
// ─────────────────────────────────────────────────────────────────────────────

export function generateFacturXml(inv: FxInvoice): string {
  const currency = inv.currency ?? "EUR"
  const sellerCountry = inv.seller.country ?? "FR"
  const buyerCountry  = inv.buyer.country  ?? "FR"

  // ── Regroupement TVA par taux ──────────────────────────────────────────────
  const vatMap = new Map<number, { base: number; amount: number }>()
  for (const line of inv.lines) {
    const existing = vatMap.get(line.vat_rate) ?? { base: 0, amount: 0 }
    vatMap.set(line.vat_rate, {
      base:   existing.base   + line.total_ht,
      amount: existing.amount + line.total_vat,
    })
  }

  // ── Lignes XML ────────────────────────────────────────────────────────────
  const linesXml = inv.lines.map((line) => `
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${line.id}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${esc(line.description)}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${amt(line.unit_price_ht)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="C62">${amt(line.quantity)}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>${vatCategory(line.vat_rate)}</ram:CategoryCode>
          <ram:RateApplicablePercent>${amt(line.vat_rate)}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${amt(line.total_ht)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`
  ).join("")

  // ── Détail TVA par taux ───────────────────────────────────────────────────
  const vatBreakdownXml = Array.from(vatMap.entries()).map(([rate, v]) => `
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${amt(v.amount)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${amt(v.base)}</ram:BasisAmount>
        <ram:CategoryCode>${vatCategory(rate)}</ram:CategoryCode>
        <ram:RateApplicablePercent>${amt(rate)}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>`
  ).join("")

  // ── IBAN (si disponible) ──────────────────────────────────────────────────
  const ibanXml = inv.seller.iban ? `
      <ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>58</ram:TypeCode>
        <ram:PayeePartyCreditorFinancialAccount>
          <ram:IBANID>${esc(inv.seller.iban)}</ram:IBANID>
        </ram:PayeePartyCreditorFinancialAccount>
      </ram:SpecifiedTradeSettlementPaymentMeans>` : ""

  // ── Notes ─────────────────────────────────────────────────────────────────
  const notesXml = inv.notes ? `
  <rsm:ExchangedDocument>
    <ram:ID>${esc(inv.invoice_number)}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${ciiDate(inv.issue_date)}</udt:DateTimeString>
    </ram:IssueDateTime>
    <ram:IncludedNote>
      <ram:Content>${esc(inv.notes)}</ram:Content>
    </ram:IncludedNote>
  </rsm:ExchangedDocument>` : `
  <rsm:ExchangedDocument>
    <ram:ID>${esc(inv.invoice_number)}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${ciiDate(inv.issue_date)}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>`

  // ── XML complet ───────────────────────────────────────────────────────────
  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100"
  xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100">

  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017#conformant#urn:factur-x.eu:1p0:extended</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>

  ${notesXml}

  <rsm:SupplyChainTradeTransaction>

    <!-- ═══ LIGNES ═══════════════════════════════════════════════════════ -->
    ${linesXml}

    <!-- ═══ EN-TÊTE COMMERCIAL ══════════════════════════════════════════ -->
    <ram:ApplicableHeaderTradeAgreement>

      <!-- Vendeur / Émetteur -->
      <ram:SellerTradeParty>
        <ram:Name>${esc(inv.seller.name)}</ram:Name>${inv.seller.siret ? `
        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${esc(inv.seller.siret)}</ram:ID>
        </ram:SpecifiedLegalOrganization>` : inv.seller.siren ? `
        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${esc(inv.seller.siren)}</ram:ID>
        </ram:SpecifiedLegalOrganization>` : ""}
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${esc(inv.seller.zip_code)}</ram:PostcodeCode>
          <ram:LineOne>${esc(inv.seller.address)}</ram:LineOne>
          <ram:CityName>${esc(inv.seller.city)}</ram:CityName>
          <ram:CountryID>${sellerCountry}</ram:CountryID>
        </ram:PostalTradeAddress>${inv.seller.vat_number ? `
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${esc(inv.seller.vat_number)}</ram:ID>
        </ram:SpecifiedTaxRegistration>` : ""}
      </ram:SellerTradeParty>

      <!-- Acheteur / Client -->
      <ram:BuyerTradeParty>
        <ram:Name>${esc(inv.buyer.name)}</ram:Name>${inv.buyer.siren ? `
        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${esc(inv.buyer.siren)}</ram:ID>
        </ram:SpecifiedLegalOrganization>` : ""}${(inv.buyer.address || inv.buyer.zip_code || inv.buyer.city) ? `
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${esc(inv.buyer.zip_code ?? "")}</ram:PostcodeCode>
          <ram:LineOne>${esc(inv.buyer.address ?? "")}</ram:LineOne>
          <ram:CityName>${esc(inv.buyer.city ?? "")}</ram:CityName>
          <ram:CountryID>${buyerCountry}</ram:CountryID>
        </ram:PostalTradeAddress>` : ""}${inv.buyer.vat_number ? `
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${esc(inv.buyer.vat_number)}</ram:ID>
        </ram:SpecifiedTaxRegistration>` : ""}
      </ram:BuyerTradeParty>

    </ram:ApplicableHeaderTradeAgreement>

    <!-- ═══ LIVRAISON ════════════════════════════════════════════════════ -->
    <ram:ApplicableHeaderTradeDelivery/>

    <!-- ═══ RÈGLEMENT ════════════════════════════════════════════════════ -->
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${currency}</ram:InvoiceCurrencyCode>
      ${ibanXml}

      <!-- Échéance -->
      <ram:SpecifiedTradePaymentTerms>
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">${ciiDate(inv.due_date)}</udt:DateTimeString>
        </ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>

      <!-- Ventilation TVA -->
      ${vatBreakdownXml}

      <!-- Totaux -->
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${amt(inv.subtotal_ht)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${amt(inv.subtotal_ht)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${currency}">${amt(inv.total_vat)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${amt(inv.total_ttc)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${amt(inv.total_ttc)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>

    </ram:ApplicableHeaderTradeSettlement>

  </rsm:SupplyChainTradeTransaction>

</rsm:CrossIndustryInvoice>`
}
