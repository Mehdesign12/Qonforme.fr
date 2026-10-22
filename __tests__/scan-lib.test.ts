// @vitest-environment node
/** Documents scannés : validation, quotas, recadrage et filtres (modules purs). */
import { describe, expect, it } from "vitest"
import {
  checkQuota, documentFromRow, documentName, formatAmountInput, formatBytes, parseAmountCents, parseScanFields, searchTerm, usageRatio,
} from "@/lib/scan/documents"
import { FULL_CROP, MIN_CROP, clampCrop, cropRect, dragCorner, fitWithin, moveCrop } from "@/lib/scan/geometry"
import { applyFilter, lumaLevels } from "@/lib/scan/filters"
import { SCAN_QUOTAS } from "@/lib/stripe/plans"

describe("montants", () => {
  it.each([
    ["1 240,50", 124050], ["1240.5", 124050], ["12", 1200], ["0,99", 99], ["", null], ["  ", null], ["12 €", 1200], ["1 240,50", 124050],
  ])("%j → %j", (input, expected) => expect(parseAmountCents(input)).toBe(expected))
  it.each(["abc", "1,234", "-5", "12,5,5", "1e5", "999999999"])("refuse %j", (input) => expect(parseAmountCents(input)).toBeUndefined())
  it("nombre, null, valeur absente", () => {
    expect(parseAmountCents(12.5)).toBe(1250)
    expect(parseAmountCents(null)).toBeNull()
    expect(parseAmountCents(-1)).toBeUndefined()
  })
  it("aller-retour avec le champ de saisie", () => {
    for (const cents of [0, 99, 1200, 124050, 123456789]) expect(parseAmountCents(formatAmountInput(cents))).toBe(cents)
  })
})

describe("champs d'un document", () => {
  it("n'accepte que les champs présents, nettoyés", () => {
    const r = parseScanFields({ supplier: "  Point P  ", doc_date: "2026-10-20", amount: "1 240,50", client_id: "", kind: "delivery_note", status: "classified" })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toEqual({ supplier: "Point P", doc_date: "2026-10-20", amount_cents: 124050, client_id: null, kind: "delivery_note", status: "classified" })
  })
  it("une modification vide ne contient rien", () => {
    const r = parseScanFields({})
    expect(r.ok && r.value).toEqual({})
  })
  it("efface un champ avec null ou une chaîne vide", () => {
    const r = parseScanFields({ supplier: "  ", doc_number: null, doc_date: "", amount: "" })
    expect(r.ok && r.value).toEqual({ supplier: null, doc_number: null, doc_date: null, amount_cents: null })
  })
  it.each([
    [{ kind: "facture" }, /Type/], [{ status: "x" }, /État/], [{ supplier: "x".repeat(201) }, /fournisseur/], [{ doc_number: 5 }, /numéro/],
    [{ doc_date: "2026-02-30" }, /Date/], [{ amount: "abc" }, /Montant/], [{ client_id: "pas-un-uuid" }, /Client/], [{ chantier_id: 4 }, /Chantier/],
  ])("refuse %j", (body, message) => {
    const r = parseScanFields(body as Record<string, unknown>)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(message)
  })
  it("recherche : ni virgule, ni parenthèse, ni joker (filtre PostgREST)", () => {
    expect(searchTerm("Point P, (Lyon)*%")).toBe("Point P Lyon")
    expect(searchTerm("a")).toBeNull()
    expect(searchTerm(null)).toBeNull()
    expect(searchTerm("x".repeat(200))?.length).toBe(60)
  })
  it("nom affiché : fournisseur, titre, puis type", () => {
    expect(documentName({ supplier: "Cedeo", title: "T", kind: "other" })).toBe("Cedeo")
    expect(documentName({ supplier: " ", title: "T", kind: "other" })).toBe("T")
    expect(documentName({ supplier: null, title: null, kind: "delivery_note" })).toBe("Bon de livraison")
  })
  it("lit une ligne avec ses pages triées et sa première adresse signée", () => {
    const urls = new Map([["u/d/1.webp", "https://signed/1"], ["u/d/2.webp", "https://signed/2"]])
    const d = documentFromRow({
      id: "d", kind: "delivery_note", status: "classified", title: null, supplier: "S", doc_number: null, doc_date: null, amount_cents: "12000",
      client_id: null, chantier_id: null, created_at: "2026-10-20T10:00:00Z", client: [{ name: "M. Test" }],
      pages: [{ id: "b", position: 2, storage_path: "u/d/2.webp", bytes: 200, width: 1, height: 1 }, { id: "a", position: 1, storage_path: "u/d/1.webp", bytes: 100, width: 1, height: 1 }],
    }, urls)
    expect(d.pages.map((p) => p.position)).toEqual([1, 2])
    expect(d).toMatchObject({ page_count: 2, total_bytes: 300, thumb_url: "https://signed/1", client_name: "M. Test", amount_cents: 12000 })
  })
})

describe("quotas", () => {
  it("quotas de la grille : 50 documents et 200 Mo en gratuit", () => {
    expect(SCAN_QUOTAS.free).toEqual({ documents: 50, megabytes: 200 })
    expect(SCAN_QUOTAS.starter.documents).toBe(2000)
  })
  it("autorise jusqu'à la limite, refuse au-delà, avec la formule dans le message du gratuit", () => {
    expect(checkQuota("free", { documents: 49, bytes: 0 }, { documents: 1 }).ok).toBe(true)
    const full = checkQuota("free", { documents: 50, bytes: 0 }, { documents: 1 })
    expect(full.ok).toBe(false)
    if (!full.ok) { expect(full.code).toBe("SCAN_QUOTA"); expect(full.message).toContain("Essentiel"); expect(full.message).toMatch(/2.000/) }
    expect(checkQuota("starter", { documents: 50, bytes: 0 }, { documents: 1 }).ok).toBe(true)
  })
  it("compte aussi le poids", () => {
    const mb = 1024 * 1024
    expect(checkQuota("free", { documents: 1, bytes: 199 * mb }, { bytes: mb }).ok).toBe(true)
    const over = checkQuota("free", { documents: 1, bytes: 199 * mb }, { bytes: mb + 1 })
    expect(over.ok).toBe(false)
    if (!over.ok) expect(over.message).toContain("200 Mo")
    const paid = checkQuota("pro", { documents: 1, bytes: 200 * mb }, { bytes: mb })
    expect(paid.ok).toBe(true)
  })
  it("part utilisée : la plus élevée des deux, bornée à 1", () => {
    const base = { plan: "free" as const, quota: { documents: 50, megabytes: 200 } }
    expect(usageRatio({ ...base, documents: 25, bytes: 0 })).toBe(0.5)
    expect(usageRatio({ ...base, documents: 1, bytes: 100 * 1024 * 1024 })).toBe(0.5)
    expect(usageRatio({ ...base, documents: 90, bytes: 0 })).toBe(1)
  })
  it("formats", () => {
    expect(formatBytes(512 * 1024)).toBe("0,5 Mo")
    expect(formatBytes(34 * 1024 * 1024)).toBe("34 Mo")
    expect(formatBytes(2 * 1024 * 1024 * 1024)).toBe("2 Go")
  })
})

describe("recadrage", () => {
  it("garde le cadre dans l'image et au-dessus du minimum", () => {
    expect(clampCrop({ x: -1, y: 2, w: 5, h: 0 })).toEqual({ x: 0, y: 1 - MIN_CROP, w: 1, h: MIN_CROP })
  })
  it("un coin déplacé laisse le coin opposé fixe et ne passe pas sous le minimum", () => {
    const c = dragCorner(FULL_CROP, "nw", 0.3, 0.2)
    expect(c.x).toBeCloseTo(0.3)
    expect(c.y).toBeCloseTo(0.2)
    expect(c.x + c.w).toBeCloseTo(1)
    expect(c.y + c.h).toBeCloseTo(1)
    const tiny = dragCorner(FULL_CROP, "se", 0, 0)
    expect(tiny.w).toBeCloseTo(MIN_CROP)
    expect(tiny.h).toBeCloseTo(MIN_CROP)
    expect(dragCorner(FULL_CROP, "se", 9, 9)).toEqual(FULL_CROP)
  })
  it("déplace le cadre sans le sortir de l'image", () => {
    expect(moveCrop({ x: 0.2, y: 0.2, w: 0.5, h: 0.5 }, 0.9, -0.9)).toEqual({ x: 0.5, y: 0, w: 0.5, h: 0.5 })
  })
  it("zone source en pixels et réduction proportionnelle", () => {
    expect(cropRect({ x: 0.1, y: 0.2, w: 0.5, h: 0.5 }, 1000, 2000)).toEqual({ sx: 100, sy: 400, sw: 500, sh: 1000 })
    expect(cropRect(FULL_CROP, 800, 600)).toEqual({ sx: 0, sy: 0, sw: 800, sh: 600 })
    expect(fitWithin(4000, 3000, 2000)).toEqual({ width: 2000, height: 1500 })
    expect(fitWithin(1000, 800, 2000)).toEqual({ width: 1000, height: 800 })
  })
})

describe("filtres", () => {
  /** Page type : fond clair un peu gris, quelques pixels de texte foncé. */
  const page = () => {
    const px = 100
    const data = new Uint8ClampedArray(px * 4)
    for (let i = 0; i < px; i++) {
      const dark = i % 10 === 0
      const v = dark ? 40 : 200
      data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255
    }
    return data
  }
  it("original : aucun changement", () => {
    const d = page(); const copy = d.slice()
    applyFilter(d, "original")
    expect(Array.from(d)).toEqual(Array.from(copy))
  })
  it("noir et blanc : papier blanchi, texte conservé foncé, gris pur, alpha intact", () => {
    const d = page()
    applyFilter(d, "bw")
    expect(d[4]).toBeGreaterThanOrEqual(245)          // un pixel de papier
    expect(d[0]).toBeLessThanOrEqual(40)              // un pixel de texte
    for (let i = 0; i < d.length; i += 4) { expect(d[i]).toBe(d[i + 1]); expect(d[i + 3]).toBe(255) }
  })
  it("couleur : garde la teinte (rouge reste plus fort que bleu)", () => {
    const d = new Uint8ClampedArray([200, 120, 80, 255, 230, 230, 230, 255, 30, 30, 30, 255, 220, 220, 220, 255])
    applyFilter(d, "color")
    expect(d[0]).toBeGreaterThan(d[2])
  })
  it("une image unie n'est pas étirée en aplat", () => {
    const flat = new Uint8ClampedArray(40).fill(128)
    for (let i = 3; i < flat.length; i += 4) flat[i] = 255
    expect(lumaLevels(flat)).toEqual({ black: 0, white: 255 })
  })
})
