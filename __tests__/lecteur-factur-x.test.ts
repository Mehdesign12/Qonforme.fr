/**
 * Outil gratuit /outils/lecteur-factur-x (07/11/2026) : lecture d'une facture électronique
 * dans le navigateur, avec les lecteurs et contrôles de l'import des factures reçues.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { PDFDocument } from "pdf-lib"
import { describe, expect, it } from "vitest"
import { LECTEUR_FAQ, PDF_SIMPLE_NOTE, lireFactureElectronique } from "@/lib/outils/lecteur-facture"
import { metadata } from "@/app/outils/lecteur-factur-x/layout"
import { DESCRIPTION_MAX, TITLE_MAX } from "@/lib/seo/meta"
import { MAIN_PAGES } from "@/lib/seo/links/catalog"

const lire = (rel: string) => readFileSync(join(process.cwd(), rel))
const bytes = (rel: string) => new Uint8Array(lire(rel))

describe("lecture", () => {
  it("l'exemple publié est un Factur-X lu en entier, sans contrôle propre à un compte", async () => {
    const r = await lireFactureElectronique(bytes("public/outils/exemple-facture-factur-x.pdf"))
    expect(r.ok && r.kind).toBe("structured")
    if (!r.ok || r.kind !== "structured") return
    expect(r.format).toBe("facturx")
    expect(r.has_pdf).toBe(true)
    expect(r.invoice.number).toBe("EX-2026-001")
    expect(r.invoice.lines).toHaveLength(3)
    expect(r.invoice.seller.name).toContain("fictive")
    expect(r.checks.map((c) => c.id)).not.toContain("buyer_siren")
    expect(r.checks.map((c) => c.id)).not.toContain("duplicate")
    expect(r.checks.filter((c) => c.level !== "ok")).toEqual([])
  })

  it("XML CII et UBL seuls", async () => {
    const cii = await lireFactureElectronique(bytes("__tests__/fixtures/reception/cii-invoice.xml"))
    const ubl = await lireFactureElectronique(bytes("__tests__/fixtures/reception/ubl-invoice.xml"))
    expect(cii.ok && cii.kind === "structured" && cii.format).toBe("cii")
    expect(ubl.ok && ubl.kind === "structured" && ubl.format).toBe("ubl")
  })

  it("PDF sans données : facture PDF simple, expliquée sans renvoyer à une saisie", async () => {
    const doc = await PDFDocument.create()
    doc.addPage().drawText("Facture 12")
    const r = await lireFactureElectronique(await doc.save())
    expect(r).toMatchObject({ ok: true, kind: "pdf_only" })
    if (r.ok && r.kind === "pdf_only") {
      expect(r.note).toContain(PDF_SIMPLE_NOTE)
      expect(r.note).not.toMatch(/Saisissez/)
    }
  })

  it("fichier qui n'est pas une facture : message clair", async () => {
    const r = await lireFactureElectronique(new TextEncoder().encode("bonjour"))
    expect(r.ok).toBe(false)
    const xml = await lireFactureElectronique(new TextEncoder().encode("<?xml version=\"1.0\"?><Note>x</Note>"))
    expect(xml).toMatchObject({ ok: false })
  })
})

describe("page", () => {
  it("title et description sous les limites de Google, canonique", () => {
    expect(`${String(metadata.title)} | Qonforme`.length).toBeLessThanOrEqual(TITLE_MAX)
    const d = String(metadata.description)
    expect(d.length).toBeGreaterThanOrEqual(120)
    expect(d.length).toBeLessThanOrEqual(DESCRIPTION_MAX)
    expect((metadata.alternates as { canonical: string }).canonical).toBe("/outils/lecteur-factur-x")
  })

  it("FAQ : réponses qui commencent par le bénéfice, JSON-LD bâti sur la même liste, aucun interdit", () => {
    const page = lire("app/outils/lecteur-factur-x/page.tsx").toString()
    expect(page).toContain("faqJsonLd(LECTEUR_FAQ)")
    expect(page).toContain("items={LECTEUR_FAQ}")
    for (const f of LECTEUR_FAQ) expect(f.a, f.q).not.toMatch(/^Non\b/)
    const all = page + JSON.stringify(LECTEUR_FAQ)
    expect(all).not.toMatch(/certifi|homologu/i)
    expect(all).not.toMatch(/facturation\s+(électronique\s+)?gratuite/i)
  })

  it("le fichier n'est jamais envoyé : aucun fetch hors de l'exemple publié", () => {
    const page = lire("app/outils/lecteur-factur-x/page.tsx").toString()
    expect(page.match(/fetch\(/g)).toHaveLength(1)
    expect(page).toContain('fetch(EXAMPLE_URL)')
    expect(lire("lib/outils/lecteur-facture.ts").toString()).not.toMatch(/fetch\(/)
  })

  it("enregistrée partout où un outil doit l'être", () => {
    expect(lire("app/sitemap.ts").toString()).toContain('"lecteur-factur-x"')
    expect(lire("app/outils/page.tsx").toString()).toContain('href: "/outils/lecteur-factur-x"')
    expect(lire("components/layout/public-links.ts").toString()).toContain('href: "/outils/lecteur-factur-x"')
    expect(lire("lib/seo/links/catalog.ts").toString()).toContain('"/outils/lecteur-factur-x"')
    expect(MAIN_PAGES.length).toBeGreaterThan(0)
  })
})
