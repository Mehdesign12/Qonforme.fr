/**
 * Catalogue pré-rempli selon le métier (lib/catalogue/trades.ts) : structure
 * des listes, taux de TVA proposés selon les règles du bâtiment, aucun prix
 * inventé, import sans doublon.
 */
import { describe, it, expect } from "vitest"
import { TRADES } from "@/lib/legal/profile"
import {
  TRADE_CATALOGUES, buildImportRows, normalizeProductName, proposedVatRate, tradeItems,
  type CatalogueUnit, type VatNature,
} from "@/lib/catalogue/trades"

const UNITS: CatalogueUnit[] = ["m²", "ml", "m³", "unité", "heure", "forfait"]
const NATURES: VatNature[] = ["travaux", "energie", "normal"]

describe("listes par métier", () => {
  it("chaque métier proposé a sa liste, et seulement eux", () => {
    expect(Object.keys(TRADE_CATALOGUES).sort()).toEqual(TRADES.map((t) => t.id).sort())
  })

  it("prestations bien formées : identifiant unique, désignation, unité et nature connues, aucun prix", () => {
    for (const [trade, items] of Object.entries(TRADE_CATALOGUES)) {
      expect(items.length, trade).toBeGreaterThan(0)
      const ids = items.map((i) => i.id)
      expect(new Set(ids).size, `${trade} : identifiants en double`).toBe(ids.length)
      const names = items.map((i) => normalizeProductName(i.name))
      expect(new Set(names).size, `${trade} : désignations en double`).toBe(names.length)
      for (const item of items) {
        expect(item.name.trim().length, item.id).toBeGreaterThan(3)
        expect(UNITS).toContain(item.unit)
        expect(NATURES).toContain(item.vat)
        expect(item).not.toHaveProperty("unit_price_ht")
        expect(item).not.toHaveProperty("price")
      }
    }
  })

  it("les grands métiers attendus sont couverts", () => {
    for (const t of ["plaquiste", "plombier", "electricien", "peintre", "carreleur", "macon", "menuisier", "couvreur", "chauffagiste", "serrurier", "paysagiste"] as const) {
      expect(tradeItems(t).length, t).toBeGreaterThanOrEqual(6)
    }
    expect(tradeItems(null)).toEqual([])
  })
})

describe("TVA proposée", () => {
  it("logement de plus de 2 ans : 10 % travaux, 5,5 % rénovation énergétique, 20 % exclusions", () => {
    expect(proposedVatRate("travaux", "renovation")).toBe(10)
    expect(proposedVatRate("energie", "renovation")).toBe(5.5)
    expect(proposedVatRate("normal", "renovation")).toBe(20)
  })

  it("neuf ou locaux professionnels : 20 % partout ; franchise : 0 %", () => {
    for (const n of NATURES) {
      expect(proposedVatRate(n, "standard")).toBe(20)
      expect(proposedVatRate(n, "franchise")).toBe(0)
    }
  })

  it("exclusions des taux réduits : chaudière gaz, espaces verts", () => {
    const gaz = tradeItems("chauffagiste").find((i) => i.id === "chaudiere-gaz")!
    expect(gaz.vat).toBe("normal")
    expect(gaz.note).toMatch(/1er mars 2025/)
    for (const item of tradeItems("paysagiste")) expect(item.vat, item.id).toBe("normal")
  })

  it("rénovation énergétique : PAC air/eau, isolation des combles, fenêtres", () => {
    expect(tradeItems("chauffagiste").find((i) => i.id === "pac-air-eau")!.vat).toBe("energie")
    expect(tradeItems("plaquiste").find((i) => i.id === "isolation-combles")!.vat).toBe("energie")
    expect(tradeItems("menuisier").find((i) => i.id === "fenetre")!.vat).toBe("energie")
  })
})

describe("import", () => {
  it("prestations cochées seulement, taux du chantier type, prix à 0 € s'il n'est pas saisi", () => {
    const { rows, skipped } = buildImportRows({
      trade: "plaquiste",
      context: "renovation",
      items: [{ id: "cloison-ba13", unit_price_ht: 48 }, { id: "isolation-combles" }, { id: "inconnu" }],
    })
    expect(skipped).toEqual([])
    expect(rows).toEqual([
      { name: "Cloison sur ossature métallique, plaques de plâtre BA13", unit: "m²", vat_rate: 10, unit_price_ht: 48 },
      { name: "Isolation des combles perdus", unit: "m²", vat_rate: 5.5, unit_price_ht: 0 },
    ])
  })

  it("aucun doublon : prestations déjà au catalogue ou cochées deux fois", () => {
    const { rows, skipped } = buildImportRows({
      trade: "peintre",
      context: "standard",
      items: [{ id: "murs" }, { id: "murs" }, { id: "plafonds" }],
      existingNames: ["  peinture des MURS, deux couches "],
    })
    expect(rows.map((r) => r.name)).toEqual(["Peinture des plafonds, deux couches"])
    expect(skipped).toEqual(["Peinture des murs, deux couches"])
  })

  it("prix négatif ou illisible : jamais repris", () => {
    const { rows } = buildImportRows({
      trade: "plombier",
      context: "franchise",
      items: [{ id: "mitigeur", unit_price_ht: -5 }, { id: "debouchage", unit_price_ht: Number.NaN }],
    })
    expect(rows.map((r) => [r.unit_price_ht, r.vat_rate])).toEqual([[0, 0], [0, 0]])
  })
})
