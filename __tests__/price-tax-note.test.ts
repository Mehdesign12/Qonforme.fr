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
