/**
 * Appels aux modèles de rédaction et d'image, indépendants du fournisseur.
 *
 * - Gemini : `fetch` vers generateContent, clé dans l'en-tête x-goog-api-key.
 * - Claude : SDK officiel @anthropic-ai/sdk, en flux (`messages.stream` puis
 *   `finalMessage()`) pour les longues sorties. Haiku 5.5 et Sonnet 5.5 :
 *   réflexion adaptative ; Opus 5.5 : réflexion toujours active (aucun réglage
 *   `thinking`, jamais de `budget_tokens`).
 *
 * Côté serveur seulement. Aucune clé n'est rendue, journalisée ni placée dans
 * un message d'erreur. Le registre (sans réseau) est dans model-registry.ts.
 */
import Anthropic from "@anthropic-ai/sdk"
import {
  COVER_IMAGE_SIZE,
  IMAGE_MODELS,
  TEXT_MODELS,
  findImageModel,
  findTextModel,
  imagePriceLabel,
  textPriceLabel,
  type ImageModelDef,
  type ModelKeyEnv,
  type ModelOption,
  type TextModelDef,
} from "@/lib/seo/articles/model-registry"

export * from "@/lib/seo/articles/model-registry"

const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta"
const DEFAULT_TIMEOUT_MS = 240_000

export type ModelErrorKind = "not_configured" | "unknown_model" | "refused" | "truncated" | "empty" | "http" | "timeout"

/** Erreur d'un appel de modèle, avec un message en français sûr à afficher. */
export class ModelError extends Error {
  readonly kind: ModelErrorKind
  /** Faux : réessayer ne sert à rien (clé absente, modèle inconnu, refus). */
  readonly retryable: boolean
  constructor(kind: ModelErrorKind, message: string, retryable = kind === "http" || kind === "timeout" || kind === "empty" || kind === "truncated") {
    super(message)
    this.name = "ModelError"
    this.kind = kind
    this.retryable = retryable
  }
}

export function hasKey(env: ModelKeyEnv): boolean {
  return Boolean(process.env[env]?.trim())
}

export function isTextModelAvailable(def: TextModelDef): boolean {
  return hasKey(def.envKey)
}

export function isImageModelAvailable(def: ImageModelDef): boolean {
  return hasKey(def.envKey)
}

/** Menus de Préférences et de la fenêtre « Générer un article » (présence des clés seulement). */
export function textModelOptions(): ModelOption[] {
  return TEXT_MODELS.map((m) => ({
    id: m.id,
    label: m.label,
    provider: m.provider,
    envKey: m.envKey,
    price: textPriceLabel(m),
    available: isTextModelAvailable(m),
    ...(m.legacy ? { legacy: m.legacy } : {}),
  }))
}

/** Modèles d'image des menus (sans les anciens identifiants gardés pour un réglage enregistré). */
export function imageModelOptions(): ModelOption[] {
  return IMAGE_MODELS.filter((m) => !m.hidden).map((m) => ({
    id: m.id,
    label: m.label,
    provider: m.provider,
    envKey: m.envKey,
    price: imagePriceLabel(m),
    available: isImageModelAvailable(m),
    ...(m.fallback ? { fallback: m.fallback } : {}),
  }))
}

/* ------------------------------------------------------------------ */
/* Texte                                                               */
/* ------------------------------------------------------------------ */

export interface GenerateTextInput {
  /** Identifiant du registre (« gemini-2.5-flash », « claude-opus-5-5 »…). */
  model: string
  system: string
  prompt: string
  /** Sortie maximale, réflexion comprise. */
  maxOutputTokens: number
  /**
   * Sortie JSON : Gemini reçoit responseMimeType « application/json », Claude le
   * schéma en sortie structurée (output_config.format). Le résultat est validé
   * par l'appelant.
   */
  json?: { schema: Record<string, unknown> }
  /** Délai maximal de l'appel (ms). */
  timeoutMs?: number
}

export interface GenerateTextResult {
  text: string
  model: string
  usage: { inputTokens: number | null; outputTokens: number | null }
}

function requireKey(env: ModelKeyEnv): string {
  const key = process.env[env]?.trim()
  if (!key) throw new ModelError("not_configured", `Clé ${env} absente : ajoutez-la dans les variables d'environnement (Paramètres › Connexions).`)
  return key
}

export async function generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
  const def = findTextModel(input.model)
  if (!def) throw new ModelError("unknown_model", `Modèle de rédaction inconnu : ${input.model}.`)
  const key = requireKey(def.envKey)
  const maxOutputTokens = Math.min(input.maxOutputTokens, def.maxOutputTokens)
  const timeoutMs = Math.max(5_000, input.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  return def.provider === "anthropic"
    ? anthropicText(def, key, { ...input, maxOutputTokens }, timeoutMs)
    : geminiText(def, key, { ...input, maxOutputTokens }, timeoutMs)
}

/** Client Anthropic : remplaçable dans les tests. */
let anthropicFactory: (apiKey: string) => Anthropic = (apiKey) => new Anthropic({ apiKey, maxRetries: 1 })

export function setAnthropicFactoryForTests(factory: ((apiKey: string) => Anthropic) | null): void {
  anthropicFactory = factory ?? ((apiKey) => new Anthropic({ apiKey, maxRetries: 1 }))
}

async function anthropicText(def: TextModelDef, key: string, input: GenerateTextInput, timeoutMs: number): Promise<GenerateTextResult> {
  const client = anthropicFactory(key)
  const params: Anthropic.MessageStreamParams = {
    model: def.apiModel,
    max_tokens: input.maxOutputTokens,
    system: input.system,
    messages: [{ role: "user", content: input.prompt }],
  }
  // Opus 5.5 : réflexion toujours active, aucun réglage accepté (ni « disabled » ni budget).
  if (def.thinking === "adaptive") params.thinking = { type: "adaptive" }
  if (input.json) params.output_config = { format: { type: "json_schema", schema: input.json.schema } }

  let message: Anthropic.Message
  try {
    const stream = client.messages.stream(params, { timeout: timeoutMs, signal: AbortSignal.timeout(timeoutMs) })
    message = await stream.finalMessage()
  } catch (error) {
    throw anthropicError(error)
  }

  if (message.stop_reason === "refusal") {
    throw new ModelError("refused", "Le modèle a refusé de rédiger ce contenu. Reformulez le sujet ou changez de modèle.", false)
  }
  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim()
  if (message.stop_reason === "max_tokens") {
    throw new ModelError("truncated", "La réponse du modèle a été coupée (longueur maximale atteinte).")
  }
  if (!text) throw new ModelError("empty", "Le modèle n'a rien renvoyé.")
  return {
    text,
    model: def.id,
    usage: { inputTokens: message.usage?.input_tokens ?? null, outputTokens: message.usage?.output_tokens ?? null },
  }
}

function anthropicError(error: unknown): ModelError {
  if (error instanceof ModelError) return error
  if (error instanceof Anthropic.APIUserAbortError || error instanceof Anthropic.APIConnectionTimeoutError) {
    return new ModelError("timeout", "Le modèle n'a pas répondu à temps. Nouvel essai au prochain passage.")
  }
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new ModelError("not_configured", "Clé ANTHROPIC_API_KEY refusée par Anthropic : vérifiez-la dans les variables d'environnement.", false)
  }
  if (error instanceof Anthropic.NotFoundError) {
    return new ModelError("unknown_model", "Modèle indisponible chez Anthropic.", false)
  }
  if (error instanceof Anthropic.BadRequestError) {
    return new ModelError("http", `Requête refusée par Anthropic (400) : ${shortMessage(error.message)}`, false)
  }
  if (error instanceof Anthropic.APIError) {
    return new ModelError("http", `Anthropic indisponible (${error.status ?? "réseau"}). Nouvel essai au prochain passage.`)
  }
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return new ModelError("timeout", "Le modèle n'a pas répondu à temps. Nouvel essai au prochain passage.")
  }
  return new ModelError("http", "Appel au modèle impossible pour le moment.")
}

interface GeminiPart {
  text?: string
  thought?: boolean
  inlineData?: { mimeType?: string; data?: string }
}

interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[]
  promptFeedback?: { blockReason?: string }
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number }
  error?: { message?: string }
}

const GEMINI_REFUSALS = new Set(["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION", "IMAGE_SAFETY", "IMAGE_PROHIBITED_CONTENT"])

async function geminiCall(apiModel: string, key: string, body: unknown, timeoutMs: number): Promise<GeminiResponse> {
  let res: Response
  try {
    res = await fetch(`${GEMINI_API}/models/${encodeURIComponent(apiModel)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new ModelError("timeout", "Gemini n'a pas répondu à temps. Nouvel essai au prochain passage.")
    }
    throw new ModelError("http", "Gemini injoignable pour le moment.")
  }
  const data = (await res.json().catch(() => ({}))) as GeminiResponse
  if (!res.ok) {
    const detail = shortMessage(data.error?.message ?? "")
    if (res.status === 401 || res.status === 403) {
      throw new ModelError("not_configured", "Clé GEMINI_API_KEY refusée par Google : vérifiez-la dans les variables d'environnement.", false)
    }
    if (res.status === 404) throw new ModelError("unknown_model", `Modèle ${apiModel} indisponible chez Google.`, false)
    if (res.status === 400) throw new ModelError("http", `Requête refusée par Gemini (400)${detail ? ` : ${detail}` : ""}`, false)
    throw new ModelError("http", `Gemini indisponible (${res.status}). Nouvel essai au prochain passage.`)
  }
  if (data.promptFeedback?.blockReason) {
    throw new ModelError("refused", "Gemini a refusé la consigne. Reformulez le sujet ou changez de modèle.", false)
  }
  return data
}

async function geminiText(def: TextModelDef, key: string, input: GenerateTextInput, timeoutMs: number): Promise<GenerateTextResult> {
  const data = await geminiCall(
    def.apiModel,
    key,
    {
      systemInstruction: { parts: [{ text: input.system }] },
      contents: [{ role: "user", parts: [{ text: input.prompt }] }],
      generationConfig: {
        // Gemini 3 : température par défaut du modèle (conseil de Google) ; Gemini 2.5 : 0,7 comme l'ancien générateur
        ...(def.temperature !== undefined ? { temperature: def.temperature } : {}),
        maxOutputTokens: input.maxOutputTokens,
        ...(input.json ? { responseMimeType: "application/json" } : {}),
      },
    },
    timeoutMs,
  )
  const candidate = data.candidates?.[0]
  const reason = candidate?.finishReason
  if (reason && GEMINI_REFUSALS.has(reason)) {
    throw new ModelError("refused", "Gemini a refusé de rédiger ce contenu. Reformulez le sujet ou changez de modèle.", false)
  }
  const text = (candidate?.content?.parts ?? [])
    .filter((p) => typeof p.text === "string" && !p.thought)
    .map((p) => p.text)
    .join("")
    .trim()
  if (reason === "MAX_TOKENS") throw new ModelError("truncated", "La réponse du modèle a été coupée (longueur maximale atteinte).")
  if (!text) throw new ModelError("empty", "Le modèle n'a rien renvoyé.")
  const u = data.usageMetadata
  return {
    text,
    model: def.id,
    usage: {
      inputTokens: u?.promptTokenCount ?? null,
      outputTokens: u ? (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0) : null,
    },
  }
}

/* ------------------------------------------------------------------ */
/* Image                                                               */
/* ------------------------------------------------------------------ */

export interface GenerateImageInput {
  model: string
  prompt: string
  aspect: "16:9"
  timeoutMs?: number
}

export interface GeneratedImage {
  data: Buffer
  mimeType: string
  /** Modèle qui a réellement produit l'image. */
  model: string
  /** Repli utilisé : modèle demandé et motif de l'échec. */
  fallbackFrom?: { model: string; reason: string }
}

interface RawImage {
  data: string
  mimeType: string
}

interface InteractionContent {
  type?: string
  data?: string
  mime_type?: string
}

/**
 * Image d'une réponse de l'API Interactions (POST /v1beta/interactions),
 * d'après la référence https://ai.google.dev/api/interactions-api relevée le
 * 9 octobre 2026 : `steps[]` dont l'étape `model_output` porte `content[]`,
 * un contenu image étant { type: "image", data (base64), mime_type }. Lit aussi
 * l'ancien schéma (`outputs[]`, retiré le 8 juin 2026) et le raccourci
 * `output_image` des SDK. Lève ModelError si l'interaction n'a pas abouti ou
 * ne contient pas d'image.
 */
export function parseInteractionImage(json: unknown): RawImage {
  if (!json || typeof json !== "object") throw new ModelError("empty", "Réponse de Nano Banana illisible.")
  const body = json as {
    status?: string
    error?: { message?: string }
    steps?: { type?: string; content?: InteractionContent[] }[]
    outputs?: InteractionContent[]
    output_image?: { data?: string; mime_type?: string }
  }
  if (body.error) throw new ModelError("http", `Nano Banana a répondu par une erreur${body.error.message ? ` : ${shortMessage(body.error.message)}` : ""}.`)
  if (body.status && !["completed", "incomplete"].includes(body.status)) {
    throw new ModelError("empty", `Interaction non terminée (statut « ${body.status} »).`)
  }
  const candidates: InteractionContent[] = []
  for (const step of body.steps ?? []) {
    if (step?.type === "model_output" && Array.isArray(step.content)) candidates.push(...step.content)
  }
  if (Array.isArray(body.outputs)) candidates.push(...body.outputs)
  if (body.output_image?.data) candidates.push({ type: "image", data: body.output_image.data, mime_type: body.output_image.mime_type })
  const image = candidates.filter((c) => c?.type === "image" && typeof c.data === "string" && c.data.length > 0).pop()
  if (!image?.data) throw new ModelError("empty", "Aucune image dans la réponse de Nano Banana.")
  return { data: image.data, mimeType: image.mime_type || "image/jpeg" }
}

async function interactionsImage(def: ImageModelDef, key: string, prompt: string, aspect: string, timeoutMs: number): Promise<RawImage> {
  let res: Response
  try {
    res = await fetch(`${GEMINI_API}/interactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        model: def.apiModel,
        input: [{ type: "text", text: prompt }],
        response_format: { type: "image", mime_type: "image/jpeg", aspect_ratio: aspect, image_size: COVER_IMAGE_SIZE },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new ModelError("timeout", "Nano Banana n'a pas répondu à temps.")
    }
    throw new ModelError("http", "Nano Banana injoignable pour le moment.")
  }
  const data = (await res.json().catch(() => null)) as unknown
  if (!res.ok) {
    const message = (data as { error?: { message?: string } } | null)?.error?.message ?? ""
    throw new ModelError("http", `Nano Banana a répondu ${res.status}${message ? ` : ${shortMessage(message)}` : ""}.`)
  }
  return parseInteractionImage(data)
}

async function generateContentImage(def: ImageModelDef, key: string, prompt: string, aspect: string, deadline: number): Promise<RawImage> {
  const request = (imageSize: boolean) =>
    geminiCall(
      def.apiModel,
      key,
      {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: { aspectRatio: aspect, ...(imageSize ? { imageSize: COVER_IMAGE_SIZE } : {}) },
        },
      },
      remainingMs(deadline),
    )
  let data: GeminiResponse
  try {
    data = await request(true)
  } catch (error) {
    // Taille refusée par le modèle : nouvel essai à la taille par défaut, comme le code historique
    if (error instanceof ModelError && error.kind === "http" && error.message.includes("(400)")) data = await request(false)
    else throw error
  }
  const candidate = data.candidates?.[0]
  if (candidate?.finishReason && GEMINI_REFUSALS.has(candidate.finishReason)) {
    throw new ModelError("refused", "Le modèle d'image a refusé la consigne.", false)
  }
  const part = (candidate?.content?.parts ?? []).find((p) => p.inlineData?.data)
  if (!part?.inlineData?.data) throw new ModelError("empty", "Aucune image renvoyée par le modèle.")
  return { data: part.inlineData.data, mimeType: part.inlineData.mimeType || "image/png" }
}

/** Temps restant avant la limite de la passe ; lève si trop court pour un appel utile. */
function remainingMs(deadline: number): number {
  const left = deadline - Date.now()
  if (left < 5_000) throw new ModelError("timeout", "Plus assez de temps pour générer l'image.")
  return left
}

async function imageWith(def: ImageModelDef, input: GenerateImageInput, deadline: number): Promise<RawImage> {
  const key = requireKey(def.envKey)
  return def.api === "interactions"
    ? interactionsImage(def, key, input.prompt, input.aspect, remainingMs(deadline))
    : generateContentImage(def, key, input.prompt, input.aspect, deadline)
}

/**
 * Image de couverture. Si le modèle a un repli (Nano Banana 2.1 → Nano Banana 2)
 * et que l'appel échoue (erreur, format inattendu, pas d'image), l'image est
 * demandée au modèle de repli ; le modèle réellement utilisé est rendu.
 */
export async function generateImage(input: GenerateImageInput): Promise<GeneratedImage> {
  const def = findImageModel(input.model)
  if (!def) throw new ModelError("unknown_model", `Modèle d'image inconnu : ${input.model}.`, false)
  // timeoutMs borne toute la passe : appel principal, repli et nouvel essai compris
  const started = Date.now()
  const total = Math.max(5_000, input.timeoutMs ?? 90_000)
  const deadline = started + total
  const fallbackDef = findImageModel(def.fallback)
  // Avec un repli, l'appel principal n'a droit qu'à une part du temps
  const primaryDeadline = fallbackDef ? started + Math.round(total * 0.55) : deadline
  try {
    const raw = await imageWith(def, input, primaryDeadline)
    return { data: Buffer.from(raw.data, "base64"), mimeType: raw.mimeType, model: def.id }
  } catch (error) {
    const fallback = fallbackDef
    if (!fallback) throw error
    const reason = error instanceof Error ? error.message : "Échec du modèle d'image"
    console.warn(`[seo-articles] ${def.label} indisponible, repli sur ${fallback.label} : ${reason}`)
    const raw = await imageWith(fallback, input, deadline)
    return {
      data: Buffer.from(raw.data, "base64"),
      mimeType: raw.mimeType,
      model: fallback.id,
      fallbackFrom: { model: def.id, reason: reason.slice(0, 200) },
    }
  }
}

/** Message d'erreur d'un fournisseur, raccourci et sans rien qui ressemble à une clé. */
function shortMessage(message: string): string {
  return message
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[clé]")
    .replace(/sk-ant-[0-9A-Za-z_-]+/g, "[clé]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200)
}
