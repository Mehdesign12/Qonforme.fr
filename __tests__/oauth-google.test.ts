/**
 * Connexion avec Google : adresse de retour filtrée, détection d'un compte
 * Google tout juste créé, métadonnées de l'inscription et route de retour.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const updated: { id: string; attrs: { user_metadata: Record<string, unknown> } }[] = []
const sent: { to: string; subject: string }[] = []
let exchange: { data: { user: unknown } | null; error: { message: string } | null } = { data: null, error: null }

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession: async () => exchange } }),
  createAdminClient: () => ({
    auth: { admin: { updateUserById: async (id: string, attrs: { user_metadata: Record<string, unknown> }) => { updated.push({ id, attrs }); return { error: null } } } },
  }),
}))
vi.mock("@/lib/onboarding/store", () => ({ enrollInOnboarding: async () => true, claimSequenceStep: async () => true }))
vi.mock("@/lib/email/resend", () => ({ sendEmail: (o: { to: string; subject: string }) => { sent.push(o); return Promise.resolve({ id: "e1" }) } }))

import { isFreshOAuthSignup, oauthRedirectTo, oauthSignupMetadata } from "@/lib/auth/oauth"
import { GET } from "@/app/api/auth/callback/route"

const NOW = Date.parse("2026-10-19T12:00:00Z")
const google = (over: Record<string, unknown> = {}) => ({
  id: "u1",
  email: "a@b.fr",
  created_at: new Date(NOW - 20_000).toISOString(),
  app_metadata: { provider: "google" },
  user_metadata: { given_name: "Awa", family_name: "Diallo", full_name: "Awa Diallo" },
  ...over,
})

describe("oauthRedirectTo", () => {
  it("garde next et la variante connue, rien d'autre", () => {
    expect(oauthRedirectTo("https://qonforme.fr", { next: "/invitation-comptable", ab: "design" }))
      .toBe("https://qonforme.fr/api/auth/callback?next=%2Finvitation-comptable&ab=design")
    expect(oauthRedirectTo("https://qonforme.fr", { ab: "inconnue" })).toBe("https://qonforme.fr/api/auth/callback")
  })
})

describe("isFreshOAuthSignup", () => {
  it("vrai pour un compte Google créé à l'instant", () => expect(isFreshOAuthSignup(google(), NOW)).toBe(true))
  it("faux pour un compte ancien, déjà inscrit par l'assistant ou d'un autre fournisseur", () => {
    expect(isFreshOAuthSignup(google({ created_at: new Date(NOW - 3_600_000).toISOString() }), NOW)).toBe(false)
    expect(isFreshOAuthSignup(google({ user_metadata: { signup_wizard: true } }), NOW)).toBe(false)
    expect(isFreshOAuthSignup(google({ app_metadata: { provider: "email" } }), NOW)).toBe(false)
    expect(isFreshOAuthSignup(google({ created_at: undefined }), NOW)).toBe(false)
  })
})

describe("oauthSignupMetadata", () => {
  it("marque l'inscription et reprend le prénom et le nom de Google", () => {
    expect(oauthSignupMetadata(google(), "design")).toEqual({
      signup_wizard: true, signup_provider: "google", first_name: "Awa", last_name: "Diallo", landing_variant: "design",
    })
  })
  it("sans prénom fourni, ne l'invente pas", () => {
    expect(oauthSignupMetadata(google({ user_metadata: {} }))).toEqual({ signup_wizard: true, signup_provider: "google" })
  })
})

describe("GET /api/auth/callback (code Google)", () => {
  beforeEach(() => { updated.length = 0; sent.length = 0 })
  const call = (qs: string) => GET(new NextRequest(`http://localhost/api/auth/callback${qs}`))

  it("nouveau compte : métadonnées, bienvenue et fenêtre « Bienvenue »", async () => {
    exchange = { data: { user: google({ created_at: new Date().toISOString() }) }, error: null }
    const res = await call("?code=abc")
    expect(res.headers.get("location")).toBe("http://localhost/dashboard?bienvenue=1")
    expect(updated[0].attrs.user_metadata).toMatchObject({ signup_wizard: true, first_name: "Awa" })
    expect(sent).toHaveLength(1)
  })

  it("compte existant : tableau de bord, rien d'écrit ni d'envoyé", async () => {
    exchange = { data: { user: google({ created_at: "2026-01-01T00:00:00Z" }) }, error: null }
    const res = await call("?code=abc")
    expect(res.headers.get("location")).toBe("http://localhost/dashboard")
    expect(updated).toHaveLength(0)
    expect(sent).toHaveLength(0)
  })

  it("next interne suivi, adresse externe ignorée", async () => {
    exchange = { data: { user: google({ created_at: "2026-01-01T00:00:00Z" }) }, error: null }
    expect((await call("?code=abc&next=/invitation-comptable")).headers.get("location")).toBe("http://localhost/invitation-comptable")
    expect((await call("?code=abc&next=//evil.example")).headers.get("location")).toBe("http://localhost/dashboard")
  })

  it("échange en échec ou refus de Google : retour à la connexion", async () => {
    exchange = { data: null, error: { message: "bad code" } }
    expect((await call("?code=abc")).headers.get("location")).toBe("http://localhost/login?error=oauth")
    expect((await call("?error=access_denied")).headers.get("location")).toBe("http://localhost/login?error=oauth")
  })
})
