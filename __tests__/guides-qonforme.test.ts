/**
 * Encadré « Avec Qonforme » des guides cités par les assistants IA (31/10/2026).
 * Chaque entrée vise un guide existant et une page produit enregistrée, sans
 * concurrent ni promesse interdite.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { AVEC_QONFORME } from "@/lib/pseo/guides-qonforme"
import { GUIDES } from "@/lib/pseo/guides"

const middleware = readFileSync("lib/supabase/middleware.ts", "utf8")

describe("encadré « Avec Qonforme »", () => {
  it.each(Object.entries(AVEC_QONFORME))("%s", (slug, e) => {
    expect(GUIDES.some((g) => g.slug === slug)).toBe(true)
    expect(middleware).toContain(`'${e.href}'`)
    expect(e.texte).not.toMatch(/certifi|homologu|\bconforme\b|gratuit[^.]*factur/i)
    expect(e.texte).not.toMatch(/\d+\s?€\s?(par mois|HT|TTC)/)
  })

  it("est affiché par la page du guide", () => {
    expect(readFileSync("app/guide/[slug]/page.tsx", "utf8")).toContain("AVEC_QONFORME[guide.slug]")
  })
})
