/**
 * Lecture d'une facture ou d'un avoir OASIS UBL 2.1 (Invoice, CreditNote).
 *
 * Correspondance des champs : norme EN 16931-3-2 (syntaxe UBL), reprise par la
 * DGFiP, spécifications externes v3.2, annexe 1 (colonne chemin UBL) ; le
 * portail public accepte « la norme OASIS U.B.L. 2.1 » (dossier général,
 * § 3.6.3, note 99).
 * https://www.impots.gouv.fr/specifications-externes-b2b
 */
import { all, at, child, childrenOf, textAt, textOf, type XmlElement } from "@/lib/reception/xml"
import { asSiren, asSiret, asVat, clip, clipBlock, deriveSiren, isoDate, num } from "@/lib/reception/fields"
import type {
  ParsedInvoice, ReceivedAllowanceCharge, ReceivedLine, ReceivedParty, ReceivedVatBreakdown,
} from "@/lib/reception/types"

export const UBL_INVOICE_NS = "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
export const UBL_CREDIT_NOTE_NS = "urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2"

/** Vrai si l'élément racine est une facture ou un avoir UBL. */
export function isUblRoot(root: XmlElement): boolean {
  return (root.name === "Invoice" && (root.ns === UBL_INVOICE_NS || root.ns === ""))
    || (root.name === "CreditNote" && (root.ns === UBL_CREDIT_NOTE_NS || root.ns === ""))
}

function ublParty(wrapper: XmlElement | undefined): ReceivedParty {
  const p = child(wrapper, "Party")
  let siren: string | null = null
  let siret: string | null = null

  const legal = child(p, "PartyLegalEntity")
  const companyId = child(legal, "CompanyID")
  if (companyId) {
    const scheme = companyId.attrs.schemeID
    if (scheme === "0002" || !scheme) siren = asSiren(textOf(companyId))
    if (scheme === "0009") siret = asSiret(textOf(companyId))
  }
  for (const id of all(p, "PartyIdentification", "ID")) {
    if (id.attrs.schemeID === "0009" && !siret) siret = asSiret(textOf(id))
    if (id.attrs.schemeID === "0002" && !siren) siren = asSiren(textOf(id))
  }

  let vat: string | null = null
  for (const pts of childrenOf(p, "PartyTaxScheme")) {
    const scheme = textAt(pts, "TaxScheme", "ID")
    if (!scheme || scheme.toUpperCase() === "VAT") vat = vat ?? asVat(textAt(pts, "CompanyID"))
  }

  const endpoint = child(p, "EndpointID")
  const electronic = endpoint && textOf(endpoint)
    ? clip(`${endpoint.attrs.schemeID ? `${endpoint.attrs.schemeID}:` : ""}${textOf(endpoint)}`, 140)
    : null

  const addr = child(p, "PostalAddress")
  const line2 = [textAt(addr, "AdditionalStreetName"), textAt(addr, "AddressLine", "Line")].filter(Boolean).join(", ")

  const party: ReceivedParty = {
    name: clip(textAt(legal, "RegistrationName"), 200) ?? clip(textAt(p, "PartyName", "Name"), 200),
    siren,
    siret,
    vat_number: vat,
    address: addr ? {
      line1: clip(textAt(addr, "StreetName"), 200),
      line2: clip(line2, 200),
      zip: clip(textAt(addr, "PostalZone"), 20),
      city: clip(textAt(addr, "CityName"), 120),
      country: clip(textAt(addr, "Country", "IdentificationCode"), 2),
    } : null,
    electronic_address: electronic,
    email: clip(textAt(p, "Contact", "ElectronicMail"), 200),
  }
  party.siren = deriveSiren(party)
  return party
}

/** Montant d'un élément UBL dans la devise du document (attribut currencyID). */
function amountIn(els: XmlElement[], currency: string): number | null {
  const preferred = els.find((e) => !e.attrs.currencyID || e.attrs.currencyID === currency) ?? els[0]
  return num(textOf(preferred))
}

export function parseUbl(root: XmlElement): ParsedInvoice {
  const isCredit = root.name === "CreditNote"
  const currency = clip(textAt(root, "DocumentCurrencyCode"), 3) ?? "EUR"
  const lineTag = isCredit ? "CreditNoteLine" : "InvoiceLine"
  const qtyTag = isCredit ? "CreditedQuantity" : "InvoicedQuantity"

  const lines: ReceivedLine[] = childrenOf(root, lineTag).map((li) => {
    const item = child(li, "Item")
    const qty = child(li, qtyTag)
    const taxCat = child(item, "ClassifiedTaxCategory")
    const name = clip(textAt(item, "Name"), 300) ?? clip(textAt(item, "Description"), 300) ?? "Ligne sans désignation"
    return {
      id: clip(textAt(li, "ID"), 40),
      name,
      description: textAt(item, "Name") ? clip(textAt(item, "Description"), 500) : null,
      quantity: num(textOf(qty)),
      unit_code: qty?.attrs.unitCode ? clip(qty.attrs.unitCode, 6) : null,
      unit_price: num(textAt(li, "Price", "PriceAmount")),
      net_amount: num(textAt(li, "LineExtensionAmount")) ?? 0,
      vat_category: clip(textAt(taxCat, "ID"), 3),
      vat_rate: num(textAt(taxCat, "Percent")),
    }
  })

  // Deux TaxTotal possibles (devise de facture, devise de comptabilisation) : celui qui porte la ventilation
  const taxTotals = childrenOf(root, "TaxTotal")
  const mainTaxTotal = taxTotals.find((t) => childrenOf(t, "TaxSubtotal").length > 0) ?? taxTotals[0]
  const vat: ReceivedVatBreakdown[] = childrenOf(mainTaxTotal, "TaxSubtotal").map((st) => {
    const cat = child(st, "TaxCategory")
    return {
      category: clip(textAt(cat, "ID"), 3) ?? "S",
      rate: num(textAt(cat, "Percent")),
      base: num(textAt(st, "TaxableAmount")) ?? 0,
      tax: num(textAt(st, "TaxAmount")) ?? 0,
      exemption_reason: clip(textAt(cat, "TaxExemptionReason"), 300),
      exemption_code: clip(textAt(cat, "TaxExemptionReasonCode"), 40),
    }
  })

  const allowancesCharges: ReceivedAllowanceCharge[] = childrenOf(root, "AllowanceCharge").map((ac) => ({
    charge: textAt(ac, "ChargeIndicator") === "true",
    amount: num(textAt(ac, "Amount")) ?? 0,
    reason: clip(textAt(ac, "AllowanceChargeReason"), 200),
    vat_category: clip(textAt(ac, "TaxCategory", "ID"), 3),
    vat_rate: num(textAt(ac, "TaxCategory", "Percent")),
  }))

  const monetary = child(root, "LegalMonetaryTotal")
  const means = child(root, "PaymentMeans")
  const billing = at(root, "BillingReference", "InvoiceDocumentReference")
  const precedingNumber = clip(textAt(billing, "ID"), 60)

  const notes = childrenOf(root, "Note")
    .map((n) => clipBlock(textOf(n), 2000))
    .filter((n): n is string => !!n)
    .slice(0, 30)

  return {
    syntax: "UBL",
    profile: clip(textAt(root, "CustomizationID"), 200),
    business_process: clip(textAt(root, "ProfileID"), 40),
    type_code: clip(textAt(root, isCredit ? "CreditNoteTypeCode" : "InvoiceTypeCode"), 3) ?? (isCredit ? "381" : "380"),
    number: clip(textAt(root, "ID"), 60),
    issue_date: isoDate(textAt(root, "IssueDate")),
    due_date: isoDate(textAt(root, "DueDate")) ?? isoDate(textAt(means, "PaymentDueDate")),
    currency,
    seller: ublParty(child(root, "AccountingSupplierParty")),
    buyer: ublParty(child(root, "AccountingCustomerParty")),
    lines: lines.slice(0, 5000),
    vat,
    allowances_charges: allowancesCharges,
    totals: {
      line_total: num(textAt(monetary, "LineExtensionAmount")),
      allowances: num(textAt(monetary, "AllowanceTotalAmount")),
      charges: num(textAt(monetary, "ChargeTotalAmount")),
      tax_basis: num(textAt(monetary, "TaxExclusiveAmount")),
      tax_total: amountIn(taxTotals.map((t) => child(t, "TaxAmount")).filter((e): e is XmlElement => !!e), currency),
      grand_total: num(textAt(monetary, "TaxInclusiveAmount")),
      prepaid: num(textAt(monetary, "PrepaidAmount")),
      rounding: num(textAt(monetary, "PayableRoundingAmount")),
      due_payable: num(textAt(monetary, "PayableAmount")),
    },
    payment: {
      means_code: clip(textAt(means, "PaymentMeansCode"), 4),
      iban: clip(textAt(means, "PayeeFinancialAccount", "ID"), 40)?.replace(/\s+/g, "") ?? null,
      bic: clip(textAt(means, "PayeeFinancialAccount", "FinancialInstitutionBranch", "ID"), 11),
      reference: clip(textAt(means, "PaymentID"), 140),
      terms: clip(textAt(root, "PaymentTerms", "Note"), 500),
    },
    notes,
    buyer_reference: clip(textAt(root, "BuyerReference"), 100),
    order_reference: clip(textAt(root, "OrderReference", "ID"), 100),
    preceding_invoice: precedingNumber ? { number: precedingNumber, issue_date: isoDate(textAt(billing, "IssueDate")) } : null,
    delivery_date: isoDate(textAt(root, "Delivery", "ActualDeliveryDate")),
  }
}
