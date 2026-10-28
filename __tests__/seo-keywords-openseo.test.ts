/**
 * Mesures des mots-clés par le compte OpenSEO (lib/seo/keywords/openseo.ts) :
 * analyse des réponses MCP (JSON ou flux SSE), session (initialize, puis
 * notifications/initialized, puis tools/call), choix du projet, lots de 700,
 * messages en français sans clé, priorité sur DataForSEO, test de connexion.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  OPENSEO_MAX_KEYWORDS,
  OPENSEO_MCP_URL,
  OPENSEO_TOOLS,
  OpenSeoError,
  fetchOpenSeoKeywordMetrics,
  openSeoMessage,
  parseOpenSeoMetrics,
  parseSse,
  pickProject,
  rpcMessage,
  toolPayload,
} from "@/lib/seo/keywords/openseo"
import { DataForSeoError, fetchKeywordMetrics, keywordDataSource } from "@/lib/seo/keywords/dataforseo"
import { testConnection } from "@/lib/seo/connections-test"
import { isKeywordDataConfigured } from "@/lib/seo/connections"

const KEY = "oseo_test_cle_secrete_123456"
const PROJECT = "3ed81614-5ec8-4e75-9455-45144bc51b82"

/** Réponse réelle de get_keyword_metrics (28/10/2026), deux mots-clés. */
const METRICS_PAYLOAD = {
  keywords: [
    { keyword: "logiciel devis bâtiment", search_volume: 260, keyword_difficulty: 10, main_intent: "commercial", cpc: 21.32, competition: 0.71, competition_level: "HIGH" },
    { keyword: "modèle devis artisan", search_volume: 30, keyword_difficulty: null, main_intent: "informational", cpc: 1.58, competition: 0.6, competition_level: "MEDIUM" },
  ],
  meta: { projectId: PROJECT },
}

describe("analyse des réponses", () => {
  it("lit un flux SSE et ignore ce qui n'est pas du JSON", () => {
    const sse = 'event: message\ndata: {"jsonrpc":"2.0","id":2,"result":{"ok":true}}\n\n: ping\n\nevent: message\ndata: pas du json\n\n'
    expect(parseSse(sse)).toEqual([{ jsonrpc: "2.0", id: 2, result: { ok: true } }])
    expect(parseSse("data: {\"a\":1}\r\n\r\n")).toEqual([{ a: 1 }])
  })

  it("choisit le message qui répond à la requête, en JSON comme en SSE", () => {
    expect(rpcMessage('{"jsonrpc":"2.0","id":3,"result":{"x":1}}', "application/json", 3)).toMatchObject({ result: { x: 1 } })
    const sse = 'data: {"jsonrpc":"2.0","method":"notifications/progress"}\n\ndata: {"jsonrpc":"2.0","id":4,"result":{"y":2}}\n\n'
    expect(rpcMessage(sse, "text/event-stream; charset=utf-8", 4)).toMatchObject({ id: 4, result: { y: 2 } })
    expect(rpcMessage('[{"id":1,"result":{}},{"id":5,"result":{"z":3}}]', "application/json", 5)).toMatchObject({ result: { z: 3 } })
    expect(rpcMessage("<html>", "text/html", 1)).toBeNull()
  })

  it("lit le contenu d'un résultat d'outil : structuré, sinon le JSON du bloc texte", () => {
    expect(toolPayload({ structuredContent: { a: 1 }, content: [{ type: "text", text: '{"a":2}' }] })).toEqual({ a: 1 })
    expect(toolPayload({ content: [{ type: "text", text: JSON.stringify(METRICS_PAYLOAD) }] })).toEqual(METRICS_PAYLOAD)
    expect(toolPayload({ content: [{ type: "text", text: "pas du json" }] })).toBeNull()
    expect(toolPayload(null)).toBeNull()
  })

  it("rend volume, CPC, difficulté et intention par mot-clé canonique, null quand une valeur manque", () => {
    const map = parseOpenSeoMetrics(METRICS_PAYLOAD)
    expect(map.get("logiciel devis bâtiment")).toEqual({ volume: 260, cpc: 21.32, difficulty: 10, intent: "commercial" })
    expect(map.get("modèle devis artisan")).toEqual({ volume: 30, cpc: 1.58, difficulty: null, intent: "informational" })
    expect(parseOpenSeoMetrics({ keywords: [{ keyword: "x", search_volume: -4, keyword_difficulty: 140, main_intent: "autre", cpc: "2.456" }] }).get("x")).toEqual({
      volume: 0,
      cpc: 2.46,
      difficulty: 100,
      intent: null,
    })
    expect(parseOpenSeoMetrics(null).size).toBe(0)
  })

  it("retrouve le projet du site, ou le seul projet du compte, sinon rien", () => {
    const own = { id: "p-site", domain: "qonforme.fr" }
    expect(pickProject({ projects: [{ id: "p-autre", domain: "autre.fr" }, own] })).toBe("p-site")
    expect(pickProject({ projects: [{ id: "p-www", domain: "www.qonforme.fr" }] })).toBe("p-www")
    expect(pickProject({ projects: [{ id: "p-seul", domain: "autre.fr" }] })).toBe("p-seul")
    expect(pickProject({ projects: [{ id: "a", domain: "a.fr" }, { id: "b", domain: "b.fr" }] })).toBeNull()
    expect(pickProject({ projects: [] })).toBeNull()
  })

  it("messages en français : clé refusée, crédits, limite, panne", () => {
    expect(openSeoMessage(401)).toContain("OPENSEO_API_KEY")
    expect(openSeoMessage(402)).toContain("crédits")
    expect(openSeoMessage(null, "Insufficient credits for this request")).toContain("crédits")
    expect(openSeoMessage(429)).toContain("Trop de requêtes")
    expect(openSeoMessage(503)).toContain("indisponible")
    expect(openSeoMessage(null, "projet inconnu")).toBe("OpenSEO n'a pas pu répondre : « projet inconnu ».")
  })

  it("le site n'appelle que trois outils (la clé ne peut pas être limitée à la lecture)", () => {
    expect([...OPENSEO_TOOLS]).toEqual(["whoami", "list_projects", "get_keyword_metrics"])
  })
})

/* ------------------------------------------------------------------ */
/* Appels (fetch simulé)                                                */
/* ------------------------------------------------------------------ */

interface Sent {
  url: string
  headers: Record<string, string>
  body: { id?: number; method: string; params?: { name?: string; arguments?: Record<string, unknown> } }
}

let sent: Sent[]
/** Réponses de tools/call, dans l'ordre. */
let toolReplies: (() => Response)[]
let initReply: () => Response

const jsonResponse = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" }, ...init })
const toolResult = (payload: unknown) => ({ jsonrpc: "2.0", id: 0, result: { content: [{ type: "text", text: JSON.stringify(payload) }] } })

beforeEach(() => {
  sent = []
  toolReplies = []
  initReply = () =>
    new Response(`event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: 1, result: { protocolVersion: "2025-03-26", capabilities: {} } })}\n\n`, {
      status: 200,
      headers: { "content-type": "text/event-stream", "mcp-session-id": "session-abc" },
    })
  vi.stubEnv("OPENSEO_API_KEY", KEY)
  vi.stubEnv("OPENSEO_PROJECT_ID", "")
  vi.stubEnv("DATAFORSEO_LOGIN", "")
  vi.stubEnv("DATAFORSEO_PASSWORD", "")
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as Sent["body"]
      sent.push({ url, headers: init.headers as Record<string, string>, body })
      if (body.method === "initialize") return initReply()
      if (body.method === "notifications/initialized") return new Response(null, { status: 202 })
      const next = toolReplies.shift()
      if (!next) throw new Error(`appel inattendu : ${body.method} ${body.params?.name ?? ""}`)
      // L'identifiant de la réponse suit celui de la requête
      const res = next()
      const json = (await res.clone().json().catch(() => null)) as { id?: number } | null
      if (json && typeof json === "object" && "jsonrpc" in json) {
        return new Response(JSON.stringify({ ...json, id: body.id }), { status: res.status, headers: res.headers })
      }
      return res
    }),
  )
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const deadline = () => Date.now() + 60_000

describe("fetchOpenSeoKeywordMetrics", () => {
  it("ouvre une session, retrouve le projet, puis mesure les mots-clés (clé en en-tête, session renvoyée)", async () => {
    toolReplies = [() => jsonResponse(toolResult({ projects: [{ id: PROJECT, name: "Qonforme", domain: "qonforme.fr" }] })), () => jsonResponse(toolResult(METRICS_PAYLOAD))]
    const map = await fetchOpenSeoKeywordMetrics(["logiciel devis bâtiment", "modèle devis artisan", "phrase inconnue"], { deadline: deadline() })

    expect(sent.map((s) => s.body.method)).toEqual(["initialize", "notifications/initialized", "tools/call", "tools/call"])
    expect(sent.every((s) => s.url === OPENSEO_MCP_URL)).toBe(true)
    expect(sent.every((s) => s.headers.Authorization === `Bearer ${KEY}`)).toBe(true)
    expect(sent[0].headers["Mcp-Session-Id"]).toBeUndefined()
    expect(sent.slice(1).every((s) => s.headers["Mcp-Session-Id"] === "session-abc")).toBe(true)
    expect(sent[2].body.params).toEqual({ name: "list_projects", arguments: {} })
    expect(sent[3].body.params?.name).toBe("get_keyword_metrics")
    expect(sent[3].body.params?.arguments).toMatchObject({
      projectId: PROJECT,
      keywords: ["logiciel devis bâtiment", "modèle devis artisan", "phrase inconnue"],
      locationCode: 2250,
      languageCode: "fr",
      includeMonthlyTrends: false,
    })
    expect(map.get("logiciel devis bâtiment")).toEqual({ volume: 260, cpc: 21.32, difficulty: 10, intent: "commercial" })
    expect(map.get("phrase inconnue")).toEqual({ volume: null, cpc: null, difficulty: null, intent: null })
  })

  it("OPENSEO_PROJECT_ID fourni : pas d'appel list_projects", async () => {
    vi.stubEnv("OPENSEO_PROJECT_ID", "projet-fixe")
    toolReplies = [() => jsonResponse(toolResult(METRICS_PAYLOAD))]
    await fetchOpenSeoKeywordMetrics(["logiciel devis bâtiment"], { deadline: deadline() })
    expect(sent.filter((s) => s.body.method === "tools/call").map((s) => s.body.params?.name)).toEqual(["get_keyword_metrics"])
    expect(sent[sent.length - 1].body.params?.arguments?.projectId).toBe("projet-fixe")
  })

  it("plus de 700 mots-clés : un appel par lot de 700", async () => {
    vi.stubEnv("OPENSEO_PROJECT_ID", "projet-fixe")
    const keywords = Array.from({ length: OPENSEO_MAX_KEYWORDS + 5 }, (_, i) => `mot cle ${i}`)
    toolReplies = [() => jsonResponse(toolResult({ keywords: [] })), () => jsonResponse(toolResult({ keywords: [] }))]
    const map = await fetchOpenSeoKeywordMetrics(keywords, { deadline: deadline() })
    const calls = sent.filter((s) => s.body.method === "tools/call")
    expect(calls).toHaveLength(2)
    expect((calls[0].body.params?.arguments?.keywords as string[]).length).toBe(OPENSEO_MAX_KEYWORDS)
    expect((calls[1].body.params?.arguments?.keywords as string[]).length).toBe(5)
    expect(map.size).toBe(OPENSEO_MAX_KEYWORDS + 5)
  })

  it("réponse en SSE, JSON-RPC en erreur, outil en erreur : messages en français, sans la clé", async () => {
    vi.stubEnv("OPENSEO_PROJECT_ID", "projet-fixe")
    const sse = `event: message\ndata: ${JSON.stringify(toolResult(METRICS_PAYLOAD))}\n\n`
    toolReplies = [() => new Response(sse, { status: 200, headers: { "content-type": "text/event-stream" } })]
    expect((await fetchOpenSeoKeywordMetrics(["logiciel devis bâtiment"], { deadline: deadline() })).get("logiciel devis bâtiment")?.volume).toBe(260)

    toolReplies = [() => jsonResponse({ jsonrpc: "2.0", id: 0, error: { code: -32602, message: "keywords invalides" } })]
    await expect(fetchOpenSeoKeywordMetrics(["a"], { deadline: deadline() })).rejects.toThrow(/keywords invalides/)

    toolReplies = [() => jsonResponse({ jsonrpc: "2.0", id: 0, result: { isError: true, content: [{ type: "text", text: "Not enough credits" }] } })]
    const error = await fetchOpenSeoKeywordMetrics(["a"], { deadline: deadline() }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(OpenSeoError)
    // Les routes qui attrapent DataForSeoError gèrent aussi OpenSEO
    expect(error).toBeInstanceOf(DataForSeoError)
    expect((error as Error).message).toContain("crédits")
    expect((error as Error).message).not.toContain(KEY)
  })

  it("clé refusée à l'ouverture : message sans la clé ; projet introuvable ; délai trop court", async () => {
    initReply = () => new Response("unauthorized", { status: 401 })
    const refused = await fetchOpenSeoKeywordMetrics(["a"], { deadline: deadline() }).catch((e: Error) => e)
    expect((refused as Error).message).toContain("OPENSEO_API_KEY")
    expect((refused as Error).message).not.toContain(KEY)

    initReply = () => jsonResponse({ jsonrpc: "2.0", id: 1, result: { protocolVersion: "2025-03-26" } })
    toolReplies = [() => jsonResponse(toolResult({ projects: [{ id: "a", domain: "a.fr" }, { id: "b", domain: "b.fr" }] }))]
    await expect(fetchOpenSeoKeywordMetrics(["a"], { deadline: deadline() })).rejects.toThrow(/OPENSEO_PROJECT_ID/)

    await expect(fetchOpenSeoKeywordMetrics(["a"], { deadline: Date.now() + 5_000 })).rejects.toThrow(/à temps/)
  })

  it("sans clé : aucun appel", async () => {
    vi.stubEnv("OPENSEO_API_KEY", "")
    await expect(fetchOpenSeoKeywordMetrics(["a"], { deadline: deadline() })).rejects.toThrow(/pas configuré/)
    expect(sent).toHaveLength(0)
  })
})

describe("source des mesures", () => {
  it("OpenSEO passe avant DataForSEO ; sans l'un ni l'autre, rien", () => {
    expect(keywordDataSource()).toBe("openseo")
    vi.stubEnv("DATAFORSEO_LOGIN", "login")
    vi.stubEnv("DATAFORSEO_PASSWORD", "mot-de-passe")
    expect(keywordDataSource()).toBe("openseo")
    vi.stubEnv("OPENSEO_API_KEY", "")
    expect(keywordDataSource()).toBe("dataforseo")
    vi.stubEnv("DATAFORSEO_LOGIN", "")
    expect(keywordDataSource()).toBeNull()
  })

  it("fetchKeywordMetrics passe par OpenSEO quand sa clé est là, jamais par l'API de DataForSEO", async () => {
    vi.stubEnv("DATAFORSEO_LOGIN", "login")
    vi.stubEnv("DATAFORSEO_PASSWORD", "mot-de-passe")
    vi.stubEnv("OPENSEO_PROJECT_ID", "projet-fixe")
    toolReplies = [() => jsonResponse(toolResult(METRICS_PAYLOAD))]
    const map = await fetchKeywordMetrics(["logiciel devis bâtiment"], { deadline: deadline() })
    expect(map.get("logiciel devis bâtiment")?.volume).toBe(260)
    expect(sent.every((s) => s.url === OPENSEO_MCP_URL)).toBe(true)
  })

  it("la connexion OpenSEO compte comme une source de mesures, comme DataForSEO", () => {
    expect(isKeywordDataConfigured()).toBe(true)
    vi.stubEnv("OPENSEO_API_KEY", "")
    expect(isKeywordDataConfigured()).toBe(false)
    vi.stubEnv("DATAFORSEO_LOGIN", "login")
    vi.stubEnv("DATAFORSEO_PASSWORD", "mot-de-passe")
    expect(isKeywordDataConfigured()).toBe(true)
  })
})

describe("test de la connexion OpenSEO", () => {
  const NOW = () => new Date("2026-10-28T10:00:00.000Z")

  it("clé acceptée : compte et crédits restants (outil gratuit whoami)", async () => {
    toolReplies = [() => jsonResponse(toolResult({ userEmail: "mehdi@example.com", scopes: ["mcp"], mode: "hosted", creditsRemaining: 9482 }))]
    const result = await testConnection("openseo", NOW)
    expect(result.state).toBe("connected")
    expect(result.message).toContain("mehdi@example.com")
    expect(result.message).toMatch(/9\s?482 crédits/)
    expect(sent.filter((s) => s.body.method === "tools/call").map((s) => s.body.params?.name)).toEqual(["whoami"])
  })

  it("clé refusée : erreur en français, jamais la clé", async () => {
    initReply = () => new Response("unauthorized", { status: 401 })
    const result = await testConnection("openseo", NOW)
    expect(result.state).toBe("error")
    expect(result.message).toContain("OPENSEO_API_KEY")
    expect(result.message).not.toContain(KEY)
  })

  it("clé absente : rien n'est appelé", async () => {
    vi.stubEnv("OPENSEO_API_KEY", "")
    const result = await testConnection("openseo", NOW)
    expect(result.state).toBe("not_configured")
    expect(sent).toHaveLength(0)
  })
})
