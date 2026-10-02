/**
 * Données propres aux pages Paramètres de la démo, en complément de
 * lib/demo/data.ts (entreprise, documents) : formule, échéance, moyen de
 * paiement et factures d'abonnement fictifs. Formule Essentiel au tarif réel
 * (lib/stripe/plans.ts), souscrite le 24 septembre 2026 : la garantie de
 * 30 jours court encore au « aujourd'hui » de la démo (1er octobre 2026).
 */
import { PLANS, withVat } from "@/lib/stripe/plans"
import type { Subscription } from "@/lib/stripe/subscription"
import { DEMO_COMPANY } from "@/lib/demo/data"
import { DEMO_IDENTITY } from "@/components/layout/shell"
import type {
  BillingIdentity,
  BillingInvoice,
  GuaranteeInfo,
  PaymentMethodInfo,
} from "@/components/billing/BillingPageClient"

/** Première souscription et prochaine échéance fictives (mensuel). */
const DEMO_SUBSCRIBED_AT = "2026-09-24T00:00:00.000Z"
export const DEMO_RENEWS_AT = "2026-10-24T00:00:00.000Z"

export const DEMO_PLAN = {
  name: PLANS.starter.name,
  period: "monthly" as const,
  amountTtc: withVat(PLANS.starter.monthlyPrice),
  renewsAt: DEMO_RENEWS_AT,
  pastDue: false,
}

export const DEMO_SUBSCRIPTION: Subscription = {
  id: "demo",
  user_id: "demo",
  stripe_customer_id: "demo",
  stripe_subscription_id: "demo",
  stripe_price_id: null,
  plan: "starter",
  billing_period: "monthly",
  status: "active",
  current_period_end: DEMO_RENEWS_AT,
  canceled_at: null,
  created_at: DEMO_SUBSCRIBED_AT,
  updated_at: DEMO_SUBSCRIBED_AT,
}

export const DEMO_GUARANTEE: GuaranteeInfo = {
  eligible: true,
  endsAt: DEMO_RENEWS_AT,
  amountPaid: Math.round(withVat(PLANS.starter.monthlyPrice) * 100),
}

export const DEMO_PAYMENT_METHOD: PaymentMethodInfo = {
  kind: "card", brand: "visa", last4: "4242", expMonth: 8, expYear: 2028,
}

export const DEMO_BILLING_INVOICES: BillingInvoice[] = [
  {
    id: "demo-1",
    number: "QF8K2D1A-0001",
    date: DEMO_SUBSCRIBED_AT,
    amount: withVat(PLANS.starter.monthlyPrice),
    status: "paid",
    pdfUrl: null,
  },
]

export const DEMO_BILLING_IDENTITY: BillingIdentity = {
  name: DEMO_COMPANY.name,
  address: `${DEMO_COMPANY.address}, ${DEMO_COMPANY.zip_code} ${DEMO_COMPANY.city}`,
  siren: DEMO_COMPANY.siren,
  email: DEMO_IDENTITY.email,
}
