/**
 * Modèles de mise en page (lib/pdf/theme.ts) : lecture du choix enregistré,
 * Classique identique au rendu d'avant, habillage effectivement appliqué au PDF.
 */
import { describe, expect, it } from "vitest"
import { PDFArray, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from "pdf-lib"
import { rgb } from "pdf-lib"
import { DOC_TEMPLATES, parseDocumentTemplates, pdfTheme, templateOf } from "@/lib/pdf/theme"
import { generateQuotePdf } from "@/lib/pdf/quote"

const content = async (bytes: Uint8Array) => {
  const pdf = await PDFDocument.load(bytes)
  const c = pdf.getPage(0).node.get(PDFName.of("Contents"))
  const refs = c instanceof PDFArray ? c.asArray() : [c]
  return refs.map((r) => {
    const st = pdf.context.lookup(r)
    return st instanceof PDFRawStream ? new TextDecoder("latin1").decode(decodePDFRawStream(st).decode()) : ""
  }).join("\n")
}

describe("modèles de documents", () => {
  it("cinq modèles, choix enregistré nettoyé, Classique par défaut", () => {
    expect(DOC_TEMPLATES.map((t) => t.id)).toEqual(["classique", "chantier", "moderne", "epure", "prestige"])
    expect(parseDocumentTemplates({ quote: "chantier", invoice: "inconnu", credit_note: 3, autre: "epure" })).toEqual({ quote: "chantier" })
    expect(parseDocumentTemplates(null)).toEqual({})
    expect(templateOf({ document_templates: { invoice: "moderne" } }, "invoice")).toBe("moderne")
    expect(templateOf({ document_templates: { invoice: "moderne" } }, "quote")).toBe("classique")
    expect(templateOf(null, "invoice")).toBe("classique")
  })

  it("Classique reprend les couleurs propres au document", () => {
    const green = rgb(0.06, 0.58, 0.35)
    const t = pdfTheme("classique", { docColor: green, classicTitle: green, classicHeadFill: rgb(0.94, 0.99, 0.96), brand: rgb(0, 0, 1) })
    expect(t).toMatchObject({ primary: green, title: green, band: null, divider: "bar", total: { style: "rule" } })
  })

  it("le PDF suit le modèle choisi : bandeau sombre du modèle Chantier", async () => {
    const quote = {
      quote_number: "D-2026-012", issue_date: "2026-10-01", valid_until: "2026-10-31", subtotal_ht: 100, total_vat: 20, total_ttc: 120,
      lines: [{ description: "Pose", quantity: 1, unit_price_ht: 100, vat_rate: 20, total_ht: 100, total_vat: 20 }], client: { name: "Client" },
    }
    const company = { name: "Garnier", siren: "552100554", address: "1 rue", zip_code: "49000", city: "Angers", accent_color: "#2563EB" }
    const band = "0.04 0.07 0.13 rg"
    const classic = await content(await generateQuotePdf({ quote: quote as never, company: company as never }))
    const chantier = await content(await generateQuotePdf({ quote: quote as never, company: { ...company, document_templates: { quote: "chantier" } } as never }))
    expect(classic).not.toContain(band)
    expect(chantier).toContain(band)
  })
})
