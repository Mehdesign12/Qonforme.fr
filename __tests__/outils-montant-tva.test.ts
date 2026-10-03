import { describe, expect, it } from "vitest"
import { parseMontant, parseNombre } from "@/lib/outils/montant"
import { aAuPlusDecimales, divArrondi, formatCentimes, versEntier } from "@/lib/outils/decimal"
import { TVA_RATES, calculateVat, depuisHt, depuisTtc, htToTtc, ttcToHt } from "@/lib/outils/tva"

describe("lecture des montants saisis (lib/outils/montant.ts)", () => {
  it("virgule décimale française, espaces de milliers, espaces insécables", () => {
    expect(parseMontant("12,5")).toBe(12.5)
    expect(parseMontant("1 234,56")).toBe(1234.56)
    expect(parseMontant("1 234,56")).toBe(1234.56)
    expect(parseMontant("1 234,56")).toBe(1234.56)
    expect(parseMontant("  1 000 000 ")).toBe(1_000_000)
    expect(parseMontant("1 234,56 €")).toBe(1234.56)
  })

  it("point des milliers et virgule décimale (« 1.234,56 » n'est plus lu 1,234)", () => {
    expect(parseMontant("1.234,56")).toBe(1234.56)
    expect(parseMontant("1.234.567,8")).toBe(1234567.8)
    expect(parseMontant("1.234")).toBe(1234)
    expect(parseMontant("12.500")).toBe(12500)
  })

  it("notation anglaise", () => {
    expect(parseMontant("1234.56")).toBe(1234.56)
    expect(parseMontant("1,234.56")).toBe(1234.56)
    expect(parseMontant("12.5")).toBe(12.5)
    expect(parseMontant("0.125")).toBe(0.125)
  })

  it("signe, zéro, cas limites", () => {
    expect(parseMontant("-50")).toBe(-50)
    expect(parseMontant("−50,5")).toBe(-50.5)
    expect(parseMontant("0")).toBe(0)
    expect(Object.is(parseMontant("-0"), 0)).toBe(true)
    expect(parseMontant(",5")).toBe(0.5)
  })

  it("saisies invalides : null", () => {
    for (const s of ["", "  ", "abc", "12a", "1,2,3", "1.23.4", "1.234,5.6", "--1", ",", ".", "1,23,456.7"]) {
      expect(parseMontant(s), s).toBeNull()
    }
  })

  it("quantités et taux : un séparateur seul est toujours décimal", () => {
    expect(parseNombre("1.5")).toBe(1.5)
    expect(parseNombre("1.500")).toBe(1.5)
    expect(parseNombre("2,125")).toBe(2.125)
    expect(parseNombre("1 000")).toBe(1000)
    expect(parseNombre("1.234,5")).toBe(1234.5)
    expect(parseNombre("x")).toBeNull()
  })
})

describe("arrondi décimal exact (lib/outils/decimal.ts)", () => {
  it("demi au centime supérieur, depuis l'écriture décimale", () => {
    expect(versEntier(1.005, 2)).toBe(101)
    expect(versEntier(0.495, 2)).toBe(50)
    expect(versEntier(-1.005, 2)).toBe(-101)
    expect(versEntier(12.5, 3)).toBe(12500)
    expect(versEntier(1e-7, 2)).toBe(0)
  })

  it("division arrondie, le demi loin de zéro", () => {
    expect(divArrondi(5, 10)).toBe(1)
    expect(divArrondi(4, 10)).toBe(0)
    expect(divArrondi(-5, 10)).toBe(-1)
    expect(divArrondi(49_500, 100_000)).toBe(0)
    expect(divArrondi(50_000, 100_000)).toBe(1)
  })

  it("décimales autorisées", () => {
    expect(aAuPlusDecimales(10.25, 2)).toBe(true)
    expect(aAuPlusDecimales(10.255, 2)).toBe(false)
    expect(aAuPlusDecimales(12.5, 3)).toBe(true)
  })

  it("format des centimes sans flottant", () => {
    expect(formatCentimes(123456)).toBe("1 234,56 €")
    expect(formatCentimes(7)).toBe("0,07 €")
    expect(formatCentimes(-950)).toBe("−9,50 €")
  })
})

describe("calculateur de TVA (lib/outils/tva.ts)", () => {
  it("9 € HT à 5,5 % donnent 0,50 € de TVA et 9,50 € TTC", () => {
    expect(depuisHt(9, 5.5)).toEqual({ ht: 9, tva: 0.5, ttc: 9.5 })
    expect(calculateVat(9, 5.5)).toBe(0.5)
    expect(htToTtc(9, 5.5)).toBe(9.5)
  })

  it("exemples de référence", () => {
    expect(depuisHt(1000, 20)).toEqual({ ht: 1000, tva: 200, ttc: 1200 })
    expect(depuisHt(1234.56, 10)).toEqual({ ht: 1234.56, tva: 123.46, ttc: 1358.02 })
    expect(depuisTtc(1200, 20)).toEqual({ ht: 1000, tva: 200, ttc: 1200 })
    expect(depuisTtc(5, 10)).toEqual({ ht: 4.55, tva: 0.45, ttc: 5 })
    expect(ttcToHt(54, 5.5)).toBe(51.18)
  })

  it("plage exhaustive : HT + TVA = TTC au centime, TVA = arrondi exact de HT × taux", () => {
    const taux = TVA_RATES.map((r) => r.value)
    for (const t of [...taux, 0]) {
      const tCentiemes = Math.round(t * 100)
      for (let c = 1; c <= 200_000; c += c < 2_000 ? 1 : 37) {
        const ht = c / 100
        const r = depuisHt(ht, t)
        const htC = Math.round(r.ht * 100)
        const tvaC = Math.round(r.tva * 100)
        const ttcC = Math.round(r.ttc * 100)
        expect(htC).toBe(c)
        expect(htC + tvaC).toBe(ttcC)
        // Référence en arithmétique entière : arrondi au demi supérieur de c × t / 100
        const num = c * tCentiemes
        const attendu = Math.floor(num / 10_000) + (num % 10_000 >= 5_000 ? 1 : 0)
        expect(tvaC).toBe(attendu)

        const inv = depuisTtc(ht, t)
        expect(Math.round(inv.ht * 100) + Math.round(inv.tva * 100)).toBe(c)
        expect(Math.round(inv.ttc * 100)).toBe(c)
      }
    }
  })

  it("TTC → HT → TTC retombe sur le même TTC dans la quasi-totalité des cas, jamais à plus d'un centime", () => {
    for (const t of [20, 10, 5.5, 2.1]) {
      for (let c = 1; c <= 50_000; c++) {
        const { ht } = depuisTtc(c / 100, t)
        const retour = Math.round(depuisHt(ht, t).ttc * 100)
        expect(Math.abs(retour - c)).toBeLessThanOrEqual(1)
      }
    }
  })
})
