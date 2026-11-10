import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const cgu = readFileSync("app/cgu/page.tsx", "utf8")

describe("CGU et plateforme agréée", () => {
  it("ne remet plus toute la transmission à la charge de l'utilisateur", () => {
    expect(cgu).not.toMatch(/Effectuer lui-même la transmission des factures/)
    expect(cgu).not.toMatch(/Chorus Pro/)
    expect(cgu).not.toMatch(/Plateforme de Dématérialisation Partenaire/)
  })
  it("ne nomme pas la plateforme partenaire et suit le réglage d'ouverture de l'envoi", () => {
    expect(cgu).not.toMatch(/Super\s?PDP|SUPER G/)
    expect(cgu).toMatch(/une plateforme agréée/)
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
  it("seule la politique de confidentialité nomme la plateforme partenaire", () => {
    expect(conf).toMatch(/Super PDP/)
    expect(ml).not.toMatch(/Super\s?PDP|SUPER G/)
    expect(ml).toMatch(/href="\/confidentialite"/)
  })
})

describe("Plateforme partenaire jamais nommée en public (décision du 08/11/2026)", () => {
  const PUBLIC = [
    "app/page.tsx", "app/pricing/page.tsx", "app/cgu/page.tsx", "app/mentions-legales/page.tsx",
    "app/logiciel-gestion-batiment/page.tsx", "app/logiciel-dematerialisation-factures/page.tsx",
    "app/outils/lecteur-factur-x/page.tsx", "app/outils/generateur-facture-gratuite/page.tsx",
    "app/outils/verificateur-conformite-facture/page.tsx",
    "components/home/HomeHero.tsx", "components/home/Features.tsx", "components/home/Closing.tsx",
    "lib/stripe/plans.ts", "lib/pseo/guides.ts", "lib/pseo/metiers.ts", "lib/seo/llms.ts",
    "lib/outils/lecteur-facture.ts", "lib/pa/sending.ts",
  ]
  it.each(PUBLIC)("%s", (f) => {
    const src = readFileSync(f, "utf8").replace(/^\s*(\/\/|\*|\/\*).*$/gm, "")
    expect(src).not.toMatch(/Super\s?PDP|SUPER G\b/)
  })
})
