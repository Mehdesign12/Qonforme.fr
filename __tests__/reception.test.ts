/**
 * Réception des factures fournisseurs (lib/reception, lib/pa).
 *
 * Fichiers d'exemple : __tests__/fixtures/reception (CII et UBL 2.1 écrits à
 * la main, validés hors CI par Mustang 2.26.0 avec les schematrons EN 16931 et
 * BR-FR) ; les Factur-X sont produits par le générateur de Qonforme
 * (lib/pdf/invoice.ts), validé de la même façon.
 */
import { readFileSync } from "fs"
import path from "path"
import { describe, expect, it, vi } from "vitest"
import { PDFDocument } from "pdf-lib"
import { parseXml, XmlError, XML_LIMITS, textAt } from "@/lib/reception/xml"
import { analyzeFile } from "@/lib/reception/analyze"
import { checkParsedInvoice, checkManualEntry, hasBlockingCheck } from "@/lib/reception/checks"
import { canTransition, RECIPIENT_TRANSITIONS, STATUS_DEFS, statusFromCode, validateStatusChange, effectiveReasonCode } from "@/lib/reception/lifecycle"
import { dedupKey, parseManualEntry, recordFromParsed, sameSupplier } from "@/lib/reception/record"
import { prepareUpload } from "@/lib/reception/prepare"
import { sniffKind, inflateLimited, InflateError } from "@/lib/reception/bytes"
import { findDuplicate, persistReceivedInvoice, isReceptionUnavailable, safeFileName } from "@/lib/reception/server"
import { ingestInboundInvoice } from "@/lib/reception/ingest"
import { getPlatformAdapter } from "@/lib/pa"
import { PaNotConnectedError } from "@/lib/pa/types"
import { generateInvoicePdf } from "@/lib/pdf/invoice"
import type { ParsedInvoice } from "@/lib/reception/types"

const FIX = path.join(__dirname, "fixtures", "reception")
const fixture = (name: string) => new Uint8Array(readFileSync(path.join(FIX, name)))
const enc = (s: string) => new TextEncoder().encode(s)

/** Entreprise de l'utilisateur (destinataire des factures d'exemple). */
const MY_SIREN = "948211375"

async function parsed(name: string): Promise<ParsedInvoice> {
  const a = await analyzeFile(fixture(name))
  if (!a.ok || a.kind !== "structured") throw new Error(`analyse impossible : ${JSON.stringify(a)}`)
  return a.invoice
}

// ── Lecteur XML ──────────────────────────────────────────────────────────────

describe("lecteur XML", () => {
  it("lit espaces de noms, attributs, entités, CDATA", () => {
    const root = parseXml(`<?xml version="1.0"?>
      <r:Root xmlns:r="urn:a" xmlns="urn:b"><Item code="A&amp;B">Plâtre &lt;BA13&gt; &#233;&#x20AC;</Item><r:Note><![CDATA[<pas une balise>]]></r:Note><!-- commentaire --><Vide/></r:Root>`)
    expect(root.name).toBe("Root")
    expect(root.ns).toBe("urn:a")
    expect(root.children[0].ns).toBe("urn:b")
    expect(root.children[0].attrs.code).toBe("A&B")
    expect(textAt(root, "Item")).toBe("Plâtre <BA13> é€")
    expect(textAt(root, "Note")).toBe("<pas une balise>")
    expect(root.children).toHaveLength(3)
  })

  it("refuse les entités externes (XXE) et les DOCTYPE", () => {
    const xxe = `<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><Invoice>&xxe;</Invoice>`
    expect(() => parseXml(xxe)).toThrowError(XmlError)
    try { parseXml(xxe) } catch (e) { expect((e as XmlError).code).toBe("doctype") }
  })

  it("refuse l'expansion d'entités en cascade (billion laughs)", () => {
    const bomb = `<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">]><lolz>&lol2;</lolz>`
    expect(() => parseXml(bomb)).toThrowError(/DOCTYPE/)
  })

  it("refuse une entité non prédéfinie et un « & » isolé", () => {
    expect(() => parseXml("<a>&nbsp;</a>")).toThrowError(/non prédéfinie/)
    expect(() => parseXml("<a>R & D</a>")).toThrowError(XmlError)
    expect(() => parseXml("<a>&#0;</a>")).toThrowError(XmlError)
  })

  it("refuse un document mal formé", () => {
    expect(() => parseXml("<a><b></a></b>")).toThrowError(/imbriquées/)
    expect(() => parseXml("<a><b>")).toThrowError(/tronqué/)
    expect(() => parseXml("<a/><b/>")).toThrowError(/plusieurs/)
    expect(() => parseXml("texte<a/>")).toThrowError(/hors/)
    expect(() => parseXml('<a x="<">')).toThrowError(XmlError)
    expect(() => parseXml("")).toThrowError(XmlError)
  })

  it("borne la profondeur, le nombre d'éléments et la taille", () => {
    const deep = "<a>".repeat(XML_LIMITS.maxDepth + 1) + "</a>".repeat(XML_LIMITS.maxDepth + 1)
    expect(() => parseXml(deep)).toThrowError(/profonde/)
    const many = `<r>${"<i/>".repeat(50)}</r>`
    expect(() => parseXml(many, { ...XML_LIMITS, maxNodes: 20 })).toThrowError(/trop d'éléments/)
    expect(() => parseXml("<a/>", { ...XML_LIMITS, maxChars: 3 })).toThrowError(/volumineux/)
  })
})

// ── Formats ──────────────────────────────────────────────────────────────────

describe("CII brut", () => {
  it("lit parties, lignes, remise, frais, TVA et totaux", async () => {
    const inv = await parsed("cii-invoice.xml")
    expect(inv.syntax).toBe("CII")
    expect(inv.number).toBe("CIL-26-04512")
    expect(inv.type_code).toBe("380")
    expect(inv.issue_date).toBe("2026-09-22")
    expect(inv.due_date).toBe("2026-10-31")
    expect(inv.delivery_date).toBe("2026-09-21")
    expect(inv.seller.name).toBe("Comptoir des Isolants Ligériens")
    expect(inv.seller.siren).toBe("398765438")
    expect(inv.seller.siret).toBe("39876543800017")
    expect(inv.seller.vat_number).toBe("FR79398765438")
    expect(inv.seller.electronic_address).toBe("0225:398765438")
    expect(inv.buyer.siren).toBe(MY_SIREN)
    expect(inv.lines).toHaveLength(4)
    expect(inv.lines[0]).toMatchObject({ name: "Plaque de plâtre BA13 2,50 x 1,20 m", quantity: 60, unit_code: "C62", unit_price: 8.4, net_amount: 504, vat_category: "S", vat_rate: 20 })
    expect(inv.allowances_charges).toEqual([
      expect.objectContaining({ charge: false, amount: 51.16 }),
      expect.objectContaining({ charge: true, amount: 45 }),
    ])
    expect(inv.vat).toEqual([expect.objectContaining({ category: "S", rate: 20, base: 1699.24, tax: 339.85 })])
    expect(inv.totals).toMatchObject({ line_total: 1705.4, allowances: 51.16, charges: 45, tax_basis: 1699.24, tax_total: 339.85, grand_total: 2039.09, due_payable: 2039.09 })
    expect(inv.payment).toMatchObject({ means_code: "58", iban: "FR7630004000031234567890143", reference: "CIL-26-04512" })
    expect(inv.order_reference).toBe("BC-2026-014")
    expect(inv.notes).toHaveLength(3)
  })

  it("passe tous les contrôles", async () => {
    const inv = await parsed("cii-invoice.xml")
    const checks = checkParsedInvoice(inv, "cii", { companySiren: MY_SIREN, duplicate: null })
    expect(checks.filter((c) => c.level !== "ok")).toEqual([])
  })
})

describe("UBL 2.1", () => {
  it("lit une facture", async () => {
    const a = await analyzeFile(fixture("ubl-invoice.xml"))
    expect(a.ok && a.kind === "structured" && a.format).toBe("ubl")
    const inv = await parsed("ubl-invoice.xml")
    expect(inv.syntax).toBe("UBL")
    expect(inv.number).toBe("LLM-2026-0917")
    expect(inv.due_date).toBe("2026-10-28")
    expect(inv.seller).toMatchObject({ name: "Ligéria Location Matériel", siren: "812345676", siret: "81234567600024", vat_number: "FR19812345676", email: "factures@ligeria-location.example.com" })
    expect(inv.buyer.siren).toBe(MY_SIREN)
    expect(inv.lines.map((l) => l.net_amount)).toEqual([435, 90, 36])
    expect(inv.lines[0].description).toContain("nacelle articulée électrique")
    expect(inv.totals).toMatchObject({ line_total: 561, tax_basis: 561, tax_total: 112.2, grand_total: 673.2, due_payable: 673.2 })
    expect(inv.payment.iban).toBe("FR7610107001011234567890129")
    expect(checkParsedInvoice(inv, "ubl", { companySiren: MY_SIREN, duplicate: null }).filter((c) => c.level !== "ok")).toEqual([])
  })

  it("lit un avoir et sa facture d'origine", async () => {
    const inv = await parsed("ubl-credit-note.xml")
    expect(inv.type_code).toBe("381")
    expect(inv.preceding_invoice).toEqual({ number: "CIL-26-04512", issue_date: "2026-09-22" })
    expect(inv.lines[0]).toMatchObject({ quantity: 4, net_amount: 126 })
    expect(inv.totals.grand_total).toBe(151.2)
  })
})

describe("Factur-X (PDF)", () => {
  const supplier = {
    name: "Comptoir des Isolants Ligériens", siren: "398765438", siret: "39876543800017", vat_number: "FR79398765438",
    address: "ZA des Rives", zip_code: "49070", city: "Beaucouzé", iban: "FR7630004000031234567890143",
  }
  const me = { name: "Garnier Plâtrerie Isolation", siren: MY_SIREN, vat_number: "FR32948211375", address: "14 rue des Lices", zip_code: "49100", city: "Angers" }
  const invoice = {
    invoice_number: "CIL-26-04600", issue_date: "2026-09-30", due_date: "2026-10-30", client: me,
    subtotal_ht: 177.5, total_vat: 35.5, total_ttc: 213,
    lines: [
      { description: "Rail R48 3 m", quantity: 40, unit_price_ht: 3.2, vat_rate: 20, total_ht: 128, total_vat: 25.6, total_ttc: 153.6 },
      { description: "Vis TTPC 25 mm, boîte", quantity: 5, unit_price_ht: 9.9, vat_rate: 20, total_ht: 49.5, total_vat: 9.9, total_ttc: 59.4 },
    ],
  }

  it("extrait le XML embarqué d'un Factur-X", async () => {
    const pdf = await generateInvoicePdf({ invoice, company: supplier })
    expect(sniffKind(pdf)).toBe("pdf")
    const a = await analyzeFile(pdf)
    expect(a.ok && a.kind).toBe("structured")
    if (!a.ok || a.kind !== "structured") return
    expect(a.format).toBe("facturx")
    expect(a.has_pdf).toBe(true)
    expect(a.invoice.number).toBe("CIL-26-04600")
    expect(a.invoice.seller.siren).toBe("398765438")
    expect(a.invoice.buyer.siren).toBe(MY_SIREN)
    expect(a.invoice.totals.grand_total).toBe(213)
    const checks = checkParsedInvoice(a.invoice, a.format, { companySiren: MY_SIREN, duplicate: null })
    expect(hasBlockingCheck(checks)).toBe(false)
    expect(checks.find((c) => c.id === "totals")?.level).toBe("ok")
  })

  it("classe un PDF sans XML comme PDF simple", async () => {
    const pdf = await generateInvoicePdf({ invoice, company: supplier, watermark: "BROUILLON" })
    const a = await analyzeFile(pdf)
    expect(a).toMatchObject({ ok: true, kind: "pdf_only", format: "pdf", note: null })
  })

  it("ne décompresse pas une pièce jointe démesurée (bombe de décompression)", async () => {
    const doc = await PDFDocument.create()
    doc.addPage()
    await doc.attach(new Uint8Array(8 * 1024 * 1024), "factur-x.xml", { mimeType: "text/xml" })
    const bytes = await doc.save()
    expect(bytes.byteLength).toBeLessThan(200_000)
    const a = await analyzeFile(bytes)
    expect(a).toMatchObject({ ok: true, kind: "pdf_only" })
  })

  it("signale un XML joint hostile sans l'interpréter", async () => {
    const doc = await PDFDocument.create()
    doc.addPage()
    await doc.attach(enc(`<?xml version="1.0"?><!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><rsm:CrossIndustryInvoice>&e;</rsm:CrossIndustryInvoice>`), "factur-x.xml", { mimeType: "text/xml" })
    const a = await analyzeFile(await doc.save())
    expect(a.ok && a.kind === "pdf_only" && a.note).toMatch(/DOCTYPE/)
  })

  it("repère un PDF chiffré", async () => {
    const a = await analyzeFile(enc("%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R /Encrypt 5 0 R >>\n%%EOF"))
    expect(a.ok && a.kind === "pdf_only" && a.note).toMatch(/protégé/)
  })

  it("borne la décompression", async () => {
    const zeros = new Uint8Array(2 * 1024 * 1024)
    const compressed = new Uint8Array(await new Response(new Blob([zeros]).stream().pipeThrough(new CompressionStream("deflate"))).arrayBuffer())
    await expect(inflateLimited(compressed, 1024 * 1024)).rejects.toBeInstanceOf(InflateError)
    expect((await inflateLimited(compressed, 3 * 1024 * 1024)).byteLength).toBe(zeros.byteLength)
  })
})

describe("fichiers refusés", () => {
  it("refuse un type inconnu, un XML qui n'est pas une facture, un fichier vide ou trop lourd", async () => {
    expect(await analyzeFile(enc("PK\u0003\u0004 zip"))).toMatchObject({ ok: false, code: "unsupported" })
    expect(await analyzeFile(enc("<html><body>Bonjour</body></html>"))).toMatchObject({ ok: false, code: "not_invoice" })
    expect(await analyzeFile(new Uint8Array(0))).toMatchObject({ ok: false, code: "empty" })
    expect(await analyzeFile(new Uint8Array(4 * 1024 * 1024 + 1))).toMatchObject({ ok: false, code: "too_large" })
    expect(await analyzeFile(enc(`<!DOCTYPE x [<!ENTITY e SYSTEM "http://169.254.169.254/">]><Invoice>&e;</Invoice>`))).toMatchObject({ ok: false, code: "xml_doctype" })
  })
})

// ── Contrôles ────────────────────────────────────────────────────────────────

describe("contrôles", () => {
  it("bloque une facture adressée à un autre SIREN", async () => {
    const inv = await parsed("cii-invoice.xml")
    const checks = checkParsedInvoice(inv, "cii", { companySiren: "552100554", duplicate: null })
    expect(checks.find((c) => c.id === "buyer_siren")).toMatchObject({ level: "error" })
    expect(hasBlockingCheck(checks)).toBe(true)
  })

  it("avertit si l'entreprise n'a pas de SIREN", async () => {
    const inv = await parsed("cii-invoice.xml")
    const checks = checkParsedInvoice(inv, "cii", { companySiren: null, duplicate: null })
    expect(checks.find((c) => c.id === "buyer_siren")?.level).toBe("warning")
    expect(hasBlockingCheck(checks)).toBe(false)
  })

  it("bloque un doublon", async () => {
    const inv = await parsed("cii-invoice.xml")
    const checks = checkParsedInvoice(inv, "cii", { companySiren: MY_SIREN, duplicate: { id: "x", created_at: "2026-09-25T10:00:00Z" } })
    expect(checks.find((c) => c.id === "duplicate")).toMatchObject({ level: "error", duplicate_of: { id: "x" } })
  })

  it("avertit sur des totaux ou une TVA incohérents", async () => {
    const xml = new TextDecoder().decode(fixture("cii-invoice.xml"))
      .replace("<ram:GrandTotalAmount>2039.09", "<ram:GrandTotalAmount>2040.00")
      .replace("<ram:CalculatedAmount>339.85", "<ram:CalculatedAmount>330.00")
    const a = await analyzeFile(enc(xml))
    if (!a.ok || a.kind !== "structured") throw new Error("analyse")
    const checks = checkParsedInvoice(a.invoice, "cii", { companySiren: MY_SIREN, duplicate: null })
    expect(checks.find((c) => c.id === "totals")).toMatchObject({ level: "warning" })
    expect(checks.find((c) => c.id === "vat")).toMatchObject({ level: "warning" })
    expect(hasBlockingCheck(checks)).toBe(false)
  })

  it("bloque une facture sans numéro", async () => {
    const xml = new TextDecoder().decode(fixture("ubl-invoice.xml")).replace("<cbc:ID>LLM-2026-0917</cbc:ID>", "")
    const a = await analyzeFile(enc(xml))
    if (!a.ok || a.kind !== "structured") throw new Error("analyse")
    expect(recordFromParsed(a.invoice, "ubl")).toBeNull()
    expect(checkParsedInvoice(a.invoice, "ubl", { companySiren: MY_SIREN, duplicate: null }).find((c) => c.id === "required")?.level).toBe("error")
  })

  it("contrôle une saisie manuelle", () => {
    const entry = { document_type: "380" as const, supplier_name: "Relais Carburant", supplier_siren: null, number: "T-1", issue_date: "2026-09-30", due_date: null, total_ht: 100, total_vat: 20, total_ttc: 121 }
    const checks = checkManualEntry(entry, { companySiren: MY_SIREN, duplicate: null })
    expect(checks.find((c) => c.id === "totals")?.level).toBe("warning")
    expect(hasBlockingCheck(checks)).toBe(false)
  })
})

// ── Cycle de vie ─────────────────────────────────────────────────────────────

describe("cycle de vie", () => {
  it("porte les codes de la DGFiP", () => {
    expect(STATUS_DEFS.approved.code).toBe("205")
    expect(STATUS_DEFS.refused).toMatchObject({ code: "210", mandatory: true })
    expect(STATUS_DEFS.payment_sent.code).toBe("211")
    expect(statusFromCode("207")).toBe("disputed")
    expect(statusFromCode("999")).toBeNull()
  })

  it("n'autorise que les changements de la liste blanche", () => {
    expect(canTransition("received", "approved")).toBe(true)
    expect(canTransition("approved", "payment_sent")).toBe(true)
    expect(canTransition("refused", "approved")).toBe(false)
    expect(canTransition("payment_sent", "disputed")).toBe(false)
    expect(canTransition("received", "cashed")).toBe(false)
    expect(canTransition("received", "rejected")).toBe(false)
    expect(canTransition("received", "received")).toBe(false)
    // Statuts posés par d'autres que l'artisan : jamais proposés
    for (const targets of Object.values(RECIPIENT_TRANSITIONS)) {
      expect(targets).not.toContain("cashed")
      expect(targets).not.toContain("completed")
      expect(targets).not.toContain("made_available")
    }
  })

  it("demande un motif pour refuser", () => {
    expect(validateStatusChange("refused", null, null)).toMatch(/motif/)
    expect(validateStatusChange("refused", "AUTRE", "")).toMatch(/Précisez/)
    expect(validateStatusChange("refused", "MONTANT_ERR", null)).toBeNull()
    expect(validateStatusChange("refused", "INCONNU", null)).toMatch(/inconnu/)
    expect(validateStatusChange("disputed", null, "Livraison partielle")).toBeNull()
    expect(validateStatusChange("partially_approved", null, "")).toMatch(/acceptez/)
    expect(effectiveReasonCode("suspended", null)).toBe("JUSTIF_ABS")
    expect(effectiveReasonCode("approved", "MONTANT_ERR")).toBeNull()
  })
})

// ── Enregistrement ───────────────────────────────────────────────────────────

describe("enregistrement", () => {
  it("clé de doublon : fournisseur, numéro, année", () => {
    expect(dedupKey("398765438", "X", " cil-26 04512 ", "2026-09-22")).toBe("siren:398765438|CIL-2604512|2026")
    expect(dedupKey(null, "Relais Carburant des Ponts", "T-1", "2026-09-30")).toBe("nom:relaiscarburantdesponts|T-1|2026")
    expect(sameSupplier({ siren: "398765438", name: "A" }, { siren: "398765438", name: "B" })).toBe(true)
    expect(sameSupplier({ siren: null, name: "Comptoir des Isolants" }, { siren: "398765438", name: "Comptoir des isolants" })).toBe(true)
    expect(sameSupplier({ siren: "398765438", name: "A" }, { siren: "812345676", name: "A" })).toBe(false)
  })

  it("valide la saisie manuelle", () => {
    expect(parseManualEntry({ supplier_name: "", number: "1" })).toMatchObject({ ok: false, field: "supplier_name" })
    expect(parseManualEntry({ supplier_name: "A", number: "1", issue_date: "2026-02-30" })).toMatchObject({ ok: false, field: "issue_date" })
    expect(parseManualEntry({ supplier_name: "A", supplier_siren: "12", number: "1", issue_date: "2026-09-30" })).toMatchObject({ ok: false, field: "supplier_siren" })
    const ok = parseManualEntry({ supplier_name: " Relais ", number: "T-1", issue_date: "2026-09-30", total_ht: "1 234,50", total_vat: "246,90", total_ttc: 1481.4, document_type: "999" })
    expect(ok).toMatchObject({ ok: true, entry: { supplier_name: "Relais", total_ht: 1234.5, total_vat: 246.9, total_ttc: 1481.4, document_type: "380" } })
  })

  it("prépare un import : PDF simple, saisie, blocage", async () => {
    const plain = await generateInvoicePdf({ invoice: { invoice_number: "X-1", issue_date: "2026-09-30", due_date: "2026-10-30", subtotal_ht: 0, total_vat: 0, total_ttc: 0, lines: [] }, company: { name: "A" }, watermark: "APERÇU" })
    const none = async () => null
    expect(await prepareUpload(plain, { companySiren: MY_SIREN, findDuplicate: none })).toMatchObject({ ok: true, kind: "pdf_only" })
    expect(await prepareUpload(plain, { companySiren: MY_SIREN, findDuplicate: none, manual: { supplier_name: "A" } })).toMatchObject({ ok: false, status: 422, code: "manual_invalid" })
    const manual = await prepareUpload(plain, {
      companySiren: MY_SIREN, findDuplicate: none,
      manual: { supplier_name: "Relais Carburant des Ponts", number: "T-2026-09", issue_date: "2026-09-30", total_ht: 250, total_vat: 50, total_ttc: 300 },
    })
    expect(manual).toMatchObject({ ok: true, kind: "manual", blocking: false, record: { format: "pdf", total_ttc: 300, data: null } })
    const blocked = await prepareUpload(fixture("cii-invoice.xml"), { companySiren: "552100554", findDuplicate: none })
    expect(blocked).toMatchObject({ ok: true, kind: "structured", blocking: true })
  })

  it("nom de fichier sûr", () => {
    expect(safeFileName("../../etc/passwd", "xml")).toBe("passwd.xml")
    expect(safeFileName('fac"ture<1>.PDF', "pdf")).toBe("facture1.PDF")
    expect(safeFileName("", "pdf")).toBe("facture.pdf")
  })
})

// ── Base de données (fausse, en mémoire) ─────────────────────────────────────

type Row = Record<string, unknown>

/** Client Supabase minimal : de quoi exercer findDuplicate, persistReceivedInvoice et ingestInboundInvoice. */
function fakeDb(tables: Record<string, Row[]>, opts: { missingTable?: boolean } = {}) {
  const files = new Map<string, Uint8Array>()
  class Query {
    private filters: ((r: Row) => boolean)[] = []
    private op: "select" | "insert" | "update" = "select"
    private payload: Row | Row[] | null = null
    private max = Infinity
    private one = false
    constructor(private table: string) {}
    select() { return this }
    eq(c: string, v: unknown) { this.filters.push((r) => r[c] === v); return this }
    is(c: string, v: unknown) { this.filters.push((r) => (r[c] ?? null) === v); return this }
    gte(c: string, v: string) { this.filters.push((r) => String(r[c]) >= v); return this }
    lte(c: string, v: string) { this.filters.push((r) => String(r[c]) <= v); return this }
    limit(n: number) { this.max = n; return this }
    maybeSingle() { this.one = true; return this }
    insert(p: Row | Row[]) { this.op = "insert"; this.payload = p; return this }
    update(p: Row) { this.op = "update"; this.payload = p; return this }
    then(resolve: (v: unknown) => void) { resolve(this.run()) }
    private run() {
      if (opts.missingTable && this.table === "received_invoices") return { data: null, error: { code: "PGRST205", message: "Could not find the table 'public.received_invoices' in the schema cache" } }
      const rows = (tables[this.table] ??= [])
      if (this.op === "insert") {
        const list = Array.isArray(this.payload) ? this.payload : [this.payload!]
        for (const r of list) {
          if (this.table === "received_invoices" && rows.some((x) => x.user_id === r.user_id && x.dedup_key === r.dedup_key)) {
            return { data: null, error: { code: "23505", message: "duplicate key" } }
          }
        }
        rows.push(...list.map((r) => ({ id: r.id ?? crypto.randomUUID(), ...r })))
        return { data: null, error: null }
      }
      const hit = rows.filter((r) => this.filters.every((f) => f(r)))
      if (this.op === "update") { hit.forEach((r) => Object.assign(r, this.payload)); return { data: hit, error: null } }
      const data = hit.slice(0, this.max)
      return { data: this.one ? data[0] ?? null : data, error: null }
    }
  }
  const db = {
    from: (t: string) => new Query(t),
    storage: {
      from: () => ({
        upload: async (p: string, b: Uint8Array) => (opts.missingTable ? { error: { message: "Bucket not found" } } : (files.set(p, b), { error: null })),
        remove: async (ps: string[]) => { ps.forEach((p) => files.delete(p)); return { error: null } },
      }),
    },
  }
  return { db: db as unknown as Parameters<typeof findDuplicate>[0], files, tables }
}

describe("enregistrement en base", () => {
  it("enregistre fichier, ligne et historique, puis repère le doublon", async () => {
    const { db, files, tables } = fakeDb({})
    const prep = await prepareUpload(fixture("ubl-invoice.xml"), { companySiren: MY_SIREN, findDuplicate: async () => null })
    if (!prep.ok || prep.kind !== "structured" || !prep.record) throw new Error("préparation")
    const saved = await persistReceivedInvoice(db, {
      userId: "u1", record: prep.record, checks: prep.checks, hasPdf: false, source: "import",
      file: { bytes: fixture("ubl-invoice.xml"), kind: "xml", name: "facture.xml", sha256: "0".repeat(64) },
    })
    expect(saved.ok).toBe(true)
    expect(files.size).toBe(1)
    expect(Array.from(files.keys())[0]).toMatch(/^u1\/[0-9a-f-]{36}\.xml$/)
    expect(tables.received_invoices[0]).toMatchObject({ user_id: "u1", status: "received", supplier_siren: "812345676", total_ttc: 673.2, source: "import", platform_id: null })
    expect(tables.received_invoice_events[0]).toMatchObject({ status: "received", actor: "import", code: null })

    const dup = await findDuplicate(db, "u1", prep.record)
    expect(dup.duplicate?.id).toBe(tables.received_invoices[0].id)
    expect((await findDuplicate(db, "u2", prep.record)).duplicate).toBeNull()

    // Deuxième enregistrement de la même facture : refusé par l'index unique, fichier retiré
    const again = await persistReceivedInvoice(db, {
      userId: "u1", record: prep.record, checks: [], hasPdf: false, source: "import",
      file: { bytes: fixture("ubl-invoice.xml"), kind: "xml", name: "facture.xml", sha256: "0".repeat(64) },
    })
    expect(again).toMatchObject({ ok: false, reason: "duplicate" })
    expect(files.size).toBe(1)
  })

  it("migration absente : « indisponible », sans erreur", async () => {
    const { db } = fakeDb({}, { missingTable: true })
    const prep = await prepareUpload(fixture("ubl-invoice.xml"), { companySiren: MY_SIREN, findDuplicate: async () => null })
    if (!prep.ok || prep.kind !== "structured" || !prep.record) throw new Error("préparation")
    expect((await findDuplicate(db, "u1", prep.record)).unavailable).toBe(true)
    const saved = await persistReceivedInvoice(db, {
      userId: "u1", record: prep.record, checks: [], hasPdf: false, source: "import",
      file: { bytes: fixture("ubl-invoice.xml"), kind: "xml", name: "f.xml", sha256: "0".repeat(64) },
    })
    expect(saved).toMatchObject({ ok: false, reason: "unavailable" })
    expect(isReceptionUnavailable({ message: "Bucket not found" })).toBe(true)
    expect(isReceptionUnavailable({ code: "23505", message: "duplicate" })).toBe(false)
  })

  it("plateforme : rattache une facture déjà importée au lieu de la dédoubler", async () => {
    const { db, tables } = fakeDb({ companies: [{ user_id: "u1", siren: MY_SIREN }] })
    const prep = await prepareUpload(fixture("cii-invoice.xml"), { companySiren: MY_SIREN, findDuplicate: async () => null })
    if (!prep.ok || prep.kind !== "structured" || !prep.record) throw new Error("préparation")
    await persistReceivedInvoice(db, {
      userId: "u1", record: prep.record, checks: [], hasPdf: false, source: "import",
      file: { bytes: fixture("cii-invoice.xml"), kind: "xml", name: "f.xml", sha256: "0".repeat(64) },
    })
    const res = await ingestInboundInvoice(db, {
      platformId: "pa-123", recipientSiren: MY_SIREN, receivedAt: "2026-10-02T08:00:00Z",
      file: { bytes: fixture("cii-invoice.xml"), filename: "f.xml", mime: "application/xml" },
    })
    expect(res).toMatchObject({ ok: true, linked: true })
    expect(tables.received_invoices).toHaveLength(1)
    expect(tables.received_invoices[0]).toMatchObject({ source: "platform", platform_id: "pa-123" })
    expect(tables.received_invoice_events.at(-1)).toMatchObject({ actor: "platform", code: "202" })

    // Destinataire inconnu : rien n'est écrit
    expect(await ingestInboundInvoice(db, {
      platformId: "pa-124", recipientSiren: "552100554", receivedAt: "2026-10-02T08:00:00Z",
      file: { bytes: fixture("ubl-invoice.xml"), filename: "f.xml", mime: null },
    })).toMatchObject({ ok: false, reason: "unknown_recipient" })
  })
})

// ── Plateforme agréée ────────────────────────────────────────────────────────

describe("adaptateur de plateforme agréée", () => {
  it("« aucun » par défaut : rien n'est reçu ni transmis", async () => {
    const pa = getPlatformAdapter(undefined)
    expect(pa).toMatchObject({ id: "none", connected: false, label: null })
    expect(await pa.listInboundInvoices({ recipientSiren: MY_SIREN })).toEqual({ invoices: [], nextCursor: null })
    expect(await pa.sendStatus({ platformId: "x", status: "approved", code: "205", reasonCode: null, reason: null, at: "" })).toEqual({ transmitted: false })
    expect(await pa.searchDirectory({ siren: MY_SIREN })).toEqual([])
    await expect(pa.issueInvoice({ number: "F-1", xml: "<x/>" })).rejects.toBeInstanceOf(PaNotConnectedError)
    expect(await pa.verifyWebhook({ headers: new Headers(), rawBody: "{}" })).toBeNull()
  })

  it("un fournisseur inconnu retombe sur « aucun »", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    expect(getPlatformAdapter("plateforme-imaginaire").connected).toBe(false)
    warn.mockRestore()
  })

  it("le webhook répond 404 tant qu'aucune plateforme n'est raccordée", async () => {
    const { POST } = await import("@/app/api/pa/webhook/route")
    const res = await POST(new Request("https://qonforme.fr/api/pa/webhook", { method: "POST", body: "{}" }))
    expect(res.status).toBe(404)
  })
})
