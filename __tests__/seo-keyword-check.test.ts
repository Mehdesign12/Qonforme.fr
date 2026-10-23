/**
 * POST /api/admin/blog/keyword-check : mesure d'un mot-clé principal saisi à la
 * main (existence dans Google, volume et difficulté DataForSEO, raison quand
 * une donnée manque).
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { fakeArticlesDb, type FakeArticlesDb } from "./seo-articles-fake-db"
import { SETTINGS_DEFAULTS } from "@/lib/seo/settings-schema"
import { brandOfDomain } from "@/lib/seo/competitors"

const state = vi.hoisted(() => ({
  admin: true,
  client: null as unknown,
  credentials: true,
  metrics: null as null | ((keywords: string[]) => Promise<Map<string, { volume: number | null; cpc: number | null; difficulty: number | null; intent: string | null }>>),
  metricsCalls: [] as string[][],
  google: { reached: true, verified: true, also: ["facture plombier modele"] },
}))

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => state.client, createAdminClient: () => state.client }))
vi.mock("@/lib/admin-require", () => ({ isAdminAuthenticated: async () => state.admin }))
vi.mock("@/lib/seo/ideas/autocomplete", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/seo/ideas/autocomplete")>()),
  verifyKeywords: async (keywords: string[]) => ({ results: new Map(keywords.map((k) => [k, { ...state.google }])), state: state.google.reached ? "ok" : "unavailable" }),
}))
vi.mock("@/lib/seo/keywords/dataforseo", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/seo/keywords/dataforseo")>()
  return {
    ...actual,
    dataForSeoCredentials: () => (state.credentials ? { login: "x", password: "y" } : null),
    fetchKeywordMetrics: async (keywords: string[]) => {
      state.metricsCalls.push(keywords)
      if (!state.metrics) throw new Error("aucune mesure simulée")
      return state.metrics(keywords)
    },
  }
})

import { POST as check } from "@/app/api/admin/blog/keyword-check/route"
import { DataForSeoError } from "@/lib/seo/keywords/dataforseo"
import type { KeywordCheckResponse } from "@/lib/seo/articles/editor-types"

let db: FakeArticlesDb
const call = (body: unknown) => check(new NextRequest("http://localhost/api/admin/blog/keyword-check", { method: "POST", body: JSON.stringify(body) }))
const competitor = SETTINGS_DEFAULTS.targeting.competitors[0]
const measures = (volume: number | null, difficulty: number | null) => async (keywords: string[]) =>
  new Map(keywords.map((k) => [k, { volume, cpc: 1.4, difficulty, intent: "transactional" }]))

beforeEach(() => {
  state.admin = true
  state.credentials = true
  state.metrics = measures(320, 14)
  state.metricsCalls = []
  state.google = { reached: true, verified: true, also: ["facture plombier modele"] }
  db = fakeArticlesDb({ seo_settings: [], seo_keywords: [] })
  state.client = db.client
})

describe("POST /api/admin/blog/keyword-check", () => {
  it("mot-clé libre : existe dans Google, volume et difficulté mesurés par DataForSEO", async () => {
    const res = await call({ keyword: "Facture Plombier" })
    expect(res.status).toBe(200)
    const json = (await res.json()) as KeywordCheckResponse
    expect(json.keyword).toBe("facture plombier")
    expect(json.tracked).toBeNull()
    expect(json.google).toEqual({ state: "ok", verified: true, also: ["facture plombier modele"] })
    expect(json.metrics).toMatchObject({ state: "ok", volume: 320, difficulty: 14, cpc: 1.4, intent: "transactional", message: null })
    expect(state.metricsCalls).toEqual([["facture plombier"]])
  })

  it("mot-clé déjà suivi avec ses mesures : reprises, aucun appel payant", async () => {
    db.tables.seo_keywords.push({ id: "k1", keyword: "facture plombier", status: "targeted", volume: 90, difficulty: 22, cpc: 2, intent: "informational" })
    const json = (await (await call({ keyword: "facture plombier" })).json()) as KeywordCheckResponse
    expect(json.tracked).toEqual({ status: "targeted" })
    expect(json.metrics).toMatchObject({ state: "tracked", volume: 90, difficulty: 22, cpc: 2 })
    expect(state.metricsCalls).toEqual([])
  })

  it("suivi mais sans volume : DataForSEO est interrogé", async () => {
    db.tables.seo_keywords.push({ id: "k1", keyword: "facture plombier", status: "candidate", volume: null, difficulty: null, cpc: null, intent: null })
    const json = (await (await call({ keyword: "facture plombier" })).json()) as KeywordCheckResponse
    expect(json.tracked).toEqual({ status: "candidate" })
    expect(json.metrics.state).toBe("ok")
    expect(state.metricsCalls).toHaveLength(1)
  })

  it("DataForSEO non configuré : la raison est donnée, Google est quand même consulté", async () => {
    state.credentials = false
    const json = (await (await call({ keyword: "facture plombier" })).json()) as KeywordCheckResponse
    expect(json.metrics.state).toBe("not_configured")
    expect(json.metrics.message).toContain("DATAFORSEO_LOGIN")
    expect(json.google.verified).toBe(true)
    expect(state.metricsCalls).toEqual([])
  })

  it("DataForSEO en panne : état « unavailable » avec son message ; aucune donnée pour la phrase : message honnête", async () => {
    state.metrics = async () => {
      throw new DataForSeoError("DataForSEO n'a pas répondu à temps.")
    }
    const down = (await (await call({ keyword: "facture plombier" })).json()) as KeywordCheckResponse
    expect(down.metrics).toMatchObject({ state: "unavailable", message: "DataForSEO n'a pas répondu à temps." })

    state.metrics = measures(null, null)
    const empty = (await (await call({ keyword: "facture plombier" })).json()) as KeywordCheckResponse
    expect(empty.metrics.state).toBe("ok")
    expect(empty.metrics.message).toContain("aucune donnée")
  })

  it("Google injoignable : « unreachable », pas une erreur ; phrase inconnue de Google : non vérifiée", async () => {
    state.google = { reached: false, verified: false, also: [] }
    const unreachable = (await (await call({ keyword: "facture plombier" })).json()) as KeywordCheckResponse
    expect(unreachable.google).toEqual({ state: "unreachable", verified: false, also: [] })
    state.google = { reached: true, verified: false, also: [] }
    const unknown = (await (await call({ keyword: "facture plombier" })).json()) as KeywordCheckResponse
    expect(unknown.google).toEqual({ state: "ok", verified: false, also: [] })
  })

  it("sans mesures demandées : pas d'appel payant ; mot-clé refusé par Google Ads : raison donnée", async () => {
    const free = (await (await call({ keyword: "facture plombier", metrics: false })).json()) as KeywordCheckResponse
    expect(free.metrics.state).toBe("skipped")
    expect(state.metricsCalls).toEqual([])
    const odd = (await (await call({ keyword: "facture plombier, tarif ?" })).json()) as KeywordCheckResponse
    expect(odd.metrics.state).toBe("unsendable")
    expect(odd.metrics.message).toContain("n'accepte pas ce mot-clé")
  })

  it("concurrent nommé : signalé, jamais mesuré", async () => {
    const json = (await (await call({ keyword: `${brandOfDomain(competitor)} facture` })).json()) as KeywordCheckResponse
    expect(json.competitor).toBe(true)
    expect(json.metrics.state).toBe("skipped")
    expect(json.metrics.message).toContain("concurrent")
    expect(state.metricsCalls).toEqual([])
  })

  it("saisie invalide : 400 ; adresse web : 400 ; non connecté : 401", async () => {
    expect((await call({ keyword: "" })).status).toBe(400)
    expect((await call({ keyword: "https://qonforme.fr/blog" })).status).toBe(400)
    expect((await call({})).status).toBe(400)
    state.admin = false
    expect((await call({ keyword: "facture plombier" })).status).toBe(401)
  })
})
