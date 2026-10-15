/**
 * Calculs de chantier des outils gratuits (pente, béton) : valeurs de
 * référence recalculées à la main, bornes, et cas limites des flottants.
 */
import { describe, expect, it } from "vitest"
import {
  arrondir, avecMarge, composition, denivele, masseTonnes, penteDepuisDegres, penteDepuisDimensions, penteDepuisPourcent,
  volumeCylindres, volumeRectangulaire, SAC_CIMENT_KG,
} from "@/lib/outils/chantier"

describe("pente", () => {
  it("1 m de dénivelé sur 10 m à plat : 10 %, 5,71°, 1 pour 10", () => {
    const p = penteDepuisDimensions(1, 10)
    expect(p.pourcent).toBeCloseTo(10, 10)
    expect(p.degres).toBeCloseTo(5.710593, 5) // arctan(0,1)
    expect(p.rapport).toBeCloseTo(10, 10)
    expect(p.cmParMetre).toBeCloseTo(10, 10)
    expect(p.longueurInclinee).toBeCloseTo(Math.sqrt(101), 10)
  })

  it("triangle 3-4-5 : 75 %, 36,87°, longueur inclinée exacte", () => {
    const p = penteDepuisDimensions(3, 4)
    expect(p.pourcent).toBeCloseTo(75, 10)
    expect(p.degres).toBeCloseTo(36.869898, 5)
    expect(p.longueurInclinee).toBe(5)
  })

  it("sans dénivelé : pente nulle, pas de rapport", () => {
    const p = penteDepuisDimensions(0, 5)
    expect(p.pourcent).toBe(0)
    expect(p.degres).toBe(0)
    expect(p.rapport).toBeNull()
  })

  it("45° = 100 % = 1 pour 1, dans les deux sens", () => {
    expect(penteDepuisDegres(45).pourcent).toBeCloseTo(100, 10)
    const p = penteDepuisPourcent(100)
    expect(p.degres).toBeCloseTo(45, 10)
    expect(p.rapport).toBeCloseTo(1, 10)
  })

  it("aller-retour pourcentage → degrés → pourcentage", () => {
    for (const pct of [0.5, 2, 5, 17.6327, 33, 150]) {
      expect(penteDepuisDegres(penteDepuisPourcent(pct).degres).pourcent).toBeCloseTo(pct, 8)
    }
  })

  it("repères usuels : 10° ≈ 17,63 %, 5 % ≈ 2,86°", () => {
    expect(penteDepuisDegres(10).pourcent).toBeCloseTo(17.6327, 3)
    expect(penteDepuisPourcent(5).degres).toBeCloseTo(2.8624, 3)
  })

  it("dénivelé d'une pente connue", () => {
    const d = denivele(8, 12.5)
    expect(d.denivele).toBeCloseTo(1, 12)
    expect(d.longueurInclinee).toBeCloseTo(Math.hypot(1, 8), 12)
    expect(denivele(20, 0).denivele).toBe(0)
  })

  it("refuse les valeurs impossibles", () => {
    expect(() => penteDepuisDimensions(1, 0)).toThrow(RangeError)
    expect(() => penteDepuisDimensions(-1, 5)).toThrow(RangeError)
    expect(() => penteDepuisDimensions(NaN, 5)).toThrow(RangeError)
    expect(() => penteDepuisPourcent(-1)).toThrow(RangeError)
    expect(() => penteDepuisDegres(90)).toThrow(RangeError)
    expect(() => penteDepuisDegres(-3)).toThrow(RangeError)
    expect(() => denivele(0, 5)).toThrow(RangeError)
  })
})

describe("béton", () => {
  it("dalle 5 m × 4 m × 12 cm : 2,4 m³, 2,52 m³ avec 5 % de marge, environ 6 t", () => {
    const v = volumeRectangulaire(5, 4, 12)
    expect(v).toBeCloseTo(2.4, 12)
    expect(avecMarge(v, 5)).toBeCloseTo(2.52, 12)
    expect(masseTonnes(v)).toBeCloseTo(5.76, 12)
  })

  it("4 poteaux de 30 cm de diamètre et 2 m : π × 0,15² × 2 × 4", () => {
    expect(volumeCylindres(30, 2, 4)).toBeCloseTo(Math.PI * 0.0225 * 8, 12)
    expect(volumeCylindres(30, 2, 4)).toBeCloseTo(0.5655, 4)
  })

  it("composition de 1 m³ à 350 kg : 10 sacs de 35 kg, 0,4 m³ de sable, 0,8 m³ de gravillons, 175 L d'eau", () => {
    const c = composition(1, 350)
    expect(c.cimentKg).toBe(350)
    expect(c.sacs).toBe(10)
    expect(c.sableM3).toBeCloseTo(0.4, 12)
    expect(c.gravillonsM3).toBeCloseTo(0.8, 12)
    expect(c.eauLitres).toBe(175)
  })

  it("sacs : arrondi au sac supérieur, jamais un sac de trop sur un compte exact", () => {
    expect(composition(2.52, 350).sacs).toBe(26) // 882 kg ÷ 35 = 25,2
    // 2,8 m³ × 350 kg = 980 kg = 28 sacs pile, même si le produit flottant vaut 979,9999… ou 980,0000…1
    expect(composition(2.8, 350).sacs).toBe(28)
    for (let dixiemes = 1; dixiemes <= 400; dixiemes++) {
      const v = dixiemes / 10
      const exact = (dixiemes * 350) / 10 / SAC_CIMENT_KG
      expect(composition(v, 350).sacs, `${v} m³`).toBe(Math.ceil(Math.round(exact * 1e6) / 1e6))
    }
  })

  it("refuse les valeurs impossibles", () => {
    expect(() => volumeRectangulaire(0, 4, 12)).toThrow(RangeError)
    expect(() => volumeRectangulaire(5, 4, -1)).toThrow(RangeError)
    expect(() => volumeCylindres(30, 2, 0)).toThrow(RangeError)
    expect(() => volumeCylindres(30, 2, 1.5)).toThrow(RangeError)
    expect(() => avecMarge(1, -5)).toThrow(RangeError)
    expect(() => composition(0, 350)).toThrow(RangeError)
  })

  it("arrondir", () => {
    expect(arrondir(1.005, 2)).toBe(1.01)
    expect(arrondir(2.675, 2)).toBe(2.68)
    expect(arrondir(0, 2)).toBe(0)
    expect(arrondir(-1.005, 2)).toBe(-1.01)
  })
})
