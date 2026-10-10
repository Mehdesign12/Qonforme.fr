/**
 * Visibilité IA : analyse des réponses des cinq moteurs (exemples réalistes, formes
 * documentées), appels réseau simulés (aucun appel réel), aucune clé dans un message.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { geminiEngine, geminiRequest, geminiSource, isGeminiRedirect, parseGeminiResponse } from "@/lib/seo/geo/engines/gemini"
import { chatgptEngine, chatgptRequest, parseChatgptResponse } from "@/lib/seo/geo/engines/chatgpt"
import { parsePerplexityResponse, perplexityRequest } from "@/lib/seo/geo/engines/perplexity"
import Anthropic from "@anthropic-ai/sdk"
import { claudeEngine, parseClaudeMessages, toEngineError } from "@/lib/seo/geo/engines/claude"
import { detect } from "@/lib/seo/geo/detect"
import { aiOverviewRequest, googleAiOverviewEngine, parseAiOverviewResponse } from "@/lib/seo/geo/engines/google-ai-overview"
import { GeoEngineError, redact } from "@/lib/seo/geo/engines/http"
import { systemContext } from "@/lib/seo/geo/engines/context"

const OPTS = { market: "France", language: "français" }
const Q = "Quel logiciel de devis et de facturation est le plus adapté aux artisans du bâtiment en France ?"

/* ------------------------------------------------------------------ */
/* Gemini                                                              */
/* ------------------------------------------------------------------ */

const GEMINI_RESPONSE = {
  candidates: [
    {
      content: {
        role: "model",
        parts: [
          { text: "Pour un artisan du bâtiment, plusieurs logiciels conviennent. ", thought: false },
          { text: "réflexion interne", thought: true },
          { text: "Les critères : mentions obligatoires, TVA par ligne, relances." },
        ],
      },
      finishReason: "STOP",
      groundingMetadata: {
        webSearchQueries: ["logiciel devis facturation artisan bâtiment"],
        searchEntryPoint: { renderedContent: "<div>…</div>" },
        groundingChunks: [
          { web: { uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQabc", title: "constructor.co" } },
          { web: { uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQdef", title: "Logiciel de facturation" } },
        ],
        groundingSupports: [{ segment: { startIndex: 0, endIndex: 60 }, groundingChunkIndices: [0, 1] }],
      },
    },
  ],
  usageMetadata: { promptTokenCount: 30, candidatesTokenCount: 120 },
  modelVersion: "gemini-2.5-flash",
}

describe("Gemini", () => {
  it("demande la recherche Google et une réponse pour le marché suivi", () => {
    const body = geminiRequest(Q, OPTS)
    expect(body.tools).toEqual([{ google_search: {} }])
    expect(body.contents[0].parts[0].text).toBe(Q)
    expect(body.systemInstruction.parts[0].text).toBe(systemContext(OPTS))
    expect(systemContext(OPTS)).toContain("en France")
  })

  it("lit le texte (sans les pensées) et les sources de groundingChunks", () => {
    const parsed = parseGeminiResponse(GEMINI_RESPONSE, "gemini-2.5-flash")
    expect(parsed.answer).toBe("Pour un artisan du bâtiment, plusieurs logiciels conviennent. Les critères : mentions obligatoires, TVA par ligne, relances.")
    expect(parsed.chunks).toHaveLength(2)
    expect(parsed.model).toBe("gemini-2.5-flash")
  })

  it("domaine : destination de la redirection, sinon le titre s'il a la forme d'un domaine", () => {
    const [a, b] = parseGeminiResponse(GEMINI_RESPONSE, "m").chunks
    expect(geminiSource(a, "https://www.qonforme.fr/guide/tva-travaux")).toEqual({
      url: "https://www.qonforme.fr/guide/tva-travaux",
      domain: "qonforme.fr",
      title: "constructor.co",
    })
    expect(geminiSource(a, null).domain).toBe("constructor.co")
    expect(geminiSource(b, null).domain).toBe("")
  })

  it("ne suit que l'hôte exact de redirection de Google", () => {
    expect(isGeminiRedirect("https://vertexaisearch.cloud.google.com/grounding-api-redirect/x")).toBe(true)
    expect(isGeminiRedirect("https://vertexaisearch.cloud.google.com.evil.example/x")).toBe(false)
    expect(isGeminiRedirect("http://vertexaisearch.cloud.google.com/x")).toBe(false)
    expect(isGeminiRedirect("https://example.com/x")).toBe(false)
  })

  it("question refusée ou réponse vide : erreur explicite", () => {
    expect(() => parseGeminiResponse({ promptFeedback: { blockReason: "SAFETY" } }, "m")).toThrow(/refusée/)
    expect(() => parseGeminiResponse({ candidates: [{ content: { parts: [] }, finishReason: "SAFETY" }] }, "m")).toThrow(GeoEngineError)
  })
})

/* ------------------------------------------------------------------ */
/* ChatGPT (API Responses)                                             */
/* ------------------------------------------------------------------ */

const OPENAI_RESPONSE = {
  id: "resp_123",
  object: "response",
  status: "completed",
  model: "gpt-4.1-mini-2025-04-14",
  output: [
    { type: "web_search_call", id: "ws_1", status: "completed", action: { type: "search", query: "logiciel devis artisan" } },
    {
      id: "msg_1",
      type: "message",
      status: "completed",
      role: "assistant",
      content: [
        {
          type: "output_text",
          text: "Plusieurs solutions existent, dont Qonforme, pensé pour les artisans du bâtiment.",
          annotations: [
            { type: "url_citation", start_index: 0, end_index: 40, url: "https://qonforme.fr/?utm_source=openai", title: "Qonforme" },
            { type: "url_citation", start_index: 41, end_index: 80, url: "https://www.tolteck.com/tarifs?utm_source=openai", title: "Tarifs" },
            { type: "url_citation", start_index: 41, end_index: 80, url: "https://www.tolteck.com/tarifs?utm_source=openai", title: "Tarifs" },
          ],
        },
      ],
    },
  ],
}

describe("ChatGPT", () => {
  it("impose la recherche web et ne conserve rien chez OpenAI", () => {
    const body = chatgptRequest(Q, OPTS, "gpt-4.1-mini")
    expect(body.tools[0]).toMatchObject({ type: "web_search", user_location: { type: "approximate", country: "FR", timezone: "Europe/Paris" } })
    expect(body.tool_choice).toBe("required")
    expect(body.store).toBe(false)
    expect(body.input).toBe(Q)
  })

  it("lit output_text et les annotations url_citation (dédoublonnées, sans utm_source=openai)", () => {
    const res = parseChatgptResponse(OPENAI_RESPONSE, "gpt-4.1-mini")
    expect(res.answer).toContain("Qonforme")
    expect(res.model).toBe("gpt-4.1-mini-2025-04-14")
    expect(res.sources).toEqual([
      { url: "https://qonforme.fr/", domain: "qonforme.fr", title: "Qonforme" },
      { url: "https://www.tolteck.com/tarifs", domain: "tolteck.com", title: "Tarifs" },
    ])
  })

  it("citations en ligne ([domaine](url)) et adresses du texte : ni mention de la marque, ni mention d'un concurrent ; la citation reste une citation", () => {
    // Forme observée : output_text où ChatGPT insère ses sources en liens Markdown, plus les annotations url_citation
    const text =
      "Pour un artisan du bâtiment, privilégiez un logiciel qui gère devis, factures et relances " +
      "([qonforme.fr](https://qonforme.fr/guide/comment-faire-un-devis?utm_source=openai)). " +
      "Comparez aussi les tarifs ([tolteck.com](https://www.tolteck.com/tarifs?utm_source=openai)) " +
      "et les avis publiés sur https://www.constructor.co/avis avant de vous décider."
    const res = parseChatgptResponse(
      {
        status: "completed",
        model: "gpt-4.1-mini-2025-04-14",
        output: [
          { type: "web_search_call", id: "ws_1", status: "completed" },
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text,
                annotations: [
                  { type: "url_citation", start_index: 92, end_index: 180, url: "https://qonforme.fr/guide/comment-faire-un-devis?utm_source=openai", title: "Comment faire un devis" },
                  { type: "url_citation", start_index: 210, end_index: 280, url: "https://www.tolteck.com/tarifs?utm_source=openai", title: "Tarifs" },
                ],
              },
            ],
          },
        ],
      },
      "gpt-4.1-mini",
    )
    const found = detect(res, { brandTerms: ["Qonforme", "qonforme.fr"], competitors: ["tolteck.com", "constructor.co"] })
    expect(found).toEqual({ brand_mentioned: false, site_cited: true, competitors_mentioned: [], competitors_cited: ["tolteck.com"] })
    // Nommée dans le texte lui-même : c'est une mention
    const named = detect({ ...res, answer: `Qonforme est pensé pour les artisans ${text}` }, { brandTerms: ["Qonforme"], competitors: ["tolteck.com"] })
    expect(named.brand_mentioned).toBe(true)
  })

  it("échec et refus : erreurs explicites", () => {
    expect(() => parseChatgptResponse({ status: "failed", error: { message: "server_error" } }, "m")).toThrow(/échec/)
    expect(() =>
      parseChatgptResponse({ status: "completed", output: [{ type: "message", content: [{ type: "refusal", refusal: "Je ne peux pas" }] }] }, "m"),
    ).toThrow(/refusée/)
  })
})

/* ------------------------------------------------------------------ */
/* Perplexity                                                          */
/* ------------------------------------------------------------------ */

describe("Perplexity", () => {
  it("envoie le modèle sonar et la question", () => {
    const body = perplexityRequest(Q, OPTS)
    expect(body.model).toBe("sonar")
    expect(body.messages[1]).toEqual({ role: "user", content: Q })
  })

  it("sources = citations, titres repris de search_results", () => {
    const res = parsePerplexityResponse({
      id: "8158ec84-87a8-40fd-8720-a8b8e628708c",
      model: "sonar",
      object: "chat.completion",
      created: 1784292153,
      choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: "Les logiciels les plus cités [1][2]." } }],
      citations: ["https://www.mediabat.com/logiciel", "https://www.service-public.gouv.fr/F31808"],
      search_results: [
        { title: "Logiciel bâtiment", url: "https://www.mediabat.com/logiciel", date: "2026-05-01" },
        { title: "Mentions obligatoires", url: "https://www.service-public.gouv.fr/F31808" },
      ],
    })
    expect(res.answer).toBe("Les logiciels les plus cités [1][2].")
    expect(res.sources.map((s) => [s.domain, s.title])).toEqual([
      ["mediabat.com", "Logiciel bâtiment"],
      ["service-public.gouv.fr", "Mentions obligatoires"],
    ])
  })

  it("lit aussi la forme de l'Agent API", () => {
    const res = parsePerplexityResponse({
      output_text: "Réponse [1]",
      output: [{ type: "search_results", results: [{ id: 1, url: "https://qonforme.fr/modele", title: "Modèles" }] }],
    })
    expect(res.sources).toEqual([{ url: "https://qonforme.fr/modele", domain: "qonforme.fr", title: "Modèles" }])
  })

  it("réponse vide : erreur", () => {
    expect(() => parsePerplexityResponse({ choices: [{ message: { content: "" } }] })).toThrow(/vide/)
  })
})

/* ------------------------------------------------------------------ */
/* Claude                                                              */
/* ------------------------------------------------------------------ */

const CLAUDE_PAUSED = {
  id: "msg_01",
  type: "message",
  role: "assistant",
  model: "claude-opus-5-5",
  stop_reason: "pause_turn",
  content: [
    { type: "server_tool_use", id: "srvtoolu_1", name: "web_search", input: { query: "logiciel devis artisan bâtiment" } },
    {
      type: "web_search_tool_result",
      tool_use_id: "srvtoolu_1",
      content: [
        { type: "web_search_result", url: "https://www.constructor.co/", title: "Constructor", encrypted_content: "x", page_age: null },
        { type: "web_search_result", url: "https://qonforme.fr/guide/comment-faire-un-devis", title: "Comment faire un devis", encrypted_content: "y", page_age: null },
      ],
    },
  ],
  usage: { input_tokens: 10, output_tokens: 10 },
}

const CLAUDE_DONE = {
  id: "msg_02",
  type: "message",
  role: "assistant",
  model: "claude-opus-5-5",
  stop_reason: "end_turn",
  content: [
    { type: "text", text: "Voici les critères à regarder. ", citations: null },
    {
      type: "text",
      text: "Un devis doit porter les mentions obligatoires.",
      citations: [
        {
          type: "web_search_result_location",
          url: "https://qonforme.fr/guide/comment-faire-un-devis",
          title: "Comment faire un devis",
          cited_text: "…",
          encrypted_index: "z",
        },
      ],
    },
  ],
  usage: { input_tokens: 10, output_tokens: 10 },
}

describe("Claude", () => {
  it("texte des blocs text ; sources : seulement les résultats cités dans la réponse (blocs text avec citations)", () => {
    const res = parseClaudeMessages([CLAUDE_PAUSED, CLAUDE_DONE], "claude-opus-5-5")
    expect(res.answer).toBe("Voici les critères à regarder. Un devis doit porter les mentions obligatoires.")
    // constructor.co a été trouvé par la recherche mais n'est pas cité : ce n'est pas une citation
    expect(res.sources).toEqual([{ url: "https://qonforme.fr/guide/comment-faire-un-devis", domain: "qonforme.fr", title: "Comment faire un devis" }])
  })

  it("un résultat de recherche lu mais jamais cité ne compte pas comme citation (site ni concurrent)", () => {
    const uncited = { ...CLAUDE_DONE, content: [{ type: "text", text: "Comparez plusieurs logiciels avant de choisir.", citations: null }] }
    const res = parseClaudeMessages([CLAUDE_PAUSED, uncited], "claude-opus-5-5")
    expect(res.sources).toEqual([])
    expect(detect(res, { brandTerms: ["Qonforme"], competitors: ["constructor.co"] })).toMatchObject({ site_cited: false, competitors_cited: [] })
  })

  it("requête coupée par notre signal (APIUserAbortError du SDK) : délai dépassé, pas « service injoignable »", () => {
    const err = toEngineError(new Anthropic.APIUserAbortError(), 50_000)
    expect(err.code).toBe("timeout")
    expect(err.message).not.toMatch(/injoignable/)
    expect(toEngineError(new Anthropic.APIConnectionTimeoutError(), 50_000).code).toBe("timeout")
  })

  it("refus : erreur non renouvelable", () => {
    try {
      parseClaudeMessages([{ stop_reason: "refusal", content: [] }], "m")
      throw new Error("pas d'erreur")
    } catch (e) {
      expect(e).toBeInstanceOf(GeoEngineError)
      expect((e as GeoEngineError).retryable).toBe(false)
    }
  })
})

/* ------------------------------------------------------------------ */
/* Aperçu IA Google (DataForSEO)                                       */
/* ------------------------------------------------------------------ */

const DFS_WITH_OVERVIEW = {
  version: "0.1.20260901",
  status_code: 20000,
  status_message: "Ok.",
  cost: 0.004,
  tasks_count: 1,
  tasks_error: 0,
  tasks: [
    {
      id: "10091234-1535-0139-0000-abcdef",
      status_code: 20000,
      status_message: "Ok.",
      cost: 0.004,
      result: [
        {
          keyword: Q,
          type: "organic",
          se_domain: "google.fr",
          location_code: 2250,
          language_code: "fr",
          item_types: ["ai_overview", "organic"],
          items: [
            {
              type: "ai_overview",
              rank_group: 1,
              rank_absolute: 1,
              asynchronous_ai_overview: true,
              markdown: "Un **logiciel de devis** pour artisan doit gérer la TVA par ligne.",
              items: [
                {
                  type: "ai_overview_element",
                  title: null,
                  text: "Un logiciel de devis pour artisan doit gérer la TVA par ligne.",
                  references: [{ type: "ai_overview_reference", source: "Mediabat", domain: "www.mediabat.com", url: "https://www.mediabat.com/a", title: "Logiciel" }],
                },
              ],
              references: [{ type: "ai_overview_reference", source: "Qonforme", domain: "qonforme.fr", url: "https://qonforme.fr/guide/tva-travaux", title: "TVA des travaux" }],
            },
            { type: "organic", rank_group: 1, url: "https://example.fr" },
          ],
        },
      ],
    },
  ],
}

describe("Aperçu IA Google", () => {
  it("demande la France (2250), le français et l'Aperçu IA différé", () => {
    expect(aiOverviewRequest(Q, OPTS)).toEqual([
      { keyword: Q, location_code: 2250, language_code: "fr", device: "desktop", depth: 10, load_async_ai_overview: true },
    ])
  })

  it("lit le texte et les références de l'élément ai_overview", () => {
    const res = parseAiOverviewResponse(DFS_WITH_OVERVIEW)
    expect(res.answer).toBe("Un **logiciel de devis** pour artisan doit gérer la TVA par ligne.")
    expect(res.sources.map((s) => s.domain)).toEqual(["qonforme.fr", "mediabat.com"])
  })

  it("pas d'Aperçu IA pour la requête : réponse nulle, pas une erreur", () => {
    const without = JSON.parse(JSON.stringify(DFS_WITH_OVERVIEW))
    without.tasks[0].result[0].items = [{ type: "organic", url: "https://example.fr" }]
    expect(parseAiOverviewResponse(without)).toMatchObject({ answer: null, sources: [] })
    const noResults = { status_code: 20000, tasks: [{ status_code: 40102, status_message: "No Search Results." }] }
    expect(parseAiOverviewResponse(noResults).answer).toBeNull()
  })

  it("requête refusée : erreur explicite", () => {
    expect(() => parseAiOverviewResponse({ status_code: 40100, status_message: "You are not authorized." })).toThrow(/refusé/)
  })
})

/* ------------------------------------------------------------------ */
/* Appels simulés : délai, redirections, clés                          */
/* ------------------------------------------------------------------ */

describe("appels réseau (simulés)", () => {
  const saved = { ...process.env }
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "AIzaSyTESTKEY1234567890"
    process.env.OPENAI_API_KEY = "sk-proj-TESTKEY1234567890"
    process.env.ANTHROPIC_API_KEY = "sk-ant-TESTKEY1234567890"
    process.env.DATAFORSEO_LOGIN = "login@example.com"
    process.env.DATAFORSEO_PASSWORD = "secretpassword"
  })
  afterEach(() => {
    process.env = { ...saved }
    vi.unstubAllGlobals()
  })

  it("Gemini : clé en en-tête, HEAD sans suivre la redirection, jamais d'appel vers la destination", async () => {
    const calls: { url: string; init?: RequestInit }[] = []
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      if (init?.method === "HEAD") {
        return new Response(null, { status: 302, headers: { location: "https://www.qonforme.fr/guide/tva-travaux" } })
      }
      return new Response(JSON.stringify(GEMINI_RESPONSE), { status: 200 })
    })
    const res = await geminiEngine.ask(Q, OPTS)
    expect(calls[0].url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent")
    expect(calls[0].url).not.toContain("key=")
    expect((calls[0].init?.headers as Record<string, string>)["x-goog-api-key"]).toBe("AIzaSyTESTKEY1234567890")
    const heads = calls.filter((c) => c.init?.method === "HEAD")
    expect(heads).toHaveLength(2)
    heads.forEach((h) => {
      expect(new URL(h.url).hostname).toBe("vertexaisearch.cloud.google.com")
      expect(h.init?.redirect).toBe("manual")
    })
    expect(calls.some((c) => c.url.includes("qonforme.fr"))).toBe(false)
    expect(res.sources[0]).toMatchObject({ domain: "qonforme.fr", url: "https://www.qonforme.fr/guide/tva-travaux" })
  })

  it("erreur HTTP : message en français, sans la clé", async () => {
    vi.stubGlobal("fetch", async () =>
      new Response(JSON.stringify({ error: { message: "Incorrect API key provided: sk-proj-TESTKEY1234567890." } }), { status: 401 }),
    )
    const err = await chatgptEngine.ask(Q, OPTS).catch((e) => e)
    expect(err).toBeInstanceOf(GeoEngineError)
    expect(err.message).toMatch(/clé refusée/)
    expect(err.message).not.toContain("TESTKEY")
    expect(err.retryable).toBe(false)
  })

  it("délai dépassé : erreur « timeout » renouvelable", async () => {
    vi.stubGlobal("fetch", async () => {
      throw Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" })
    })
    const err = await googleAiOverviewEngine.ask(Q, { ...OPTS, timeoutMs: 5_000 }).catch((e) => e)
    expect(err).toBeInstanceOf(GeoEngineError)
    expect(err.code).toBe("timeout")
    expect(err.retryable).toBe(true)
  })

  it("DataForSEO : authentification Basic", async () => {
    let auth = ""
    vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
      auth = (init?.headers as Record<string, string>).authorization
      return new Response(JSON.stringify(DFS_WITH_OVERVIEW), { status: 200 })
    })
    await googleAiOverviewEngine.ask(Q, OPTS)
    expect(auth).toBe(`Basic ${Buffer.from("login@example.com:secretpassword").toString("base64")}`)
  })

  it("Claude : reprise après pause_turn avec la réponse en tour « assistant », sans message ajouté", async () => {
    const bodies: { messages: { role: string; content: unknown }[]; tools: unknown[]; model: string }[] = []
    const replies = [CLAUDE_PAUSED, CLAUDE_DONE]
    vi.stubGlobal("fetch", async (_url: string | URL | Request, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)))
      return new Response(JSON.stringify(replies[bodies.length - 1]), { status: 200, headers: { "content-type": "application/json" } })
    })
    const res = await claudeEngine.ask(Q, OPTS)
    expect(bodies).toHaveLength(2)
    expect(bodies[0].model).toBe("claude-opus-5-5")
    expect(bodies[0].tools).toEqual([
      { type: "web_search_20260209", name: "web_search", max_uses: 3, user_location: { type: "approximate", country: "FR", timezone: "Europe/Paris" } },
    ])
    expect(bodies[1].messages).toHaveLength(2)
    expect(bodies[1].messages[1].role).toBe("assistant")
    expect(res.answer).toContain("mentions obligatoires")
    expect(res.sources.some((s) => s.domain === "qonforme.fr")).toBe(true)
  })

  it("masque les clés dans un texte de fournisseur", () => {
    expect(redact("key sk-proj-abcdef123456 et AIzaSyABCDEFGHIJKLMN", [])).toBe("key *** et ***")
    expect(redact("mot secretpassword ici", ["DATAFORSEO_PASSWORD"])).toBe("mot *** ici")
  })
})
