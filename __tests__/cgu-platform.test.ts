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
