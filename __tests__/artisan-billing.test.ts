/**
 * Formule Artisan : factures d'acompte, situations de travaux, facture de
 * solde, retenue de garantie et autoliquidation — calculs au centime
 * (lib/artisan/billing.ts, quote-billing.ts, build.ts, retention.ts).
 *
 * Invariant central : additionner toutes les factures d'un devis facturé
 * jusqu'au bout (acomptes + situations, ou acomptes + solde) donne exactement
 * le montant TTC du devis, et chaque acompte est repris exactement une fois.
 */
import { describe, expect, it } from "vitest"
import {
  computeDeposit, computeFinal, computeSituation, depositGroups, invoiceKindLabel, invoiceTitle, isArtisanKind,
  parseBillingContext, previousProgress, sumGroups, vatGroupsOf,
  type BillingLine, type DeductedRecord, type DepositRecord, type SourceLine,
} from "@/lib/artisan/billing"
import { quoteBillingState, conversionBlockedBy, type InvoiceForBilling } from "@/lib/artisan/quote-billing"
import { buildArtisanInvoice, buildFreeDeposit, parseCreateRequest, parseFreeDeposit, type QuoteBilling, type Preview } from "@/lib/artisan/build"
import { applyRetention, dueAtTermCents, parseRetentionRate, releaseDate, retentionNote, retentionStatus } from "@/lib/artisan/retention"
import { allocateCents, percentOf, roundHalfAwayFromZero, toCents, vatOfCents } from "@/lib/artisan/money"
import { applyReverseCharge, hasReverseCharge, isReverseChargeDocument, reverseChargeClientIssue } from "@/lib/artisan/reverse-charge"

const line = (description: string, quantity: number, unit_price_ht: number, vat_rate: number, extra: Partial<SourceLine> = {}): SourceLine => {
  const total_ht = Math.round(quantity * unit_price_ht * 100) / 100
  return { description, quantity, unit_price_ht, vat_rate, total_ht, total_vat: Math.round(total_ht * vat_rate) / 100, ...extra }
}
const cents = (lines: { total_ht: number | string | null | undefined; total_vat?: number | string | null }[]) => ({
  ht: lines.reduce((s, l) => s + toCents(l.total_ht), 0),
  vat: lines.reduce((s, l) => s + toCents(l.total_vat), 0),
})
const ttcOf = (lines: BillingLine[]) => { const c = cents(lines); return c.ht + c.vat }

/** Devis du canevas : plâtrerie à 10 %, échafaudage à 20 % — 12 085,60 € TTC. */
const QUOTE: SourceLine[] = [
  line("Doublage isolant collé 10+80", 140, 36, 10, { unit: "m²" }),
  line("Cloison sur ossature métallique 72/48", 72, 48, 10, { unit: "m²" }),
  line("Bandes et enduits", 212, 10, 10, { unit: "m²" }),
  line("Location d'échafaudage", 4, 85, 20, { unit: "jour" }),
]
const QUOTE_TTC = sumGroups(vatGroupsOf(QUOTE)).ttc

describe("montants au centime", () => {
  it("arrondit la moitié loin de zéro, y compris en négatif", () => {
    expect(roundHalfAwayFromZero(2.5)).toBe(3)
    expect(roundHalfAwayFromZero(-2.5)).toBe(-3)
    expect(roundHalfAwayFromZero(0.285 * 100)).toBe(29)
  })
  it("TVA à 5,5 % exacte sur un produit entier", () => {
    expect(vatOfCents(1234, 5.5)).toBe(68) // 67,87 → 68
    expect(vatOfCents(306000, 5.5)).toBe(16830)
  })
  it("répartit un total sans perdre de centime", () => {
    const parts = allocateCents(1000, [1, 1, 1])
    expect(parts.reduce((s, p) => s + p, 0)).toBe(1000)
    expect(parts).toEqual([334, 333, 333])
    expect(percentOf(1_061_600, 33.33)).toBe(353_831)
  })
})

describe("facture d'acompte", () => {
  it("devis à 12 085,60 € TTC", () => {
    expect(QUOTE_TTC).toBe(1_208_560)
  })
  it("30 % : chaque taux reçoit 30 % de sa base, TVA par taux", () => {
    const r = computeDeposit(QUOTE, { mode: "percent", percent: 30 }, { quoteNumber: "D-2026-033" })
    if (!r.ok) throw new Error(r.error)
    expect(r.groups).toEqual([
      { rate: 20, treatment: "standard", ht: 10_200, vat: 2_040 },
      { rate: 10, treatment: "standard", ht: 318_480, vat: 31_848 },
    ])
    expect(r.ttc).toBe(362_568)
    expect(r.lines).toHaveLength(2)
    expect(r.lines[0].description).toBe("Acompte de 30 % sur le devis D-2026-033 — TVA 20 %")
    expect(r.lines.every((l) => l.quantity === 1)).toBe(true)
  })
  it("montant TTC demandé : atteint au centime près, ventilé au prorata", () => {
    for (const amount of [1500, 1234.56, 3000.01, 99.99, 12085.6]) {
      const r = computeDeposit(QUOTE, { mode: "amount", amountTtc: amount })
      if (!r.ok) throw new Error(r.error)
      expect(Math.abs(r.ttc - toCents(amount))).toBeLessThanOrEqual(1)
      for (const g of r.groups) expect(g.vat).toBe(vatOfCents(g.ht, g.rate))
    }
  })
  it("refuse de dépasser le montant du devis, acomptes précédents compris", () => {
    const r = computeDeposit(QUOTE, { mode: "percent", percent: 40 }, { alreadyTtc: 800_000 })
    expect(r.ok).toBe(false)
    expect(computeDeposit(QUOTE, { mode: "percent", percent: 0 }).ok).toBe(false)
    expect(computeDeposit(QUOTE, { mode: "percent", percent: 101 }).ok).toBe(false)
    expect(computeDeposit(QUOTE, { mode: "amount", amountTtc: -5 }).ok).toBe(false)
  })
  it("autoliquidation : acompte sans TVA, catégorie conservée", () => {
    const sub = applyReverseCharge([line("Plâtrerie lot 3", 1, 18400, 20)], true)
    const r = computeDeposit(sub, { mode: "amount", amountTtc: 3000 })
    if (!r.ok) throw new Error(r.error)
    expect(r.vat).toBe(0)
    expect(r.ttc).toBe(300_000)
    expect(r.lines[0].vat_treatment).toBe("autoliquidation_btp")
    expect(r.lines[0].description).toContain("autoliquidation")
  })
})

function deposit(percent: number, number = "F-2026-0150"): DepositRecord {
  const r = computeDeposit(QUOTE, { mode: "percent", percent })
  if (!r.ok) throw new Error(r.error)
  return { invoice_id: number, number, issue_date: "2026-09-25", groups: depositGroups(r.lines) }
}

describe("situations de travaux", () => {
  it("cumul, déduction des situations précédentes et reprise de l'acompte : le total est exactement le devis", () => {
    const dep = deposit(30)
    const s1 = computeSituation(QUOTE, { global: 40 }, previousProgress(QUOTE.length, []), { records: [dep], deducted: [] })
    if (!s1.ok) throw new Error(s1.error)
    expect(s1.final).toBe(false)
    expect(s1.cumulative_percent).toBe(40)
    // Acompte repris à 40 %, par taux
    const ded1 = s1.deductions[0]
    expect(ded1.groups.map((g) => g.ht)).toEqual([percentOf(10_200, 40), percentOf(318_480, 40)])

    const deducted: DeductedRecord[] = s1.deductions.map((d) => ({ invoice_id: d.invoice_id, groups: d.groups }))
    const s2 = computeSituation(QUOTE, { global: 75 }, previousProgress(QUOTE.length, [{ lines: s1.lines }]), { records: [dep], deducted })
    if (!s2.ok) throw new Error(s2.error)
    expect(s2.previous_ht).toBe(s1.cumulative_ht)
    expect(s2.amount_ht).toBe(s2.cumulative_ht - s1.cumulative_ht)

    const deducted2 = [...deducted, ...s2.deductions.map((d) => ({ invoice_id: d.invoice_id, groups: d.groups }))]
    const s3 = computeSituation(QUOTE, QUOTE.map(() => ({ percent: 100 })), previousProgress(QUOTE.length, [{ lines: s1.lines }, { lines: s2.lines }]), { records: [dep], deducted: deducted2 })
    if (!s3.ok) throw new Error(s3.error)
    expect(s3.final).toBe(true)
    expect(s3.cumulative_ht).toBe(s3.contract_ht)

    // Somme des factures = devis ; acompte repris exactement une fois (HT et TVA)
    const depTtc = sumGroups(dep.groups).ttc
    expect(depTtc + s1.ttc + s2.ttc + s3.ttc).toBe(QUOTE_TTC)
    const allDed = [...s1.deductions, ...s2.deductions, ...s3.deductions].flatMap((d) => d.groups)
    expect(allDed.reduce((s, g) => s + g.ht, 0)).toBe(sumGroups(dep.groups).ht)
    expect(allDed.reduce((s, g) => s + g.vat, 0)).toBe(sumGroups(dep.groups).vat)
    // Chaque ligne du devis facturée exactement
    const billed = previousProgress(QUOTE.length, [{ lines: s1.lines }, { lines: s2.lines }, { lines: s3.lines }]).billedHt
    expect(billed).toEqual(QUOTE.map((l) => toCents(l.total_ht)))
  })

  it("lignes de reprise : quantité -1, prix positif, montants négatifs", () => {
    const s = computeSituation(QUOTE, { global: 50 }, previousProgress(QUOTE.length, []), { records: [deposit(20)], deducted: [] })
    if (!s.ok) throw new Error(s.error)
    const reprises = s.lines.filter((l) => l.deposit_of)
    expect(reprises.length).toBe(2)
    for (const l of reprises) {
      expect(l.quantity).toBe(-1)
      expect(l.unit_price_ht).toBeGreaterThan(0)
      expect(l.total_ht).toBeLessThan(0)
      expect(l.total_ht).toBe(-l.unit_price_ht)
    }
  })

  it("avancement par ligne ; une ligne ne recule jamais ; rien à facturer refusé", () => {
    const s1 = computeSituation(QUOTE, [{ percent: 100 }, { percent: 50 }, { percent: 0 }, { percent: 25 }], previousProgress(QUOTE.length, []))
    if (!s1.ok) throw new Error(s1.error)
    expect(s1.lines.map((l) => l.progress?.quote_line)).toEqual([0, 1, 3])
    const prev = previousProgress(QUOTE.length, [{ lines: s1.lines }])
    expect(prev.percents).toEqual([100, 50, 0, 25])
    expect(computeSituation(QUOTE, [{ percent: 100 }, { percent: 40 }, { percent: 10 }, { percent: 25 }], prev).ok).toBe(false)
    expect(computeSituation(QUOTE, [{ percent: 100 }, { percent: 50 }, { percent: 0 }, { percent: 25 }], prev).ok).toBe(false)
    // Mode global : une ligne déjà plus avancée garde son avancement
    const g = computeSituation(QUOTE, { global: 60 }, prev)
    if (!g.ok) throw new Error(g.error)
    expect(g.state.map((s) => s.percent)).toEqual([100, 60, 60, 60])
  })

  it("propriété : quelles que soient les étapes, la facturation complète retombe sur le devis au centime", () => {
    let seed = 42
    const rand = () => { seed = (seed * 1103515245 + 12345) % 2 ** 31; return seed / 2 ** 31 }
    const rates = [0, 5.5, 10, 20]
    for (let run = 0; run < 200; run++) {
      const n = 1 + Math.floor(rand() * 6)
      const q: SourceLine[] = Array.from({ length: n }, (_, i) =>
        line(`L${i}`, Math.round(rand() * 300 * 100) / 100 + 0.01, Math.round(rand() * 900 * 100) / 100 + 0.01, rates[Math.floor(rand() * 4)]))
      const total = sumGroups(vatGroupsOf(q)).ttc
      const depPercent = Math.round(rand() * 50 * 100) / 100
      const deps: DepositRecord[] = []
      if (depPercent > 0) {
        const d = computeDeposit(q, { mode: "percent", percent: depPercent })
        if (d.ok) deps.push({ invoice_id: "d", number: "F-1", issue_date: "2026-01-01", groups: depositGroups(d.lines) })
      }
      let sum = deps.reduce((s, d) => s + sumGroups(d.groups).ttc, 0)
      const situations: { lines: BillingLine[] }[] = []
      const deducted: DeductedRecord[] = []
      let percents = q.map(() => 0)
      for (let step = 0; step < 6; step++) {
        const last = step === 5
        percents = percents.map((p) => (last ? 100 : Math.min(100, Math.round((p + rand() * 40) * 100) / 100)))
        const s = computeSituation(q, percents.map((percent) => ({ percent })), previousProgress(n, situations), { records: deps, deducted })
        if (!s.ok) continue // avancement identique : rien à facturer
        expect(s.ttc).toBeGreaterThanOrEqual(0)
        // TVA d'une ligne : cumul moins déjà facturé. Écart à « HT × taux » d'un
        // centime au plus, deux à 100 % si la TVA enregistrée sur le devis
        // était elle-même arrondie autrement (BR-CO-17 tolère 1 € par taux)
        for (const l of s.lines) if (l.vat_rate > 0) expect(Math.abs(toCents(l.total_vat) - vatOfCents(toCents(l.total_ht), l.vat_rate))).toBeLessThanOrEqual(2)
        situations.push({ lines: s.lines })
        deducted.push(...s.deductions.map((d) => ({ invoice_id: d.invoice_id, groups: d.groups })))
        sum += s.ttc
      }
      expect(sum).toBe(total)
    }
  })
})

describe("facture de solde", () => {
  it("toutes les lignes du devis, acompte repris en ligne : acompte + solde = devis", () => {
    const dep = deposit(30)
    const r = computeFinal(QUOTE, [dep])
    if (!r.ok) throw new Error(r.error)
    expect(r.lines.filter((l) => !l.deposit_of)).toHaveLength(QUOTE.length)
    expect(sumGroups(dep.groups).ttc + r.ttc).toBe(QUOTE_TTC)
    expect(r.deductions[0].ttc).toBe(3625.68)
  })
  it("deux acomptes, dont un déjà en partie repris", () => {
    const d1 = deposit(10, "F-1")
    const d2 = deposit(15, "F-2")
    const half: DeductedRecord = { invoice_id: "F-1", groups: d1.groups.map((g) => ({ ...g, ht: Math.round(g.ht / 2), vat: vatOfCents(Math.round(g.ht / 2), g.rate) })) }
    const r = computeFinal(QUOTE, [d1, d2], [half])
    if (!r.ok) throw new Error(r.error)
    const repris = r.deductions.flatMap((d) => d.groups).reduce((s, g) => s + g.ht, 0) + half.groups.reduce((s, g) => s + g.ht, 0)
    expect(repris).toBe(sumGroups(d1.groups).ht + sumGroups(d2.groups).ht)
  })
  it("sans acompte : refusée (la conversion du devis suffit)", () => {
    expect(computeFinal(QUOTE, []).ok).toBe(false)
  })
})

describe("retenue de garantie (loi n° 71-584 du 16 juillet 1971)", () => {
  it("5 % au plus, du TTC de la facture", () => {
    expect(applyRetention(338_397, "retenue", 5)).toEqual({ rate: 5, mode: "retenue", amount: 169.2, base_ttc: 3383.97 })
    expect(parseRetentionRate(5.01)).toBeNull()
    expect(parseRetentionRate("2,5")).toBe(2.5)
    expect(applyRetention(100_000, "retenue", 6)).toBeNull()
    expect(applyRetention(100_000, "aucune", 5)).toBeNull()
  })
  it("caution bancaire : rien n'est retenu, la facture le dit", () => {
    const r = applyRetention(100_000, "caution", 5)
    expect(r).toMatchObject({ mode: "caution", amount: 0 })
    expect(retentionNote(r)).toContain("caution bancaire")
  })
  it("montant à régler à l'échéance = TTC − retenue ; note ABU avec l'article 2", () => {
    expect(dueAtTermCents(3383.97, 169.2)).toBe(321_477)
    expect(retentionNote(applyRetention(338_397, "retenue", 5))).toMatch(/169,20.*un an après la réception.*art\. 2/)
  })
  it("libération un an après la réception, sauf opposition", () => {
    expect(releaseDate("2026-11-20")).toBe("2027-11-20")
    expect(releaseDate("2028-02-29")).toBe("2029-03-01")
    expect(releaseDate(null)).toBeNull()
    expect(retentionStatus(0, null, null, "2026-10-01")).toEqual({ state: "none" })
    expect(retentionStatus(1000, null, null, "2026-10-01").state).toBe("awaiting_reception")
    expect(retentionStatus(1000, "2026-11-20", null, "2027-11-19")).toMatchObject({ state: "pending", releaseDate: "2027-11-20" })
    expect(retentionStatus(1000, "2026-11-20", null, "2027-11-20").state).toBe("releasable")
    expect(retentionStatus(1000, "2026-11-20", "2027-12-01", "2028-01-01").state).toBe("released")
  })
})

describe("autoliquidation en sous-traitance (CGI, art. 283, 2 nonies)", () => {
  it("lignes sans TVA, traitement posé, retiré si la case est décochée", () => {
    const lines = applyReverseCharge<SourceLine & { total_ttc?: number }>([{ total_ht: 100, vat_rate: 20, total_vat: 20, total_ttc: 120 }], true)
    expect(lines[0]).toMatchObject({ vat_rate: 0, total_vat: 0, total_ttc: 100, vat_treatment: "autoliquidation_btp" })
    expect(hasReverseCharge(lines)).toBe(true)
    expect(isReverseChargeDocument(lines)).toBe(true)
    expect(applyReverseCharge(lines, false)[0].vat_treatment).toBeUndefined()
  })
  it("client identifié obligatoire (BR-AE-02)", () => {
    expect(reverseChargeClientIssue({ siren: "", vat_number: "" })).toMatch(/SIREN/)
    expect(reverseChargeClientIssue({ siren: "732829320" })).toBeNull()
  })
  it("situation en autoliquidation : TTC = HT, retenue sur ce montant", () => {
    const sub = applyReverseCharge([line("Lot 3", 1, 18400, 0), line("Faux plafonds", 120, 42, 0)], true)
    const s = computeSituation(sub, [{ percent: 50 }, { percent: 25 }], previousProgress(2, []))
    if (!s.ok) throw new Error(s.error)
    expect(s.vat).toBe(0)
    expect(s.ttc).toBe(920_000 + 126_000)
    expect(applyRetention(s.ttc, "retenue", 5)?.amount).toBe(523)
  })
})

/* ------------------------------------------------------------------ */
/* État de facturation d'un devis et construction (route et écran)     */
/* ------------------------------------------------------------------ */

const quoteRow: QuoteBilling["quote"] = { id: "q1", quote_number: "D-2026-033", status: "accepted", issue_date: "2026-09-24", lines: QUOTE, total_ttc: 12085.6, client_id: "c1", chantier_id: "ch1", converted_invoice_id: null }
const chantier = { id: "ch1", name: "Résidence Les Tilleuls", retention_mode: "retenue" as const, retention_rate: 5, subcontracting: false }

function billingOf(invoices: InvoiceForBilling[], quote = quoteRow): QuoteBilling {
  return { quote, invoices, state: quoteBillingState(quote, invoices), chantier }
}
function asInvoice(p: Preview, id: string, number: string | null, status: string): InvoiceForBilling {
  return { id, invoice_number: number, status, issue_date: "2026-10-01", invoice_kind: p.kind, billing_context: p.context, lines: p.lines, total_ttc: p.total_ttc, retention_amount: p.retention?.amount ?? 0 }
}
const build = (b: QuoteBilling, body: Record<string, unknown>): Preview => {
  const req = parseCreateRequest(body)
  if ("error" in req) throw new Error(req.error)
  const p = buildArtisanInvoice(b, req, "2026-10-01")
  if ("error" in p) throw new Error(p.error)
  return p
}

describe("état de facturation d'un devis", () => {
  it("parcours complet : acompte, deux situations avec retenue du chantier, plus rien ensuite", () => {
    let invoices: InvoiceForBilling[] = []
    const dep = build(billingOf(invoices), { kind: "deposit", deposit: { mode: "percent", percent: 30 } })
    expect(dep.context.quote?.number).toBe("D-2026-033")
    expect(dep.context.chantier?.name).toBe("Résidence Les Tilleuls")
    expect(dep.retention).toBeNull() // jamais de retenue sur un acompte
    expect(dep.due_date).toBe("2026-10-01")

    // Brouillon en cours : rien d'autre tant qu'il n'est pas émis
    invoices = [asInvoice(dep, "i1", null, "draft")]
    expect(billingOf(invoices).state.canSituation).toMatchObject({ ok: false })
    invoices = [asInvoice(dep, "i1", "F-2026-0150", "sent")]

    const s1 = build(billingOf(invoices), { kind: "situation", progress: { global: 40 } })
    expect(s1.context.situation?.number).toBe(1)
    expect(s1.retention).toMatchObject({ mode: "retenue", rate: 5 })
    expect(s1.retention?.amount).toBe(Math.round(s1.total_ttc * 5) / 100)
    expect(s1.context.deductions[0].number).toBe("F-2026-0150")
    invoices.push(asInvoice(s1, "i2", "F-2026-0158", "sent"))

    let st = billingOf(invoices).state
    expect(st.canDeposit).toMatchObject({ ok: false }) // plus d'acompte après une situation
    expect(st.canFinal).toMatchObject({ ok: false })   // le décompte final remplace le solde
    expect(st.nextSituation).toBe(2)
    expect(st.progressPercent).toBe(40)

    const s2 = build(billingOf(invoices), { kind: "situation", progress: { global: 100 }, retention: { mode: "retenue", rate: 5 } })
    expect(s2.context.situation).toMatchObject({ number: 2, final: true })
    invoices.push(asInvoice(s2, "i3", "F-2026-0163", "sent"))

    st = billingOf(invoices).state
    expect(st.finalIssued).toBe(true)
    expect(st.billedTtc).toBe(QUOTE_TTC)
    expect(st.canSituation).toMatchObject({ ok: false })
    expect(conversionBlockedBy(invoices)).not.toBeNull()
  })

  it("facture annulée par un avoir total : son avancement est à refacturer", () => {
    const s1 = build(billingOf([]), { kind: "situation", progress: { global: 40 } })
    const st = billingOf([asInvoice(s1, "i1", "F-1", "credited")]).state
    expect(st.previous.percents.every((p) => p === 0)).toBe(true)
    expect(st.nextSituation).toBe(2) // le numéro n° 1 reste pris
    expect(st.billedTtc).toBe(0)
  })

  it("devis non accepté ou déjà converti : rien n'est possible", () => {
    expect(billingOf([], { ...quoteRow, status: "sent" }).state.canDeposit.ok).toBe(false)
    expect(billingOf([], { ...quoteRow, converted_invoice_id: "x" }).state.canSituation.ok).toBe(false)
    expect(() => build(billingOf([], { ...quoteRow, status: "sent" }), { kind: "deposit", deposit: { mode: "percent", percent: 30 } })).toThrow(/accepté/)
  })

  it("retenue au-delà de 5 % refusée dès la lecture de la requête", () => {
    expect(parseCreateRequest({ kind: "situation", progress: { global: 50 }, retention: { mode: "retenue", rate: 7 } })).toMatchObject({ error: expect.stringContaining("5 %") })
    expect(parseCreateRequest({ kind: "avance" })).toMatchObject({ error: expect.any(String) })
  })

  it("acompte libre : une ligne au taux choisi, montant TTC au centime près", () => {
    const input = parseFreeDeposit({ client_id: "c1", label: "Acompte à la commande, cuisine", amount_ttc: 1000, vat_rate: 10 })
    if ("error" in input) throw new Error(input.error)
    const p = buildFreeDeposit(input, null, "2026-10-01")
    if ("error" in p) throw new Error(p.error)
    expect(p.context.quote).toBeNull()
    expect(p.lines).toHaveLength(1)
    expect(Math.abs(toCents(p.total_ttc) - 100_000)).toBeLessThanOrEqual(1)
    expect(parseFreeDeposit({ client_id: "c1", label: "x", amount_ttc: 10, vat_rate: 7 })).toMatchObject({ error: expect.any(String) })
  })
})

describe("libellés et contexte", () => {
  it("titres imprimés et pastilles", () => {
    expect(invoiceTitle("deposit")).toBe("Facture d'acompte")
    expect(invoiceTitle("situation", { situation: { number: 3, final: true } as never })).toBe("Situation de travaux n° 3 — décompte final")
    expect(invoiceKindLabel("final")).toBe("Solde")
    expect(invoiceKindLabel("standard")).toBeNull()
    expect(isArtisanKind("situation")).toBe(true)
    expect(isArtisanKind("standard")).toBe(false)
    expect(isArtisanKind(undefined)).toBe(false)
  })
  it("contexte illisible ignoré", () => {
    expect(parseBillingContext(null)).toBeNull()
    expect(parseBillingContext({ v: 2, kind: "deposit" })).toBeNull()
    expect(parseBillingContext({ v: 1, kind: "deposit" })?.deductions).toEqual([])
  })
})
