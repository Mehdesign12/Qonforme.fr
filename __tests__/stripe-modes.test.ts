/**
 * Deux modes Stripe (production et bac à sable), comptes d'essai, TVA non collectée
 * (DECISIONS-STRATEGIQUES.md § 14) : choix du mode, correspondance des prix,
 * signature du webhook des deux modes, route de paiement, routes admin.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import Stripe from "stripe"

// Les prix et les clés sont lus au chargement des modules : les poser avant tout import.
vi.hoisted(() => {
  Object.assign(process.env, {
    STRIPE_SECRET_KEY: "sk_live_unit",
    STRIPE_SECRET_KEY_TEST: "sk_test_unit",
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_unit",
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST: "pk_test_unit",
    STRIPE_WEBHOOK_SECRET: "whsec_live_unit",
    STRIPE_WEBHOOK_SECRET_TEST: "whsec_test_unit",
    STRIPE_PRICE_ESSENTIEL_MONTHLY: "price_live_ess_m",
    STRIPE_PRICE_ESSENTIEL_YEARLY: "price_live_ess_y",
    STRIPE_PRICE_ESSENTIEL_MONTHLY_TEST: "price_test_ess_m",
    STRIPE_PRICE_ESSENTIEL_YEARLY_TEST: "price_test_ess_y",
    STRIPE_PRICE_ARTISAN_MONTHLY_TEST: "price_test_art_m",
    STRIPE_PRICE_ARTISAN_YEARLY_TEST: "price_test_art_y",
  })
})

const state = vi.hoisted(() => ({
  userMode: "live" as "live" | "test" | null,
  subscription: null as Record<string, unknown> | null,
  sessionArgs: [] as Record<string, unknown>[],
  fakeStripe: null as unknown,
  admin: true,
}))

vi.mock("@/lib/supabase/server", () => {
  const builder = (table: string) => {
    const b: Record<string, unknown> = {}
    for (const m of ["select", "eq", "insert", "update", "upsert", "delete", "order", "limit"]) b[m] = () => b
    const row = () => (table === "subscriptions" ? state.subscription : null)
    b.single = async () => ({ data: row(), error: null })
    b.maybeSingle = async () => ({ data: row(), error: null })
    b.then = (resolve: (v: unknown) => unknown) => resolve({ data: null, error: null })
    return b
  }
  const client = {
    from: builder,
    auth: { getUser: async () => ({ data: { user: { id: "user-1", email: "artisan@example.fr" } } }) },
  }
  return { createClient: async () => client, createAdminClient: () => client }
})

vi.mock("@/lib/stripe/test-users", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/stripe/test-users")>()),
  getUserStripeMode: async () => state.userMode,
}))

vi.mock("@/lib/admin-require", () => ({ isAdminAuthenticated: async () => state.admin }))

import {
  getStripe, modeFromStripeId, modeOfSubscription, publishableKeyFor, stripeEnvStatus, webhookSecretFor,
} from "@/lib/stripe/mode"
import { verifyStripeEvent, WebhookConfigError, WebhookSignatureError } from "@/lib/stripe/webhook-verify"
import { PLANS, TAX_SUFFIX, VAT_COLLECTED, getPlanByPriceId, isPlanAvailable, payableAmount } from "@/lib/stripe/plans"
import { isMissingSchema } from "@/lib/stripe/test-users"
import { addTestAccount } from "@/lib/stripe/test-accounts"

// ─────────────────────────────────────────────────────────────────────────────

describe("mode d'un objet Stripe", () => {
  it("session de paiement : le mode se lit dans l'identifiant", () => {
    expect(modeFromStripeId("cs_test_a1B2")).toBe("test")
    expect(modeFromStripeId("cs_live_a1B2")).toBe("live")
  })
  it("sans indice, ou vide : production", () => {
    expect(modeFromStripeId("cus_123")).toBe("live")
    expect(modeFromStripeId("")).toBe("live")
    expect(modeFromStripeId(null)).toBe("live")
    expect(modeFromStripeId(undefined)).toBe("live")
  })
  it("abonnement enregistré : seul livemode = false est un abonnement d'essai", () => {
    expect(modeOfSubscription({ livemode: false })).toBe("test")
    expect(modeOfSubscription({ livemode: true })).toBe("live")
    expect(modeOfSubscription({})).toBe("live")
    expect(modeOfSubscription({ livemode: null })).toBe("live")
    expect(modeOfSubscription(null)).toBe("live")
  })
})

describe("clients et clés des deux modes", () => {
  it("chaque mode a son client, mis en cache", () => {
    expect(getStripe("live")).toBe(getStripe("live"))
    expect(getStripe("test")).not.toBe(getStripe("live"))
    expect(getStripe()).toBe(getStripe("live"))
  })
  it("clés publique et de signature du mode", () => {
    expect(publishableKeyFor("live")).toBe("pk_live_unit")
    expect(publishableKeyFor("test")).toBe("pk_test_unit")
    expect(webhookSecretFor("live")).toBe("whsec_live_unit")
    expect(webhookSecretFor("test")).toBe("whsec_test_unit")
  })
  it("écran admin : seuls les noms et leur présence, jamais les valeurs", () => {
    const live = stripeEnvStatus("live")
    const test = stripeEnvStatus("test")
    expect(live.map((i) => i.name)).toContain("STRIPE_SECRET_KEY")
    expect(test.map((i) => i.name)).toContain("STRIPE_SECRET_KEY_TEST")
    expect(test.map((i) => i.name)).toContain("STRIPE_PRICE_ARTISAN_YEARLY_TEST")
    expect(JSON.stringify([...live, ...test])).not.toMatch(/sk_|pk_|whsec_|price_/)
    expect(live.find((i) => i.name === "STRIPE_PRICE_ARTISAN_MONTHLY")?.present).toBe(false)
    expect(test.find((i) => i.name === "STRIPE_PRICE_ARTISAN_MONTHLY_TEST")?.present).toBe(true)
  })
})

describe("grille et TVA non collectée", () => {
  it("TVA non collectée : le prix affiché est le prix payé, sans mention HT", () => {
    expect(VAT_COLLECTED).toBe(false)
    expect(TAX_SUFFIX).toBe("")
    expect(payableAmount(24)).toBe(24)
    expect(payableAmount(34)).toBe(34)
  })
  it("un identifiant de prix d'essai ou de production retrouve sa formule", () => {
    expect(getPlanByPriceId("price_live_ess_m")).toEqual({ plan: "starter", period: "monthly" })
    expect(getPlanByPriceId("price_test_ess_y")).toEqual({ plan: "starter", period: "yearly" })
    expect(getPlanByPriceId("price_test_art_m")).toEqual({ plan: "pro", period: "monthly" })
    expect(getPlanByPriceId("price_test_art_y")).toEqual({ plan: "pro", period: "yearly" })
    expect(getPlanByPriceId("price_inconnu")).toBeNull()
    expect(getPlanByPriceId("")).toBeNull()
  })
  it("Artisan : vendable en production seulement avec ses prix, mais vendable à un compte d'essai dès ses prix d'essai", () => {
    expect(isPlanAvailable(PLANS.pro, "live")).toBe(false)
    expect(isPlanAvailable(PLANS.pro, "test")).toBe(true)
    expect(isPlanAvailable(PLANS.starter, "live")).toBe(true)
  })
})

describe("signature du webhook des deux modes", () => {
  const payload = (livemode: boolean) => JSON.stringify({ id: "evt_1", object: "event", type: "invoice.paid", livemode, data: { object: {} } })
  const sign = (body: string, secret: string) => Stripe.webhooks.generateTestHeaderString({ payload: body, secret })

  it("la clé de production donne le mode production", () => {
    const body = payload(true)
    expect(verifyStripeEvent(body, sign(body, "whsec_live_unit")).mode).toBe("live")
  })
  it("la clé du bac à sable donne le mode essai", () => {
    const body = payload(false)
    expect(verifyStripeEvent(body, sign(body, "whsec_test_unit")).mode).toBe("test")
  })
  it("une mauvaise signature est refusée", () => {
    const body = payload(true)
    expect(() => verifyStripeEvent(body, sign(body, "whsec_autre"))).toThrow(WebhookSignatureError)
  })
  it("un message de production signé avec la clé du bac à sable est refusé (mode incohérent)", () => {
    const body = payload(true)
    expect(() => verifyStripeEvent(body, sign(body, "whsec_test_unit"))).toThrow(WebhookSignatureError)
  })
  it("un corps modifié après signature est refusé", () => {
    const body = payload(true)
    const header = sign(body, "whsec_live_unit")
    expect(() => verifyStripeEvent(body.replace("invoice.paid", "invoice.voided"), header)).toThrow(WebhookSignatureError)
  })
  it("aucune clé de signature configurée : erreur de configuration, pas de signature invalide", () => {
    const saved = { a: process.env.STRIPE_WEBHOOK_SECRET, b: process.env.STRIPE_WEBHOOK_SECRET_TEST }
    delete process.env.STRIPE_WEBHOOK_SECRET
    delete process.env.STRIPE_WEBHOOK_SECRET_TEST
    try {
      expect(() => verifyStripeEvent("{}", "t=1,v1=x")).toThrow(WebhookConfigError)
    } finally {
      process.env.STRIPE_WEBHOOK_SECRET = saved.a
      process.env.STRIPE_WEBHOOK_SECRET_TEST = saved.b
    }
  })
})

describe("migration pas encore appliquée", () => {
  it("table ou colonne absente reconnue, autre erreur non", () => {
    expect(isMissingSchema({ code: "42P01", message: 'relation "stripe_test_users" does not exist' })).toBe(true)
    expect(isMissingSchema({ code: "PGRST205", message: "Could not find the table 'public.stripe_test_users' in the schema cache" })).toBe(true)
    expect(isMissingSchema({ code: "PGRST204", message: "Could not find the 'livemode' column of 'subscriptions' in the schema cache" })).toBe(true)
    expect(isMissingSchema({ code: "57014", message: "canceling statement due to statement timeout" })).toBe(false)
    expect(isMissingSchema(null)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Route de paiement
// ─────────────────────────────────────────────────────────────────────────────

import { POST as checkout } from "@/app/api/stripe/checkout/route"

vi.mock("@/lib/stripe/mode", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/stripe/mode")>()
  const fake = () => state.fakeStripe as ((mode: string) => unknown) | null
  // Faux client seulement quand un test en pose un ; sinon le vrai (signature du webhook, clés)
  return { ...actual, getStripe: (mode: "live" | "test" = "live") => (fake() ? fake()!(mode) : actual.getStripe(mode)) }
})

function useFakeStripe() {
  state.sessionArgs = []
  state.fakeStripe = (mode: string) => ({
    customers: {
      list: async () => ({ data: [] }),
      create: async () => ({ id: `cus_${mode}` }),
      update: async () => ({}),
    },
    checkout: {
      sessions: {
        create: async (args: Record<string, unknown>) => {
          state.sessionArgs.push({ ...args, __mode: mode })
          return { client_secret: `secret_${mode}` }
        },
      },
    },
  })
}

function post(body: Record<string, unknown>) {
  return checkout(new NextRequest("http://localhost/api/stripe/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }))
}

describe("POST /api/stripe/checkout", () => {
  beforeEach(() => {
    state.userMode = "live"
    state.subscription = null
    useFakeStripe()
  })
  afterEach(() => { state.fakeStripe = null })

  it("compte de production : prix de production, aucune taxe ajoutée, clé publique de production", async () => {
    const res = await post({ planId: "starter", billingPeriod: "monthly" })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({ clientSecret: "secret_live", publishableKey: "pk_live_unit" })
    const args = state.sessionArgs[0]
    expect(args.__mode).toBe("live")
    expect(args.line_items).toEqual([{ price: "price_live_ess_m", quantity: 1 }])
    expect(args).not.toHaveProperty("automatic_tax")
    expect(args).not.toHaveProperty("tax_id_collection")
    expect((args.subscription_data as Record<string, unknown>)).not.toHaveProperty("default_tax_rates")
  })

  it("compte d'essai : bac à sable, prix d'essai, clé publique d'essai", async () => {
    state.userMode = "test"
    const res = await post({ planId: "starter", billingPeriod: "yearly" })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ clientSecret: "secret_test", publishableKey: "pk_test_unit" })
    const args = state.sessionArgs[0]
    expect(args.__mode).toBe("test")
    expect(args.line_items).toEqual([{ price: "price_test_ess_y", quantity: 1 }])
  })

  it("compte d'essai : Artisan s'ouvre dès ses prix d'essai, pas pour un compte de production", async () => {
    state.userMode = "test"
    expect((await post({ planId: "pro", billingPeriod: "monthly" })).status).toBe(200)
    state.userMode = "live"
    expect((await post({ planId: "pro", billingPeriod: "monthly" })).status).toBe(400)
  })

  it("mode du compte illisible : paiement refusé (503), jamais deviné", async () => {
    state.userMode = null
    const res = await post({ planId: "starter", billingPeriod: "monthly" })
    expect(res.status).toBe(503)
    expect(state.sessionArgs).toHaveLength(0)
  })

  it("abonnement d'essai oublié sur un compte revenu en production : pas de « déjà abonné »", async () => {
    state.subscription = { status: "active", stripe_subscription_id: "sub_test_old", stripe_customer_id: "cus_old", plan: "starter", livemode: false }
    const res = await post({ planId: "starter", billingPeriod: "monthly" })
    expect(res.status).toBe(200)
    expect((await res.json()).clientSecret).toBe("secret_live")
  })

  it("abonnement de production actif : rien à payer", async () => {
    state.subscription = { status: "active", stripe_subscription_id: "sub_live", stripe_customer_id: "cus_live", plan: "starter" }
    const res = await post({ planId: "starter", billingPeriod: "monthly" })
    expect((await res.json()).alreadySubscribed).toBe(true)
    expect(state.sessionArgs).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Routes admin
// ─────────────────────────────────────────────────────────────────────────────

import { GET as listAccounts, POST as addAccount, DELETE as deleteAccount } from "@/app/api/admin/stripe-test-accounts/route"
import { POST as purge } from "@/app/api/admin/stripe-test-accounts/purge/route"

describe("routes admin des comptes d'essai", () => {
  beforeEach(() => { state.admin = true })

  it("refusées (401) sans session admin", async () => {
    state.admin = false
    expect((await listAccounts()).status).toBe(401)
    expect((await addAccount(new NextRequest("http://localhost/api/admin/stripe-test-accounts", { method: "POST", body: "{}" }))).status).toBe(401)
    expect((await deleteAccount(new NextRequest("http://localhost/api/admin/stripe-test-accounts?userId=x"))).status).toBe(401)
    expect((await purge()).status).toBe(401)
  })

  it("ajout : adresse invalide refusée avant toute lecture", async () => {
    const res = await addAccount(new NextRequest("http://localhost/api/admin/stripe-test-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "pas-un-email" }),
    }))
    expect(res.status).toBe(400)
    expect((await addTestAccount("")).ok).toBe(false)
  })

  it("retrait : identifiant de compte invalide refusé", async () => {
    const res = await deleteAccount(new NextRequest("http://localhost/api/admin/stripe-test-accounts?userId=n-importe-quoi"))
    expect(res.status).toBe(400)
  })
})
