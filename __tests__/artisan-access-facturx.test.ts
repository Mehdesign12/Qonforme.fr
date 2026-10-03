/**
 * Formule Artisan : accès côté serveur, Factur-X des nouveaux types de
 * factures, synthèse d'un chantier et numérotation des acomptes et situations.
 *
 * - Accès : une seule fonction (requireArtisanAccess) répond 402
 *   ARTISAN_REQUIRED sans la formule, 503 si l'abonnement n'a pas pu être lu
 *   (jamais un faux « sans formule », CLAUDE.md).
 * - Factur-X : acompte en type 386 (UNTDID 1001), facture qui reprend des
 *   acomptes en cadre S4 avec les acomptes cités en BG-3 (type 386 + date),
 *   devis en référence de contrat (BT-12), récapitulatif de situation (note
 *   AAI) et retenue de garantie (note ABU) sans toucher au montant à payer
 *   (BT-115 = BT-112) ; autoliquidation en catégorie AE / VATEX-EU-AE.
 *   Fiche Flash « Acomptes » du FNFE-MPE (2026) et spécifications externes
 *   DGFiP (cadre de facturation BT-23). Validation complète faite hors CI
 *   avec Mustang 2.26.0 (voir le rapport de la session du 03/10/2026).
 * - Numérotation : un acompte ou une situation est un brouillon sans numéro,
 *   numéroté à l'émission dans la même série continue que les autres factures
 *   (CGI, ann. II, art. 242 nonies A, I-7°).
 */
import { describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { requireArtisanAccess, hasArtisanAccess } from "@/lib/artisan/access"
import { ARTISAN_REQUIRED, hasArtisanPlan, isArtisanRequired } from "@/lib/artisan/plan"
import { PLANS, isArtisanOnSale } from "@/lib/stripe/plans"
import { buildFacturX } from "@/lib/facturx/xml"
import { invoiceToFacturX } from "@/lib/facturx/records"
import {
  computeDeposit, computeSituation, depositGroups, previousProgress, totalsOfLines,
  type BillingContext, type DepositRecord, type SourceLine,
} from "@/lib/artisan/billing"
import { applyRetention } from "@/lib/artisan/retention"
import { applyReverseCharge } from "@/lib/artisan/reverse-charge"
import { fromCents } from "@/lib/artisan/money"
import { chantierSummary, parseChantierInput, type ChantierDoc } from "@/lib/artisan/chantier"
import { buildArtisanInvoice, type QuoteBilling } from "@/lib/artisan/build"
import { quoteBillingState, type InvoiceForBilling } from "@/lib/artisan/quote-billing"
import { insertArtisanDraft } from "@/lib/artisan/server"
import { insertDraftInvoice, issueDraftInvoice } from "@/lib/utils/document-numbering"
import { fakeInvoicesDb, type Row } from "./helpers/fake-invoices-db"
import { remainingDue } from "@/lib/payment-link/rules"
import { demoPaymentPage } from "@/lib/demo/payment-link"

// ── Accès ────────────────────────────────────────────────────────────────────

function subscriptionsDb(result: { data: unknown; error: unknown }): SupabaseClient {
  const q = {
    select: () => q,
    eq: () => q,
    maybeSingle: async () => result,
  }
  return { from: () => q } as unknown as SupabaseClient
}

describe("accès à la formule Artisan", () => {
  it("formule Artisan active ou en nouvelle tentative de paiement : accès", () => {
    expect(hasArtisanPlan({ plan: "pro", status: "active" })).toBe(true)
    expect(hasArtisanPlan({ plan: "pro", status: "past_due" })).toBe(true)
  })
  it("Essentiel, résiliée, sans formule : pas d'accès", () => {
    expect(hasArtisanPlan({ plan: "starter", status: "active" })).toBe(false)
    expect(hasArtisanPlan({ plan: "pro", status: "canceled" })).toBe(false)
    expect(hasArtisanPlan({ plan: "pro", status: "incomplete" })).toBe(false)
    expect(hasArtisanPlan(null)).toBe(false)
  })

  it("requireArtisanAccess laisse passer un abonné Artisan", async () => {
    expect(await requireArtisanAccess(subscriptionsDb({ data: { plan: "pro", status: "active" }, error: null }), "u1")).toBeNull()
  })

  it("répond 402 ARTISAN_REQUIRED à un abonné Essentiel ou sans formule", async () => {
    for (const data of [{ plan: "starter", status: "active" }, null]) {
      const res = await requireArtisanAccess(subscriptionsDb({ data, error: null }), "u1")
      expect(res?.status).toBe(402)
      const json = await res!.json()
      expect(json.code).toBe(ARTISAN_REQUIRED)
      expect(json.onSale).toBe(PLANS.pro.available)
      expect(isArtisanRequired(402, json)).toBe(true)
    }
  })

  it("répond 503 si l'abonnement n'a pas pu être lu (jamais un faux « sans formule »)", async () => {
    const db = subscriptionsDb({ data: null, error: { message: "timeout" } })
    expect(await hasArtisanAccess(db, "u1")).toBeNull()
    const res = await requireArtisanAccess(db, "u1")
    expect(res?.status).toBe(503)
    expect(isArtisanRequired(503, await res!.json())).toBe(false)
  })

  it("la formule n'est en vente qu'avec ses deux prix Stripe", () => {
    expect(isArtisanOnSale("price_m", "price_y")).toBe(true)
    expect(isArtisanOnSale("price_m", "")).toBe(false)
    expect(isArtisanOnSale(undefined, "price_y")).toBe(false)
    expect(isArtisanOnSale("  ", "  ")).toBe(false)
  })
})

// ── Factur-X ────────────────────────────────────────────────────────────────

const all = (xml: string, tag: string): string[] =>
  Array.from(xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "g"))).map((m) => m[1].trim())
const one = (xml: string, tag: string): string | undefined => all(xml, tag)[0]
const docTypeCode = (xml: string) => one(one(xml, "rsm:ExchangedDocument")!, "ram:TypeCode")
const framework = (xml: string) => one(one(xml, "ram:BusinessProcessSpecifiedDocumentContextParameter")!, "ram:ID")
const notes = (xml: string) => all(xml, "ram:IncludedNote").map((n) => ({ subject: one(n, "ram:SubjectCode"), content: one(n, "ram:Content") }))
const summation = (xml: string) => {
  const s = one(xml, "ram:SpecifiedTradeSettlementHeaderMonetarySummation")!
  return { basis: one(s, "ram:TaxBasisTotalAmount"), tax: one(s, "ram:TaxTotalAmount"), grand: one(s, "ram:GrandTotalAmount"), due: one(s, "ram:DuePayableAmount") }
}

const line = (description: string, quantity: number, unit_price_ht: number, vat_rate: number): SourceLine & { total_ttc: number } => {
  const total_ht = Math.round(quantity * unit_price_ht * 100) / 100
  const total_vat = Math.round(total_ht * vat_rate) / 100
  return { description, quantity, unit_price_ht, vat_rate, total_ht, total_vat, total_ttc: Math.round((total_ht + total_vat) * 100) / 100 }
}

const company = {
  name: "Garnier Plâtrerie Isolation SARL", siren: "552100554", siret: "55210055400013", vat_number: "FR40552100554",
  address: "14 rue des Lices", zip_code: "49100", city: "Angers", country: "FR",
  iban: "FR76 3000 6000 0112 3456 7890 189", email: "contact@garnier.example.com",
  legal_notice: "SARL au capital de 10 000 € — RCS Angers 552 100 554.",
}
const proClient = { name: "SCI Les Tilleuls", email: "gestion@tilleuls.example.com", address: "18 allée des Tilleuls", zip_code: "44300", city: "Nantes", siren: "443061841", vat_number: "FR57443061841" }

const quote = [
  line("Doublage isolant collé", 140, 36, 10),
  line("Cloison sur ossature métallique", 72, 48, 10),
  line("Location d'échafaudage", 4, 85, 20),
]
const quoteRef = { id: "q1", number: "D-2026-033", issue_date: "2026-09-24", total_ht: 0, total_ttc: 0 }

function ok<T>(r: T | { ok: false; error: string }): T {
  if ((r as { ok: boolean }).ok === false) throw new Error((r as { error: string }).error)
  return r as T
}

const dep = ok(computeDeposit(quote, { mode: "percent", percent: 30 }, { quoteNumber: quoteRef.number }))
const depositRecord: DepositRecord = { invoice_id: "dep1", number: "F-2026-0150", issue_date: "2026-09-25", groups: depositGroups(dep.lines) }

describe("Factur-X — facture d'acompte", () => {
  const ctx: BillingContext = { v: 1, kind: "deposit", quote: quoteRef, chantier: null, deposit: { mode: "percent", percent: 30, requested_ttc: null }, deductions: [], retention: null }
  const { xml } = buildFacturX(invoiceToFacturX({
    invoice_number: "F-2026-0150", issue_date: "2026-09-25", due_date: "2026-09-25", lines: dep.lines, client: proClient,
    invoice_kind: "deposit", billing_context: ctx,
  }, company))

  it("type 386, cadre S1, devis en référence de contrat (BT-12)", () => {
    expect(docTypeCode(xml)).toBe("386")
    expect(framework(xml)).toBe("S1")
    expect(one(one(xml, "ram:ContractReferencedDocument")!, "ram:IssuerAssignedID")).toBe("D-2026-033")
    expect(xml).not.toContain("<ram:InvoiceReferencedDocument>")
  })
  it("TVA ventilée comme le devis, au centime", () => {
    const s = summation(xml)
    expect(Number(s.grand)).toBeCloseTo(fromCents(dep.ttc), 2)
    expect(s.due).toBe(s.grand)
  })
})

describe("Factur-X — situation avec reprise d'acompte et retenue de garantie", () => {
  const s1 = ok(computeSituation(quote, { global: 40 }, previousProgress(quote.length, []), { records: [depositRecord], deducted: [] }))
  const retention = applyRetention(s1.ttc, "retenue", 5)
  const ctx: BillingContext = {
    v: 1, kind: "situation", quote: quoteRef, chantier: null,
    situation: { number: 1, final: false, contract_ht: fromCents(s1.contract_ht), previous_ht: 0, cumulative_ht: fromCents(s1.cumulative_ht), amount_ht: fromCents(s1.amount_ht), cumulative_percent: s1.cumulative_percent },
    deductions: s1.deductions, retention,
  }
  const totals = totalsOfLines(s1.lines)
  const { xml } = buildFacturX(invoiceToFacturX({
    invoice_number: "F-2026-0158", issue_date: "2026-10-15", due_date: "2026-11-14", lines: s1.lines, client: proClient,
    invoice_kind: "situation", billing_context: ctx,
  }, company))

  it("type 380 en cadre S4, l'acompte repris cité en BG-3 (type 386 et date)", () => {
    expect(docTypeCode(xml)).toBe("380")
    expect(framework(xml)).toBe("S4")
    const refs = all(xml, "ram:InvoiceReferencedDocument")
    expect(refs).toHaveLength(1)
    expect(one(refs[0], "ram:IssuerAssignedID")).toBe("F-2026-0150")
    expect(one(refs[0], "ram:TypeCode")).toBe("386")
    expect(one(refs[0], "qdt:DateTimeString")).toBe("20260925")
  })
  it("reprise de l'acompte en lignes négatives : le total est déjà net de l'acompte", () => {
    expect(s1.lines.some((l) => l.total_ht < 0 && l.deposit_of?.number === "F-2026-0150")).toBe(true)
    expect(Number(summation(xml).grand)).toBeCloseTo(totals.total_ttc, 2)
  })
  it("récapitulatif en note AAI, retenue en note ABU ; montant à payer inchangé", () => {
    const n = notes(xml)
    expect(n.find((x) => x.subject === "AAI")?.content).toContain("Situation de travaux n° 1")
    expect(n.find((x) => x.subject === "ABU")?.content).toContain("Retenue de garantie")
    const s = summation(xml)
    expect(s.due).toBe(s.grand)
    expect(retention?.amount).toBeGreaterThan(0)
  })
})

describe("Factur-X — sous-traitance en autoliquidation", () => {
  const subQuote = applyReverseCharge([line("Plâtrerie lot 3", 1, 18400, 20), line("Faux plafonds", 120, 42, 20)], true)
  const s1 = ok(computeSituation(subQuote, { global: 50 }, previousProgress(subQuote.length, []), { records: [], deducted: [] }))
  const ctx: BillingContext = {
    v: 1, kind: "situation", quote: { ...quoteRef, number: "D-2026-041" }, chantier: null,
    situation: { number: 1, final: false, contract_ht: fromCents(s1.contract_ht), previous_ht: 0, cumulative_ht: fromCents(s1.cumulative_ht), amount_ht: fromCents(s1.amount_ht), cumulative_percent: s1.cumulative_percent },
    deductions: [], retention: applyRetention(s1.ttc, "retenue", 5),
  }
  const { xml } = buildFacturX(invoiceToFacturX({
    invoice_number: "F-2026-0159", issue_date: "2026-10-16", due_date: "2026-11-15", lines: s1.lines, client: proClient,
    invoice_kind: "situation", billing_context: ctx,
  }, company))

  it("lignes sans TVA, traitement conservé", () => {
    expect(s1.lines.every((l) => l.vat_rate === 0 && l.total_vat === 0 && l.vat_treatment === "autoliquidation_btp")).toBe(true)
  })
  it("catégorie AE, motif VATEX-EU-AE, TVA nulle, cadre S1 sans acompte", () => {
    const settlement = one(xml, "ram:ApplicableHeaderTradeSettlement")!
    const tax = one(settlement, "ram:ApplicableTradeTax")!
    expect(one(tax, "ram:CategoryCode")).toBe("AE")
    expect(one(tax, "ram:ExemptionReasonCode")).toBe("VATEX-EU-AE")
    expect(Number(summation(xml).tax)).toBe(0)
    expect(framework(xml)).toBe("S1")
  })
})

// ── Synthèse d'un chantier ───────────────────────────────────────────────────

describe("synthèse d'un chantier", () => {
  const q: ChantierDoc = { type: "quote", id: "q", number: "D-1", status: "accepted", issue_date: "2026-06-01", total_ht: 10_000, total_ttc: 12_000 }
  const deposit: ChantierDoc = { type: "invoice", id: "a", number: "F-1", status: "paid", issue_date: "2026-06-05", total_ht: 2_000, total_ttc: 2_400, kind: "deposit", retention_amount: 0 }
  const situation: ChantierDoc = { type: "invoice", id: "s", number: "F-2", status: "paid", issue_date: "2026-07-01", total_ht: 2_000, total_ttc: 2_400, kind: "situation", retention_amount: 240 }
  const open: ChantierDoc = { type: "invoice", id: "o", number: "F-3", status: "sent", issue_date: "2026-08-01", total_ht: 3_000, total_ttc: 3_600, kind: "situation", retention_amount: 180 }
  const draft: ChantierDoc = { type: "invoice", id: "d", number: null, status: "draft", issue_date: "2026-09-01", total_ht: 1_000, total_ttc: 1_200, kind: "situation" }
  const credit: ChantierDoc = { type: "credit_note", id: "c", number: "A-1", status: "sent", issue_date: "2026-08-10", total_ht: 500, total_ttc: 600, original_invoice_id: "o" }

  const s = chantierSummary([q, deposit, situation, open, draft, credit, { ...credit }], { reception_date: null, retention_released_at: null }, "2026-10-03")

  it("facturé = factures émises moins les avoirs, chaque avoir compté une fois ; brouillons exclus", () => {
    expect(s.signed).toBe(1_200_000)
    expect(s.invoiced).toBe((2_400 + 2_400 + 3_600 - 600) * 100)
    expect(s.toInvoice).toBe(1_200_000 - s.invoiced)
    expect(s.counts).toMatchObject({ invoices: 3, drafts: 1, creditNotes: 1 })
  })
  it("encaissé hors retenue non libérée ; en attente net des avoirs et de la retenue", () => {
    expect(s.collected).toBe((2_400 + 2_400 - 240) * 100)
    expect(s.outstanding).toBe((3_600 - 600 - 180) * 100)
    expect(s.retentionHeld).toBe(42_000)
    expect(s.retention.state).toBe("awaiting_reception")
  })
  it("retenue libérée : rendue à l'encaissé ; réception il y a plus d'un an : libérable", () => {
    const released = chantierSummary([q, deposit, situation], { reception_date: "2025-06-01", retention_released_at: "2026-07-01" }, "2026-10-03")
    expect(released.collected).toBe(480_000)
    expect(released.retention.state).toBe("released")
    const releasable = chantierSummary([q, deposit, situation], { reception_date: "2025-06-01", retention_released_at: null }, "2026-10-03")
    expect(releasable.retention).toEqual({ state: "releasable", held: 24_000, releaseDate: "2026-06-01" })
  })
})

describe("saisie d'un chantier", () => {
  it("nom obligatoire, retenue de 5 % au plus, fin après le début", () => {
    expect(parseChantierInput({ name: " " }).ok).toBe(false)
    expect(parseChantierInput({ name: "Lot 4", retention_rate: 6 }).ok).toBe(false)
    expect(parseChantierInput({ name: "Lot 4", start_date: "2026-10-10", end_date: "2026-10-01" }).ok).toBe(false)
    expect(parseChantierInput({ name: "Lot 4", status: "inconnu" }).ok).toBe(false)
    const r = parseChantierInput({ name: "Lot 4", retention_mode: "retenue", retention_rate: 5, status: "in_progress", subcontracting: true })
    expect(r).toMatchObject({ ok: true, value: { name: "Lot 4", retention_mode: "retenue", retention_rate: 5, status: "in_progress", subcontracting: true } })
  })
  it("modification partielle : seuls les champs fournis", () => {
    expect(parseChantierInput({ reception_date: "2026-09-18" }, true)).toEqual({ ok: true, value: { reception_date: "2026-09-18" } })
  })
})

// ── Numérotation ─────────────────────────────────────────────────────────────

describe("numérotation des acomptes et situations", () => {
  const USER = "user-1"
  const TODAY = "2026-10-03"
  const quoteRow = {
    id: "q1", quote_number: "D-2026-033", status: "accepted", issue_date: "2026-09-24", lines: quote, client_id: "c1",
  }

  function billingOf(invoices: InvoiceForBilling[]): QuoteBilling {
    return { quote: quoteRow, invoices, state: quoteBillingState(quoteRow, invoices), chantier: null }
  }

  it("brouillon sans numéro, numéroté à l'émission dans la série continue des factures", async () => {
    const db = fakeInvoicesDb([
      { id: "f5", user_id: USER, invoice_number: "F-2026-005", status: "paid", issue_date: "2026-09-01" } as Row,
    ])

    // Acompte : brouillon sans numéro
    const preview = buildArtisanInvoice(billingOf([]), { kind: "deposit", deposit: { mode: "percent", percent: 30 } }, TODAY)
    if ("error" in preview) throw new Error(preview.error)
    const created = await insertArtisanDraft(db.client, USER, { client_id: "c1", quote_id: "q1", chantier_id: null }, preview, TODAY, "F")
    expect(created.error).toBeNull()
    const draftRow = db.rows.find((r) => r.invoice_kind === "deposit")!
    expect(draftRow.invoice_number).toBeNull()
    expect(draftRow.status).toBe("draft")
    expect(draftRow.due_date).toBe(TODAY)

    // Une facture ordinaire créée entre-temps
    await insertDraftInvoice(db.client, { userId: USER, companyPrefix: "F", today: TODAY, row: { user_id: USER, status: "draft", issue_date: TODAY, due_date: "2026-11-02" } })
    const standard = db.rows.find((r) => r.id !== draftRow.id && r.invoice_number === null)!

    const emit = (row: Row) => issueDraftInvoice<Row & { status?: string; invoice_number?: string | null }>(db.client, {
      invoiceId: row.id, userId: USER, companyPrefix: "F",
      draft: { status: "draft", invoice_number: null, issue_date: row.issue_date as string, due_date: row.due_date as string },
      status: "sent", today: TODAY,
    })
    const a = await emit(standard)
    const b = await emit(draftRow)
    expect(a.error).toBeNull()
    expect(b.error).toBeNull()
    expect(standard.invoice_number).toBe("F-2026-006")
    expect(draftRow.invoice_number).toBe("F-2026-007")
  })

  it("la situation suivante reprend l'acompte émis et prend le numéro de situation suivant", () => {
    const depositInvoice: InvoiceForBilling = {
      id: "dep1", invoice_number: "F-2026-007", status: "sent", issue_date: TODAY, invoice_kind: "deposit",
      billing_context: { v: 1, kind: "deposit", quote: null, chantier: null, deductions: [], retention: null }, lines: dep.lines,
    }
    const p = buildArtisanInvoice(billingOf([depositInvoice]), { kind: "situation", progress: { global: 50 } }, TODAY)
    if ("error" in p) throw new Error(p.error)
    expect(p.context.situation?.number).toBe(1)
    expect(p.context.deductions.map((d) => d.number)).toEqual(["F-2026-007"])
    expect(p.due_date).toBe("2026-11-02")

    // Un brouillon en cours bloque toute autre facture du devis
    const blocked = buildArtisanInvoice(billingOf([depositInvoice, { id: "s-draft", invoice_number: null, status: "draft", issue_date: TODAY, invoice_kind: "situation", lines: [] }]), { kind: "situation", progress: { global: 60 } }, TODAY)
    expect(blocked).toMatchObject({ status: 409 })
  })
})

// ── Lien de paiement ─────────────────────────────────────────────────────────

describe("lien de paiement d'une situation avec retenue de garantie", () => {
  it("la retenue sort du montant demandé à l'échéance, les avoirs aussi", () => {
    expect(remainingDue(12_636.8, [], 631.84)).toBe(12_004.96)
    expect(remainingDue(1_000, [{ total_ttc: 200 }], 50)).toBe(750)
    expect(remainingDue(100, [{ total_ttc: 100 }], 5)).toBe(0)
    expect(remainingDue(100, [])).toBe(100)
  })
  it("démo : la page de règlement demande le net, retenue affichée à part", () => {
    const page = demoPaymentPage("f-2026-0137")
    expect(page.state).toBe("payable")
    if (page.state !== "payable") return
    expect(page.invoice.totalTtc).toBe(12_636.8)
    expect(page.invoice.retention).toBe(631.84)
    expect(page.invoice.remaining).toBe(12_004.96)
    expect(page.invoice.credited).toBe(0)
  })
})
