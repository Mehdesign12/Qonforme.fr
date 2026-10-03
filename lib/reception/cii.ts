/**
 * Lecture d'une facture UN/CEFACT Cross Industry Invoice (CII D16B à D22B),
 * seule ou embarquée dans un Factur-X.
 *
 * Correspondance des champs : norme EN 16931-3-3 (syntaxe CII), reprise par la
 * spécification Factur-X (FNFE-MPE) et par la DGFiP, spécifications externes
 * v3.2, annexe 1 « Format sémantique FE e-invoicing » (colonne chemin CII).
 * https://www.impots.gouv.fr/specifications-externes-b2b
 *
 * Lecture tolérante : un champ absent vaut null, les contrôles de cohérence
 * sont faits à part (lib/reception/checks.ts).
 */
import { all, at, child, childrenOf, textAt, textOf, type XmlElement } from "@/lib/reception/xml"
import { asSiren, asSiret, asVat, clip, clipBlock, deriveSiren, isoDate, num } from "@/lib/reception/fields"
import type {
  ParsedInvoice, ReceivedAllowanceCharge, ReceivedLine, ReceivedParty, ReceivedVatBreakdown,
} from "@/lib/reception/types"

export const CII_NS = "urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"

/** Vrai si l'élément racine est une facture CII. */
export function isCiiRoot(root: XmlElement): boolean {
  return root.name === "CrossIndustryInvoice"
}

/** Date d'un élément CII : enfant DateTimeString (udt ou qdt), format 102. */
function ciiDate(el: XmlElement | undefined): string | null {
  const dts = child(el, "DateTimeString")
  if (!dts) return null
  const format = dts.attrs.format
  if (format && format !== "102") return null
  return isoDate(textOf(dts))
}

function ciiParty(p: XmlElement | undefined): ReceivedParty {
  let siren: string | null = null
  let siret: string | null = null

  const legal = at(p, "SpecifiedLegalOrganization", "ID")
  if (legal) {
    const scheme = legal.attrs.schemeID
    const v = textOf(legal)
    if (scheme === "0002" || !scheme) siren = asSiren(v)
    if (scheme === "0009") siret = asSiret(v)
  }
  for (const g of [...childrenOf(p, "GlobalID"), ...childrenOf(p, "ID")]) {
    if (g.attrs.schemeID === "0009" && !siret) siret = asSiret(textOf(g))
    if (g.attrs.schemeID === "0002" && !siren) siren = asSiren(textOf(g))
  }

  let vat: string | null = null
  for (const reg of childrenOf(p, "SpecifiedTaxRegistration")) {
    const id = child(reg, "ID")
    if (id && (id.attrs.schemeID ?? "VA") === "VA") vat = vat ?? asVat(textOf(id))
  }

  const uri = at(p, "URIUniversalCommunication", "URIID")
  const electronic = uri && textOf(uri) ? clip(`${uri.attrs.schemeID ? `${uri.attrs.schemeID}:` : ""}${textOf(uri)}`, 140) : null

  const addr = child(p, "PostalTradeAddress")
  const lineTwo = [textAt(addr, "LineTwo"), textAt(addr, "LineThree")].filter(Boolean).join(", ")

  const party: ReceivedParty = {
    name: clip(textAt(p, "Name"), 200) ?? clip(textAt(p, "SpecifiedLegalOrganization", "TradingBusinessName"), 200),
    siren,
    siret,
    vat_number: vat,
    address: addr ? {
      line1: clip(textAt(addr, "LineOne"), 200),
      line2: clip(lineTwo, 200),
      zip: clip(textAt(addr, "PostcodeCode"), 20),
      city: clip(textAt(addr, "CityName"), 120),
      country: clip(textAt(addr, "CountryID"), 2),
    } : null,
    electronic_address: electronic,
    email: clip(textAt(p, "DefinedTradeContact", "EmailURIUniversalCommunication", "URIID"), 200),
  }
  party.siren = deriveSiren(party)
  return party
}

/**
 * Montant d'en-tête qui peut figurer deux fois (BT-110 en devise de facture et
 * BT-111 en devise de comptabilisation) : on garde celui de la devise de facture.
 */
function amountInCurrency(els: XmlElement[], currency: string): number | null {
  const preferred = els.find((e) => !e.attrs.currencyID || e.attrs.currencyID === currency) ?? els[0]
  return num(textOf(preferred))
}

export function parseCii(root: XmlElement): ParsedInvoice {
  const context = child(root, "ExchangedDocumentContext")
  const doc = child(root, "ExchangedDocument")
  const tx = child(root, "SupplyChainTradeTransaction")
  const agreement = child(tx, "ApplicableHeaderTradeAgreement")
  const delivery = child(tx, "ApplicableHeaderTradeDelivery")
  const settlement = child(tx, "ApplicableHeaderTradeSettlement")
  const summation = child(settlement, "SpecifiedTradeSettlementHeaderMonetarySummation")

  const currency = clip(textAt(settlement, "InvoiceCurrencyCode"), 3) ?? "EUR"

  const lines: ReceivedLine[] = childrenOf(tx, "IncludedSupplyChainTradeLineItem").map((li) => {
    const product = child(li, "SpecifiedTradeProduct")
    const qty = at(li, "SpecifiedLineTradeDelivery", "BilledQuantity")
    const lineTax = at(li, "SpecifiedLineTradeSettlement", "ApplicableTradeTax")
    const name = clip(textAt(product, "Name"), 300) ?? clip(textAt(product, "Description"), 300) ?? "Ligne sans désignation"
    return {
      id: clip(textAt(li, "AssociatedDocumentLineDocument", "LineID"), 40),
      name,
      description: textAt(product, "Name") ? clip(textAt(product, "Description"), 500) : null,
      quantity: num(textOf(qty)),
      unit_code: qty?.attrs.unitCode ? clip(qty.attrs.unitCode, 6) : null,
      unit_price: num(textAt(li, "SpecifiedLineTradeAgreement", "NetPriceProductTradePrice", "ChargeAmount")),
      net_amount: num(textAt(li, "SpecifiedLineTradeSettlement", "SpecifiedTradeSettlementLineMonetarySummation", "LineTotalAmount")) ?? 0,
      vat_category: clip(textAt(lineTax, "CategoryCode"), 3),
      vat_rate: num(textAt(lineTax, "RateApplicablePercent")),
    }
  })

  const vat: ReceivedVatBreakdown[] = childrenOf(settlement, "ApplicableTradeTax").map((t) => ({
    category: clip(textAt(t, "CategoryCode"), 3) ?? "S",
    rate: num(textAt(t, "RateApplicablePercent")),
    base: num(textAt(t, "BasisAmount")) ?? 0,
    tax: num(textAt(t, "CalculatedAmount")) ?? 0,
    exemption_reason: clip(textAt(t, "ExemptionReason"), 300),
    exemption_code: clip(textAt(t, "ExemptionReasonCode"), 40),
  }))

  const allowancesCharges: ReceivedAllowanceCharge[] = childrenOf(settlement, "SpecifiedTradeAllowanceCharge").map((ac) => ({
    charge: textAt(ac, "ChargeIndicator", "Indicator") === "true",
    amount: num(textAt(ac, "ActualAmount")) ?? 0,
    reason: clip(textAt(ac, "Reason"), 200),
    vat_category: clip(textAt(ac, "CategoryTradeTax", "CategoryCode"), 3),
    vat_rate: num(textAt(ac, "CategoryTradeTax", "RateApplicablePercent")),
  }))

  const means = child(settlement, "SpecifiedTradeSettlementPaymentMeans")
  const terms = child(settlement, "SpecifiedTradePaymentTerms")
  const preceding = child(settlement, "InvoiceReferencedDocument")
  const precedingNumber = clip(textAt(preceding, "IssuerAssignedID"), 60)

  const notes = all(doc, "IncludedNote", "Content")
    .map((n) => clipBlock(textOf(n), 2000))
    .filter((n): n is string => !!n)
    .slice(0, 30)

  return {
    syntax: "CII",
    profile: clip(textAt(context, "GuidelineSpecifiedDocumentContextParameter", "ID"), 200),
    business_process: clip(textAt(context, "BusinessProcessSpecifiedDocumentContextParameter", "ID"), 40),
    type_code: clip(textAt(doc, "TypeCode"), 3) ?? "380",
    number: clip(textAt(doc, "ID"), 60),
    issue_date: ciiDate(child(doc, "IssueDateTime")),
    due_date: ciiDate(child(terms, "DueDateDateTime")),
    currency,
    seller: ciiParty(child(agreement, "SellerTradeParty")),
    buyer: ciiParty(child(agreement, "BuyerTradeParty")),
    lines: lines.slice(0, 5000),
    vat,
    allowances_charges: allowancesCharges,
    totals: {
      line_total: num(textAt(summation, "LineTotalAmount")),
      allowances: num(textAt(summation, "AllowanceTotalAmount")),
      charges: num(textAt(summation, "ChargeTotalAmount")),
      tax_basis: num(textAt(summation, "TaxBasisTotalAmount")),
      tax_total: amountInCurrency(childrenOf(summation, "TaxTotalAmount"), currency),
      grand_total: num(textAt(summation, "GrandTotalAmount")),
      prepaid: num(textAt(summation, "TotalPrepaidAmount")),
      rounding: num(textAt(summation, "RoundingAmount")),
      due_payable: num(textAt(summation, "DuePayableAmount")),
    },
    payment: {
      means_code: clip(textAt(means, "TypeCode"), 4),
      iban: clip(textAt(means, "PayeePartyCreditorFinancialAccount", "IBANID"), 40)?.replace(/\s+/g, "") ?? null,
      bic: clip(textAt(means, "PayeeSpecifiedCreditorFinancialInstitution", "BICID"), 11),
      reference: clip(textAt(settlement, "PaymentReference"), 140),
      terms: clip(textAt(terms, "Description"), 500),
    },
    notes,
    buyer_reference: clip(textAt(agreement, "BuyerReference"), 100),
    order_reference: clip(textAt(agreement, "BuyerOrderReferencedDocument", "IssuerAssignedID"), 100),
    preceding_invoice: precedingNumber
      ? { number: precedingNumber, issue_date: ciiDate(child(preceding, "FormattedIssueDateTime")) }
      : null,
    delivery_date: ciiDate(at(delivery, "ActualDeliverySupplyChainEvent", "OccurrenceDateTime")),
  }
}
