/**
 * Test des connexions (Paramètres › Connexions) avec des réponses simulées :
 * succès, refus (401), délai dépassé, réponse inattendue ; aucun message ne
 * contient une clé ; résultats gardés sans écraser les autres ; routes
 * réservées à l'admin, clé inconnue refusée.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { fakeSeoDb, type FakeSeoDb } from "./seo-reports-fake-db"

let db: FakeSeoDb
let admin = true
const pageSpeed = vi.fn()
const pingSc = vi.fn()

vi.mock("@/lib/supabase/server", () => ({ createAdminClient: () => db.client, createClient: () => db.client }))
vi.mock("@/lib/admin-require", () => ({ isAdminAuthenticated: () => Promise.resolve(admin) }))
vi.mock("@/lib/seo/google", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/seo/google")>()
  return { ...actual, runPageSpeed: (...args: unknown[]) => pageSpeed(...args), pingSearchConsole: () => pingSc() }
})

import { redact, readConnectionTests, storeConnectionTest, testConnection } from "@/lib/seo/connections-test"
import { GoogleApiError } from "@/lib/seo/google"
import { GET as connectionsGet } from "@/app/api/admin/seo/connections/route"
import { POST as testPost } from "@/app/api/admin/seo/connections/test/route"
import type { SeoDb } from "@/lib/seo/db"
import { displayState, pillOf, summaryOf } from "@/components/admin/seo/settings/connection-display"

const KEYS = {
  GEMINI_API_KEY: "AIzaSyGEMINI-secret-0123456789",
  OPENAI_API_KEY: "sk-proj-OPENAI-secret-0123456789",
  PERPLEXITY_API_KEY: "pplx-PERPLEXITY-secret-0123456789",
  ANTHROPIC_API_KEY: "sk-ant-api03-ANTHROPIC-secret-0123456789",
  DATAFORSEO_LOGIN: "compte@exemple.fr",
  DATAFORSEO_PASSWORD: "motdepasse-DATAFORSEO-0123",
  RESEND_API_KEY: "re_RESEND_secret_0123456789",
  PAGESPEED_API_KEY: "AIzaSyPAGESPEED-secret-0123456789",
}
const ENV_NAMES = Object.keys(KEYS).concat("GOOGLE_SERVICE_ACCOUNT_JSON")
const NOW = () => new Date("2026-10-09T12:00:00Z")

type FetchCall = { url: string; init: RequestInit }
let calls: FetchCall[] = []

function respond(status: number, body: unknown) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
  })
}

function expectNoSecret(text: string) {
  Object.values(KEYS).forEach((v) => {
    if (v.length >= 6 && !v.includes("@")) expect(text).not.toContain(v)
  })
  expect(text).not.toMatch(/Bearer\s+[A-Za-z0-9]/)
}

beforeEach(() => {
  admin = true
  calls = []
  pageSpeed.mockReset()
  pingSc.mockReset()
  ENV_NAMES.forEach((n) => delete process.env[n])
  db = fakeSeoDb({ seo_settings: [] })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("testConnection", () => {
  it("variable absente : aucun appel, état de présence et nom de la variable", async () => {
    vi.stubGlobal("fetch", respond(200, {}))
    const openai = await testConnection("openai", NOW)
    expect(openai).toEqual({
      state: "missing",
      message: "Clé manquante : ajoutez OPENAI_API_KEY dans les variables d'environnement de l'hébergeur.",
      checkedAt: "2026-10-09T12:00:00.000Z",
    })
    expect((await testConnection("dataforseo", NOW)).state).toBe("not_configured")
    expect(calls).toHaveLength(0)
  })

  it("Gemini : clé acceptée, envoyée dans l'en-tête, jamais dans le message", async () => {
    process.env.GEMINI_API_KEY = KEYS.GEMINI_API_KEY
    vi.stubGlobal("fetch", respond(200, { models: [{ name: "models/gemini-2.5-flash" }] }))
    const r = await testConnection("gemini", NOW)
    expect(r.state).toBe("connected")
    expect(calls[0].url).toContain("generativelanguage.googleapis.com/v1beta/models")
    expect(calls[0].url).not.toContain(KEYS.GEMINI_API_KEY)
    expect((calls[0].init.headers as Record<string, string>)["x-goog-api-key"]).toBe(KEYS.GEMINI_API_KEY)
    expect(calls[0].init.signal).toBeDefined()
    expectNoSecret(r.message)
  })

  it("OpenAI : 401 → erreur en français, sans la clé même si le service la renvoie", async () => {
    process.env.OPENAI_API_KEY = KEYS.OPENAI_API_KEY
    vi.stubGlobal("fetch", respond(401, { error: { message: `Incorrect API key provided: ${KEYS.OPENAI_API_KEY}` } }))
    const r = await testConnection("openai", NOW)
    expect(r.state).toBe("error")
    expect(r.message).toBe("OpenAI refuse la clé (erreur 401). Vérifiez OPENAI_API_KEY.")
    expectNoSecret(r.message)
  })

  it("DataForSEO : délai dépassé → message clair", async () => {
    process.env.DATAFORSEO_LOGIN = KEYS.DATAFORSEO_LOGIN
    process.env.DATAFORSEO_PASSWORD = KEYS.DATAFORSEO_PASSWORD
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new DOMException("The operation was aborted due to timeout", "TimeoutError")
      }),
    )
    const r = await testConnection("dataforseo", NOW)
    expect(r).toMatchObject({ state: "error", message: "DataForSEO n'a pas répondu en 15 s. Réessayez plus tard." })
  })

  it("DataForSEO : identifiants en Basic, solde affiché", async () => {
    process.env.DATAFORSEO_LOGIN = KEYS.DATAFORSEO_LOGIN
    process.env.DATAFORSEO_PASSWORD = KEYS.DATAFORSEO_PASSWORD
    vi.stubGlobal("fetch", respond(200, { status_code: 20000, tasks: [{ status_code: 20000, result: [{ money: { balance: 12.5 } }] }] }))
    const r = await testConnection("dataforseo", NOW)
    expect(r.state).toBe("connected")
    expect(r.message).toMatch(/solde de 12,50 \$/)
    const auth = (calls[0].init.headers as Record<string, string>).Authorization
    expect(auth).toBe(`Basic ${Buffer.from(`${KEYS.DATAFORSEO_LOGIN}:${KEYS.DATAFORSEO_PASSWORD}`).toString("base64")}`)
    expectNoSecret(r.message)
  })

  it("DataForSEO : code d'authentification refusé dans le corps", async () => {
    process.env.DATAFORSEO_LOGIN = KEYS.DATAFORSEO_LOGIN
    process.env.DATAFORSEO_PASSWORD = KEYS.DATAFORSEO_PASSWORD
    vi.stubGlobal("fetch", respond(200, { status_code: 40100, tasks: [] }))
    expect((await testConnection("dataforseo", NOW)).state).toBe("error")
  })

  it("Perplexity : refus = erreur ; succès = connectée ; réponse inattendue = « non vérifiée », jamais connectée", async () => {
    process.env.PERPLEXITY_API_KEY = KEYS.PERPLEXITY_API_KEY
    vi.stubGlobal("fetch", respond(401, {}))
    expect((await testConnection("perplexity", NOW)).state).toBe("error")
    vi.stubGlobal("fetch", respond(200, { requests: [] }))
    expect((await testConnection("perplexity", NOW)).state).toBe("connected")
    vi.stubGlobal("fetch", respond(404, {}))
    const r = await testConnection("perplexity", NOW)
    expect(r.state).toBe("unverified")
    expect(r.message).toMatch(/^Clé présente, non vérifiée/)
    // Gardé tel quel et relu sans devenir « connectée »
    const seo = db.client as unknown as SeoDb
    await storeConnectionTest(seo, "perplexity", r)
    expect((await readConnectionTests(seo)).perplexity?.state).toBe("unverified")
    expect(displayState({ state: "connected" }, r)).toBe("present")
  })

  it("Anthropic (SDK officiel) : 200 → connectée ; 401 → erreur sans la clé", async () => {
    process.env.ANTHROPIC_API_KEY = KEYS.ANTHROPIC_API_KEY
    vi.stubGlobal("fetch", respond(200, { data: [{ id: "claude-opus-5-5", type: "model" }], has_more: false, first_id: null, last_id: null }))
    expect((await testConnection("anthropic", NOW)).state).toBe("connected")
    expect(calls[0].url).toContain("/v1/models")
    vi.stubGlobal("fetch", respond(401, { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }))
    const r = await testConnection("anthropic", NOW)
    expect(r).toMatchObject({ state: "error", message: "Anthropic refuse la clé (erreur 401). Vérifiez ANTHROPIC_API_KEY." })
  })

  it("Resend : clé limitée à l'envoi acceptée ; domaines listés avec une clé complète", async () => {
    process.env.RESEND_API_KEY = KEYS.RESEND_API_KEY
    vi.stubGlobal("fetch", respond(401, { name: "restricted_api_key", message: "This API key is restricted to only send emails" }))
    expect(await testConnection("resend", NOW)).toMatchObject({ state: "connected" })
    vi.stubGlobal("fetch", respond(200, { data: [{ name: "qonforme.fr", status: "verified" }] }))
    expect((await testConnection("resend", NOW)).message).toContain("qonforme.fr (vérifié)")
    vi.stubGlobal("fetch", respond(400, { name: "validation_error", message: "API key is invalid" }))
    expect((await testConnection("resend", NOW)).state).toBe("error")
  })

  it("PageSpeed : vraie mesure de l'accueil en mobile seulement si la clé est là", async () => {
    expect(await testConnection("pagespeed", NOW)).toMatchObject({ state: "missing" })
    expect(pageSpeed).not.toHaveBeenCalled()
    process.env.PAGESPEED_API_KEY = KEYS.PAGESPEED_API_KEY
    pageSpeed.mockResolvedValue({ lighthouseResult: { categories: { performance: { score: 0.87 } } } })
    const r = await testConnection("pagespeed", NOW)
    expect(pageSpeed).toHaveBeenCalledWith("https://qonforme.fr/", "mobile")
    expect(r).toMatchObject({ state: "connected", message: "Mesure réussie : accueil sur mobile, performance 87 / 100." })
    pageSpeed.mockRejectedValue(new GoogleApiError(400, "PageSpeed : API key not valid. Please pass a valid API key."))
    expect((await testConnection("pagespeed", NOW)).message).toMatch(/refuse la clé \(erreur 400\)/)
  })

  it("PageSpeed : une erreur de Google qui recopie l'adresse avec la clé n'expose jamais la clé", async () => {
    process.env.PAGESPEED_API_KEY = KEYS.PAGESPEED_API_KEY
    pageSpeed.mockRejectedValue(
      new GoogleApiError(500, `PageSpeed : erreur interne pour https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=x&key=${KEYS.PAGESPEED_API_KEY}`),
    )
    const r = await testConnection("pagespeed", NOW)
    expect(r.state).toBe("error")
    expect(r.message).toContain("erreur interne")
    expect(r.message).toContain("•••")
    expectNoSecret(r.message)
  })

  it("Search Console : accès vérifié ou message de Google, sans clé privée", async () => {
    const privateKey = "-----BEGIN PRIVATE KEY-----\nABCDEF123456\n-----END PRIVATE KEY-----\n"
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({ client_email: "seo@projet.iam.gserviceaccount.com", private_key: privateKey })
    pingSc.mockResolvedValue(undefined)
    expect(await testConnection("search_console", NOW)).toMatchObject({ state: "connected", message: "Accès vérifié à la propriété sc-domain:qonforme.fr." })
    // Le message simulé porte la clé privée (brute, puis échappée comme dans un JSON) : elle ne doit jamais ressortir
    pingSc.mockRejectedValue(new GoogleApiError(403, `Accès refusé à sc-domain:qonforme.fr (clé ${privateKey}) ; ${privateKey.replace(/\n/g, "\\n")}`))
    const r = await testConnection("search_console", NOW)
    expect(r.state).toBe("error")
    expect(r.message).toMatch(/Accès refusé/)
    expect(r.message).toContain("•••")
    expect(r.message).not.toContain("ABCDEF123456")
  })

  it("Search Console : JSON illisible → erreur sans appel", async () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = "pas du json"
    const r = await testConnection("search_console", NOW)
    expect(r.state).toBe("error")
    expect(pingSc).not.toHaveBeenCalled()
  })
})

describe("état affiché", () => {
  const test = (state: "connected" | "error" | "unverified") => ({ state, message: "m", checkedAt: "2026-10-09T12:00:00.000Z" })

  it("clé présente jamais testée : « Clé présente », pas « Connectée »", () => {
    expect(displayState({ state: "connected" }, undefined)).toBe("present")
    expect(pillOf("present").label).toBe("Clé présente")
    expect(displayState({ state: "connected" }, test("unverified"))).toBe("present")
    expect(displayState({ state: "connected" }, test("connected"))).toBe("connected")
    expect(pillOf("connected").label).toBe("Connectée")
    expect(displayState({ state: "connected" }, test("error"))).toBe("error")
    // La présence passe d'abord : une clé retirée n'est plus « Connectée », même testée avant
    expect(displayState({ state: "missing" }, test("connected"))).toBe("missing")
    expect(summaryOf({ connected: 1, present: 2, error: 0, missing: 3, not_configured: 1 })).toBe(
      "1 connectée · 2 clés présentes · 3 clés manquantes · 1 non configurée",
    )
  })
})

describe("redact", () => {
  it("retire les clés connues, les en-têtes d'autorisation et les paramètres de clé", () => {
    process.env.OPENAI_API_KEY = KEYS.OPENAI_API_KEY
    const msg = redact(`clé ${KEYS.OPENAI_API_KEY} ; Authorization: Bearer abcdefghijkl ; https://x.fr/?key=AIzaXYZ123&b=1`)
    expect(msg).not.toContain(KEYS.OPENAI_API_KEY)
    expect(msg).not.toContain("abcdefghijkl")
    expect(msg).not.toContain("AIzaXYZ123")
    expect(redact("x".repeat(400)).length).toBeLessThanOrEqual(300)
  })
})

describe("résultats enregistrés", () => {
  const result = (state: "connected" | "error", message = "ok") => ({ state, message, checkedAt: "2026-10-09T12:00:00.000Z" })

  it("une ligne par connexion : un test n'efface pas ceux des autres", async () => {
    const seo = db.client as unknown as SeoDb
    await storeConnectionTest(seo, "gemini", result("connected"))
    await storeConnectionTest(seo, "openai", result("error"))
    await storeConnectionTest(seo, "gemini", result("error", "second test"))
    const tests = await readConnectionTests(seo)
    expect(Object.keys(tests).sort()).toEqual(["gemini", "openai"])
    expect(tests.gemini).toMatchObject({ state: "error", message: "second test" })
    expect(db.tables.seo_settings.map((r) => r.key).sort()).toEqual(["connections_test:gemini", "connections_test:openai"])
  })

  it("« Tout tester » : huit écritures simultanées, aucun résultat perdu", async () => {
    const seo = db.client as unknown as SeoDb
    const keys = ["search_console", "pagespeed", "gemini", "openai", "perplexity", "anthropic", "dataforseo", "resend"] as const
    await Promise.all(keys.map((k, i) => storeConnectionTest(seo, k, result(i % 2 ? "error" : "connected", k))))
    const tests = await readConnectionTests(seo)
    expect(Object.keys(tests).sort()).toEqual(keys.slice().sort())
    keys.forEach((k) => expect(tests[k]?.message).toBe(k))
  })

  it("ignore les entrées mal formées, inconnues et les autres réglages", async () => {
    db.tables.seo_settings.push(
      { key: "connections_test:gemini", updated_at: "x", value: { state: "connected" } },
      { key: "connections_test:inconnu", updated_at: "x", value: result("connected") },
      { key: "connections_test:openai", updated_at: "x", value: result("error") },
      { key: "reports", updated_at: "x", value: { weeklyDigest: true } },
    )
    expect(Object.keys(await readConnectionTests(db.client as unknown as SeoDb))).toEqual(["openai"])
  })
})

describe("routes", () => {
  const post = (body: unknown) =>
    testPost(
      new NextRequest("https://qonforme.fr/api/admin/seo/connections/test", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      }),
    )

  it("401 hors de l'admin", async () => {
    admin = false
    expect((await post({ key: "gemini" })).status).toBe(401)
    expect((await connectionsGet()).status).toBe(401)
  })

  it("400 pour une connexion inconnue", async () => {
    expect((await post({ key: "pushrank" })).status).toBe(400)
    expect((await post({})).status).toBe(400)
  })

  it("teste, enregistre et ne renvoie jamais une valeur de variable", async () => {
    process.env.GEMINI_API_KEY = KEYS.GEMINI_API_KEY
    process.env.RESEND_API_KEY = KEYS.RESEND_API_KEY
    vi.stubGlobal("fetch", respond(200, {}))
    const res = await post({ key: "gemini" })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toMatchObject({ stored: true, result: { state: "connected" } })

    const list = await connectionsGet()
    const text = await list.text()
    expectNoSecret(text)
    const body = JSON.parse(text)
    expect(body.testsAvailable).toBe(true)
    expect(body.tests.gemini.state).toBe("connected")
    expect(body.connections.find((c: { key: string }) => c.key === "gemini").state).toBe("connected")
    expect(body.connections.find((c: { key: string }) => c.key === "openai").state).toBe("missing")
  })

  it("rend le résultat même si la base ne peut pas le garder", async () => {
    db.missing.add("seo_settings")
    const res = await post({ key: "openai" })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ stored: false, result: { state: "missing" } })
    const list = await connectionsGet()
    expect(await list.json()).toMatchObject({ testsAvailable: false, testsFailure: "migration_pending" })
  })

  it("historique illisible : lecture en échec distinguée d'une base pas à jour", async () => {
    db.failing.add("seo_settings")
    const list = await connectionsGet()
    expect(list.status).toBe(200)
    const body = await list.json()
    expect(body).toMatchObject({ testsAvailable: false, testsFailure: "read_failed", tests: {} })
    expect(body.connections).toHaveLength(8)
  })
})
