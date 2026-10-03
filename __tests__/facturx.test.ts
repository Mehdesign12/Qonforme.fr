/**
 * Factur-X des factures et des avoirs (lib/facturx, lib/pdf/invoice.ts,
 * lib/pdf/credit-note.ts).
 *
 * Avant le 03/10/2026, le XML se déclarait « EXTENDED » sans en suivre le
 * profil, codait la franchise en base en Z (taux zéro), mettait le SIRET à la
 * place du SIREN (schéma 0002), plaçait l'échéance avant la ventilation de TVA
 * (XML invalide au schéma) et le PDF n'était pas un PDF/A-3. Les avoirs
 * n'avaient pas de XML.
 *
 * Ces tests vérifient la structure sur des factures types (taux normal,
 * multi-taux 5,5/10/20, franchise, autoliquidation, avoir) et le conteneur
 * PDF/A-3. La validation complète a été faite hors de la CI avec le validateur
 * Mustang 2.26.0 (veraPDF + schematrons CEN EN 16931 v1.3.16, Factur-X 1.08 et
 * BR-FR XP Z12-012 v1.3.0) : voir le rapport de la session du 03/10/2026.
 */
import { describe, it, expect } from "vitest"
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFRawStream, decodePDFRawStream } from "pdf-lib"
import { buildFacturX, computeFacturXTotals, documentMentions, unitCode, type FxDocument, type FxLine } from "@/lib/facturx/xml"
import { creditNoteToFacturX, invoiceToFacturX } from "@/lib/facturx/records"
import { paymentMentions } from "@/lib/facturx/mentions"
import { declaresVatFranchise } from "@/lib/facturx/vat"
import { generateInvoicePdf } from "@/lib/pdf/invoice"
import { generateCreditNotePdf } from "@/lib/pdf/credit-note"

// ── Données types ────────────────────────────────────────────────────────────

type TestLine = FxLine & { total_vat: number; total_ttc: number }
const line = (description: string, quantity: number, unit_price_ht: number, vat_rate: number, extra: Pick<FxLine, "unit" | "vat_treatment"> = {}): TestLine => {
  const total_ht = Math.round(quantity * unit_price_ht * 100) / 100
  const total_vat = Math.round(total_ht * vat_rate) / 100
  return { description, quantity, unit_price_ht, vat_rate, total_ht, total_vat, total_ttc: Math.round((total_ht + total_vat) * 100) / 100, ...extra }
}

const company = {
  name: "Plâtrerie Martin SARL", siren: "552100554", siret: "55210055400013", vat_number: "FR40552100554",
  address: "12 rue des Artisans", zip_code: "69003", city: "Lyon", country: "FR",
  iban: "FR76 3000 6000 0112 3456 7890 189", email: "contact@platrerie-martin.fr",
  legal_notice: "SARL au capital de 10 000 € — RCS Lyon 552 100 554.",
}
const franchiseCompany = {
  name: "Jean Dupont EI", siren: "732829320", siret: "73282932000074", vat_number: "",
  address: "4 impasse du Moulin", zip_code: "33000", city: "Bordeaux", iban: "FR7630006000011234567890189",
  legal_notice: "Dispensé d'immatriculation au RCS et au RM.\nTVA non applicable, art. 293 B du CGI.",
}
const proClient = { name: "SCI Les Tilleuls", email: "gestion@tilleuls.fr", address: "8 avenue Foch", zip_code: "75016", city: "Paris", siren: "443061841", vat_number: "FR57443061841" }
const particulier = { name: "Mme Claire Bernard", email: "claire@example.com", address: "3 rue Victor Hugo", zip_code: "69002", city: "Lyon" }

const invoice = (lines: TestLine[], extra: Record<string, unknown> = {}) => ({
  invoice_number: "F-2026-041", issue_date: "2026-10-01", due_date: "2026-10-31", lines, client: proClient, ...extra,
})

// ── Lecture du XML (sans dépendance) ─────────────────────────────────────────

/** Contenu de toutes les balises <tag> (non imbriquées). */
const all = (xml: string, tag: string): string[] =>
  Array.from(xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "g"))).map((m) => m[1].trim())
const one = (xml: string, tag: string): string | undefined => all(xml, tag)[0]
/** Blocs de ventilation de TVA de l'en-tête. */
const breakdowns = (xml: string) => {
  const settlement = one(xml, "ram:ApplicableHeaderTradeSettlement")!
  return all(settlement, "ram:ApplicableTradeTax").map((b) => ({
    tax: one(b, "ram:CalculatedAmount"), base: one(b, "ram:BasisAmount"), category: one(b, "ram:CategoryCode"),
    rate: one(b, "ram:RateApplicablePercent"), code: one(b, "ram:ExemptionReasonCode"), reason: one(b, "ram:ExemptionReason"),
  }))
}
const summation = (xml: string) => {
  const s = one(xml, "ram:SpecifiedTradeSettlementHeaderMonetarySummation")!
  return {
    lineTotal: one(s, "ram:LineTotalAmount"), basis: one(s, "ram:TaxBasisTotalAmount"), tax: one(s, "ram:TaxTotalAmount"),
    grand: one(s, "ram:GrandTotalAmount"), due: one(s, "ram:DuePayableAmount"),
  }
}
const noteCodes = (xml: string) => all(xml, "ram:SubjectCode")

// ── XML ──────────────────────────────────────────────────────────────────────

describe("Factur-X — facture au taux normal", () => {
  const lines = [line("Plaques BA13", 42.5, 22, 20, { unit: "m²" }), line("Main d'œuvre", 7.5, 46, 20, { unit: "h" }), line("Déplacement", 1, 40, 20)]
  const { xml, warnings } = buildFacturX(invoiceToFacturX(invoice(lines), company))

  it("déclare le profil EN 16931, une facture 380 et le cadre S1", () => {
    expect(one(one(xml, "ram:GuidelineSpecifiedDocumentContextParameter")!, "ram:ID")).toBe("urn:cen.eu:en16931:2017")
    expect(xml).not.toContain("extended")
    expect(one(xml, "ram:TypeCode")).toBe("380")
    expect(one(one(xml, "ram:BusinessProcessSpecifiedDocumentContextParameter")!, "ram:ID")).toBe("S1")
  })

  it("identifie le vendeur : SIREN en 0002, SIRET en 0009, TVA, adresse électronique 0225", () => {
    const seller = one(xml, "ram:SellerTradeParty")!
    expect(seller).toContain('<ram:ID schemeID="0002">552100554</ram:ID>')
    expect(seller).toContain('<ram:GlobalID schemeID="0009">55210055400013</ram:GlobalID>')
    expect(seller).toContain('<ram:ID schemeID="VA">FR40552100554</ram:ID>')
    expect(seller).toContain('<ram:URIID schemeID="0225">552100554</ram:URIID>')
    expect(seller).not.toContain('schemeID="FC"')
  })

  it("identifie l'acheteur : SIREN, TVA, adresse postale avec pays, adresse électronique", () => {
    const buyer = one(xml, "ram:BuyerTradeParty")!
    expect(buyer).toContain('<ram:ID schemeID="0002">443061841</ram:ID>')
    expect(buyer).toContain('<ram:ID schemeID="VA">FR57443061841</ram:ID>')
    expect(buyer).toContain("<ram:CountryID>FR</ram:CountryID>")
    expect(buyer).toContain('<ram:URIID schemeID="0225">443061841</ram:URIID>')
  })

  it("une ventilation S 20 % et des totaux cohérents au centime", () => {
    // 935,00 + 345,00 + 40,00 = 1 320,00 HT ; TVA 264,00
    expect(breakdowns(xml)).toEqual([{ tax: "264.00", base: "1320.00", category: "S", rate: "20", code: undefined, reason: undefined }])
    expect(summation(xml)).toEqual({ lineTotal: "1320.00", basis: "1320.00", tax: "264.00", grand: "1584.00", due: "1584.00" })
    expect(xml).toContain('<ram:TaxTotalAmount currencyID="EUR">264.00</ram:TaxTotalAmount>')
  })

  it("IBAN sans espaces avec le moyen de paiement 58, et l'échéance", () => {
    expect(xml).toContain("<ram:TypeCode>58</ram:TypeCode>")
    expect(one(xml, "ram:IBANID")).toBe("FR7630006000011234567890189")
    expect(one(one(xml, "ram:DueDateDateTime")!, "udt:DateTimeString")).toBe("20261031")
  })

  it("respecte l'ordre du schéma dans le règlement : paiement, TVA, conditions, totaux", () => {
    const s = one(xml, "ram:ApplicableHeaderTradeSettlement")!
    const pos = ["ram:InvoiceCurrencyCode", "ram:SpecifiedTradeSettlementPaymentMeans", "ram:ApplicableTradeTax", "ram:SpecifiedTradePaymentTerms", "ram:SpecifiedTradeSettlementHeaderMonetarySummation"]
      .map((t) => s.indexOf(`<${t}>`))
    expect(pos.every((p) => p >= 0)).toBe(true)
    expect([...pos].sort((a, b) => a - b)).toEqual(pos)
  })

  it("mentions de règlement entre professionnels : AAB, PMD, PMT une fois chacune (BR-FR-05/06)", () => {
    const codes = noteCodes(xml)
    for (const c of ["AAB", "PMD", "PMT"]) expect(codes.filter((x) => x === c)).toHaveLength(1)
    expect(codes).toContain("ABL") // mentions de l'entreprise
  })

  it("unités converties en codes UN/ECE", () => {
    expect(all(xml, "ram:BilledQuantity")).toEqual(["42.5", "7.5", "1"])
    expect(xml).toContain('unitCode="MTK"')
    expect(xml).toContain('unitCode="HUR"')
    expect(unitCode("forfait")).toBe("LS")
    expect(unitCode("jour")).toBe("DAY")
    expect(unitCode("ml")).toBe("MTR")
    expect(unitCode("bidule")).toBe("C62")
  })

  it("aucun avertissement sur une facture complète", () => {
    expect(warnings).toEqual([])
  })
})

describe("Factur-X — multi-taux 5,5 / 10 / 20 %", () => {
  const lines = [
    line("Isolation des combles", 85, 36, 5.5, { unit: "m²" }),
    line("Cloison 72/48", 23.4, 48, 10, { unit: "m²" }),
    line("Bandes et enduits", 23.4, 10.15, 10, { unit: "m²" }),
    line("Échafaudage", 3, 85, 20, { unit: "jour" }),
    line("Benne", 1, 260, 20),
    line("Remise commerciale", 1, -50, 20),
  ]
  const { xml, totals } = buildFacturX(invoiceToFacturX(invoice(lines), company))

  it("une ventilation par taux, base et TVA exactes", () => {
    const b = breakdowns(xml)
    expect(b.map((x) => `${x.category}/${x.rate}`)).toEqual(["S/20", "S/10", "S/5.5"])
    // 20 % : 255 + 260 - 50 = 465 → 93,00 ; 10 % : 1 123,20 + 237,51 = 1 360,71 → 112,32 + 23,75 = 136,07 ; 5,5 % : 3 060 → 168,30
    expect(b.find((x) => x.rate === "20")).toMatchObject({ base: "465.00", tax: "93.00" })
    expect(b.find((x) => x.rate === "10")).toMatchObject({ base: "1360.71", tax: "136.07" })
    expect(b.find((x) => x.rate === "5.5")).toMatchObject({ base: "3060.00", tax: "168.30" })
  })

  it("totaux : Σ lignes = base, Σ TVA par taux = TVA, TTC = HT + TVA (BR-CO-10/14/15)", () => {
    const s = summation(xml)
    expect(s).toEqual({ lineTotal: "4885.71", basis: "4885.71", tax: "397.37", grand: "5283.08", due: "5283.08" })
    const sumBases = breakdowns(xml).reduce((acc, x) => acc + Math.round(Number(x.base) * 100), 0)
    const sumTaxes = breakdowns(xml).reduce((acc, x) => acc + Math.round(Number(x.tax) * 100), 0)
    expect(sumBases).toBe(488571)
    expect(sumTaxes).toBe(39737)
    expect(totals.grandTotal).toBe(5283.08)
  })

  it("TVA par taux à moins d'un euro de base × taux (BR-S-09, BR-CO-17)", () => {
    for (const b of breakdowns(xml)) {
      expect(Math.abs(Number(b.tax) - Math.round(Number(b.base) * Number(b.rate)) / 100)).toBeLessThan(1)
    }
  })

  it("une remise saisie en prix négatif : prix net positif, quantité négative (BR-27)", () => {
    expect(all(xml, "ram:ChargeAmount")).not.toContain("-50")
    expect(all(xml, "ram:BilledQuantity")).toContain("-1")
    expect(all(xml, "ram:LineTotalAmount")).toContain("-50.00")
  })
})

describe("Factur-X — franchise en base (art. 293 B du CGI)", () => {
  const lines = [line("Pose de carrelage", 18, 35, 0, { unit: "m²" }), line("Déplacement", 1, 30, 0)]
  const { xml, warnings } = buildFacturX(invoiceToFacturX(invoice(lines), franchiseCompany))

  it("catégorie E avec le code VATEX-FR-FRANCHISE et le motif, jamais Z", () => {
    expect(breakdowns(xml)).toEqual([{
      tax: "0.00", base: "660.00", category: "E", rate: "0",
      code: "VATEX-FR-FRANCHISE", reason: "TVA non applicable, art. 293 B du CGI",
    }])
    expect(all(xml, "ram:CategoryCode")).not.toContain("Z")
    expect(all(xml, "ram:CategoryCode").every((c) => c === "E")).toBe(true)
  })

  it("sans n° de TVA, le SIREN est répété en identifiant fiscal BT-32 (BR-FR-CO-16)", () => {
    const seller = one(xml, "ram:SellerTradeParty")!
    expect(seller).toContain('<ram:ID schemeID="FC">732829320</ram:ID>')
    expect(seller).not.toContain('schemeID="VA"')
    expect(warnings).toEqual([])
  })

  it("la mention peut aussi venir des notes de la facture", () => {
    const fx = buildFacturX(invoiceToFacturX(invoice(lines, { notes: "TVA non applicable, art. 293 B du CGI" }), { ...franchiseCompany, legal_notice: "" }))
    expect(breakdowns(fx.xml)[0]).toMatchObject({ category: "E", code: "VATEX-FR-FRANCHISE" })
  })

  it("détection de la mention", () => {
    expect(declaresVatFranchise("TVA non applicable, art. 293 B du CGI")).toBe(true)
    expect(declaresVatFranchise("art. 293B")).toBe(true)
    expect(declaresVatFranchise("art. 293 bis", null)).toBe(false)
  })

  it("rien à ajouter au PDF : la mention y est déjà", () => {
    expect(documentMentions(invoiceToFacturX(invoice(lines, { client: particulier }), franchiseCompany))).toEqual([])
  })
})

describe("Factur-X — 0 % sans motif connu", () => {
  it("part en Z (taux zéro), avec un avertissement, sans motif inventé", () => {
    const { xml, warnings } = buildFacturX(invoiceToFacturX(invoice([line("Débours", 1, 120, 0)]), company))
    expect(breakdowns(xml)[0]).toMatchObject({ category: "Z", rate: "0", code: undefined, reason: undefined })
    expect(warnings.join(" ")).toMatch(/293 B/)
  })
})

describe("Factur-X — autoliquidation de la sous-traitance du BTP", () => {
  const lines = [
    line("Lot 3 plâtrerie, sous-traitance", 1, 12500, 0, { vat_treatment: "autoliquidation_btp", unit: "forfait" }),
    line("Main d'œuvre complémentaire", 12, 46, 0, { vat_treatment: "autoliquidation_btp", unit: "h" }),
  ]
  const fxDoc = invoiceToFacturX(invoice(lines), company)
  const { xml, warnings } = buildFacturX(fxDoc)

  it("catégorie AE, code VATEX-EU-AE et motif citant l'article 283-2 nonies", () => {
    expect(breakdowns(xml)).toEqual([{
      tax: "0.00", base: "13052.00", category: "AE", rate: "0",
      code: "VATEX-EU-AE", reason: "Autoliquidation, art. 283-2 nonies du CGI",
    }])
    expect(summation(xml)).toMatchObject({ tax: "0.00", grand: "13052.00" })
    expect(warnings).toEqual([])
  })

  it("le PDF imprime la mention « Autoliquidation », TVA due par le preneur (BOFiP, BOI-TVA-DECLA-10-10-20, § 536)", () => {
    expect(documentMentions(fxDoc)).toContain("Autoliquidation : TVA due par le preneur assujetti (art. 283, 2 nonies du CGI).")
  })

  it("aussi pour tout le document, et une ligne qui facture la TVA reste en S", () => {
    const doc: FxDocument = { ...invoiceToFacturX(invoice([line("Sous-traitance", 1, 1000, 0), line("Fourniture revendue", 1, 100, 20)]), company), vat_treatment: "autoliquidation_btp" }
    const t = computeFacturXTotals(doc)
    expect(t.breakdown.map((b) => b.category).sort()).toEqual(["AE", "S"])
    expect(t.taxTotal).toBe(20)
  })
})

describe("Factur-X — avoir", () => {
  const lines = [line("Cloison 72/48", 23.4, 48, 10, { unit: "m²" }), line("Échafaudage", 1, 85, 20, { unit: "jour" })]
  const creditNote = {
    credit_note_number: "AV-2026-003", issue_date: "2026-10-03", reason: "Erreur de métrage",
    lines, client: proClient, original_invoice: { invoice_number: "F-2026-042", issue_date: "2026-10-02" },
  }
  const { xml, warnings } = buildFacturX(creditNoteToFacturX(creditNote, company))

  it("type 381 avec la facture d'origine et sa date (BT-25, BT-26)", () => {
    expect(one(xml, "ram:TypeCode")).toBe("381")
    const ref = one(xml, "ram:InvoiceReferencedDocument")!
    expect(one(ref, "ram:IssuerAssignedID")).toBe("F-2026-042")
    expect(ref).toContain('<qdt:DateTimeString format="102">20261002</qdt:DateTimeString>')
  })

  it("montants positifs et cohérents, conditions de paiement en clair (BR-CO-25)", () => {
    expect(summation(xml)).toEqual({ lineTotal: "1208.20", basis: "1208.20", tax: "129.32", grand: "1337.52", due: "1337.52" })
    expect(one(one(xml, "ram:SpecifiedTradePaymentTerms")!, "ram:Description")).toContain("F-2026-042")
    expect(xml).toContain("Motif de l&apos;avoir : Erreur de métrage")
    expect(warnings).toEqual([])
  })

  it("lignes d'avoir sans TVA enregistrée : TVA recalculée depuis le taux", () => {
    const bare = lines.map(({ total_vat: _v, ...l }) => l)
    const fx = buildFacturX(creditNoteToFacturX({ ...creditNote, lines: bare }, company))
    expect(summation(fx.xml).tax).toBe("129.32")
  })
})

describe("Factur-X — client particulier, texte libre", () => {
  it("pas de mentions réservées aux professionnels, adresse électronique par email", () => {
    const { xml } = buildFacturX(invoiceToFacturX(invoice([line("Peinture", 1, 100, 10)], { client: particulier }), company))
    expect(noteCodes(xml)).not.toContain("PMT")
    expect(one(xml, "ram:BuyerTradeParty")).toContain('<ram:URIID schemeID="EM">claire@example.com</ram:URIID>')
    expect(paymentMentions(false, "")).toEqual([])
  })

  it("reprend les mentions déjà présentes plutôt que d'en ajouter", () => {
    const legal = "Escompte : aucun.\nEn cas de retard de paiement, pénalité de 3 fois le taux d'intérêt légal.\nIndemnité forfaitaire pour frais de recouvrement : 40 €."
    const m = paymentMentions(true, legal)
    expect(m.every((x) => x.alreadyPrinted)).toBe(true)
    expect(m.find((x) => x.code === "PMD")?.text).toContain("3 fois")
    expect(documentMentions(invoiceToFacturX(invoice([line("A", 1, 10, 20)]), { ...company, legal_notice: legal }))).toEqual([])
  })

  it("échappe le XML", () => {
    const { xml } = buildFacturX(invoiceToFacturX(invoice([line("Plinthes <chêne> & joints", 1, 10, 20)]), company))
    expect(xml).toContain("Plinthes &lt;chêne&gt; &amp; joints")
  })
})

// ── PDF/A-3 ──────────────────────────────────────────────────────────────────

const name = (n: string) => PDFName.of(n)

async function inspectPdf(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false })
  const cat = pdf.catalog
  const af = cat.lookupMaybe(name("AF"), PDFArray)
  const rawMetadata = cat.lookup(name("Metadata"))
  const metadata = rawMetadata instanceof PDFRawStream ? rawMetadata : undefined
  const intents = cat.lookupMaybe(name("OutputIntents"), PDFArray)
  let embedded: { name?: string; relationship?: string; subtype?: string; xml?: string } | null = null
  if (af) {
    const spec = af.lookup(0, PDFDict)
    const stream = spec.lookup(name("EF"), PDFDict).lookup(name("F")) as PDFRawStream
    embedded = {
      name: (spec.lookup(name("UF")) as PDFHexString | undefined)?.decodeText(),
      relationship: spec.get(name("AFRelationship"))?.toString(),
      subtype: (stream.dict.get(name("Subtype")) as PDFName | undefined)?.decodeText(),
      xml: new TextDecoder().decode(decodePDFRawStream(stream).decode()),
    }
  }
  return {
    pdf, embedded,
    xmp: metadata ? new TextDecoder().decode(metadata.getContents()) : null,
    metadataFiltered: metadata?.dict.has(name("Filter")) ?? false,
    intent: intents ? intents.lookup(0, PDFDict) : null,
    hasId: !!pdf.context.trailerInfo.ID,
  }
}

describe("PDF Factur-X (PDF/A-3)", () => {
  const lines = [line("Plaques BA13", 42.5, 22, 20, { unit: "m²" }), line("Déplacement", 1, 40, 20)]
  const data = { ...invoice(lines), subtotal_ht: 975, total_vat: 195, total_ttc: 1170 }

  it("facture émise : XML embarqué, relation Alternative, XMP PDF/A-3 et Factur-X, sRGB, identifiant", async () => {
    const bytes = await generateInvoicePdf({ invoice: data, company })
    const r = await inspectPdf(bytes)
    expect(r.embedded?.relationship).toBe("/Alternative")
    expect(r.embedded?.subtype).toBe("text/xml")
    expect(r.embedded?.name).toBe("factur-x.xml")
    expect(r.embedded?.xml).toBe(buildFacturX(invoiceToFacturX(data, company)).xml)
    expect(r.xmp).toContain("<pdfaid:part>3</pdfaid:part>")
    expect(r.xmp).toContain("<pdfaid:conformance>B</pdfaid:conformance>")
    expect(r.xmp).toContain("<fx:ConformanceLevel>EN 16931</fx:ConformanceLevel>")
    expect(r.xmp).toContain("<fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>")
    expect(r.xmp).toContain("<fx:DocumentType>INVOICE</fx:DocumentType>")
    expect(r.metadataFiltered).toBe(false)
    expect(r.intent?.get(name("S"))?.toString()).toBe("/GTS_PDFA1")
    expect(r.intent?.lookup(name("DestOutputProfile"))).toBeInstanceOf(PDFRawStream)
    expect(r.hasId).toBe(true)
    expect(r.pdf.getProducer()).toBe("Qonforme (pdf-lib)")
  })

  it("brouillon : aucun XML, aucune métadonnée Factur-X", async () => {
    const bytes = await generateInvoicePdf({ invoice: data, company, watermark: "BROUILLON" })
    const r = await inspectPdf(bytes)
    expect(r.embedded).toBeNull()
    expect(r.xmp).toBeNull()
    expect(r.pdf.catalog.has(name("Names"))).toBe(false)
  })

  it("avoir : XML 381 embarqué dans un PDF/A-3", async () => {
    const creditNote = {
      credit_note_number: "AV-2026-003", issue_date: "2026-10-03", reason: "Erreur", subtotal_ht: 975, total_vat: 195, total_ttc: 1170,
      lines, client: proClient, original_invoice: { invoice_number: "F-2026-041", issue_date: "2026-10-01" },
    }
    const r = await inspectPdf(await generateCreditNotePdf({ creditNote, company }))
    expect(r.embedded?.relationship).toBe("/Alternative")
    expect(one(r.embedded!.xml!, "ram:TypeCode")).toBe("381")
    expect(r.xmp).toContain("<pdfaid:part>3</pdfaid:part>")
  })

  it("un caractère absent de la police (émoji) ne casse pas la génération", async () => {
    const bytes = await generateInvoicePdf({ invoice: { ...data, client: { ...proClient, name: "SCI 🏠 Les Tilleuls" } }, company })
    expect(bytes.length).toBeGreaterThan(1000)
  })
})
