/**
 * Factur-X des factures remisées : remises de ligne (BG-27) et remise globale
 * (BG-20, une par taux). Sur des milliers de factures tirées au hasard, le XML
 * reste cohérent avec lui-même (règles BR-CO de l'EN 16931) et avec les totaux
 * enregistrés par le serveur.
 */
import { describe, it, expect } from "vitest"
import { buildFacturX } from "@/lib/facturx/xml"
import { invoiceToFacturX } from "@/lib/facturx/records"
import { prepareLinesForSave, buildGlobalDiscountLines, itemLines, type DiscountableLine } from "@/lib/documents/discounts"

const company = {
  name: "Plâtrerie Martin SARL", siren: "552100554", siret: "55210055400013", vat_number: "FR40552100554",
  address: "12 rue des Artisans", zip_code: "69003", city: "Lyon", country: "FR",
  iban: "FR7630006000011234567890189", email: "contact@platrerie-martin.fr", legal_notice: "SARL au capital de 10 000 €.",
}
const proClient = { name: "SCI Les Tilleuls", email: "g@tilleuls.fr", address: "8 avenue Foch", zip_code: "75016", city: "Paris", siren: "443061841", vat_number: "FR57443061841" }

const all = (xml: string, tag: string): string[] =>
  Array.from(xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "g"))).map((m) => m[1].trim())
const one = (xml: string, tag: string) => all(xml, tag)[0]
const c = (s: string | undefined) => Math.round(Number(s) * 100)

function rng(seed: number) {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32 }
}

/** Facture tirée au hasard, passée par le même calcul que le serveur. */
function randomInvoice(r: () => number): DiscountableLine[] {
  const rates = [20, 10, 5.5, 0, 2.1]
  const n = 1 + Math.floor(r() * 7)
  const items: DiscountableLine[] = Array.from({ length: n }, (_, i) => {
    const qty = [1, 2, 3.5, 0.25, 12, 42.5, 1.333][Math.floor(r() * 7)]
    const price = Math.round(r() * (r() < 0.2 ? 500000 : 50000)) / 100
    const disc = r()
    const line: DiscountableLine = { description: `Ligne ${i + 1}`, quantity: qty, unit_price_ht: price, vat_rate: rates[Math.floor(r() * rates.length)] }
    if (disc < 0.35) { line.discount_kind = "pct"; line.discount_value = [5, 10, 12.5, 33.33, 100][Math.floor(r() * 5)] }
    else if (disc < 0.55) { line.discount_kind = "eur"; line.discount_value = Math.round(r() * qty * price * 100) / 100 }
    return line
  })
  const g = r()
  const global = g < 0.4 ? { kind: "pct" as const, value: [3, 5, 7.5, 15, 100][Math.floor(r() * 5)], label: "Remise commerciale" }
    : g < 0.65 ? { kind: "eur" as const, value: Math.round(r() * 30000) / 100, label: "Geste commercial" } : null
  const first = prepareLinesForSave(items)
  if (!first.ok) throw new Error(first.error)
  const withGlobal = global ? [...itemLines(first.lines), ...buildGlobalDiscountLines(itemLines(first.lines), global).lines] : first.lines
  const final = prepareLinesForSave(withGlobal)
  if (!final.ok) return first.lines
  return final.lines
}

function check(lines: DiscountableLine[]) {
  const saved = prepareLinesForSave(lines)
  if (!saved.ok) throw new Error(saved.error)
  const doc = invoiceToFacturX({ invoice_number: "F-2026-100", issue_date: "2026-11-04", due_date: "2026-12-04", lines: saved.lines, client: proClient }, company)
  const { xml, totals } = buildFacturX(doc)
  const items = all(xml, "ram:IncludedSupplyChainTradeLineItem")
  const settlement = one(xml, "ram:ApplicableHeaderTradeSettlement")!
  const sum = one(settlement, "ram:SpecifiedTradeSettlementHeaderMonetarySummation")!
  const headerAllowances = all(settlement, "ram:SpecifiedTradeAllowanceCharge").filter((b) => b.includes("CategoryTradeTax"))

  // Une ligne XML par prestation, aucune pour la remise globale
  expect(items.length).toBe(itemLines(saved.lines).length)
  // BR-CO-10 : somme des lignes
  const lineSum = items.reduce((s, it) => s + c(one(it, "ram:LineTotalAmount")), 0)
  expect(lineSum).toBe(c(one(sum, "ram:LineTotalAmount")))
  // Montant net de ligne = quantité × prix − remise de ligne (à 1 centime près)
  for (const it of items) {
    const qty = Number(one(it, "ram:BilledQuantity")); const price = Number(one(it, "ram:ChargeAmount"))
    const allowance = c(one(one(it, "ram:SpecifiedTradeAllowanceCharge") ?? "", "ram:ActualAmount") ?? "0")
    expect(Math.abs(Math.round(qty * price * 100) - allowance - c(one(it, "ram:LineTotalAmount")))).toBeLessThanOrEqual(1)
    expect(allowance).toBeGreaterThanOrEqual(0)
  }
  // BR-CO-11 : total des remises de pied
  const allowSum = headerAllowances.reduce((s, b) => s + c(one(b, "ram:ActualAmount")), 0)
  expect(allowSum).toBe(c(one(sum, "ram:AllowanceTotalAmount") ?? "0"))
  for (const b of headerAllowances) expect(c(one(b, "ram:ActualAmount"))).toBeGreaterThan(0)
  // BR-CO-13 : base = lignes − remises
  expect(c(one(sum, "ram:TaxBasisTotalAmount"))).toBe(lineSum - allowSum)
  // Ventilation : bases et TVA
  const breakdowns = all(settlement, "ram:ApplicableTradeTax")
  expect(breakdowns.reduce((s, b) => s + c(one(b, "ram:BasisAmount")), 0)).toBe(lineSum - allowSum)
  const tax = breakdowns.reduce((s, b) => s + c(one(b, "ram:CalculatedAmount")), 0)
  expect(tax).toBe(c(one(sum, "ram:TaxTotalAmount")))
  // BR-CO-17 : TVA par taux = base × taux (tolérance de la norme : 1 €)
  for (const b of breakdowns) {
    const expected = Math.round(c(one(b, "ram:BasisAmount")) * Number(one(b, "ram:RateApplicablePercent")) / 100)
    expect(Math.abs(expected - c(one(b, "ram:CalculatedAmount")))).toBeLessThanOrEqual(1)
  }
  // BR-CO-15, et égalité avec le serveur
  expect(c(one(sum, "ram:GrandTotalAmount"))).toBe(lineSum - allowSum + tax)
  expect(c(one(sum, "ram:GrandTotalAmount"))).toBe(Math.round(saved.total_ttc * 100))
  expect(c(one(sum, "ram:TaxBasisTotalAmount"))).toBe(Math.round(saved.subtotal_ht * 100))
  expect(totals.allowances.length).toBe(headerAllowances.length)
  return xml
}

describe("Factur-X — remises", () => {
  it("exemple de la maquette : remises de ligne et remise globale à deux taux", () => {
    const items = prepareLinesForSave([
      { description: "Dépose et pose de carrelage", quantity: 32, unit_price_ht: 45, vat_rate: 10, discount_kind: "pct", discount_value: 10 },
      { description: "Plinthes", quantity: 24, unit_price_ht: 12.5, vat_rate: 10 },
      { description: "Fourniture", quantity: 1, unit_price_ht: 90, vat_rate: 20, discount_kind: "eur", discount_value: 15 },
    ])
    if (!items.ok) throw new Error()
    const lines = [...items.lines, ...buildGlobalDiscountLines(items.lines, { kind: "pct", value: 5, label: "Remise commerciale" }).lines]
    const xml = check(lines)
    expect(xml).toContain("<ram:AllowanceTotalAmount>")
    expect(all(xml, "ram:Reason")).toContain("Remise")
    // Ordre du schéma : ventilation, remises de pied, conditions de paiement, totaux
    const s = one(xml, "ram:ApplicableHeaderTradeSettlement")!
    const iTax = s.lastIndexOf("<ram:ApplicableTradeTax>"), iAllow = s.indexOf("<ram:SpecifiedTradeAllowanceCharge>"), iSum = s.indexOf("<ram:SpecifiedTradeSettlementHeaderMonetarySummation>")
    expect(iTax).toBeLessThan(iAllow); expect(iAllow).toBeLessThan(iSum)
    const sum = one(s, "ram:SpecifiedTradeSettlementHeaderMonetarySummation")!
    expect(sum.indexOf("LineTotalAmount")).toBeLessThan(sum.indexOf("AllowanceTotalAmount"))
    expect(sum.indexOf("AllowanceTotalAmount")).toBeLessThan(sum.indexOf("TaxBasisTotalAmount"))
  })

  it("sans remise : XML inchangé (ni remise ni AllowanceTotalAmount)", () => {
    const xml = check([{ description: "Pose", quantity: 1, unit_price_ht: 100, vat_rate: 20 }])
    expect(xml).not.toContain("SpecifiedTradeAllowanceCharge")
    expect(xml).not.toContain("AllowanceTotalAmount")
  })

  it("3 000 factures au hasard restent cohérentes", () => {
    const r = rng(20261104)
    for (let i = 0; i < 3000; i++) check(randomInvoice(r))
  })
})
