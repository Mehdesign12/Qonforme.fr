/**
 * Raccordement à Super PDP (lib/pa) : OAuth (autorisation, échange, rotation),
 * cookie d'aller-retour, calcul de l'état, client API, relève et résumé.
 */
import { describe, expect, it, vi } from "vitest"
import { buildAuthorizeUrl, exchangeCode, OAuthError, refreshTokens } from "@/lib/pa/superpdp/oauth"
import { superPdpConfig, type SuperPdpConfig } from "@/lib/pa/superpdp/config"
import { paKey, pkceChallenge, seal, unseal } from "@/lib/pa/superpdp/crypto"
import { createSuperPdpApi } from "@/lib/pa/superpdp/api"
import { derivePaStatus } from "@/lib/pa/status"
import { openOAuthCookie, sameState, sealOAuthCookie } from "@/lib/pa/oauth-cookie"
import { platformIdOf, platformStatusOf, recipientEventCode, superPdpInvoiceId } from "@/lib/pa/sync"
import { digestDue } from "@/lib/pa/notify"
import { accessTokenFor, type ConnectionRow } from "@/lib/pa/store"

const CFG: SuperPdpConfig = { mode: "live", clientId: "cid", clientSecret: "secret", redirectUri: "https://qonforme.fr/api/pa/superpdp/callback" }
const KEY = paKey("token", "test-secret")

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

describe("configuration", () => {
  it("lit les identifiants du mode, rien si absents", () => {
    const env = { SUPERPDP_CLIENT_ID_TEST: "a", SUPERPDP_CLIENT_SECRET_TEST: "b" } as unknown as NodeJS.ProcessEnv
    expect(superPdpConfig("test", env)?.clientId).toBe("a")
    expect(superPdpConfig("live", env)).toBeNull()
  })
})

describe("autorisation", () => {
  it("pré-remplit l'email, le SIREN et la réception, avec PKCE S256", () => {
    const url = new URL(buildAuthorizeUrl(CFG, { state: "st", verifier: "v".repeat(50), email: "a@b.fr", siren: "123 456 782" }))
    expect(url.origin + url.pathname).toBe("https://api.superpdp.tech/oauth2/authorize")
    const p = url.searchParams
    expect(p.get("response_type")).toBe("code")
    expect(p.get("client_id")).toBe("cid")
    expect(p.get("redirect_uri")).toBe(CFG.redirectUri)
    expect(p.get("state")).toBe("st")
    expect(p.get("code_challenge")).toBe(pkceChallenge("v".repeat(50)))
    expect(p.get("code_challenge_method")).toBe("S256")
    expect(p.get("login_hint")).toBe("a@b.fr")
    expect(p.get("superpdp_company_number")).toBe("123456782")
    expect(p.get("superpdp_company_number_scheme")).toBe("fr_siren")
    expect(p.get("superpdp_directory_entry_identifier")).toBe("123456782")
    expect(p.get("superpdp_send_and_receive")).toBe("receive")
  })

  it("ne pré-remplit pas de SIREN réel en bac à sable", () => {
    const url = new URL(buildAuthorizeUrl({ ...CFG, mode: "test" }, { state: "s", verifier: "v", siren: "123456782" }))
    expect(url.searchParams.get("superpdp_company_number")).toBeNull()
  })
})

describe("jetons", () => {
  it("échange le code avec l'authentification Basic et le vérificateur PKCE", async () => {
    const f = vi.fn(async (_url: unknown, _init?: RequestInit) => jsonResponse({ access_token: "acc", refresh_token: "ref", expires_in: 1800 }))
    const t = await exchangeCode(CFG, "code1", "ver1", f as unknown as typeof fetch, () => 0)
    expect(t).toEqual({ accessToken: "acc", refreshToken: "ref", expiresAt: new Date(1800_000).toISOString() })
    const init = f.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>).Authorization).toBe("Basic " + Buffer.from("cid:secret").toString("base64"))
    const body = new URLSearchParams(String(init.body))
    expect(body.get("grant_type")).toBe("authorization_code")
    expect(body.get("code")).toBe("code1")
    expect(body.get("code_verifier")).toBe("ver1")
    expect(body.get("redirect_uri")).toBe(CFG.redirectUri)
  })

  it("invalid_grant = autorisation expirée ou retirée", async () => {
    const f = async () => jsonResponse({ error: "invalid_grant" }, 400)
    await expect(refreshTokens(CFG, "old", f as unknown as typeof fetch)).rejects.toMatchObject({ kind: "revoked" })
  })

  it("panne de la plateforme : indisponible, pas expiré", async () => {
    const f = async () => jsonResponse({}, 503)
    const err = await refreshTokens(CFG, "old", f as unknown as typeof fetch).catch((e) => e)
    expect(err).toBeInstanceOf(OAuthError)
    expect(err.kind).toBe("unavailable")
  })

  it("chiffre et déchiffre, refuse une valeur altérée", () => {
    const sealed = seal("jeton", KEY)
    expect(unseal(sealed, KEY)).toBe("jeton")
    expect(unseal(sealed.slice(0, -2) + "xx", KEY)).toBeNull()
    expect(unseal(sealed, paKey("token", "autre"))).toBeNull()
  })

  it("rafraîchit un jeton expiré et enregistre le nouveau jeton de rafraîchissement (rotation)", async () => {
    vi.stubEnv("PA_TOKEN_SECRET", "test-secret")
    const updates: Record<string, unknown>[] = []
    const admin = {
      from: () => ({
        update: (patch: Record<string, unknown>) => {
          updates.push(patch)
          return { eq: async () => ({ error: null }) }
        },
      }),
    }
    const row = {
      user_id: "u1", mode: "live", status: "active",
      access_token_enc: seal("vieux", KEY), access_expires_at: new Date(0).toISOString(),
      refresh_token_enc: seal("ref-1", KEY),
    } as unknown as ConnectionRow
    const f = vi.fn(async (_url: unknown, init?: RequestInit) => {
      expect(new URLSearchParams(String(init?.body)).get("refresh_token")).toBe("ref-1")
      return jsonResponse({ access_token: "neuf", refresh_token: "ref-2", expires_in: 1800 })
    })
    const token = await accessTokenFor(admin as never, row, { cfg: CFG, fetch: f as unknown as typeof fetch, now: () => 10_000 })
    expect(token).toBe("neuf")
    expect(unseal(updates[0].refresh_token_enc as string, KEY)).toBe("ref-2")
    expect(unseal(row.refresh_token_enc, KEY)).toBe("ref-2")
    // Le jeton d'accès encore valide est réutilisé sans appel
    await accessTokenFor(admin as never, row, { cfg: CFG, fetch: f as unknown as typeof fetch, now: () => 20_000 })
    expect(f).toHaveBeenCalledTimes(1)
    vi.unstubAllEnvs()
  })
})

describe("cookie d'aller-retour", () => {
  const key = paKey("cookie", "test-secret")
  it("s'ouvre avec la même clé, avant expiration", () => {
    const raw = sealOAuthCookie({ state: "s", verifier: "v", uid: "u", mode: "test", exp: 2000 }, key)
    expect(openOAuthCookie(raw, key, 1000)?.uid).toBe("u")
    expect(openOAuthCookie(raw, key, 3000)).toBeNull()
    expect(openOAuthCookie("v1.a.b.c", key, 1000)).toBeNull()
  })
  it("compare l'état en temps constant", () => {
    expect(sameState("abc", "abc")).toBe(true)
    expect(sameState("abc", "abd")).toBe(false)
    expect(sameState("abc", null)).toBe(false)
  })
})

describe("état du raccordement", () => {
  it("suit la vérification puis l'annuaire", () => {
    expect(derivePaStatus({ company: "needs_review" }).status).toBe("manual_review")
    expect(derivePaStatus({ company: "failed" }).status).toBe("refused")
    expect(derivePaStatus({ company: "verified", identity: "failed" }).status).toBe("refused")
    expect(derivePaStatus({ company: "verified", entries: [] }).status).toBe("verifying")
    expect(derivePaStatus({ company: "verified", entries: [{ identifier: "0225:123456782", status: "pending" }] })).toEqual({ status: "verifying", address: "0225:123456782" })
    expect(derivePaStatus({ company: "verified", entries: [{ identifier: "0225:123456782", status: "error" }] }).status).toBe("transfer")
  })
  it("actif seulement si l'adresse est dans l'annuaire (casse ignorée), sans conclure d'un annuaire illisible", () => {
    const entries = [{ identifier: "0225:123456782", status: "created" as const }]
    expect(derivePaStatus({ company: "verified", entries, activeInFrenchDirectory: ["0225:123456782"] }).status).toBe("active")
    expect(derivePaStatus({ company: "verified", entries, activeInFrenchDirectory: [] }).status).toBe("directory_missing")
    expect(derivePaStatus({ company: "verified", entries, activeInFrenchDirectory: null }).status).toBe("active")
  })
})

describe("client API", () => {
  it("relève les factures reçues après le curseur, avec le jeton", async () => {
    const f = vi.fn(async (_url: unknown, _init?: RequestInit) => jsonResponse({ data: [{ id: 8, company_id: 1, created_at: "x", direction: "in" }], has_after: true, count: 9, has_before: false }))
    const api = createSuperPdpApi("tok", f as unknown as typeof fetch)
    const r = await api.listInboundInvoices(7)
    expect(r).toEqual({ data: [{ id: 8, company_id: 1, created_at: "x", direction: "in" }], hasAfter: true })
    expect(String(f.mock.calls[0][0])).toBe("https://api.superpdp.tech/v1.beta/invoices?direction=in&order=asc&limit=100&starting_after_id=7")
    expect(((f.mock.calls[0][1] as RequestInit).headers as Record<string, string>).Authorization).toBe("Bearer tok")
  })
  it("transmet une décision avec son motif et sa précision", async () => {
    const f = vi.fn(async (_url: unknown, _init?: RequestInit) => jsonResponse({ id: 1, invoice_id: 8, status_code: "fr:210", created_at: "x", status_text: "" }))
    const api = createSuperPdpApi("tok", f as unknown as typeof fetch)
    await api.createEvent({ invoiceId: 8, statusCode: "fr:210", reasonCode: "MONTANT_ERR", note: "Total faux" })
    expect(JSON.parse(String((f.mock.calls[0][1] as RequestInit).body))).toEqual({
      invoice_id: 8, status_code: "fr:210", details: [{ reason: "MONTANT_ERR", notes: [{ contents: [{ content: "Total faux" }] }] }],
    })
  })
  it("lève une erreur portant le code HTTP", async () => {
    const api = createSuperPdpApi("tok", (async () => jsonResponse({ message: "Forbidden" }, 403)) as unknown as typeof fetch)
    await expect(api.session()).rejects.toMatchObject({ status: 403 })
  })
})

describe("relève", () => {
  it("identifiant de plateforme aller-retour", () => {
    expect(superPdpInvoiceId(platformIdOf(42))).toBe(42)
    expect(superPdpInvoiceId("autre:42")).toBeNull()
    expect(superPdpInvoiceId(null)).toBeNull()
  })
  it("ne reprend que les statuts posés côté plateforme ou fournisseur", () => {
    expect(platformStatusOf("fr:212")).toBe("cashed")
    expect(platformStatusOf("fr:213")).toBe("rejected")
    expect(platformStatusOf("fr:209")).toBe("completed")
    expect(platformStatusOf("fr:205")).toBeNull()
    expect(platformStatusOf("api:received")).toBeNull()
  })
  it("transmet les décisions de l'artisan, jamais un statut de plateforme", () => {
    expect(recipientEventCode("205")).toBe("fr:205")
    expect(recipientEventCode("210")).toBe("fr:210")
    expect(recipientEventCode("212")).toBeNull()
    expect(recipientEventCode("213")).toBeNull()
  })
})

describe("résumé quotidien", () => {
  const base = { notify_digest: true, pending_digest_count: 2, last_digest_at: null as string | null }
  it("part à partir de 18 h (Paris), une fois par jour, seulement s'il y a des factures", () => {
    expect(digestDue(base, new Date("2026-10-30T16:30:00Z"))).toBe(false) // 17 h 30 à Paris
    expect(digestDue(base, new Date("2026-10-30T17:05:00Z"))).toBe(true) // 18 h 05
    expect(digestDue({ ...base, last_digest_at: "2026-10-30T17:05:00Z" }, new Date("2026-10-30T20:00:00Z"))).toBe(false)
    expect(digestDue({ ...base, pending_digest_count: 0 }, new Date("2026-10-30T19:00:00Z"))).toBe(false)
    expect(digestDue({ ...base, notify_digest: false }, new Date("2026-10-30T19:00:00Z"))).toBe(false)
  })
})
