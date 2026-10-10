/**
 * Lien « Propulsé par Qonforme » (lib/utils/powered-by.ts) : provenance dans
 * les emails (lib/email/templates/base.ts) et lien cliquable dans les PDF
 * (lib/pdf/link.ts), sans aucun identifiant du destinataire ou du document.
 */
import { describe, expect, it } from "vitest"
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFString } from "pdf-lib"
import { poweredByUrl } from "@/lib/utils/powered-by"
import { emailBase } from "@/lib/email/templates/base"
import { generateQuotePdf } from "@/lib/pdf/quote"

describe("lien « Propulsé par Qonforme »", () => {
  it("provenance nettoyée : lettres, chiffres et tirets seulement", () => {
    expect(poweredByUrl("email-facture")).toMatch(/\/\?source=email-facture$/)
    expect(poweredByUrl("PDF Devis<script>")).toMatch(/\/\?source=pdf-devis-script$/)
    expect(poweredByUrl("")).toMatch(/\/\?source=email$/)
  })

  it("emails : « Qonforme » est un lien avec la provenance du modèle", () => {
    const html = emailBase({ companyName: "Garnier", preheader: "x", body: "<p>x</p>", source: "email-devis" })
    expect(html).toContain('href="https://qonforme.fr/?source=email-devis"')
    expect(html.match(/source=email-devis/g)).toHaveLength(2)
  })

  it("PDF : annotation de lien vers le site, imprimable (PDF/A)", async () => {
    const bytes = await generateQuotePdf({
      quote: {
        quote_number: "D-2026-012", issue_date: "2026-10-01", valid_until: "2026-10-31", subtotal_ht: 100, total_vat: 20, total_ttc: 120,
        lines: [{ description: "Pose", quantity: 1, unit_price_ht: 100, vat_rate: 20, total_ht: 100, total_vat: 20 }],
        client: { name: "Client" },
      } as never,
      company: { name: "Garnier", siren: "552100554", address: "1 rue", zip_code: "49000", city: "Angers" } as never,
    })
    const pdf = await PDFDocument.load(bytes)
    const annots = pdf.getPage(0).node.lookup(PDFName.of("Annots"), PDFArray)
    const link = annots.lookup(0, PDFDict)
    expect(link.get(PDFName.of("Subtype"))?.toString()).toBe("/Link")
    expect(link.get(PDFName.of("F"))?.toString()).toBe("4")
    const action = link.lookup(PDFName.of("A"), PDFDict)
    expect((action.lookup(PDFName.of("URI")) as PDFString).decodeText()).toBe("https://qonforme.fr/?source=pdf-devis")
  })
})
