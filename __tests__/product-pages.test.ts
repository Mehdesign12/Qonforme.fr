/**
 * Pages de produit du 30/10/2026 (devis gratuit, relances, export FEC, situations de
 * travaux) et /llms.txt.
 *
 * Mêmes gardes que __tests__/logiciel-gestion-batiment.test.ts : balises sous les limites
 * de Google, route enregistrée partout, JSON-LD bâti sur la FAQ affichée, règles
 * d'honnêteté de CLAUDE.md (aucun concurrent, ni « certifié » ni « conforme », prix lus
 * dans plans.ts, « gratuit » jamais pour les factures).
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import * as React from "react"
import { beforeAll, describe, expect, it } from "vitest"
import { DESCRIPTION_MAX, TITLE_MAX } from "@/lib/seo/meta"
import { MAIN_PAGES } from "@/lib/seo/links/catalog"
import { productJsonLd } from "@/components/content/ProductPage"
import { buildLlmsTxt } from "@/lib/seo/llms"
import { PLANS, formatEuros } from "@/lib/stripe/plans"

beforeAll(() => {
  ;(globalThis as { React?: typeof React }).React = React
})

const lire = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8")

const MODULES = {
  "/logiciel-devis-gratuit": () => import("@/app/logiciel-devis-gratuit/page"),
  "/logiciel-relance-factures-impayees": () => import("@/app/logiciel-relance-factures-impayees/page"),
  "/logiciel-export-fec": () => import("@/app/logiciel-export-fec/page"),
  "/logiciel-situations-travaux": () => import("@/app/logiciel-situations-travaux/page"),
}
const ROUTES = Object.keys(MODULES) as (keyof typeof MODULES)[]

/** Noms de logiciels que le relevé du 30/10/2026 a fait apparaître : jamais dans une page publique. */
const CONCURRENTS = /tolteck|obat|costructor|batappli|henrri|abby|indy|tiime|vertuoza|graneet|progbat|pennylane|sellsy|axonaut|\bsage\b|\bebp\b/i

describe.each(ROUTES)("%s", (route) => {
  const page = `app${route}/page.tsx`

  it("title et description tiennent sous le lien Google", async () => {
    const { metadata } = await MODULES[route]()
    expect(`${String(metadata.title)} | Qonforme`.length).toBeLessThanOrEqual(TITLE_MAX)
    const d = String(metadata.description)
    expect(d.length).toBeGreaterThanOrEqual(120)
    expect(d.length).toBeLessThanOrEqual(DESCRIPTION_MAX)
    expect((metadata.alternates as { canonical: string }).canonical).toBe(route)
  })

  it("passe par ProductPage (un seul H1, JSON-LD bâti sur la FAQ affichée)", () => {
    const src = lire(page)
    expect(src).toContain("<ProductPage")
    expect(src).toContain("faq={FAQ}")
    expect(src.match(/<h1/g)).toBeNull()
    expect(src).not.toMatch(/"@type"/)
  })

  it("enregistrée partout où une page publique doit l'être", () => {
    expect(lire("app/sitemap.ts")).toContain(`"${route}": "2026-10-30"`)
    expect(lire("app/sitemap.ts")).toContain(`url: \`\${baseUrl}${route}\``)
    expect(lire("lib/supabase/middleware.ts")).toContain(`'${route}'`)
    expect(lire("public/sw.js")).toContain(`'${route}'`)
    expect(lire("components/layout/Footer.tsx")).toContain(`href: "${route}"`)
    expect(lire("app/plan-du-site/page.tsx")).toContain(`href: "${route}"`)
    expect(MAIN_PAGES.some((p) => p.path === route)).toBe(true)
    expect(buildLlmsTxt()).toContain(`https://qonforme.fr${route}`)
  })

  it("honnête : aucun concurrent, ni certifié ni conforme, aucun prix écrit en dur", () => {
    const src = lire(page)
    expect(src).not.toMatch(CONCURRENTS)
    expect(src).not.toMatch(/certifi|homologu|plateforme agréée|\bconforme\b/i)
    expect(src).not.toMatch(/\d+\s?€\s?(HT|TTC|par mois)/)
    expect(src).not.toMatch(/factur\w*\s+gratuite?s?/i)
  })
})

describe("JSON-LD", () => {
  it("FAQPage reprend exactement les questions passées", () => {
    const faq = [{ question: "Q1 ?", reponse: "R1." }, { question: "Q2 ?", reponse: "R2." }]
    const ld = productJsonLd({ path: "/x", titre: "T", description: "D", verifieLe: "2026-10-30", faq })
    const faqLd = ld.find((b) => b["@type"] === "FAQPage") as { mainEntity: { name: string; acceptedAnswer: { text: string } }[] }
    expect(faqLd.mainEntity.map((q) => q.name)).toEqual(["Q1 ?", "Q2 ?"])
    expect(faqLd.mainEntity[1].acceptedAnswer.text).toBe("R2.")
    expect(ld.filter((b) => b["@type"] === "BreadcrumbList")).toHaveLength(1)
  })
})

describe("/llms.txt", () => {
  const txt = buildLlmsTxt()

  it("prix lus dans plans.ts, aucun concurrent", () => {
    expect(txt).toContain(formatEuros(PLANS.starter.monthlyPrice))
    expect(txt).not.toMatch(CONCURRENTS)
    expect(txt).not.toMatch(/certifi|homologu/i)
  })

  it("dit Artisan « bientôt » quand la formule n'est pas en vente", () => {
    if (PLANS.pro.available) expect(txt).toContain(formatEuros(PLANS.pro.monthlyPrice))
    else expect(txt).toContain("bientôt disponible")
  })

  it("servi sans passer par l'authentification, avec la clé IndexNow", () => {
    expect(lire("lib/supabase/middleware.ts")).toContain("'/llms.txt'")
    const cle = lire("public/ffdab55111a547e9b320f4c0f2c6d047.txt")
    expect(cle).toBe("ffdab55111a547e9b320f4c0f2c6d047")
  })
})
