// @vitest-environment node
/**
 * Un compte d'essai voit exactement les mêmes écrans qu'en production : Artisan
 * proposé à l'achat dès que le serveur le dit, et l'historique de facturation
 * distingue une facture remboursée (garantie de 30 jours).
 */
import { describe, expect, it, vi } from "vitest"
import React, { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

// Modules compilés en JSX classique : React doit être global avant leur import
;(globalThis as unknown as { React: typeof React }).React = React

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {} }),
  usePathname: () => "/settings/billing",
  useSearchParams: () => new URLSearchParams(),
}))

async function load() {
  const [{ default: PricingSelector }, { default: BillingPageClient }] = await Promise.all([
    import("@/components/billing/PricingSelector"),
    import("@/components/billing/BillingPageClient"),
  ])
  return { PricingSelector, BillingPageClient }
}

describe("choix de formule", () => {
  it("bouton « Choisir Artisan » quand le serveur le dit (compte d'essai), « Bientôt » sinon", async () => {
    const { PricingSelector } = await load()
    const html = (onSale: boolean) => renderToStaticMarkup(createElement(PricingSelector, { isAuthenticated: true, artisanOnSale: onSale }))
    const test = html(true)
    expect(test).toContain("Choisir Artisan")
    expect(test).toContain("/pricing/checkout?plan=pro")
    expect(test).not.toContain("Bientôt")
    const live = html(false)
    expect(live).toContain("Bientôt")
    expect(live).not.toContain("plan=pro")
  })
})

describe("page Abonnement", () => {
  const base = {
    subscription: { plan: "starter", status: "active", billing_period: "monthly", current_period_end: "2026-11-19T00:00:00Z", stripe_customer_id: "cus_1", stripe_subscription_id: "sub_1" },
    guarantee: null,
    cancelAtPeriodEnd: false,
  }

  it("Artisan proposé à un compte d'essai, « pas encore en vente » sinon", async () => {
    const { BillingPageClient } = await load()
    const html = (onSale: boolean) => renderToStaticMarkup(createElement(BillingPageClient, { ...base, artisanOnSale: onSale } as never))
    expect(html(true)).toContain("Passer à Artisan")
    expect(html(true)).not.toContain("pas encore en vente")
    expect(html(false)).toContain("pas encore en vente")
  })

  it("historique : une facture remboursée se lit « Remboursée », pas « Payée »", async () => {
    const { BillingPageClient } = await load()
    const invoices = [
      { id: "in_2", number: "ABC-0002", date: "2026-10-19T10:00:00Z", amount: 10, status: "paid", refunded: 10, pdfUrl: null },
      { id: "in_1", number: "ABC-0001", date: "2026-10-19T09:00:00Z", amount: 24, status: "paid", refunded: 0, pdfUrl: null },
      { id: "in_3", number: "ABC-0003", date: "2026-10-19T08:00:00Z", amount: 24, status: "paid", refunded: 5, pdfUrl: null },
    ]
    const html = renderToStaticMarkup(createElement(BillingPageClient, { subscription: null, guarantee: null, cancelAtPeriodEnd: false, invoices } as never))
    expect(html).toContain("Remboursée")
    expect(html).toContain("Payée")
    expect(html).toContain("Remboursée en partie")
    expect(html).toMatch(/dont[^<]*5,00[^<]*remboursés/)
  })
})
