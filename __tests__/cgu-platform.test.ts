import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const cgu = readFileSync("app/cgu/page.tsx", "utf8")

describe("CGU et plateforme agréée", () => {
  it("ne remet plus toute la transmission à la charge de l'utilisateur", () => {
    expect(cgu).not.toMatch(/Effectuer lui-même la transmission des factures/)
    expect(cgu).not.toMatch(/Chorus Pro/)
    expect(cgu).not.toMatch(/Plateforme de Dématérialisation Partenaire/)
  })
  it("nomme Super PDP et suit le réglage d'ouverture de l'envoi", () => {
    expect(cgu).toMatch(/Super PDP/)
    expect(cgu).toMatch(/PLATFORM_SENDING_LIVE/)
    expect(cgu).toMatch(/n&apos;est pas lui-même une plateforme agréée/)
  })
})

describe("Confidentialité et mentions légales et plateforme agréée", () => {
  const conf = readFileSync("app/confidentialite/page.tsx", "utf8")
  const ml = readFileSync("app/mentions-legales/page.tsx", "utf8")
  it("la politique décrit l'envoi par Super PDP selon le réglage d'ouverture", () => {
    expect(conf).toMatch(/PLATFORM_SENDING_LIVE/)
    expect(conf).toMatch(/envoi de vos factures et avoirs à vos clients professionnels/)
    expect(conf).toMatch(/déclare l'encaissement/)
  })
  it("les mentions légales citent Super PDP et renvoient à la liste complète", () => {
    expect(ml).toMatch(/Super PDP/)
    expect(ml).toMatch(/href="\/confidentialite"/)
  })
})
