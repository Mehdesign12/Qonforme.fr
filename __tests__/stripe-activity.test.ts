/**
 * Activité Stripe de l'admin (encaissements, remboursements, abonnements) et
 * mention « Remboursée » de la page Abonnement.
 */
import { describe, expect, it, vi } from "vitest"
import type Stripe from "stripe"

vi.hoisted(() => {
  Object.assign(process.env, {
    STRIPE_PRICE_ESSENTIEL_MONTHLY: "price_live_ess_m",
    STRIPE_PRICE_ESSENTIEL_YEARLY: "price_live_ess_y",
    STRIPE_PRICE_ARTISAN_MONTHLY_TEST: "price_test_art_m",
    STRIPE_SECRET_KEY: "sk_live_unit",
  })
})

import { invoiceBadge } from "@/lib/stripe/invoice-status"
import { ACTIVITY_WINDOW_DAYS, loadActivity, paymentRowOf, planLabelOf, summarize } from "@/lib/stripe/admin-activity"

const NOW = new Date("2026-10-19T12:00:00Z")
const day = 86_400
const at = (daysAgo: number) => Math.floor(NOW.getTime() / 1000) - daysAgo * day

function invoice(over: Partial<Record<string, unknown>> = {}): Stripe.Invoice {
  return {
    id: "in_1", number: "ABC-0001", status: "paid", created: at(1), amount_paid: 2400, total: 2400,
    customer_email: "a@x.fr", attempt_count: 1, post_payment_credit_notes_amount: 0,
    lines: { data: [{ description: "1 × Qonforme Essentiel", pricing: { price_details: { price: "price_live_ess_m" } } }] },
    ...over,
  } as unknown as Stripe.Invoice
}
const sub = (over: Partial<Record<string, unknown>> = {}) => ({ id: "sub_1", status: "active", cancel_at_period_end: false, cancel_at: null, ...over }) as unknown as Stripe.Subscription

describe("mention de la facture d'abonnement", () => {
  it("payée, remboursée en entier, remboursée en partie", () => {
    expect(invoiceBadge("paid", 24, 0)).toEqual({ label: "Payée", tone: "ok" })
    expect(invoiceBadge("paid", 24, 24)).toEqual({ label: "Remboursée", tone: "info" })
    expect(invoiceBadge("paid", 2400, 1000)).toEqual({ label: "Remboursée en partie", tone: "info" })
  })
  it("autres statuts Stripe", () => {
    expect(invoiceBadge("open", 24).label).toBe("À régler")
    expect(invoiceBadge("uncollectible", 24).tone).toBe("danger")
    expect(invoiceBadge("void", 24).label).toBe("Annulée")
    expect(invoiceBadge("inconnu", 24)).toEqual({ label: "inconnu", tone: "neutral" })
  })
  it("un avoir sur une facture non payée ne la fait pas passer pour remboursée", () => {
    expect(invoiceBadge("open", 24, 24).label).toBe("À régler")
  })
})

describe("lignes de paiement", () => {
  it("formule et période lues d'après le prix, en production comme en essai", () => {
    expect(planLabelOf(invoice())).toBe("Essentiel · mensuel")
    const artisanTest = invoice({ lines: { data: [{ pricing: { price_details: { price: "price_test_art_m" } } }] } })
    expect(planLabelOf(artisanTest)).toBe("Artisan · mensuel")
  })
  it("prix inconnu : la description de Stripe, sans rien inventer", () => {
    const inv = invoice({ lines: { data: [{ description: "Ancien abonnement", pricing: { price_details: { price: "price_ancien" } } }] } })
    expect(planLabelOf(inv)).toBe("Ancien abonnement")
    expect(planLabelOf(invoice({ lines: { data: [] } }))).toBe("Abonnement")
  })
  it("facture remboursée : mention et montant remboursé", () => {
    const row = paymentRowOf(invoice({ post_payment_credit_notes_amount: 2400 }))
    expect(row.badge.label).toBe("Remboursée")
    expect(row.refunded).toBe(2400)
    expect(row.amount).toBe(2400)
  })
  it("facture ouverte dont le prélèvement a échoué : « Paiement refusé »", () => {
    const row = paymentRowOf(invoice({ status: "open", amount_paid: 0, attempt_count: 2 }))
    expect(row.badge).toEqual({ label: "Paiement refusé", tone: "danger" })
    expect(row.amount).toBe(2400)
  })
})

describe("résumé de la fenêtre de 30 jours", () => {
  it("encaissé, remboursé, net, abonnements, résiliations programmées, refus", () => {
    const summary = summarize(
      [
        invoice({ id: "a", amount_paid: 2400 }),
        invoice({ id: "b", amount_paid: 1000, post_payment_credit_notes_amount: 1000 }),
        invoice({ id: "c", status: "open", amount_paid: 0, attempt_count: 1 }),
        invoice({ id: "d", status: "draft" }),
        invoice({ id: "e", amount_paid: 9900, created: at(ACTIVITY_WINDOW_DAYS + 5) }), // hors fenêtre
      ],
      [sub(), sub({ id: "s2", cancel_at_period_end: true }), sub({ id: "s3", status: "canceled" })],
      at(ACTIVITY_WINDOW_DAYS),
    )
    expect(summary).toEqual({
      collected: 3400, refunded: 1000, net: 2400,
      activeSubscriptions: 2, scheduledCancellations: 1, failedPayments: 1,
    })
  })
})

describe("loadActivity", () => {
  const fake = (over: Record<string, unknown> = {}) => ({
    invoices: { list: async () => ({ data: [invoice({ post_payment_credit_notes_amount: 2400 })], has_more: false }) },
    subscriptions: { list: async () => ({ data: [sub()], has_more: false }) },
    creditNotes: { list: async () => ({ data: [
      { id: "cn_1", number: "ABC-CN-1", status: "issued", created: at(0), total: 2400, invoice: "in_1", memo: "Garantie satisfait ou remboursé 30 jours" },
      { id: "cn_2", status: "void", created: at(0), total: 100, invoice: "in_1" },
    ] }) },
    ...over,
  }) as unknown as Stripe

  it("paiements, remboursements (avoirs émis seulement) et résumé", async () => {
    const result = await loadActivity("live", { now: NOW, stripe: fake() })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.payments).toHaveLength(1)
    expect(result.payments[0].badge.label).toBe("Remboursée")
    expect(result.refunds).toEqual([
      expect.objectContaining({ id: "cn_1", amount: 2400, invoiceNumber: "ABC-0001", email: "a@x.fr", reason: expect.stringContaining("Garantie") }),
    ])
    expect(result.summary.refunded).toBe(2400)
    expect(result.truncated).toBe(false)
  })
  it("plus de 100 factures : le dit", async () => {
    const result = await loadActivity("live", { now: NOW, stripe: fake({ invoices: { list: async () => ({ data: [invoice()], has_more: true }) } }) })
    expect(result.ok && result.truncated).toBe(true)
  })
  it("Stripe en panne : message, jamais une liste vide", async () => {
    const boom = fake({ invoices: { list: async () => { throw new Error("réseau") } } })
    const result = await loadActivity("live", { now: NOW, stripe: boom })
    expect(result).toEqual({ ok: false, reason: "error", message: expect.stringContaining("Stripe") })
  })
  it("clé du mode absente : le dit sans appeler Stripe", async () => {
    const saved = process.env.STRIPE_SECRET_KEY_TEST
    delete process.env.STRIPE_SECRET_KEY_TEST
    try {
      const result = await loadActivity("test", { now: NOW })
      expect(result).toEqual({ ok: false, reason: "not_configured", message: expect.stringContaining("bac à sable") })
    } finally {
      if (saved !== undefined) process.env.STRIPE_SECRET_KEY_TEST = saved
    }
  })
})
