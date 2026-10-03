import { describe, expect, it } from "vitest"
import {
  bicError, formatIbanGroups, ibanError, isSepaIban, isValidBic, isValidIban, normalizeBic, normalizeIban,
} from "@/lib/payment-link/iban"

describe("IBAN (ISO 13616, clé mod 97)", () => {
  it("accepte les exemples du registre IBAN de SWIFT", () => {
    expect(isValidIban("FR1420041010050500013M02606")).toBe(true) // France (exemple du registre, aussi dans EPC069-12)
    expect(isValidIban("DE89370400440532013000")).toBe(true)
    expect(isValidIban("BE68539007547034")).toBe(true)
    expect(isValidIban("GB29NWBK60161331926819")).toBe(true)
    expect(isValidIban("CH9300762011623852957")).toBe(true)
    expect(isValidIban("NO9386011117947")).toBe(true)
    expect(isValidIban("MT84MALT011000012345MTLCAST001S")).toBe(true)
  })

  it("tolère espaces, tirets et minuscules", () => {
    expect(isValidIban("fr14 2004 1010 0505 0001 3m02 606")).toBe(true)
    expect(normalizeIban(" fr14-2004 1010 ")).toBe("FR1420041010")
    expect(formatIbanGroups("FR1420041010050500013M02606")).toBe("FR14 2004 1010 0505 0001 3M02 606")
  })

  it("refuse une erreur de frappe (clé de contrôle)", () => {
    expect(isValidIban("FR1420041010050500013M02607")).toBe(false)
    expect(isValidIban("FR1520041010050500013M02606")).toBe(false)
    // Deux chiffres inversés
    expect(isValidIban("FR1420041010050500031M02606")).toBe(false)
  })

  it("contrôle la longueur des pays de la zone SEPA", () => {
    expect(isValidIban("FR1420041010050500013M0260")).toBe(false)
    expect(ibanError("FR1420041010050500013M0260")).toMatch(/27 caractères/)
  })

  it("refuse ce qui n'a pas la forme d'un IBAN", () => {
    expect(isValidIban("")).toBe(false)
    expect(isValidIban(null)).toBe(false)
    expect(isValidIban("1234567890")).toBe(false)
    expect(isValidIban("FRAB20041010050500013M02606")).toBe(false)
    expect(ibanError("30004 00000 12345678901 23")).toMatch(/code du pays/)
  })

  it("ibanError : rien pour un champ vide ou un IBAN valide", () => {
    expect(ibanError("")).toBeNull()
    expect(ibanError("FR14 2004 1010 0505 0001 3M02 606")).toBeNull()
    expect(ibanError("FR1420041010050500013M02607")).toMatch(/clé de contrôle/)
  })

  it("distingue les IBAN de la zone SEPA (seuls à recevoir un virement SEPA)", () => {
    expect(isSepaIban("FR1420041010050500013M02606")).toBe(true)
    expect(isSepaIban("GB29NWBK60161331926819")).toBe(true)
    // Brésil : IBAN valide, hors zone SEPA
    expect(isValidIban("BR1800360305000010009795493C1")).toBe(true)
    expect(isSepaIban("BR1800360305000010009795493C1")).toBe(false)
  })

  it("accepte l'IBAN fictif de la démo (code banque 00000)", () => {
    expect(isValidIban("FR76 0000 0000 0000 0000 0000 000")).toBe(true)
  })
})

describe("BIC (ISO 9362)", () => {
  it("accepte 8 ou 11 caractères", () => {
    expect(isValidBic("BNPAFRPP")).toBe(true)
    expect(isValidBic("BNPAFRPPXXX")).toBe(true)
    expect(isValidBic("bnpa fr pp xxx")).toBe(true)
    expect(normalizeBic(" bnpafrpp ")).toBe("BNPAFRPP")
  })

  it("refuse une longueur ou un pays invalide", () => {
    expect(isValidBic("BNPAFRP")).toBe(false)
    expect(isValidBic("BNPAFRPPXX")).toBe(false)
    expect(isValidBic("BNPA12PP")).toBe(false)
    expect(bicError("BNPAFRPPXX")).toMatch(/8 ou 11/)
    expect(bicError("BNPA12PP")).toMatch(/BIC invalide/)
    expect(bicError("")).toBeNull()
  })
})
