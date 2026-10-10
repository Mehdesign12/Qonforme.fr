import { afterEach, describe, expect, it, vi } from "vitest"
import {
  DataForSeoError,
  DFS_LOCATION_FRANCE,
  fetchKeywordMetrics,
  isSendableKeyword,
  parseKeywordDifficulty,
  parseSearchIntent,
  parseSearchVolume,
  taskResult,
} from "@/lib/seo/keywords/dataforseo"

/** Enveloppe d'une réponse « live » (structure de la documentation DataForSEO v3). */
function envelope(result: unknown[], over: { status_code?: number; status_message?: string; task?: Record<string, unknown> } = {}) {
  return {
    version: "0.1.20260901",
    status_code: over.status_code ?? 20000,
    status_message: over.status_message ?? "Ok.",
    time: "0.4 sec.",
    cost: 0.075,
    tasks_count: 1,
    tasks_error: 0,
    tasks: [
      {
        id: "10091200-1535-0216-0000-5e0e1c0b2a10",
        status_code: 20000,
        status_message: "Ok.",
        time: "0.3 sec.",
        cost: 0.075,
        result_count: result.length,
        path: ["v3"],
        data: {},
        result,
        ...over.task,
      },
    ],
  }
}

const volumeResponse = envelope([
  {
    keyword: "factures mentions obligatoires",
    spell: null,
    location_code: 2250,
    language_code: "fr",
    search_partners: false,
    competition: "LOW",
    competition_index: 12,
    search_volume: 3600,
    low_top_of_page_bid: 0.5,
    high_top_of_page_bid: 2.1,
    cpc: 1.234,
    monthly_searches: [{ year: 2026, month: 9, search_volume: 3600 }],
  },
  { keyword: "Modèle devis", search_volume: null, cpc: null },
])

const difficultyResponse = envelope([
  {
    se_type: "google",
    location_code: 2250,
    language_code: "fr",
    total_count: 2,
    items_count: 2,
    items: [
      { se_type: "google", keyword: "factures mentions obligatoires", keyword_difficulty: 12 },
      { se_type: "google", keyword: "modèle devis", keyword_difficulty: null },
    ],
  },
])

const intentResponse = envelope([
  {
    items_count: 2,
    items: [
      {
        keyword: "factures mentions obligatoires",
        keyword_intent: { label: "informational", probability: 0.92 },
        secondary_keyword_intents: null,
      },
      {
        keyword: "modèle devis",
        keyword_intent: { label: "transactional", probability: 0.6 },
        secondary_keyword_intents: [{ label: "commercial", probability: 0.3 }],
      },
    ],
  },
])

describe("analyse des réponses de DataForSEO", () => {
  it("lit volume et CPC (Google Ads)", () => {
    const v = parseSearchVolume(volumeResponse)
    expect(v.get("factures mentions obligatoires")).toEqual({ volume: 3600, cpc: 1.23 })
    // Rapproché par la forme canonique (minuscules)
    expect(v.get("modèle devis")).toEqual({ volume: null, cpc: null })
  })

  it("lit la difficulté et l'intention (DataForSEO Labs)", () => {
    expect(parseKeywordDifficulty(difficultyResponse).get("factures mentions obligatoires")).toBe(12)
    expect(parseKeywordDifficulty(difficultyResponse).get("modèle devis")).toBeNull()
    const intents = parseSearchIntent(intentResponse)
    expect(intents.get("factures mentions obligatoires")).toBe("informational")
    expect(intents.get("modèle devis")).toBe("transactional")
  })

  it("refuse une tâche en erreur, avec un message en français et sans secret", () => {
    const failed = envelope([], { task: { status_code: 40210, status_message: "Insufficient funds." } })
    expect(() => parseSearchVolume(failed)).toThrowError(DataForSeoError)
    expect(() => parseSearchVolume(failed)).toThrowError(/solde du compte DataForSEO est insuffisant/)
    const unauthorized = envelope([], { status_code: 40100, status_message: "You are not authorized" })
    expect(() => taskResult(unauthorized)).toThrowError(/refusé les identifiants/)
    const other = envelope([], { task: { status_code: 40501, status_message: "Invalid Field: 'keywords'." } })
    try {
      parseKeywordDifficulty(other)
      throw new Error("aurait dû échouer")
    } catch (error) {
      expect(error).toBeInstanceOf(DataForSeoError)
      expect((error as DataForSeoError).code).toBe(40501)
    }
    expect(() => taskResult(null)).toThrowError(/illisible/)
    expect(() => taskResult({ status_code: 20000, tasks: [] })).toThrowError(/sans tâche/)
  })

  it("n'envoie que des mots-clés acceptés par Google Ads", () => {
    expect(isSendableKeyword("factures mentions obligatoires")).toBe(true)
    expect(isSendableKeyword("devis d'artisan")).toBe(true)
    expect(isSendableKeyword("x".repeat(81))).toBe(false)
    expect(isSendableKeyword("un deux trois quatre cinq six sept huit neuf dix onze")).toBe(false)
    expect(isSendableKeyword("devis (gratuit)")).toBe(false)
    expect(isSendableKeyword("prix, devis")).toBe(false)
  })
})

describe("appels à DataForSEO", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it("interroge les trois points d'accès pour la France en français, en Basic", async () => {
    vi.stubEnv("DATAFORSEO_LOGIN", "login@exemple.fr")
    vi.stubEnv("DATAFORSEO_PASSWORD", "secret")
    const calls: { url: string; body: unknown; auth: string | null }[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, body: JSON.parse(String(init.body)), auth: new Headers(init.headers).get("authorization") })
        const json = url.includes("search_volume") ? volumeResponse : url.includes("keyword_difficulty") ? difficultyResponse : intentResponse
        return new Response(JSON.stringify(json), { status: 200, headers: { "Content-Type": "application/json" } })
      }),
    )
    const metrics = await fetchKeywordMetrics(["factures mentions obligatoires", "modèle devis", "absent"], { deadline: Date.now() + 30_000 })
    expect(metrics.get("factures mentions obligatoires")).toEqual({ volume: 3600, cpc: 1.23, difficulty: 12, intent: "informational" })
    expect(metrics.get("absent")).toEqual({ volume: null, cpc: null, difficulty: null, intent: null })

    expect(calls).toHaveLength(3)
    const volume = calls.find((c) => c.url.endsWith("/v3/keywords_data/google_ads/search_volume/live"))
    expect(volume?.body).toEqual([{ keywords: ["factures mentions obligatoires", "modèle devis", "absent"], location_code: DFS_LOCATION_FRANCE, language_code: "fr" }])
    expect(calls.find((c) => c.url.endsWith("/v3/dataforseo_labs/google/search_intent/live"))?.body).toEqual([
      { keywords: ["factures mentions obligatoires", "modèle devis", "absent"] },
    ])
    expect(calls[0].auth).toBe(`Basic ${Buffer.from("login@exemple.fr:secret").toString("base64")}`)
  })

  it("une erreur de tâche fait échouer l'analyse sans révéler les identifiants", async () => {
    vi.stubEnv("DATAFORSEO_LOGIN", "login@exemple.fr")
    vi.stubEnv("DATAFORSEO_PASSWORD", "secret")
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(envelope([], { status_code: 40100, status_message: "You are not authorized" })), { status: 401 })),
    )
    const run = fetchKeywordMetrics(["devis"], { deadline: Date.now() + 30_000 })
    await expect(run).rejects.toThrowError(DataForSeoError)
    await expect(run).rejects.not.toThrowError(/secret|login@exemple/)
  })

  it("sans identifiants : non configuré", async () => {
    vi.stubEnv("DATAFORSEO_LOGIN", "")
    vi.stubEnv("DATAFORSEO_PASSWORD", "")
    await expect(fetchKeywordMetrics(["devis"], { deadline: Date.now() + 30_000 })).rejects.toThrowError(/n'est pas configuré/)
  })
})
