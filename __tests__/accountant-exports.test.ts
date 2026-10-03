/**
 * Accès du comptable, partie pure : export des ventes (CSV), archive ZIP (relue
 * octet par octet, CRC et décompression vérifiés), archive de vrais PDF,
 * règles (statuts, périodes, TVA) et dossier de démo (pas de brouillon).
 */
import { inflateRawSync } from "node:zlib"
import { describe, expect, it } from "vitest"
import { CSV_HEADER, buildSalesCsv, csvAmount, csvField, csvText, type CsvCreditNote, type CsvInvoice } from "@/lib/accountant/csv"
import { createZip, crc32, safeZipName } from "@/lib/accountant/zip"
import {
  accessStatus, isIssuedInvoice, maskEmail, normalizeEmail, parsePeriod, paymentState, periodPresets, vatGroups,
} from "@/lib/accountant/rules"
import { buildPdfZipExport } from "@/lib/accountant/exports"
import { demoDossier } from "@/lib/demo/accountant"
import { DEMO_ACCESS_OVERVIEW } from "@/lib/demo/accountant"
import { DEMO_CREDIT_NOTES, DEMO_INVOICES } from "@/lib/demo/data"
import { FakeAccountantDb } from "./helpers/fake-accountant-db"

/* ------------------------------------------------------------------ */
/* CSV                                                                 */
/* ------------------------------------------------------------------ */

const client = { name: "Bâti Ouest SAS", siren: "501 234 567", vat_number: "FR12501234567" }
const L = (ht: number, rate: number, extra: Record<string, unknown> = {}) => ({ vat_rate: rate, total_ht: ht, total_vat: Math.round(ht * rate) / 100, ...extra })

const invoices: CsvInvoice[] = [
  {
    invoice_number: "F-2026-0002", issue_date: "2026-09-20", due_date: "2026-10-20", payment: "paid",
    subtotal_ht: 1500, total_vat: 250, total_ttc: 1750,
    lines: [L(1000, 20), L(300, 10), L(200, 10)], client,
  },
  {
    invoice_number: "F-2026-0001", issue_date: "2026-09-12", due_date: "2026-10-12", payment: "late",
    subtotal_ht: 800, total_vat: 0, total_ttc: 800,
    lines: [L(800, 0, { vat_treatment: "autoliquidation_btp" })], client: { name: '=HYPERLINK("http://x");Dupont', siren: null, vat_number: null },
  },
]
const creditNotes: CsvCreditNote[] = [
  { credit_note_number: "AV-2026-001", issue_date: "2026-09-21", original_invoice_number: "F-2026-0002", subtotal_ht: 200, total_vat: 20, total_ttc: 220, lines: [L(200, 10)], client },
]

describe("export des ventes (CSV)", () => {
  const csv = buildSalesCsv({ invoices, creditNotes })
  const lines = csv.replace(/^﻿/, "").split("\r\n").filter(Boolean)

  it("BOM UTF-8, CRLF, en-tête au point-virgule", () => {
    expect(csv.startsWith("﻿")).toBe(true)
    expect(csv.endsWith("\r\n")).toBe(true)
    expect(lines[0]).toBe(CSV_HEADER.join(";"))
  })

  it("une ligne par facture et par taux, triées par date, avoirs en négatif", () => {
    // F-0001 (1 taux), F-0002 (20 % et 10 %), AV-001 (10 %)
    expect(lines).toHaveLength(1 + 1 + 2 + 1)
    expect(lines[1]).toContain("F-2026-0001")
    expect(lines[2]).toBe("Facture;F-2026-0002;20/09/2026;20/10/2026;Bâti Ouest SAS;501234567;FR12501234567;;20;;1000,00;200,00;1200,00;Payée")
    expect(lines[3]).toBe("Facture;F-2026-0002;20/09/2026;20/10/2026;Bâti Ouest SAS;501234567;FR12501234567;;10;;500,00;50,00;550,00;Payée")
    expect(lines[4]).toBe("Avoir;AV-2026-001;21/09/2026;;Bâti Ouest SAS;501234567;FR12501234567;F-2026-0002;10;;-200,00;-20,00;-220,00;")
  })

  it("motif d'une ligne sans TVA, et statut de paiement", () => {
    expect(lines[1]).toContain(";0;Autoliquidation, art. 283-2 nonies du CGI;800,00;0,00;800,00;En retard")
  })

  it("neutralise les formules et échappe les séparateurs", () => {
    // Le texte commence par « = » : apostrophe devant, puis guillemets (il contient « ; » et « " »)
    expect(lines[1]).toContain(`"'=HYPERLINK(""http://x"");Dupont"`)
    expect(csvText("+33 6")).toBe("'+33 6")
    expect(csvText("-Dupont")).toBe("'-Dupont")
    expect(csvText("@SUM(A1)")).toBe("'@SUM(A1)")
    expect(csvText("Ligne\nsuivante")).toBe("Ligne suivante")
    expect(csvField("a;b")).toBe('"a;b"')
    expect(csvField("simple")).toBe("simple")
    expect(csvAmount(-0.004)).toBe("0,00")
    expect(csvAmount(1234.5)).toBe("1234,50")
  })

  it("document sans lignes : une ligne avec ses totaux", () => {
    const out = buildSalesCsv({ invoices: [{ ...invoices[0], lines: null }], creditNotes: [] })
    expect(out.split("\r\n").filter(Boolean)).toHaveLength(2)
    expect(out).toContain(";;;1500,00;250,00;1750,00;Payée")
  })
})

/* ------------------------------------------------------------------ */
/* ZIP                                                                 */
/* ------------------------------------------------------------------ */

interface ZipRead { name: string; method: number; flags: number; data: Uint8Array }

/** Relecture d'une archive par son répertoire central (APPNOTE 4.3.12 / 4.3.16). */
function readZip(zip: Uint8Array): ZipRead[] {
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength)
  const eocd = zip.length - 22
  expect(v.getUint32(eocd, true)).toBe(0x06054b50)
  const count = v.getUint16(eocd + 10, true)
  const cdSize = v.getUint32(eocd + 12, true)
  let p = v.getUint32(eocd + 16, true)
  expect(p + cdSize).toBe(eocd)
  const out: ZipRead[] = []
  for (let i = 0; i < count; i++) {
    expect(v.getUint32(p, true)).toBe(0x02014b50)
    const flags = v.getUint16(p + 8, true)
    const method = v.getUint16(p + 10, true)
    const crc = v.getUint32(p + 16, true)
    const csize = v.getUint32(p + 20, true)
    const usize = v.getUint32(p + 24, true)
    const nlen = v.getUint16(p + 28, true)
    const local = v.getUint32(p + 42, true)
    const name = new TextDecoder().decode(zip.subarray(p + 46, p + 46 + nlen))
    expect(v.getUint32(local, true)).toBe(0x04034b50)
    expect(v.getUint32(local + 14, true)).toBe(crc)
    const lnlen = v.getUint16(local + 26, true)
    const start = local + 30 + lnlen + v.getUint16(local + 28, true)
    const raw = zip.subarray(start, start + csize)
    const data = method === 8 ? new Uint8Array(inflateRawSync(raw)) : raw
    expect(data.length).toBe(usize)
    expect(crc32(data)).toBe(crc)
    out.push({ name, method, flags, data })
    p += 46 + nlen + v.getUint16(p + 30, true) + v.getUint16(p + 32, true)
  }
  return out
}

describe("archive ZIP", () => {
  it("CRC-32 de référence", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926)
    expect(crc32(new Uint8Array())).toBe(0)
  })

  it("relue entrée par entrée : noms UTF-8 uniques, contenus identiques", () => {
    const text = new TextEncoder().encode("Facture ".repeat(200))
    const random = Uint8Array.from({ length: 512 }, (_, i) => (i * 7919 + 13) % 251)
    const zip = createZip([
      { name: "Facture F-2026-0001.pdf", data: text },
      { name: "Facture F-2026-0001.pdf", data: random },
      { name: "Avoir é/../x.pdf", data: new Uint8Array([1, 2, 3]) },
    ])
    const entries = readZip(zip)
    expect(entries.map((e) => e.name)).toEqual(["Facture F-2026-0001.pdf", "Facture F-2026-0001 (2).pdf", "Avoir é-..-x.pdf"])
    expect(entries[0].method).toBe(8) // texte répétitif : compressé
    expect(entries[2].method).toBe(0) // trop court pour gagner : stocké
    expect(entries.every((e) => (e.flags & 0x0800) !== 0)).toBe(true)
    expect(Array.from(entries[0].data)).toEqual(Array.from(text))
    expect(Array.from(entries[1].data)).toEqual(Array.from(random))
  })

  it("noms sûrs : ni dossier, ni caractère interdit", () => {
    expect(safeZipName("../../etc/passwd")).toBe("-..-etc-passwd")
    expect(safeZipName('a<b>c:d"e|f?g*h\\i')).toBe("a-b-c-d-e-f-g-h-i")
    expect(safeZipName("")).toBe("document")
  })

  it("archive des PDF d'une période : factures émises et avoirs, jamais un brouillon", async () => {
    const db = new FakeAccountantDb()
    const owner = "artisan-1"
    const line = { description: "Pose de cloisons", quantity: 10, unit_price_ht: 50, vat_rate: 20, total_ht: 500, total_vat: 100, total_ttc: 600 }
    const cl = { id: "c", name: "Bâti Ouest SAS", address: "4 quai de la Loire", zip_code: "44000", city: "Nantes", country: "FR", siren: "501234567" }
    db.tables.companies = [{ user_id: owner, name: "Garnier Plâtrerie", siren: "948211375", address: "14 rue des Lices", zip_code: "49100", city: "Angers", country: "FR" }]
    db.tables.invoices = [
      { id: "i1", user_id: owner, invoice_number: "F-2026-0001", status: "sent", issue_date: "2026-09-12", due_date: "2026-10-12", subtotal_ht: 500, total_vat: 100, total_ttc: 600, lines: [line], client: cl },
      { id: "i2", user_id: owner, invoice_number: null, status: "draft", issue_date: "2026-09-13", due_date: "2026-10-13", subtotal_ht: 500, total_vat: 100, total_ttc: 600, lines: [line], client: cl },
      { id: "i3", user_id: "autre", invoice_number: "X-1", status: "sent", issue_date: "2026-09-13", due_date: "2026-10-13", subtotal_ht: 500, total_vat: 100, total_ttc: 600, lines: [line], client: cl },
    ]
    db.tables.credit_notes = [
      { id: "a1", user_id: owner, credit_note_number: "AV-2026-001", issue_date: "2026-09-20", reason: "Remise", subtotal_ht: 500, total_vat: 100, total_ttc: 600, lines: [line], client: cl, original_invoice: { id: "i1", invoice_number: "F-2026-0001", issue_date: "2026-09-12", total_ttc: 600 } },
    ]
    const res = await buildPdfZipExport(db as never, owner, { from: "2026-09-01", to: "2026-09-30" })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.filename).toBe("pdf-948211375-20260901-20260930.zip")
    expect(res.count).toBe(2)
    const entries = readZip(res.body as Uint8Array)
    expect(entries.map((e) => e.name)).toEqual(["Facture F-2026-0001.pdf", "Avoir AV-2026-001.pdf"])
    for (const e of entries) expect(new TextDecoder().decode(e.data.subarray(0, 5))).toBe("%PDF-")
  }, 30_000)

  it("période vide ou trop chargée : refus explicite", async () => {
    const db = new FakeAccountantDb()
    db.tables.companies = [{ user_id: "o", name: "X" }]
    expect(await buildPdfZipExport(db as never, "o", { from: "2026-01-01", to: "2026-01-31" })).toMatchObject({ ok: false, status: 404 })
    db.tables.invoices = Array.from({ length: 101 }, (_, i) => ({ id: `i${i}`, user_id: "o", invoice_number: `F-${i}`, status: "sent", issue_date: "2026-01-10", lines: [] }))
    expect(await buildPdfZipExport(db as never, "o", { from: "2026-01-01", to: "2026-01-31" })).toMatchObject({ ok: false, status: 413 })
  })
})

/* ------------------------------------------------------------------ */
/* Règles                                                              */
/* ------------------------------------------------------------------ */

describe("règles", () => {
  const now = new Date("2026-10-03T08:00:00Z")
  const base = { revoked_at: null, accepted_at: null, accountant_id: null, expires_at: "2026-10-10T08:00:00Z" }

  it("statut d'un accès", () => {
    expect(accessStatus(base, now)).toBe("pending")
    expect(accessStatus({ ...base, expires_at: "2026-10-03T08:00:00Z" }, now)).toBe("expired")
    expect(accessStatus({ ...base, accepted_at: "2026-10-01T00:00:00Z", accountant_id: "c" }, now)).toBe("active")
    // Compte du comptable supprimé : l'accès est terminé
    expect(accessStatus({ ...base, accepted_at: "2026-10-01T00:00:00Z", accountant_id: null }, now)).toBe("revoked")
    expect(accessStatus({ ...base, accepted_at: "2026-10-01T00:00:00Z", accountant_id: "c", revoked_at: "2026-10-02T00:00:00Z" }, now)).toBe("revoked")
  })

  it("seules les factures émises et numérotées sont visibles", () => {
    expect(isIssuedInvoice({ status: "sent", invoice_number: "F-1" })).toBe(true)
    expect(isIssuedInvoice({ status: "paid", invoice_number: "F-1" })).toBe(true)
    expect(isIssuedInvoice({ status: "draft", invoice_number: "F-1" })).toBe(false)
    expect(isIssuedInvoice({ status: "cancelled", invoice_number: "F-1" })).toBe(false)
    expect(isIssuedInvoice({ status: "sent", invoice_number: null })).toBe(false)
    expect(isIssuedInvoice({ status: "sent", invoice_number: "  " })).toBe(false)
  })

  it("statut de paiement à la date de Paris", () => {
    expect(paymentState("paid", "2026-01-01", "2026-10-03")).toBe("paid")
    expect(paymentState("sent", "2026-10-03", "2026-10-03")).toBe("open")
    expect(paymentState("sent", "2026-10-02", "2026-10-03")).toBe("late")
    expect(paymentState("overdue", "2026-12-01", "2026-10-03")).toBe("late")
    expect(paymentState("credited", "2026-10-02", "2026-10-03")).toBe("credited")
    expect(paymentState("rejected", "2026-10-02", "2026-10-03")).toBe("other")
  })

  it("périodes : validation et raccourcis (changement d'année compris)", () => {
    expect(parsePeriod("2026-01-01", "2026-12-31")).toEqual({ from: "2026-01-01", to: "2026-12-31" })
    expect(parsePeriod("2026-12-31", "2026-01-01")).toBeNull()
    expect(parsePeriod("2026-02-30", "2026-03-01")).toBeNull()
    expect(parsePeriod("2020-01-01", "2026-01-01")).toBeNull()
    expect(parsePeriod(undefined, "2026-01-01")).toBeNull()
    const jan = Object.fromEntries(periodPresets("2026-01-15").map((p) => [p.key, p.period]))
    expect(jan["mois"]).toEqual({ from: "2026-01-01", to: "2026-01-31" })
    expect(jan["mois-precedent"]).toEqual({ from: "2025-12-01", to: "2025-12-31" })
    expect(jan["trimestre-precedent"]).toEqual({ from: "2025-10-01", to: "2025-12-31" })
    const feb = Object.fromEntries(periodPresets("2028-02-10").map((p) => [p.key, p.period]))
    expect(feb["mois"]).toEqual({ from: "2028-02-01", to: "2028-02-29" })
    expect(feb["trimestre"]).toEqual({ from: "2028-01-01", to: "2028-03-31" })
  })

  it("adresses : normalisation et masque", () => {
    expect(normalizeEmail("  Claire@Cabinet.FR ")).toBe("claire@cabinet.fr")
    expect(normalizeEmail("claire@cabinet")).toBeNull()
    expect(normalizeEmail("a b@c.fr")).toBeNull()
    expect(normalizeEmail("<x>@c.fr")).toBeNull()
    expect(maskEmail("claire@cabinet.fr")).toBe("c•••@cabinet.fr")
  })

  it("TVA par taux, et à 0 % par motif", () => {
    const groups = vatGroups([L(100, 20), L(50, 20), L(10, 0, { vat_treatment: "franchise" }), L(5, 0), L(7, 5.5)])
    expect(groups.map((g) => [g.label, g.base, g.vat])).toEqual([
      ["TVA 20 %", 150, 30],
      ["TVA 5,5 %", 7, 0.39],
      ["Sans TVA (0 %)", 5, 0],
      ["TVA non applicable, art. 293 B du CGI", 10, 0],
    ])
  })
})

/* ------------------------------------------------------------------ */
/* Démo                                                                */
/* ------------------------------------------------------------------ */

describe("dossier de démo", () => {
  it("mêmes règles que le réel : aucun brouillon, totaux cohérents", () => {
    const data = demoDossier({ from: "2026-01-01", to: "2026-12-31" })
    const issued = DEMO_INVOICES.filter((i) => i.status !== "draft")
    expect(data.invoices).toHaveLength(issued.length)
    expect(data.invoices.some((i) => i.number === "null" || !i.number)).toBe(false)
    expect(data.creditNotes).toHaveLength(DEMO_CREDIT_NOTES.length)
    const ttc = Math.round(issued.reduce((s, i) => s + i.total_ttc, 0) * 100) / 100
    expect(data.totals.invoicedTtc).toBe(ttc)
    const vat = data.vat.reduce((s, r) => s + r.vat, 0)
    const expected = issued.reduce((s, i) => s + i.total_vat, 0) - DEMO_CREDIT_NOTES.reduce((s, c) => s + c.total_vat, 0)
    expect(Math.round(vat * 100)).toBe(Math.round(expected * 100))
  })

  it("le journal de démo annonce les bons nombres de documents", () => {
    const count = (from: string, to: string) => {
      const d = demoDossier({ from, to })
      return d.invoices.length + d.creditNotes.length
    }
    const detailOf = (id: string) => DEMO_ACCESS_OVERVIEW.events.find((e) => e.id === id)!
    const sept = count("2026-09-01", "2026-09-30")
    expect(detailOf("e8").detail).toBe(`${sept} PDF`)
    expect(detailOf("e7").detail).toBe(`${sept} documents`)
    expect(detailOf("e4").detail).toBe(`${count("2026-01-01", "2026-08-31")} documents`)
  })
})
