import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type Anthropic from "@anthropic-ai/sdk"
import { SETTINGS_DEFAULTS } from "@/lib/seo/settings-schema"
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_PLAN_MODEL,
  DEFAULT_REVIEW_MODEL,
  DEFAULT_TEXT_MODEL,
  IMAGE_MODELS,
  TEXT_MODELS,
  findImageModel,
  findTextModel,
  generateImage,
  generateText,
  imageModelOptions,
  ModelError,
  parseInteractionImage,
  passesSummary,
  resolvePassModel,
  setAnthropicFactoryForTests,
  setSleepForTests,
  textFallbackChain,
  textModelOptions,
} from "@/lib/seo/articles/models"

const PNG = Buffer.from("image").toString("base64")
const env = { ...process.env }

/** Pauses demandées entre deux essais d'un appel (jamais attendues dans les tests). */
let pauses: number[] = []

beforeEach(() => {
  process.env.GEMINI_API_KEY = "cle-gemini-test"
  process.env.ANTHROPIC_API_KEY = "cle-anthropic-test"
  pauses = []
  setSleepForTests(async (ms) => {
    pauses.push(ms)
  })
})

afterEach(() => {
  process.env = { ...env }
  vi.unstubAllGlobals()
  setAnthropicFactoryForTests(null)
  setSleepForTests(null)
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

describe("registre des modèles", () => {
  it("les modèles par défaut sont ceux des réglages, et tous existent", () => {
    expect(DEFAULT_PLAN_MODEL).toBe(SETTINGS_DEFAULTS.articles.planModel)
    expect(DEFAULT_TEXT_MODEL).toBe(SETTINGS_DEFAULTS.articles.textModel)
    expect(DEFAULT_REVIEW_MODEL).toBe(SETTINGS_DEFAULTS.articles.reviewModel)
    expect(DEFAULT_IMAGE_MODEL).toBe(SETTINGS_DEFAULTS.articles.imageModel)
    for (const id of [DEFAULT_PLAN_MODEL, DEFAULT_TEXT_MODEL, DEFAULT_REVIEW_MODEL]) expect(findTextModel(id)).not.toBeNull()
    expect(findImageModel(DEFAULT_IMAGE_MODEL)).not.toBeNull()
  })

  it("prix indicatifs relevés le 09/10/2026 et réflexion par modèle", () => {
    expect(findTextModel("gemini-3.8-flash")).toMatchObject({ inputPerMTok: 0.75, outputPerMTok: 3.75, envKey: "GEMINI_API_KEY" })
    expect(findTextModel("claude-opus-5-5")).toMatchObject({ inputPerMTok: 4, outputPerMTok: 20, thinking: "always", envKey: "ANTHROPIC_API_KEY" })
    expect(findTextModel("claude-sonnet-5-5")).toMatchObject({ thinking: "adaptive" })
    expect(findTextModel("claude-haiku-5-5")).toMatchObject({ thinking: "adaptive" })
    expect(findTextModel("gemini-2.5-flash")?.legacy).toBeTruthy()
    expect(findImageModel("gemini-nano-banana-2.1")).toMatchObject({ api: "interactions", fallback: "gemini-3.1-flash-image", perImage: 0.0504 })
    expect(findImageModel("gemini-3.1-flash-image")).toMatchObject({ api: "generateContent", perImage: 0.101 })
    // L'ancien identifiant reste reconnu, appelé sur le code stable, et n'est pas proposé
    expect(findImageModel("gemini-3.1-flash-image-preview")?.apiModel).toBe("gemini-3.1-flash-image")
    expect(imageModelOptions().map((o) => o.id)).not.toContain("gemini-3.1-flash-image-preview")
    expect(IMAGE_MODELS.some((m) => m.id.startsWith("imagen"))).toBe(false)
    expect(new Set(TEXT_MODELS.map((m) => m.id)).size).toBe(TEXT_MODELS.length)
  })

  it("les menus disent si la clé est présente, sans jamais la rendre", () => {
    delete process.env.ANTHROPIC_API_KEY
    const options = textModelOptions()
    expect(options.find((o) => o.id === "claude-opus-5-5")?.available).toBe(false)
    expect(options.find((o) => o.id === "gemini-3.8-flash")?.available).toBe(true)
    expect(JSON.stringify(options)).not.toContain("cle-gemini-test")
  })

  it("repli sur le modèle du plan quand la clé d'une passe manque", () => {
    const onlyGemini = (e: string) => e === "GEMINI_API_KEY"
    expect(resolvePassModel("claude-opus-5-5", "gemini-3.8-flash", onlyGemini)).toEqual({
      model: "gemini-3.8-flash",
      requested: "claude-opus-5-5",
      fallbackReason: "Clé ANTHROPIC_API_KEY absente",
    })
    expect(resolvePassModel("claude-opus-5-5", "gemini-3.8-flash", () => true)).toEqual({ model: "claude-opus-5-5", requested: "claude-opus-5-5", fallbackReason: null })
    expect(resolvePassModel("modele-inconnu", "gemini-3.8-flash", () => true).fallbackReason).toMatch(/inconnu/)
    // Aucune clé utilisable : on garde le modèle demandé (l'appel dira « Clé … absente »)
    expect(resolvePassModel("claude-opus-5-5", "gemini-3.8-flash", () => false).model).toBe("claude-opus-5-5")
    // Claude partout (réglages par défaut) et clé Anthropic pas encore ajoutée : Gemini prend la passe, sans erreur
    expect(resolvePassModel("claude-opus-5-5", "claude-sonnet-5-5", onlyGemini)).toEqual({
      model: "gemini-3.8-flash",
      requested: "claude-opus-5-5",
      fallbackReason: "Clé ANTHROPIC_API_KEY absente",
    })
    expect(resolvePassModel("claude-sonnet-5-5", "claude-sonnet-5-5", onlyGemini)).toMatchObject({ model: "gemini-3.8-flash", fallbackReason: "Clé ANTHROPIC_API_KEY absente" })
    expect(resolvePassModel("claude-sonnet-5-5", "claude-sonnet-5-5", () => true)).toEqual({ model: "claude-sonnet-5-5", requested: "claude-sonnet-5-5", fallbackReason: null })
  })

  it("résume les modèles par passe pour la fenêtre « Générer »", () => {
    expect(passesSummary({ plan: "claude-sonnet-5-5", write: "claude-opus-5-5", review: "claude-sonnet-5-5" })).toBe(
      "Plan et contrôle par Claude Sonnet 5.5 · rédaction par Claude Opus 5.5",
    )
    expect(passesSummary({ plan: "gemini-3.8-flash", write: "claude-opus-5-5", review: "claude-sonnet-5-5" })).toBe(
      "Plan par Gemini 3.8 Flash · rédaction par Claude Opus 5.5 · contrôle par Claude Sonnet 5.5",
    )
  })
})

describe("rédaction par Gemini (generateContent)", () => {
  it("envoie la clé dans l'en-tête, jamais dans l'adresse, et lit le texte hors réflexion", async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () =>
      json({ candidates: [{ content: { parts: [{ text: "pensée", thought: true }, { text: "Texte final" }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, thoughtsTokenCount: 7 } }),
    )
    vi.stubGlobal("fetch", fetchMock)
    const res = await generateText({ model: "gemini-3.8-flash", system: "S", prompt: "P", maxOutputTokens: 1000, json: { schema: {} } })
    expect(res).toEqual({ text: "Texte final", model: "gemini-3.8-flash", usage: { inputTokens: 10, outputTokens: 12 } })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent")
    expect(url).not.toContain("cle-gemini-test")
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("cle-gemini-test")
    const body = JSON.parse(String(init.body))
    expect(body.generationConfig).toEqual({ maxOutputTokens: 1000, responseMimeType: "application/json" })
    expect(body.systemInstruction.parts[0].text).toBe("S")
  })

  it("réponse coupée, refus et clé absente sont des erreurs claires", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ candidates: [{ content: { parts: [{ text: "début" }] }, finishReason: "MAX_TOKENS" }] })))
    await expect(generateText({ model: "gemini-3.8-flash", system: "S", prompt: "P", maxOutputTokens: 10 })).rejects.toMatchObject({ kind: "truncated" })
    vi.stubGlobal("fetch", vi.fn(async () => json({ candidates: [{ finishReason: "SAFETY" }] })))
    await expect(generateText({ model: "gemini-3.8-flash", system: "S", prompt: "P", maxOutputTokens: 10 })).rejects.toMatchObject({ kind: "refused", retryable: false })
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: { message: "API key AIzaSyDUMMYDUMMYDUMMYDUMMYDUMMY invalid" } }, 400)))
    const err = await generateText({ model: "gemini-3.8-flash", system: "S", prompt: "P", maxOutputTokens: 10 }).catch((e: ModelError) => e)
    expect(err).toBeInstanceOf(ModelError)
    expect((err as ModelError).message).not.toContain("AIzaSyDUMMY")
    delete process.env.GEMINI_API_KEY
    await expect(generateText({ model: "gemini-3.8-flash", system: "S", prompt: "P", maxOutputTokens: 10 })).rejects.toMatchObject({
      kind: "not_configured",
      message: expect.stringContaining("GEMINI_API_KEY"),
    })
  })
})

describe("rédaction par Claude (SDK, en flux)", () => {
  function fakeClient(message: Partial<Anthropic.Message>, seen: { params?: Record<string, unknown> }) {
    return () =>
      ({
        messages: {
          stream: (params: Record<string, unknown>) => {
            seen.params = params
            return { finalMessage: async () => ({ content: [], stop_reason: "end_turn", usage: { input_tokens: 3, output_tokens: 4 }, ...message }) }
          },
        },
      }) as unknown as Anthropic

  }

  it("Opus 5.5 : aucun réglage de réflexion ni budget ; Sonnet 5.5 : réflexion adaptative ; sortie structurée", async () => {
    const seen: { params?: Record<string, unknown> } = {}
    setAnthropicFactoryForTests(fakeClient({ content: [{ type: "text", text: "Article", citations: null }] as Anthropic.Message["content"] }, seen))
    const res = await generateText({ model: "claude-opus-5-5", system: "S", prompt: "P", maxOutputTokens: 32_000 })
    expect(res.text).toBe("Article")
    expect(seen.params).toMatchObject({ model: "claude-opus-5-5", max_tokens: 32_000, system: "S" })
    expect(seen.params).not.toHaveProperty("thinking")
    expect(JSON.stringify(seen.params)).not.toContain("budget_tokens")

    await generateText({ model: "claude-sonnet-5-5", system: "S", prompt: "P", maxOutputTokens: 1000, json: { schema: { type: "object" } } })
    expect(seen.params).toMatchObject({ thinking: { type: "adaptive" }, output_config: { format: { type: "json_schema", schema: { type: "object" } } } })
  })

  it("gère le refus et la réponse coupée", async () => {
    setAnthropicFactoryForTests(fakeClient({ stop_reason: "refusal" }, {}))
    await expect(generateText({ model: "claude-opus-5-5", system: "S", prompt: "P", maxOutputTokens: 100 })).rejects.toMatchObject({ kind: "refused", retryable: false })
    setAnthropicFactoryForTests(fakeClient({ stop_reason: "max_tokens", content: [{ type: "text", text: "dé", citations: null }] as Anthropic.Message["content"] }, {}))
    await expect(generateText({ model: "claude-opus-5-5", system: "S", prompt: "P", maxOutputTokens: 100 })).rejects.toMatchObject({ kind: "truncated" })
  })
})

describe("surcharge du fournisseur : nouveaux essais puis repli", () => {
  const ASK = { model: "gemini-3.8-flash", system: "S", prompt: "P", maxOutputTokens: 100 }
  const OK = { candidates: [{ content: { parts: [{ text: "Texte" }] }, finishReason: "STOP" }] }

  function fakeClaude(text: string, seen: { params?: Record<string, unknown> } = {}) {
    return () =>
      ({
        messages: {
          stream: (params: Record<string, unknown>) => {
            seen.params = params
            return { finalMessage: async () => ({ content: [{ type: "text", text, citations: null }], stop_reason: "end_turn", usage: { input_tokens: 3, output_tokens: 4 } }) }
          },
        },
      }) as unknown as Anthropic
  }

  it("un 503 passager est rejoué après 2 s puis 6 s, et l'appel aboutit", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json({ error: { message: "overloaded" } }, 503)).mockResolvedValueOnce(json({}, 503)).mockResolvedValueOnce(json(OK))
    vi.stubGlobal("fetch", fetchMock)
    const res = await generateText(ASK)
    expect(res.text).toBe("Texte")
    expect(res.fallbackFrom).toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(pauses).toEqual([2_000, 6_000])
  })

  it("429, 500, 502 et 504 sont rejoués comme 503 ; 400, 401 et 404 ne le sont jamais", async () => {
    for (const status of [429, 500, 502, 504]) {
      const fetchMock = vi.fn().mockResolvedValueOnce(json({}, status)).mockResolvedValueOnce(json(OK))
      vi.stubGlobal("fetch", fetchMock)
      await expect(generateText(ASK)).resolves.toMatchObject({ text: "Texte" })
      expect(fetchMock).toHaveBeenCalledTimes(2)
    }
    for (const status of [400, 401, 403, 404]) {
      const fetchMock = vi.fn(async () => json({ error: { message: "non" } }, status))
      vi.stubGlobal("fetch", fetchMock)
      await expect(generateText(ASK)).rejects.toBeInstanceOf(ModelError)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    }
    expect(pauses).toEqual([2_000, 2_000, 2_000, 2_000])
  })

  it("« Retry-After » est respecté, borné entre 1 s et 10 s", async () => {
    const withRetryAfter = (value: string, status = 503) => new Response("{}", { status, headers: { "Retry-After": value } })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(withRetryAfter("4")).mockResolvedValueOnce(withRetryAfter("120")).mockResolvedValueOnce(json(OK)))
    await generateText(ASK)
    expect(pauses).toEqual([4_000, 10_000])
    pauses = []
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(withRetryAfter("pas un nombre")).mockResolvedValueOnce(json(OK)))
    await generateText(ASK)
    expect(pauses).toEqual([2_000])
  })

  it("sans assez de temps devant soi, l'appel n'est pas rejoué", async () => {
    const fetchMock = vi.fn(async () => json({}, 503))
    vi.stubGlobal("fetch", fetchMock)
    await expect(generateText({ ...ASK, model: "gemini-3.8-flash", timeoutMs: 10_000 })).rejects.toMatchObject({ kind: "http", retryable: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(pauses).toEqual([])
  })

  it("un délai dépassé n'est jamais rejoué ni remplacé par un autre modèle", async () => {
    const fetchMock = vi.fn(async () => {
      throw Object.assign(new Error("délai"), { name: "TimeoutError" })
    })
    vi.stubGlobal("fetch", fetchMock)
    const seen: { params?: Record<string, unknown> } = {}
    setAnthropicFactoryForTests(fakeClaude("Repli", seen))
    await expect(generateText(ASK)).rejects.toMatchObject({ kind: "timeout" })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(seen.params).toBeUndefined()
  })

  it("Gemini toujours surchargé après trois essais : Claude Sonnet 5.5 prend la même consigne, et le dit", async () => {
    const fetchMock = vi.fn(async () => json({}, 503))
    vi.stubGlobal("fetch", fetchMock)
    const seen: { params?: Record<string, unknown> } = {}
    setAnthropicFactoryForTests(fakeClaude("Plan de repli", seen))
    const res = await generateText({ ...ASK, system: "Consigne système", prompt: "Consigne" })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(res).toMatchObject({ text: "Plan de repli", model: "claude-sonnet-5-5", fallbackFrom: { model: "gemini-3.8-flash", reason: "Gemini indisponible (503)" } })
    expect(seen.params).toMatchObject({ model: "claude-sonnet-5-5", system: "Consigne système" })
  })

  it("Claude Opus 5.5 indisponible : repli sur Claude Sonnet 5.5 ; si Sonnet l'est aussi, sur Gemini 3.8 Flash", async () => {
    const calls: string[] = []
    setAnthropicFactoryForTests(
      () =>
        ({
          messages: {
            stream: (params: { model: string }) => {
              calls.push(params.model)
              return {
                finalMessage: async () => {
                  if (params.model === "claude-opus-5-5") throw Object.assign(new Error("overloaded"), { name: "InternalServerError" })
                  return { content: [{ type: "text", text: "Rédigé par Sonnet", citations: null }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } }
                },
              }
            },
          },
        }) as unknown as Anthropic,
    )
    // Erreur générique du SDK : « Appel au modèle impossible » est une panne passagère (http), donc éligible au repli
    const res = await generateText({ model: "claude-opus-5-5", system: "S", prompt: "P", maxOutputTokens: 100 })
    expect(res).toMatchObject({ text: "Rédigé par Sonnet", model: "claude-sonnet-5-5", fallbackFrom: { model: "claude-opus-5-5" } })
    expect(calls).toEqual(["claude-opus-5-5", "claude-sonnet-5-5"])

    // Toute la famille Claude en panne : Gemini prend le relais, avec le motif de la première panne
    calls.length = 0
    setAnthropicFactoryForTests(
      () =>
        ({
          messages: {
            stream: (params: { model: string }) => {
              calls.push(params.model)
              return { finalMessage: async () => Promise.reject(Object.assign(new Error("overloaded"), { name: "InternalServerError" })) }
            },
          },
        }) as unknown as Anthropic,
    )
    const fetchMock = vi.fn(async () => json(OK))
    vi.stubGlobal("fetch", fetchMock)
    const all = await generateText({ model: "claude-opus-5-5", system: "S", prompt: "P", maxOutputTokens: 100 })
    expect(calls).toEqual(["claude-opus-5-5", "claude-sonnet-5-5"])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(all).toMatchObject({ text: "Texte", model: "gemini-3.8-flash", fallbackFrom: { model: "claude-opus-5-5", reason: "Appel au modèle impossible pour le moment" } })
  })

  it("la chaîne de repli du registre : Opus → Sonnet → Gemini, jamais deux fois le même modèle", () => {
    const ids = (id: string) => textFallbackChain(findTextModel(id)!).map((m) => m.id)
    expect(ids("claude-opus-5-5")).toEqual(["claude-sonnet-5-5", "gemini-3.8-flash"])
    expect(ids("claude-sonnet-5-5")).toEqual(["gemini-3.8-flash"])
    expect(ids("claude-haiku-5-5")).toEqual(["gemini-3.8-flash", "claude-sonnet-5-5"])
    expect(ids("gemini-3.8-flash")).toEqual(["claude-sonnet-5-5"])
    expect(ids("gemini-2.5-flash")).toEqual([])
  })

  it("sans clé du modèle de repli, ou si le repli échoue aussi, l'erreur d'origine est rendue", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({}, 503)))
    delete process.env.ANTHROPIC_API_KEY
    await expect(generateText(ASK)).rejects.toMatchObject({ kind: "http", message: expect.stringContaining("Gemini indisponible (503)") })

    process.env.ANTHROPIC_API_KEY = "cle-anthropic-test"
    setAnthropicFactoryForTests(
      () =>
        ({
          messages: { stream: () => ({ finalMessage: async () => ({ content: [], stop_reason: "refusal", usage: {} }) }) },
        }) as unknown as Anthropic,
    )
    await expect(generateText(ASK)).rejects.toMatchObject({ kind: "http", message: expect.stringContaining("Gemini indisponible (503)") })
  })

  it("une réponse vide, coupée ou refusée ne déclenche pas de repli : le fournisseur répond", async () => {
    const seen: { params?: Record<string, unknown> } = {}
    setAnthropicFactoryForTests(fakeClaude("Repli", seen))
    vi.stubGlobal("fetch", vi.fn(async () => json({ candidates: [{ content: { parts: [] }, finishReason: "STOP" }] })))
    await expect(generateText(ASK)).rejects.toMatchObject({ kind: "empty" })
    vi.stubGlobal("fetch", vi.fn(async () => json({ candidates: [{ finishReason: "SAFETY" }] })))
    await expect(generateText(ASK)).rejects.toMatchObject({ kind: "refused" })
    expect(seen.params).toBeUndefined()
  })

  it("le registre : chaque repli existe, diffère du modèle et n'est jamais un ancien modèle", () => {
    for (const def of TEXT_MODELS) {
      if (!def.fallback) continue
      const fb = findTextModel(def.fallback)
      expect(fb, def.id).not.toBeNull()
      expect(fb?.id).not.toBe(def.id)
      expect(fb?.legacy).toBeUndefined()
    }
    expect(findTextModel("gemini-3.8-flash")?.fallback).toBe("claude-sonnet-5-5")
    expect(findTextModel("claude-opus-5-5")?.fallback).toBe("claude-sonnet-5-5")
  })
})

describe("image de couverture", () => {
  it("lit l'image d'une interaction (schéma steps, ancien schéma outputs, raccourci output_image)", () => {
    expect(
      parseInteractionImage({
        id: "int_1",
        status: "completed",
        steps: [
          { type: "user_input", content: [{ type: "text", text: "consigne" }] },
          { type: "model_output", content: [{ type: "text", text: "Voici" }, { type: "image", data: PNG, mime_type: "image/jpeg" }] },
        ],
      }),
    ).toEqual({ data: PNG, mimeType: "image/jpeg" })
    expect(parseInteractionImage({ outputs: [{ type: "image", data: PNG, mime_type: "image/png" }] })).toEqual({ data: PNG, mimeType: "image/png" })
    expect(parseInteractionImage({ output_image: { data: PNG } })).toEqual({ data: PNG, mimeType: "image/jpeg" })
    expect(() => parseInteractionImage({ status: "failed" })).toThrow(/statut « failed »/)
    expect(() => parseInteractionImage({ status: "completed", steps: [{ type: "model_output", content: [{ type: "text", text: "non" }] }] })).toThrow(/Aucune image/)
    expect(() => parseInteractionImage({ error: { message: "quota" } })).toThrow(/erreur/)
    expect(() => parseInteractionImage(null)).toThrow()
  })

  it("Nano Banana 2.1 par l'API Interactions en 16:9 et 2K", async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => json({ status: "completed", steps: [{ type: "model_output", content: [{ type: "image", data: PNG, mime_type: "image/jpeg" }] }] }))
    vi.stubGlobal("fetch", fetchMock)
    const image = await generateImage({ model: "gemini-nano-banana-2.1", prompt: "photo", aspect: "16:9" })
    expect(image).toMatchObject({ model: "gemini-nano-banana-2.1", mimeType: "image/jpeg" })
    expect(image.fallbackFrom).toBeUndefined()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/interactions")
    expect(JSON.parse(String(init.body))).toEqual({
      model: "gemini-nano-banana-2.1",
      input: [{ type: "text", text: "photo" }],
      response_format: { type: "image", mime_type: "image/jpeg", aspect_ratio: "16:9", image_size: "2K" },
    })
  })

  it("repli automatique sur gemini-3.1-flash-image (generateContent) si Nano Banana 2.1 échoue", async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async (url) =>
      url.endsWith("/interactions")
        ? json({ error: { message: "indisponible" } }, 503)
        : json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: PNG } }] } }] }),
    )
    vi.stubGlobal("fetch", fetchMock)
    const image = await generateImage({ model: "gemini-nano-banana-2.1", prompt: "photo", aspect: "16:9" })
    expect(image.model).toBe("gemini-3.1-flash-image")
    expect(image.fallbackFrom?.model).toBe("gemini-nano-banana-2.1")
    expect(image.data.toString()).toBe("image")
    const second = fetchMock.mock.calls[1]
    expect(second[0]).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent")
    expect(JSON.parse(String(second[1].body)).generationConfig.imageConfig).toEqual({ aspectRatio: "16:9", imageSize: "2K" })
  })

  it("repli aussi quand la réponse n'a pas d'image ; erreur si le repli échoue", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => (url.endsWith("/interactions") ? json({ status: "completed", steps: [] }) : json({ candidates: [{ content: { parts: [] } }] }))),
    )
    await expect(generateImage({ model: "gemini-nano-banana-2.1", prompt: "photo", aspect: "16:9" })).rejects.toMatchObject({ kind: "empty" })
  })
})
