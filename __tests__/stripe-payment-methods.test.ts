// @vitest-environment node
/**
 * Moyens de paiement de l'abonnement (20/10/2026) : la carte bancaire seulement. Activer le
 * prélèvement SEPA sur le compte Stripe de la LLC demande des vérifications d'identité que
 * le fondateur n'a pas voulu faire ; un Checkout qui réclame `sepa_debit` sans qu'il soit
 * activé échouerait pour tous les clients. Les textes passent par `PAYMENT_METHODS_TEXT`.
 */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import {
  PAYMENT_METHODS_TEXT,
  SEPA_DEBIT_ENABLED,
  SUBSCRIPTION_PAYMENT_METHODS,
} from "@/lib/stripe/plans"

const read = (path: string) => readFileSync(path, "utf8")

describe("moyens de paiement de l'abonnement", () => {
  it("la carte seule tant que SEPA n'est pas activé", () => {
    expect(SEPA_DEBIT_ENABLED).toBe(false)
    expect(SUBSCRIPTION_PAYMENT_METHODS).toEqual(["card"])
    expect(PAYMENT_METHODS_TEXT).toBe("carte bancaire")
  })

  it("le paiement n'écrit plus la liste des moyens en dur : il lit le réglage", () => {
    const route = read("app/api/stripe/checkout/route.ts")
    expect(route).toContain("payment_method_types: SUBSCRIPTION_PAYMENT_METHODS")
    expect(route).not.toMatch(/payment_method_types:\s*\[/)
  })

  it("aucun texte d'abonnement n'annonce le prélèvement SEPA en dur", () => {
    const files = [
      "app/pricing/page.tsx",
      "app/pricing/checkout/CheckoutPageClient.tsx",
      "components/billing/PricingSelector.tsx",
      "app/cgu/page.tsx",
    ]
    for (const file of files) {
      expect(read(file), file).not.toMatch(/prélèvement SEPA/)
      expect(read(file), file).toContain("PAYMENT_METHODS_TEXT")
    }
  })
})
