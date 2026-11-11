import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { PRICE_TAX_NOTE, VAT_COLLECTED } from "@/lib/stripe/plans"
import { buildLlmsTxt } from "@/lib/seo/llms"

describe("TVA des prix et formule Artisan, dits clairement", () => {
  it("la phrase sur la TVA suit VAT_COLLECTED", () => {
    expect(PRICE_TAX_NOTE).toBe(
      VAT_COLLECTED ? "Prix hors taxes : la TVA à 20 % s'y ajoute." : "Prix nets, sans TVA facturée : le montant affiché est le montant payé.",
    )
  })

  it("Tarifs, CGU et llms.txt reprennent la même phrase", () => {
    for (const f of ["app/pricing/page.tsx", "app/cgu/page.tsx"]) expect(readFileSync(f, "utf8")).toContain("PRICE_TAX_NOTE")
    expect(buildLlmsTxt()).toContain(PRICE_TAX_NOTE)
  })

  it("les CGU ne disent plus la formule Artisan « à venir » en dur", () => {
    const cgu = readFileSync("app/cgu/page.tsx", "utf8")
    expect(cgu).toMatch(/PLANS\.pro\.available\s*\?/)
  })
})

describe("e-reporting dit clairement", async () => {
  const { EREPORTING_LIVE, EREPORTING_SENTENCE, ereportingTexts } = await import("@/lib/pa/ereporting")
  const { PLANS } = await import("@/lib/stripe/plans")

  it("tant qu'il n'est pas livré : promesse datée, ligne « à venir » d'Essentiel", () => {
    expect(ereportingTexts(false).sentence).toMatch(/avant le 1er septembre 2027/)
    expect(ereportingTexts(false).sentence).toMatch(/avec Essentiel/)
    expect(ereportingTexts(true).sentence).toBe("Avec Essentiel, Qonforme transmet votre e-reporting : ventes aux particuliers et encaissements, au rythme de votre régime de TVA.")
    if (!EREPORTING_LIVE) expect(PLANS.starter.upcoming.join(" ")).toMatch(/E-reporting/)
    else expect(PLANS.starter.features.join(" ")).toMatch(/E-reporting/)
    expect(PLANS.pro.features.join(" ")).not.toMatch(/E-reporting/)
  })

  it("repris par llms.txt, la FAQ des Tarifs, le guide et Paramètres, sans nommer la plateforme", () => {
    expect(buildLlmsTxt()).toContain(EREPORTING_SENTENCE)
    for (const f of ["app/pricing/page.tsx", "lib/pseo/guides.ts", "components/settings/EInvoicingView.tsx"]) {
      expect(readFileSync(f, "utf8")).toContain("EREPORTING_SENTENCE")
    }
    expect(`${ereportingTexts(false).sentence} ${ereportingTexts(true).sentence}`).not.toMatch(/super ?pdp/i)
  })
})
