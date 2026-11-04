/**
 * Remises : stress test des calculs (lib/documents/discounts.ts).
 *
 * Chaque montant est recalculé par une référence indépendante en nombres
 * entiers exacts (BigInt, aucune virgule flottante), puis comparé au module sur
 * des milliers de documents tirés au hasard (graine fixe : rejouable), en plus
 * des cas limites écrits à la main.
 */
import { describe, expect, it } from "vitest"
import {
  allocate,
  buildGlobalDiscountLines,
  computeDocument,
  discountSummary,
  fromCents,
  isDocumentDiscountLine,
  itemLines,
  lineAmounts,
  lineDiscountLabel,
  normalizeDiscountLines,
  readGlobalDiscount,
  roundHalfUp,
  sumLines,
  toCents,
  type DiscountableLine,
  type GlobalDiscount,
} from "@/lib/documents/discounts"

/* ------------------------------------------------------------------ */
/* Référence exacte                                                    */
/* ------------------------------------------------------------------ */

/** « 12.345 » → { n: BigInt(12345), scale: 3 } (décimal exact). */
function dec(s: string): { n: bigint; scale: number } {
  const neg = s.startsWith("-")
  const [i, f = ""] = s.replace("-", "").split(".")
  const n = BigInt(i + f || "0")
  return { n: neg ? -n : n, scale: f.length }
}
const pow10 = (k: number) => { let r = BigInt(1); for (let i = 0; i < k; i++) r *= BigInt(10); return r }
/** Arrondi au plus proche, moitié vers le haut en valeur absolue : num / den. */
function roundDiv(num: bigint, den: bigint): bigint {
  if (den < BigInt(0)) { num = -num; den = -den }
  const neg = num < BigInt(0)
  const a = neg ? -num : num
  const q = (a * BigInt(2) + den) / (BigInt(2) * den)
  return neg ? -q : q
}
/** Centimes de q × p (q et p en texte décimal). */
function refGross(q: string, p: string): bigint {
  const a = dec(q), b = dec(p)
  // q × p × 100, échelle a.scale + b.scale
  return roundDiv(a.n * b.n * BigInt(100), pow10(a.scale + b.scale))
}
/** round(cents × v / 100), v en texte décimal. */
function refPct(cents: bigint, v: string): bigint {
  const d = dec(v)
  return roundDiv(cents * d.n, BigInt(100) * pow10(d.scale))
}
const refEur = (v: string): bigint => { const d = dec(v); return roundDiv(d.n * BigInt(100), pow10(d.scale)) }

/* ------------------------------------------------------------------ */
/* Tirage au hasard rejouable                                          */
/* ------------------------------------------------------------------ */

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const RATES = [20, 10, 5.5, 0] as const

function decimalString(r: () => number, max: number, decimals: number): string {
  const scale = 10 ** decimals
  const v = Math.floor(r() * max * scale) / scale
  return v.toFixed(decimals)
}

interface Case {
  q: string
  p: string
  rate: number
  kind: "pct" | "eur" | null
  v: string
}

function randomLine(r: () => number): Case {
  const pick = r()
  // Quantités : entières, au dixième, au centième ou au millième ; prix au centime
  const q = pick < 0.5 ? String(1 + Math.floor(r() * 50)) : decimalString(r, 120, 1 + Math.floor(r() * 3))
  const scale = r()
  const p = scale < 0.1 ? decimalString(r, 1, 2) : scale < 0.8 ? decimalString(r, 500, 2) : decimalString(r, 25000, 2)
  const rate = RATES[Math.floor(r() * RATES.length)]
  const k = r()
  let kind: Case["kind"] = null
  let v = "0"
  const gross = Number(refGross(q === "0" ? "1" : q, p))
  if (k < 0.35) { kind = "pct"; v = r() < 0.1 ? "100" : decimalString(r, 60, r() < 0.5 ? 0 : 2) }
  else if (k < 0.6 && gross > 0) { kind = "eur"; v = (Math.floor(r() * gross) / 100).toFixed(2) }
  return { q: q === "0" || Number(q) === 0 ? "1" : q, p, rate, kind, v }
}

const asLine = (c: Case): DiscountableLine => ({
  description: "x",
  quantity: Number(c.q),
  unit_price_ht: Number(c.p),
  vat_rate: c.rate,
  ...(c.kind ? { discount_kind: c.kind, discount_value: Number(c.v) } : {}),
})

/* ------------------------------------------------------------------ */
/* Cas limites                                                         */
/* ------------------------------------------------------------------ */

describe("arrondi", () => {
  it("moitié vers le haut, sans l'erreur de virgule flottante", () => {
    expect(toCents(1.005)).toBe(101)
    expect(toCents(2.675)).toBe(268)
    expect(toCents(-1.005)).toBe(-101)
    expect(toCents("0,1")).toBe(10)
    expect(roundHalfUp(0.5)).toBe(1)
    expect(roundHalfUp(-0.5)).toBe(-1)
    expect(roundHalfUp(0.4999)).toBe(0)
    expect(Object.is(roundHalfUp(-0.2), 0)).toBe(true)
  })
  it("0,5 × 2,01 = 1,005 → 1,01 € (l'ancien calcul donnait 1,00 €)", () => {
    expect(lineAmounts({ quantity: 0.5, unit_price_ht: 2.01, vat_rate: 20 }).grossCents).toBe(101)
  })
})

describe("remise d'une ligne : cas écrits à la main", () => {
  it("10 % de 12 × 48 € = 57,60 € ; net 518,40 € ; TVA 10 % 51,84 €", () => {
    const a = lineAmounts({ quantity: 12, unit_price_ht: 48, vat_rate: 10, discount_kind: "pct", discount_value: 10 })
    expect(a).toEqual({ grossCents: 57600, discountCents: 5760, netCents: 51840, vatCents: 5184, error: null })
  })
  it("remise en euros", () => {
    const a = lineAmounts({ quantity: 3, unit_price_ht: 33.33, vat_rate: 20, discount_kind: "eur", discount_value: 9.99 })
    expect(a.grossCents).toBe(9999)
    expect(a.discountCents).toBe(999)
    expect(a.netCents).toBe(9000)
    expect(a.vatCents).toBe(1800)
  })
  it("100 % : ligne offerte, net et TVA à 0", () => {
    const a = lineAmounts({ quantity: 2, unit_price_ht: 45, vat_rate: 20, discount_kind: "pct", discount_value: 100 })
    expect(a.netCents).toBe(0)
    expect(a.vatCents).toBe(0)
  })
  it("remise égale au montant en euros : accepté", () => {
    expect(lineAmounts({ quantity: 1, unit_price_ht: 45, vat_rate: 20, discount_kind: "eur", discount_value: 45 }).netCents).toBe(0)
  })
  it("refus : plus de 100 %, plus que la ligne, négative", () => {
    expect(lineAmounts({ quantity: 1, unit_price_ht: 10, vat_rate: 20, discount_kind: "pct", discount_value: 100.01 }).error).toMatch(/100 %/)
    expect(lineAmounts({ quantity: 1, unit_price_ht: 10, vat_rate: 20, discount_kind: "eur", discount_value: 10.01 }).error).toMatch(/dépasse/)
    expect(lineAmounts({ quantity: 1, unit_price_ht: 10, vat_rate: 20, discount_kind: "pct", discount_value: -5 }).error).toMatch(/négative/)
  })
  it("une remise refusée ne change rien au montant", () => {
    const a = lineAmounts({ quantity: 1, unit_price_ht: 10, vat_rate: 20, discount_kind: "eur", discount_value: 50 })
    expect(a.netCents).toBe(1000)
    expect(a.discountCents).toBe(0)
  })
  it("sans remise ou remise à 0 : même calcul qu'avant", () => {
    for (const l of [
      { quantity: 7, unit_price_ht: 19.99, vat_rate: 5.5 },
      { quantity: 7, unit_price_ht: 19.99, vat_rate: 5.5, discount_kind: "pct", discount_value: 0 },
      { quantity: 7, unit_price_ht: 19.99, vat_rate: 5.5, discount_kind: null, discount_value: 30 },
    ]) {
      const a = lineAmounts(l)
      expect(a.grossCents).toBe(13993)
      expect(a.netCents).toBe(13993)
      expect(a.vatCents).toBe(770) // 139,93 × 5,5 % = 7,696 → 7,70
    }
  })
  it("autoliquidation : TVA forcée à 0", () => {
    expect(lineAmounts({ quantity: 1, unit_price_ht: 100, vat_rate: 20, discount_kind: "pct", discount_value: 10 }, true).vatCents).toBe(0)
  })
  it("libellés de la colonne Remise", () => {
    expect(lineDiscountLabel({ discount_kind: "pct", discount_value: 12.5 })).toBe("−12,5 %")
    expect(lineDiscountLabel({ discount_kind: "eur", discount_value: 1234.5 })).toBe("−1 234,50 €")
    expect(lineDiscountLabel({ discount_kind: "pct", discount_value: 0 })).toBeNull()
  })
})

describe("répartition de la remise globale (plus grand reste)", () => {
  it("somme exacte, aucune part au-dessus de sa base", () => {
    expect(allocate(7557, [146640, 4500])).toEqual([7332, 225])
    expect(allocate(100, [1, 1, 1])).toEqual([1, 1, 1]) // plafonnée à la base totale
    expect(allocate(2, [1, 1, 1]).reduce((a, b) => a + b, 0)).toBe(2)
    expect(allocate(0, [500, 500])).toEqual([0, 0])
    expect(allocate(300, [-200, 1000])).toEqual([0, 300])
  })
})

describe("remise globale : exemple de la maquette", () => {
  const lines: DiscountableLine[] = [
    { quantity: 12, unit_price_ht: 48, vat_rate: 10, discount_kind: "pct", discount_value: 10 },
    { quantity: 18, unit_price_ht: 36, vat_rate: 10 },
    { quantity: 30, unit_price_ht: 10, vat_rate: 10 },
    { quantity: 1, unit_price_ht: 45, vat_rate: 20 },
  ]
  const doc = computeDocument(lines, { kind: "pct", value: 5, label: "Remise commerciale" })
  it("avant remise 1 569,00 € ; lignes −57,60 € ; globale −75,57 € ; HT 1 435,83 €", () => {
    expect(doc.grossCents).toBe(156900)
    expect(doc.lineDiscountCents).toBe(5760)
    expect(doc.globalDiscountCents).toBe(7557)
    expect(doc.htCents).toBe(143583)
  })
  it("une ligne de remise par taux, au prorata des bases", () => {
    expect(doc.discountLines.map((l) => [l.vat_rate, l.total_ht, l.description])).toEqual([
      [20, -2.25, "Remise commerciale (TVA 20 %)"],
      [10, -73.32, "Remise commerciale (TVA 10 %)"],
    ])
  })
  it("TVA et TTC", () => {
    // 10 % : 51,84 + 64,80 + 30,00 − 7,33 = 139,31 ; 20 % : 9,00 − 0,45 = 8,55
    expect(doc.vatCents).toBe(14786)
    expect(doc.ttcCents).toBe(158369)
  })
  it("un seul taux : libellé sans taux", () => {
    const d = computeDocument([{ quantity: 1, unit_price_ht: 100, vat_rate: 20 }], { kind: "eur", value: 10, label: " " })
    expect(d.discountLines).toHaveLength(1)
    expect(d.discountLines[0].description).toBe("Remise commerciale")
    expect(d.ttcCents).toBe(10800)
  })
  it("refus : plus de 100 %, plus que le total, négative, rien à remiser", () => {
    const base = [{ quantity: 1, unit_price_ht: 100, vat_rate: 20 }]
    expect(computeDocument(base, { kind: "pct", value: 101, label: "" }).globalError).toMatch(/100 %/)
    expect(computeDocument(base, { kind: "eur", value: 100.01, label: "" }).globalError).toMatch(/dépasse/)
    expect(computeDocument(base, { kind: "eur", value: -1, label: "" }).globalError).toMatch(/négative/)
    expect(computeDocument([{ quantity: 1, unit_price_ht: 0, vat_rate: 20 }], { kind: "pct", value: 5, label: "" })).toMatchObject({ globalError: null, globalDiscountCents: 0 })
    expect(computeDocument([{ quantity: 1, unit_price_ht: 0, vat_rate: 20 }], { kind: "eur", value: 5, label: "" }).globalError).toMatch(/dépasse/)
  })
  it("100 % : document à 0, TVA comprise (aucun centime résiduel)", () => {
    const d = computeDocument(lines, { kind: "pct", value: 100, label: "Geste" })
    expect(d.htCents).toBe(0)
    expect(d.vatCents).toBe(0)
    // Cas trouvé par le stress test : TVA arrondie ligne à ligne ≠ TVA de la base
    const tricky = Array.from({ length: 3 }, () => ({ quantity: 1, unit_price_ht: 0.05, vat_rate: 10 }))
    const t = computeDocument(tricky, { kind: "pct", value: 100, label: "" })
    expect([t.htCents, t.vatCents]).toEqual([0, 0])
  })
})

describe("relecture, récapitulatif, contrôle serveur", () => {
  const items: DiscountableLine[] = [
    { description: "A", quantity: 2, unit_price_ht: 99.99, vat_rate: 20, discount_kind: "eur", discount_value: 20 },
    { description: "B", quantity: 1.5, unit_price_ht: 40, vat_rate: 5.5 },
  ]
  it("une remise globale en euros se relit au centime près", () => {
    const g = buildGlobalDiscountLines(items, { kind: "eur", value: 33.33, label: "Geste" })
    expect(readGlobalDiscount(g.lines)).toEqual({ kind: "eur", value: 33.33, label: "Geste" })
  })
  it("une remise en % se relit avec son taux", () => {
    const g = buildGlobalDiscountLines(items, { kind: "pct", value: 7.5, label: "Fidélité" })
    expect(readGlobalDiscount([...items, ...g.lines])).toEqual({ kind: "pct", value: 7.5, label: "Fidélité" })
  })
  it("le serveur refuse une remise impossible", () => {
    const bad = normalizeDiscountLines([{ ...items[0], discount_kind: "pct", discount_value: 150 }])
    expect(bad.ok).toBe(false)
  })
  it("le serveur recalcule une ligne remisée envoyée avec un faux total", () => {
    const r = normalizeDiscountLines([{ ...items[0], total_ht: 1, total_vat: 0, total_ttc: 1 }])
    expect(r.ok && r.lines[0]).toMatchObject({ total_ht: 179.98, total_vat: 36, total_ttc: 215.98, discount_amount: 20 })
  })
  it("le serveur reconstruit une remise globale trafiquée", () => {
    const g = buildGlobalDiscountLines(items, { kind: "pct", value: 10, label: "X" })
    const forged = [...items, ...g.lines.map((l) => ({ ...l, total_ht: -5000, total_vat: 0, total_ttc: -5000 }))]
    const r = normalizeDiscountLines(forged)
    expect(r.ok).toBe(true)
    if (r.ok) expect(sumLines(r.lines).subtotal_ht).toBe(fromCents(computeDocument(items, { kind: "pct", value: 10, label: "X" }).htCents))
  })
  it("un document sans remise n'est pas touché", () => {
    const plain = [{ description: "Z", quantity: 1, unit_price_ht: 10, vat_rate: 20, total_ht: 10, total_vat: 2, total_ttc: 12 }]
    const r = normalizeDiscountLines(plain)
    expect(r.ok && r.lines).toEqual(plain)
    expect(r.ok && r.lines[0]).toBe(plain[0])
  })
  it("autoliquidation : remise globale à 0 % de TVA, traitement conservé", () => {
    const rc = [{ quantity: 1, unit_price_ht: 1000, vat_rate: 0, vat_treatment: "autoliquidation_btp" }]
    const g = buildGlobalDiscountLines(rc, { kind: "pct", value: 3, label: "" }, true)
    expect(g.lines).toEqual([expect.objectContaining({ total_ht: -30, total_vat: 0, vat_treatment: "autoliquidation_btp" })])
  })
})

/* ------------------------------------------------------------------ */
/* Stress test                                                         */
/* ------------------------------------------------------------------ */

describe("stress test : 6 000 documents tirés au hasard", () => {
  const r = rng(20261104)
  const DOCS = 6000
  let checkedLines = 0
  let withGlobal = 0

  it("chaque montant égale la référence exacte, chaque total égale la somme", () => {
    for (let d = 0; d < DOCS; d++) {
      const n = 1 + Math.floor(r() * (r() < 0.05 ? 120 : 8))
      const cases = Array.from({ length: n }, () => randomLine(r))
      const reverseCharge = r() < 0.05
      const lines = cases.map((c) => ({
        ...asLine(c),
        ...(reverseCharge ? { vat_rate: 0, vat_treatment: "autoliquidation_btp" } : {}),
      }))

      // 1. Chaque ligne contre la référence
      let grossRef = BigInt(0)
      let discRef = BigInt(0)
      const netByRate = new Map<string, bigint>()
      cases.forEach((c, i) => {
        const a = lineAmounts(lines[i], reverseCharge)
        const g = refGross(c.q, c.p)
        expect(a.grossCents).toBe(Number(g))
        let disc = BigInt(0)
        if (c.kind === "pct" && Number(c.v) > 0) disc = refPct(g, c.v)
        if (c.kind === "eur" && Number(c.v) > 0) disc = refEur(c.v)
        expect(a.error).toBeNull()
        expect(a.discountCents).toBe(Number(disc))
        expect(a.netCents).toBe(Number(g - disc))
        expect(a.netCents).toBeGreaterThanOrEqual(0)
        expect(a.discountCents).toBeLessThanOrEqual(a.grossCents)
        const rate = reverseCharge ? 0 : c.rate
        const rd = dec(String(rate))
        expect(a.vatCents).toBe(Number(roundDiv((g - disc) * rd.n, BigInt(100) * pow10(rd.scale))))
        grossRef += g
        discRef += disc
        const key = String(rate)
        netByRate.set(key, (netByRate.get(key) ?? BigInt(0)) + (g - disc))
        checkedLines++
      })

      // 2. Remise globale
      const gk = r()
      let global: GlobalDiscount | null = null
      const netTotal = Number(grossRef - discRef)
      if (gk < 0.4) global = { kind: "pct", value: Number(r() < 0.05 ? "100" : decimalString(r, 30, r() < 0.5 ? 0 : 2)), label: "Remise" }
      else if (gk < 0.6 && netTotal > 0) global = { kind: "eur", value: Math.floor(r() * netTotal) / 100, label: "Geste" }

      const doc = computeDocument(lines, global, reverseCharge)
      expect(doc.globalError).toBeNull()
      expect(doc.grossCents).toBe(Number(grossRef))
      expect(doc.lineDiscountCents).toBe(Number(discRef))

      let globalRef = BigInt(0)
      if (global?.kind === "pct" && global.value > 0) globalRef = refPct(grossRef - discRef, String(global.value))
      if (global?.kind === "eur" && global.value > 0) globalRef = refEur(global.value.toFixed(2))
      expect(doc.globalDiscountCents).toBe(Number(globalRef))
      if (globalRef > BigInt(0)) withGlobal++

      // 3. Répartition : somme exacte, chaque part ≤ base, à moins d'un centime du prorata exact
      const shares = doc.discountLines.map((l) => -toCents(l.total_ht))
      expect(shares.reduce((s, x) => s + x, 0)).toBe(Number(globalRef))
      for (const l of doc.discountLines) {
        const base = Number(netByRate.get(String(l.vat_rate)) ?? BigInt(0))
        const share = -toCents(l.total_ht)
        expect(share).toBeGreaterThan(0)
        expect(share).toBeLessThanOrEqual(base)
        const exact = (Number(globalRef) * base) / Number(grossRef - discRef)
        expect(Math.abs(share - exact)).toBeLessThan(1 + 1e-6)
        expect(toCents(l.total_ttc)).toBe(toCents(l.total_ht) + toCents(l.total_vat))
      }

      // 4. Totaux : HT = avant remise − remises ; TTC = HT + TVA ; jamais négatif
      expect(doc.htCents).toBe(Number(grossRef - discRef - globalRef))
      expect(doc.ttcCents).toBe(doc.htCents + doc.vatCents)
      expect(doc.htCents).toBeGreaterThanOrEqual(0)
      expect(doc.vatCents).toBeGreaterThanOrEqual(0)
      if (reverseCharge) expect(doc.vatCents).toBe(0)

      // 5. TVA par taux : écart d'arrondi ligne à ligne borné (un demi-centime par ligne,
      //    toujours sous la tolérance d'un euro de la règle BR-CO-17)
      const saved = [
        ...lines.map((l, i) => ({
          ...l,
          discount_amount: fromCents(doc.items[i].discountCents),
          total_ht: fromCents(doc.items[i].netCents),
          total_vat: fromCents(doc.items[i].vatCents),
          total_ttc: fromCents(doc.items[i].netCents + doc.items[i].vatCents),
        })),
        ...doc.discountLines,
      ]
      const byRate = new Map<number, { base: number; vat: number; count: number }>()
      for (const l of saved) {
        const k = Number(l.vat_rate)
        const g = byRate.get(k) ?? { base: 0, vat: 0, count: 0 }
        g.base += toCents(l.total_ht); g.vat += toCents(l.total_vat); g.count++
        byRate.set(k, g)
      }
      for (const [rate, g] of Array.from(byRate.entries())) {
        const exact = roundHalfUp((g.base * rate) / 100)
        // Taux remisé : TVA exactement celle de la base après remise
        if (doc.discountLines.some((l) => Number(l.vat_rate) === rate)) expect(g.vat).toBe(exact)
        expect(Math.abs(g.vat - exact)).toBeLessThanOrEqual(Math.ceil(g.count / 2))
        expect(Math.abs(g.vat - exact)).toBeLessThan(100)
      }

      // 6. Ce que le navigateur enregistre, le serveur l'accepte tel quel ; relu, rien ne bouge
      const totals = sumLines(saved)
      expect(toCents(totals.subtotal_ht)).toBe(doc.htCents)
      expect(toCents(totals.total_vat)).toBe(doc.vatCents)
      const norm = normalizeDiscountLines(saved)
      expect(norm.ok).toBe(true)
      if (!norm.ok) continue
      const again = normalizeDiscountLines(norm.lines)
      expect(again.ok && again.lines).toEqual(norm.lines)
      const t2 = sumLines(norm.lines)
      expect(toCents(t2.subtotal_ht)).toBe(doc.htCents)
      expect(toCents(t2.total_vat)).toBe(doc.vatCents)
      expect(toCents(t2.total_ttc)).toBe(doc.ttcCents)

      // 7. La remise globale se relit et se recalcule à l'identique
      const reread = readGlobalDiscount(saved)
      if (globalRef > BigInt(0)) {
        expect(reread?.kind).toBe(global!.kind)
        const rebuilt = computeDocument(itemLines(saved), reread, reverseCharge)
        expect(rebuilt.htCents).toBe(doc.htCents)
        expect(rebuilt.vatCents).toBe(doc.vatCents)
      } else expect(reread).toBeNull()

      // 8. Récapitulatif imprimé : avant remise − remises = total HT
      const sum = discountSummary(saved)
      if (discRef === BigInt(0) && globalRef === BigInt(0)) expect(sum).toBeNull()
      else {
        expect(toCents(sum!.gross)).toBe(Number(grossRef))
        expect(toCents(sum!.lineDiscount)).toBe(Number(discRef))
        expect(toCents(sum!.gross) - toCents(sum!.lineDiscount) - toCents(sum!.global?.amount ?? 0)).toBe(doc.htCents)
        expect(itemLines(saved).length).toBe(lines.length)
        expect(saved.filter(isDocumentDiscountLine).length).toBe(doc.discountLines.length)
      }
    }
    expect(checkedLines).toBeGreaterThan(20000)
    expect(withGlobal).toBeGreaterThan(1500)
  })

  it("grands montants : 200 lignes à 99 999,99 €, remise 33,33 % puis 12 345,67 €", () => {
    const lines = Array.from({ length: 200 }, (_, i) => ({
      quantity: 999.999, unit_price_ht: 99999.99, vat_rate: RATES[i % 4],
      discount_kind: "pct", discount_value: 33.33,
    }))
    const doc = computeDocument(lines, { kind: "eur", value: 12345.67, label: "" })
    const gross = refGross("999.999", "99999.99")
    const disc = refPct(gross, "33.33")
    expect(doc.grossCents).toBe(Number(gross) * 200)
    expect(doc.lineDiscountCents).toBe(Number(disc) * 200)
    expect(doc.htCents).toBe(Number((gross - disc) * BigInt(200)) - 1234567)
    expect(Number.isSafeInteger(doc.ttcCents)).toBe(true)
  })

  it("petits montants : un centime, remises qui s'arrondissent à 0", () => {
    const doc = computeDocument([{ quantity: 1, unit_price_ht: 0.01, vat_rate: 20, discount_kind: "pct", discount_value: 49 }], { kind: "pct", value: 49, label: "" })
    expect(doc.lineDiscountCents).toBe(0) // 0,49 centime → 0
    expect(doc.globalDiscountCents).toBe(0)
    expect(doc.htCents).toBe(1)
    const half = computeDocument([{ quantity: 1, unit_price_ht: 0.01, vat_rate: 20, discount_kind: "pct", discount_value: 50 }], null)
    expect(half.lineDiscountCents).toBe(1) // 0,5 centime → 1
    expect(half.htCents).toBe(0)
  })
})
