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

import { quoteChainSteps } from "@/components/documents/DocumentChain"

describe("chaîne du document", () => {
  const base = { quote_number: "D-2026-014", converted: false, converted_invoice: null }
  it("devis accepté : la facture est la prochaine étape, le bon de commande reste facultatif", () => {
    const s = quoteChainSteps({ ...base, status: "accepted" })
    expect(s.map((x) => x.state)).toEqual(["done", "optional", "next"])
  })
  it("devis envoyé : on attend l'accord, rien n'est dit de la facture", () => {
    const s = quoteChainSteps({ ...base, status: "sent" })
    expect(s.map((x) => x.state)).toEqual(["next", "optional", "todo"])
  })
  it("devis converti : la facture est faite et cliquable", () => {
    const s = quoteChainSteps({ ...base, status: "accepted", converted: true, converted_invoice: { number: "F-2026-003", href: "/invoices/x" } })
    expect(s[2]).toMatchObject({ state: "done", sub: "F-2026-003", href: "/invoices/x" })
  })
  it("facturation par situations : l'étape le dit au lieu d'inviter à convertir", () => {
    const s = quoteChainSteps({ ...base, status: "accepted" }, "Facturation par situations")
    expect(s[2].sub).toBe("Acomptes et situations")
  })
})
