/**
 * Formule Artisan sur un devis remisé : acompte, situations et solde
 * retombent exactement sur le total du devis, taux par taux.
 */
import { describe, it, expect } from "vitest"
import { computeDeposit, computeFinal, computeSituation, depositGroups, previousProgress, vatGroupsOf, sumGroups, type SourceLine } from "@/lib/artisan/billing"
import { buildGlobalDiscountLines, foldGlobalDiscount, prepareLinesForSave, sumLines } from "@/lib/documents/discounts"

const c = (n: number | string | null | undefined) => Math.round(Number(n) * 100)

function quote(seed: number): SourceLine[] {
  let s = seed >>> 0
  const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32 }
  const rates = [20, 10, 5.5]
  const items = Array.from({ length: 1 + Math.floor(r() * 6) }, (_, i) => ({
    description: `L${i}`, quantity: [1, 2.5, 12, 0.75][Math.floor(r() * 4)], unit_price_ht: Math.round(r() * 300000) / 100,
    vat_rate: rates[Math.floor(r() * 3)],
    ...(r() < 0.4 ? { discount_kind: "pct", discount_value: [5, 10, 33.33][Math.floor(r() * 3)] } : {}),
  }))
  const a = prepareLinesForSave(items); if (!a.ok) throw new Error(a.error)
  const g = r() < 0.5 ? { kind: "pct" as const, value: [2.5, 7, 15][Math.floor(r() * 3)], label: "Remise" } : { kind: "eur" as const, value: Math.round(r() * 20000) / 100, label: "Geste" }
  const b = prepareLinesForSave([...a.lines, ...buildGlobalDiscountLines(a.lines, g).lines]); if (!b.ok) throw new Error(b.error)
  return b.lines as SourceLine[]
}

describe("Formule Artisan et remises", () => {
  it("lignes repliées : même total, même TVA par taux, une ligne par prestation", () => {
    for (let seed = 1; seed < 400; seed++) {
      const q = quote(seed)
      const folded = foldGlobalDiscount(q)
      expect(folded.every((l) => (l as { kind?: string }).kind !== "document_discount")).toBe(true)
      expect(sumLines(folded)).toEqual(sumLines(q))
      expect(vatGroupsOf(folded)).toEqual(vatGroupsOf(q))
    }
  })

  it("situations jusqu'à 100 % puis acompte repris : total facturé = total du devis", () => {
    for (let seed = 1; seed < 300; seed++) {
      const q = quote(seed)
      const total = sumLines(q)
      const dep = computeDeposit(q, { mode: "percent", percent: 30 }, { quoteNumber: "D-1" })
      if (!dep.ok) throw new Error(dep.error)
      const depositRecord = { invoice_id: "a", number: "FA-1", issue_date: "2026-11-01", groups: depositGroups(dep.lines as SourceLine[]) }
      expect(Math.abs(sumGroups(depositGroups(dep.lines as SourceLine[])).ttc - Math.round(c(total.total_ttc) * 0.3))).toBeLessThanOrEqual(2)
      const folded = foldGlobalDiscount(q)
      const s1 = computeSituation(folded, { global: 40 }, previousProgress(folded.length, []), { records: [depositRecord], deducted: [] })
      if (!s1.ok) throw new Error(s1.error)
      const deducted = [{ invoice_id: "a", groups: s1.deductions?.[0]?.groups ?? [] }]
      const s2 = computeSituation(folded, { global: 100 }, previousProgress(folded.length, [{ lines: s1.lines }]), { records: [depositRecord], deducted })
      if (!s2.ok) throw new Error(s2.error)
      const billedTtc = c(dep.lines.reduce((s, l) => s + l.total_ttc, 0)) + s1.ttc + s2.ttc
      expect(billedTtc).toBe(c(total.total_ttc))
      expect(s1.contract_ht).toBe(c(total.subtotal_ht))
    }
  })

  it("solde : remises recopiées, total = devis − acompte", () => {
    const q = quote(42)
    const dep = computeDeposit(q, { mode: "percent", percent: 20 })
    if (!dep.ok) throw new Error(dep.error)
    const f = computeFinal(q, [{ invoice_id: "a", number: "FA-1", issue_date: "2026-11-01", groups: depositGroups(dep.lines as SourceLine[]) }])
    if (!f.ok) throw new Error(f.error)
    expect(f.lines.some((l) => (l as { kind?: string }).kind === "document_discount")).toBe(true)
    expect(f.ttc + c(dep.lines.reduce((s, l) => s + l.total_ttc, 0))).toBe(c(sumLines(q).total_ttc))
  })
})
