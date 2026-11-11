import { describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { expireGrantedPlans, grantPlan, grantUntil, hasLiveStripeSubscription, isGranted, parseGrantInput, parseNewUser } from "@/lib/admin/grant"

/** Fausse base : lit `current`, garde la ligne écrite. */
function fakeDb(current: Record<string, unknown> | null, opts: { upsertError?: { code: string; message: string } } = {}) {
  const writes: Record<string, unknown>[] = []
  const db = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: current, error: null }) }) }),
      upsert: async (row: Record<string, unknown>) => {
        writes.push(row)
        return { error: opts.upsertError ?? null }
      },
    }),
  }
  return { db: db as unknown as SupabaseClient, writes }
}

const input = { plan: "pro" as const, period: "monthly" as const, months: 3 as const, note: "Testeur" }

describe("formules offertes par l'admin", () => {
  it("lit la demande sans lui faire confiance", () => {
    expect(parseGrantInput({ plan: "pro", months: 3 })).toEqual({ plan: "pro", period: "monthly", months: 3, note: null })
    expect(parseGrantInput({ plan: "gold" })).toEqual({ error: "Formule invalide." })
    expect(parseGrantInput({ plan: "starter", months: 7 })).toEqual({ error: "Durée invalide." })
    expect(parseGrantInput({ plan: "starter", months: null, period: "yearly" })).toMatchObject({ months: null, period: "yearly" })
  })

  it("durée : même jour, n mois plus tard ; sans limite = vide", () => {
    expect(grantUntil(3, new Date("2026-11-11T10:00:00Z"))).toBe("2027-02-11T10:00:00.000Z")
    expect(grantUntil(null)).toBeNull()
  })

  it("offre la formule à un compte gratuit", async () => {
    const { db, writes } = fakeDb(null)
    const res = await grantPlan(db, "u1", input, new Date("2026-11-11T10:00:00Z"))
    expect(res).toEqual({ ok: true, until: "2027-02-11T10:00:00.000Z" })
    expect(writes[0]).toMatchObject({ user_id: "u1", plan: "pro", status: "active", granted_by_admin: true, stripe_subscription_id: null, granted_note: "Testeur" })
  })

  it("remplace un abonnement résilié, jamais un abonnement payant en cours", async () => {
    const canceled = fakeDb({ user_id: "u1", status: "canceled", stripe_subscription_id: "sub_1", granted_by_admin: false })
    expect((await grantPlan(canceled.db, "u1", input)).ok).toBe(true)
    const live = fakeDb({ user_id: "u1", status: "active", stripe_subscription_id: "sub_1", granted_by_admin: false })
    const res = await grantPlan(live.db, "u1", input)
    expect(res).toMatchObject({ ok: false, status: 409 })
    expect(live.writes).toHaveLength(0)
  })

  it("migration absente : refus clair, rien d'écrit à moitié", async () => {
    const old = fakeDb({ user_id: "u1", status: "canceled", stripe_subscription_id: null })
    expect(await grantPlan(old.db, "u1", input)).toMatchObject({ ok: false, status: 409 })
    expect(old.writes).toHaveLength(0)
    const fresh = fakeDb(null, { upsertError: { code: "PGRST204", message: "Could not find the 'granted_by_admin' column" } })
    expect(await grantPlan(fresh.db, "u1", input)).toMatchObject({ ok: false, status: 409 })
  })

  it("une formule offerte puis payée n'est plus « offerte »", () => {
    expect(isGranted({ granted_by_admin: true, stripe_subscription_id: null })).toBe(true)
    expect(isGranted({ granted_by_admin: true, stripe_subscription_id: "sub_9" })).toBe(false)
    expect(hasLiveStripeSubscription({ status: "past_due", stripe_subscription_id: "sub_9" })).toBe(true)
    expect(hasLiveStripeSubscription({ status: "active", stripe_subscription_id: null })).toBe(false)
  })

  it("échéance : seules les formules offertes sans Stripe sont fermées, sans jamais lever", async () => {
    const filters: [string, unknown][] = []
    const chain = {
      eq: (k: string, v: unknown) => { filters.push([k, v]); return chain },
      is: (k: string, v: unknown) => { filters.push([k, v]); return chain },
      lt: (k: string, v: unknown) => { filters.push([k, v]); return chain },
      select: async () => ({ data: [{ user_id: "u1" }], error: null }),
    }
    const db = { from: () => ({ update: () => chain }) } as unknown as SupabaseClient
    expect(await expireGrantedPlans(db)).toBe(1)
    expect(filters).toContainEqual(["granted_by_admin", true])
    expect(filters).toContainEqual(["stripe_subscription_id", null])
    const broken = { from: () => { throw new Error("réseau") } } as unknown as SupabaseClient
    expect(await expireGrantedPlans(broken)).toBe(0)
  })

  it("création d'un compte : email, mot de passe, formule facultative", () => {
    expect(parseNewUser({ email: " Test@Ex.fr ", password: "12345678", plan: "none" })).toMatchObject({ email: "test@ex.fr", grant: null, testAccount: false })
    expect(parseNewUser({ email: "a@b.fr", password: "court" })).toMatchObject({ error: expect.stringContaining("trop court") })
    expect(parseNewUser({ email: "pas-un-email", password: "12345678" })).toMatchObject({ error: "Adresse email invalide." })
    expect(parseNewUser({ email: "a@b.fr", password: "12345678", plan: "starter", months: 12, testAccount: true })).toMatchObject({ grant: { plan: "starter", months: 12 }, testAccount: true })
  })
})
