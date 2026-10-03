import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import { buildEpcPayload, epcAmount } from "@/lib/payment-link/epc"
import { dataCodewords, encodeQr, formatBits, qrSvgPath, versionFor } from "@/lib/payment-link/qr"

describe("Chaîne EPC du virement SEPA (EPC069-12 v3.1)", () => {
  it("reproduit l'exemple V2 du document (jeu UTF-8, montant au centime)", () => {
    const payload = buildEpcPayload({
      name: "François D'Alsace S.A.",
      iban: "FR14 2004 1010 0505 0001 3M02 606",
      amount: 12.3,
      remittance: "Client:Marie Louise La Lune",
    })
    // Exemple du document : 11 éléments, 10 sauts de ligne, BIC et motif vides
    expect(payload).toBe("BCD\n002\n1\nSCT\n\nFrançois D'Alsace S.A.\nFR1420041010050500013M02606\nEUR12.30\n\n\nClient:Marie Louise La Lune")
    expect(payload!.split("\n")).toHaveLength(11)
  })

  it("place le BIC valide et ne termine jamais par un séparateur", () => {
    const payload = buildEpcPayload({ name: "Garnier", iban: "FR1420041010050500013M02606", bic: "bnpafrppxxx", amount: 100, remittance: "" })
    expect(payload).toBe("BCD\n002\n1\nSCT\nBNPAFRPPXXX\nGarnier\nFR1420041010050500013M02606\nEUR100.00")
    expect(payload!.endsWith("\n")).toBe(false)
  })

  it("ignore un BIC invalide (facultatif en version 002)", () => {
    const payload = buildEpcPayload({ name: "Garnier", iban: "FR1420041010050500013M02606", bic: "NOPE", amount: 1, remittance: "F-1" })
    expect(payload!.split("\n")[4]).toBe("")
  })

  it("tronque le nom à 70 caractères et le texte à 140, sans saut de ligne", () => {
    const payload = buildEpcPayload({ name: "N".repeat(90), iban: "FR1420041010050500013M02606", amount: 1, remittance: "a\nb" + "x".repeat(200) })!
    const parts = payload.split("\n")
    expect(parts[5]).toHaveLength(70)
    expect(parts[10]).toHaveLength(140)
    expect(parts[10].startsWith("a b")).toBe(true)
  })

  it("refuse IBAN hors SEPA ou invalide, montant hors bornes, nom vide", () => {
    const base = { name: "X", iban: "FR1420041010050500013M02606", amount: 10, remittance: "F" }
    expect(buildEpcPayload({ ...base, iban: "BR1800360305000010009795493C1" })).toBeNull()
    expect(buildEpcPayload({ ...base, iban: "FR1420041010050500013M02607" })).toBeNull()
    expect(buildEpcPayload({ ...base, amount: 0 })).toBeNull()
    expect(buildEpcPayload({ ...base, amount: 1_000_000_000 })).toBeNull()
    expect(buildEpcPayload({ ...base, name: "  " })).toBeNull()
  })

  it("formate le montant au point décimal, au centime", () => {
    expect(epcAmount(1234.5)).toBe("EUR1234.50")
    expect(epcAmount(0.01)).toBe("EUR0.01")
    expect(epcAmount(999_999_999.99)).toBe("EUR999999999.99")
    expect(epcAmount(0.004)).toBeNull()
    expect(epcAmount(Number.NaN)).toBeNull()
  })
})

/** Lignes « 0/1 » d'une matrice. */
const rows = (m: boolean[][]) => m.map((r) => r.map((b) => (b ? "1" : "0")).join(""))

describe("QR code (ISO/IEC 18004, mode octet, niveau M)", () => {
  it("information de format conforme à la table de la norme (niveau M)", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((m) => formatBits(m).toString(2).padStart(15, "0"))).toEqual([
      "101010000010010", "101000100100101", "101111001111100", "101101101001011",
      "100010111111001", "100000011001110", "100111110010111", "100101010100000",
    ])
  })

  it("capacités du niveau M et choix de la version", () => {
    expect(dataCodewords(1)).toBe(16)
    expect(dataCodewords(7)).toBe(124)
    expect(dataCodewords(13)).toBe(334)
    expect(versionFor(14)).toBe(1)
    expect(versionFor(15)).toBe(2)
    // EPC : 331 octets au plus tiennent en version 13
    expect(versionFor(331)).toBe(13)
    expect(versionFor(332, 13)).toBeNull()
  })

  it("motifs fixes : repères, synchronisation, module foncé", () => {
    const qr = encodeQr("BCD\n002\n1\nSCT\n\nGarnier\nFR1420041010050500013M02606\nEUR10.00")!
    const r = rows(qr.modules)
    const n = qr.size
    expect(n).toBe(qr.version * 4 + 17)
    for (const [x, y] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
      expect(r[y].slice(x, x + 7)).toBe("1111111")
      expect(r[y + 1].slice(x, x + 7)).toBe("1000001")
      expect(r[y + 3].slice(x, x + 7)).toBe("1011101")
      expect(r[y + 6].slice(x, x + 7)).toBe("1111111")
    }
    expect(r[6].slice(8, n - 8)).toBe("10".repeat(n).slice(0, n - 16))
    expect(r.slice(8, n - 8).map((row) => row[6]).join("")).toBe("10".repeat(n).slice(0, n - 16))
    expect(qr.modules[n - 8][8]).toBe(true)
  })

  it("matrices de référence (vérifiées au développement : identiques à la bibliothèque segno à masque égal, relues par le décodeur jsQR)", () => {
    const sha = (text: string) => {
      const qr = encodeQr(text)!
      return { v: qr.version, mask: qr.mask, sha: createHash("sha256").update(rows(qr.modules).join("\n")).digest("hex") }
    }
    expect(sha("hello")).toEqual({ v: 1, mask: 0, sha: "52a7aa67e7296ede539d6be86579c7180e3b6d417445712ae8bd314c1818458a" })
    expect(sha("BCD\n002\n1\nSCT\nDEMOFRPPXXX\nGarnier Plâtrerie Isolation\nFR7600000000000000000000000\nEUR19584.00\n\n\nFacture F-2026-0142"))
      .toEqual({ v: 7, mask: 7, sha: "7613fc561756c0e18a14409ad4e4825b3dc8c9d323c2ebe8e4519117063eb8fe" })
    expect(sha("A".repeat(320))).toEqual({ v: 13, mask: 3, sha: "1089f26a93f1c48dd5fd3edd9acfc8e3a5545ce99ec22a69b9b7719b1ca82f00" })
  })

  it("respecte la version maximale demandée", () => {
    expect(encodeQr("x".repeat(400), { maxVersion: 13 })).toBeNull()
    expect(encodeQr("x".repeat(400))!.version).toBeGreaterThan(13)
  })

  it("tracé SVG : marge de 4 modules, un rectangle par suite de modules foncés", () => {
    const qr = encodeQr("hello")!
    const path = qrSvgPath(qr)
    expect(path.startsWith("M4 4h7v1h-7z")).toBe(true)
    expect(path).not.toMatch(/NaN|undefined/)
  })
})
