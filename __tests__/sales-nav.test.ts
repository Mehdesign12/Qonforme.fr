import { describe, it, expect } from "vitest"
import { NAV_SALES, NAV_CREDIT_NOTES, NAV_SITE, NAV_BOOK, NAV_PILOTAGE, SALES_KEYS, CREATE_LINKS } from "@/components/layout/nav"
import { salesRailMode } from "@/components/layout/SalesRail"

describe("navigation regroupée", () => {
  it("la chaîne des ventes va du devis à la facture, l'avoir à part", () => {
    expect(NAV_SALES.map((l) => l.key)).toEqual(["quotes", "purchase-orders", "invoices"])
    expect(NAV_CREDIT_NOTES.key).toBe("credit-notes")
    expect(SALES_KEYS).toEqual(["quotes", "purchase-orders", "invoices", "credit-notes"])
  })
  it("chaque écran n'apparaît qu'une fois dans la barre latérale", () => {
    const keys = [...NAV_SALES, NAV_CREDIT_NOTES, ...NAV_SITE, ...NAV_BOOK, ...NAV_PILOTAGE].map((l) => l.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
  it("on peut toujours créer un devis, une facture ou un bon de commande directement", () => {
    const keys = CREATE_LINKS.map((c) => c.key)
    expect(keys).toEqual(expect.arrayContaining(["quote", "invoice", "purchase-order"]))
  })
  it("le rail n'apparaît que sur la racine des quatre listes, réelles et démo", () => {
    expect(salesRailMode("/quotes")).toBe("app")
    expect(salesRailMode("/demo/credit-notes")).toBe("demo")
    expect(salesRailMode("/invoices/new")).toBeNull()
    expect(salesRailMode("/quotes/abc")).toBeNull()
    expect(salesRailMode("/clients")).toBeNull()
  })
})
