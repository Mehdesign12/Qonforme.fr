import { describe, expect, it } from "vitest"
import { legalFromCategory, tradeFromApe } from "@/lib/legal/from-sirene"
import { COMPANY_TYPES, isTradeId } from "@/lib/legal/profile"

describe("legalFromCategory", () => {
  it("1000 : entrepreneur individuel", () => {
    expect(legalFromCategory("1000")).toEqual({ legal_form: "ei", company_type: null, label: "Entrepreneur individuel" })
  })

  it.each([
    ["5498", "EURL"],
    ["5499", "SARL"],
    ["5485", "SARL"],
    ["5710", "SAS"],
    ["5720", "SASU"],
    ["5599", "SA"],
    ["5699", "SA"],
    ["5202", "SNC"],
  ])("%s : %s", (code, type) => {
    expect(legalFromCategory(code)).toEqual({ legal_form: "societe", company_type: type, label: type })
  })

  it("formes de société toutes proposées dans Paramètres › Entreprise", () => {
    for (const code of ["5498", "5499", "5710", "5720", "5599", "5202"]) {
      expect(COMPANY_TYPES).toContain(legalFromCategory(code).company_type)
    }
  })

  it.each(["5785", "5306", "6540", "6599", "7210"])("%s : société sans forme précise", (code) => {
    expect(legalFromCategory(code)).toEqual({ legal_form: "societe", company_type: null, label: "Société" })
  })

  it("catégorie numérique (API Recherche d'entreprises) et espaces acceptés", () => {
    expect(legalFromCategory(5710).company_type).toBe("SAS")
    expect(legalFromCategory(" 1000 ").legal_form).toBe("ei")
  })

  it.each([undefined, null, "", "9220", "2110", "abcd", "100", "10000"])("%s : inconnue", (code) => {
    expect(legalFromCategory(code)).toEqual({ legal_form: null, company_type: null, label: "" })
  })
})

describe("tradeFromApe", () => {
  it.each([
    ["43.31Z", "plaquiste"],
    ["43.34Z", "peintre"],
    ["43.22A", "plombier"],
    ["43.22B", "chauffagiste"],
    ["43.21A", "electricien"],
    ["43.33Z", "carreleur"],
    ["43.99C", "macon"],
    ["43.32A", "menuisier"],
    ["43.32B", "serrurier"],
    ["43.91B", "couvreur"],
    ["81.30Z", "paysagiste"],
  ])("%s → %s", (code, trade) => {
    expect(tradeFromApe(code)).toBe(trade)
    expect(isTradeId(tradeFromApe(code))).toBe(true)
  })

  it("code sans point, en minuscules ou avec des espaces", () => {
    expect(tradeFromApe("4331Z")).toBe("plaquiste")
    expect(tradeFromApe("43.31z")).toBe("plaquiste")
    expect(tradeFromApe(" 43 22A ")).toBe("plombier")
  })

  it.each([undefined, null, "", "62.01Z", "43.91A", "43.31", "constructor", "__proto__"])("%s : aucun métier", (code) => {
    expect(tradeFromApe(code)).toBeNull()
  })
})
