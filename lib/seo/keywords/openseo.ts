/**
 * Mesures des mots-clés par OpenSEO (compte hébergé, app.openseo.so) : volume,
 * difficulté, CPC et intention, pour la France en français. OpenSEO revend les
 * données de DataForSEO ; quand sa clé est présente, elle passe avant les
 * identifiants DataForSEO (lib/seo/keywords/dataforseo.ts, `keywordDataSource`).
 *
 * Point d'accès (documentation d'OpenSEO, https://openseo.so/docs/mcp, lue le
 * 28/10/2026) : le serveur MCP hébergé `https://app.openseo.so/mcp`, en
 * « Streamable HTTP », avec une clé personnelle `oseo_…` créée dans OpenSEO
 * (Settings › API keys) et envoyée en `Authorization: Bearer`. Le site parle
 * donc MCP (JSON-RPC) : `initialize`, `notifications/initialized`, puis
 * `tools/call`. La réponse est du JSON ou un flux SSE ; l'identifiant de session
 * éventuel (`Mcp-Session-Id`) est renvoyé à chaque appel suivant.
 *
 * Sûreté : la clé OpenSEO est personnelle et porte un seul droit « mcp » : elle
 * ne peut pas être limitée à la lecture (projets, rapports, suivis, analyses
 * payantes). Le site n'appelle donc QUE les outils de `OPENSEO_TOOLS` (liste
 * fermée, refusée par `callTool` pour tout autre nom) ; `get_keyword_metrics`
 * est le seul qui débite des crédits. La clé est lue dans process.env, jamais
 * rendue, journalisée ni recopiée dans un message.
 *
 * Projet : `OPENSEO_PROJECT_ID`, sinon le projet du domaine qonforme.fr (ou le
 * seul projet du compte), retrouvé par `list_projects` (gratuit).
 */
import {
  DataForSeoError,
  DFS_CALL_TIMEOUT_MS,
  DFS_LANGUAGE_FR,
  DFS_LOCATION_FRANCE,
  DFS_WRITE_RESERVE_MS,
  openSeoApiKey,
  type KeywordMetrics,
} from "@/lib/seo/keywords/dataforseo"
import { canonicalKeyword } from "@/lib/seo/keywords/normalize"
import { isKeywordIntent } from "@/lib/seo/keywords/types"
import type { KeywordIntent } from "@/lib/seo/types"

export const OPENSEO_MCP_URL = "https://app.openseo.so/mcp"
/** Mots-clés au plus par appel de `get_keyword_metrics` (documentation de l'outil). */
export const OPENSEO_MAX_KEYWORDS = 700
/** Seuls outils appelés par le site : la clé ne peut pas être limitée à la lecture. */
export const OPENSEO_TOOLS = ["whoami", "list_projects", "get_keyword_metrics"] as const
export type OpenSeoTool = (typeof OPENSEO_TOOLS)[number]

const PROTOCOL_VERSION = "2025-03-26"
const SITE_DOMAIN = "qonforme.fr"

/** Échec d'un appel à OpenSEO (message en français, sans secret). Sous-classe : les routes qui attrapent DataForSeoError le gèrent aussi. */
export class OpenSeoError extends DataForSeoError {
  constructor(message: string, code: number | null = null) {
    super(message, code)
    this.name = "OpenSeoError"
  }
}

/* ------------------------------------------------------------------ */
/* Analyse des réponses (fonctions pures)                               */
/* ------------------------------------------------------------------ */

type Json = Record<string, unknown>

function obj(value: unknown): Json | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null
}

function finite(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

/** Messages JSON-RPC d'un flux SSE (« data: {…} » ; les événements sans JSON sont ignorés). */
export function parseSse(text: string): unknown[] {
  const out: unknown[] = []
  text.split(/\r?\n\r?\n/).forEach((block) => {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).replace(/^ /, ""))
      .join("\n")
      .trim()
    if (!data) return
    try {
      out.push(JSON.parse(data))
    } catch {
      /* événement sans JSON */
    }
  })
  return out
}

/** Message JSON-RPC de réponse à la requête `id` (JSON simple ou flux SSE). */
export function rpcMessage(body: string, contentType: string, id: number): Json | null {
  if (/text\/event-stream/i.test(contentType)) {
    const messages = parseSse(body).map(obj).filter((m): m is Json => m !== null)
    return messages.find((m) => m.id === id) ?? messages.find((m) => "result" in m || "error" in m) ?? null
  }
  try {
    const json = JSON.parse(body) as unknown
    // Une réponse groupée est un tableau de messages
    if (Array.isArray(json)) return json.map(obj).find((m) => m && m.id === id) ?? null
    return obj(json)
  } catch {
    return null
  }
}

/** Contenu d'un résultat d'outil : `structuredContent`, sinon le JSON du premier bloc texte. */
export function toolPayload(result: unknown): unknown {
  const r = obj(result)
  if (!r) return null
  if (r.structuredContent !== undefined && r.structuredContent !== null) return r.structuredContent
  const content = Array.isArray(r.content) ? r.content : []
  const text = content.map(obj).find((c) => c && c.type === "text" && typeof c.text === "string")?.text
  if (typeof text !== "string") return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

/** Texte d'un résultat d'outil en erreur (isError), pour le choisir en message. */
function toolErrorText(result: unknown): string {
  const r = obj(result)
  const content = Array.isArray(r?.content) ? (r.content as unknown[]) : []
  return content
    .map(obj)
    .map((c) => (c && typeof c.text === "string" ? c.text : ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Message en français pour un refus d'OpenSEO (statut HTTP ou texte d'erreur d'un outil). */
export function openSeoMessage(status: number | null, detail?: string | null): string {
  const text = (detail ?? "").replace(/\s+/g, " ").trim()
  if (status === 401 || status === 403) return "OpenSEO a refusé la clé : vérifiez OPENSEO_API_KEY (Paramètres › Connexions)."
  if (status === 402 || /cr[ée]dit|balance|insufficient|payment/i.test(text)) return "Le solde de crédits OpenSEO est insuffisant : rechargez le compte sur app.openseo.so."
  if (status === 429 || /rate.?limit|too many/i.test(text)) return "Trop de requêtes vers OpenSEO pour le moment : réessayez dans une minute."
  if (status !== null && status >= 500) return "OpenSEO est indisponible pour le moment : réessayez plus tard."
  return `OpenSEO n'a pas pu répondre${status ? ` (erreur ${status})` : ""}${text ? ` : « ${text.slice(0, 160)} »` : ""}.`
}

/** get_keyword_metrics → volume, CPC, difficulté (0-100) et intention par mot-clé (forme canonique). */
export function parseOpenSeoMetrics(payload: unknown): Map<string, KeywordMetrics> {
  const out = new Map<string, KeywordMetrics>()
  const rows = Array.isArray(obj(payload)?.keywords) ? (obj(payload)!.keywords as unknown[]) : []
  rows.forEach((item) => {
    const row = obj(item)
    if (!row || typeof row.keyword !== "string") return
    const volume = finite(row.search_volume)
    const cpc = finite(row.cpc)
    const difficulty = finite(row.keyword_difficulty)
    const intent: KeywordIntent | null = isKeywordIntent(row.main_intent) ? row.main_intent : null
    out.set(canonicalKeyword(row.keyword), {
      volume: volume === null ? null : Math.max(0, Math.round(volume)),
      cpc: cpc === null ? null : Math.round(cpc * 100) / 100,
      difficulty: difficulty === null ? null : Math.min(100, Math.max(0, Math.round(difficulty))),
      intent,
    })
  })
  return out
}

/** Projet du site parmi ceux du compte : celui de qonforme.fr, sinon le seul projet ; null si l'on ne peut pas choisir. */
export function pickProject(payload: unknown): string | null {
  const projects = (Array.isArray(obj(payload)?.projects) ? (obj(payload)!.projects as unknown[]) : []).map(obj).filter((p): p is Json => p !== null && typeof p.id === "string")
  const own = projects.find((p) => typeof p.domain === "string" && p.domain.replace(/^www\./, "").toLowerCase() === SITE_DOMAIN)
  if (own) return own.id as string
  return projects.length === 1 ? (projects[0].id as string) : null
}

/* ------------------------------------------------------------------ */
/* Appels                                                              */
/* ------------------------------------------------------------------ */

interface Session {
  key: string
  id: string | null
  version: string
  nextId: number
}

async function post(session: Session, body: Json, timeoutMs: number): Promise<{ status: number; text: string; contentType: string; sessionId: string | null }> {
  let res: Response
  try {
    res = await fetch(OPENSEO_MCP_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.key}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...(session.id ? { "Mcp-Session-Id": session.id } : {}),
        ...(session.id ? { "MCP-Protocol-Version": session.version } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(Math.max(1000, timeoutMs)),
    })
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
    throw new OpenSeoError(timedOut ? "OpenSEO n'a pas répondu à temps." : "OpenSEO est injoignable pour le moment.")
  }
  const text = await res.text().catch(() => "")
  return { status: res.status, text, contentType: res.headers.get("content-type") ?? "", sessionId: res.headers.get("mcp-session-id") }
}

/** Ouvre une session MCP (initialize puis notifications/initialized). */
async function openSession(key: string, timeoutMs: number): Promise<Session> {
  const session: Session = { key, id: null, version: PROTOCOL_VERSION, nextId: 1 }
  const id = session.nextId++
  const init = await post(
    session,
    { jsonrpc: "2.0", id, method: "initialize", params: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: "qonforme", version: "1.0" } } },
    timeoutMs,
  )
  if (init.status < 200 || init.status >= 300) throw new OpenSeoError(openSeoMessage(init.status, init.text), init.status)
  const message = rpcMessage(init.text, init.contentType, id)
  if (message?.error) throw new OpenSeoError(openSeoMessage(null, String(obj(message.error)?.message ?? "")))
  const negotiated = obj(message?.result)?.protocolVersion
  if (typeof negotiated === "string" && negotiated) session.version = negotiated
  session.id = init.sessionId
  // Notification : aucune réponse attendue (202) ; un échec ici n'empêche pas l'appel d'outil suivant
  await post(session, { jsonrpc: "2.0", method: "notifications/initialized" }, timeoutMs).catch(() => null)
  return session
}

/** Appelle un outil de la liste fermée ; rend son contenu (JSON). */
async function callTool(session: Session, name: OpenSeoTool, args: Json, timeoutMs: number): Promise<unknown> {
  if (!(OPENSEO_TOOLS as readonly string[]).includes(name)) throw new OpenSeoError(`Outil OpenSEO non autorisé : ${name}.`)
  const id = session.nextId++
  const res = await post(session, { jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } }, timeoutMs)
  if (res.status < 200 || res.status >= 300) throw new OpenSeoError(openSeoMessage(res.status, res.text), res.status)
  const message = rpcMessage(res.text, res.contentType, id)
  if (!message) throw new OpenSeoError("Réponse d'OpenSEO illisible.")
  if (message.error) throw new OpenSeoError(openSeoMessage(null, String(obj(message.error)?.message ?? "")))
  const result = obj(message.result)
  if (result?.isError === true) throw new OpenSeoError(openSeoMessage(null, toolErrorText(result)))
  const payload = toolPayload(result)
  if (payload === null) throw new OpenSeoError("Réponse d'OpenSEO illisible.")
  return payload
}

/** Compte connecté et crédits restants (outil gratuit) : sert au test de la connexion. */
export async function openSeoAccount(timeoutMs = 15_000): Promise<{ email: string | null; credits: number | null }> {
  const key = openSeoApiKey()
  if (!key) throw new OpenSeoError("OpenSEO n'est pas configuré : Paramètres › Connexions.")
  const session = await openSession(key, timeoutMs)
  const payload = obj(await callTool(session, "whoami", {}, timeoutMs))
  return {
    email: typeof payload?.userEmail === "string" ? payload.userEmail : null,
    credits: finite(payload?.creditsRemaining ?? obj(payload?.meta)?.creditsRemaining),
  }
}

/**
 * Volume, CPC, difficulté et intention de mots-clés (formes canoniques), par
 * lots de 700. Un mot-clé absent d'une réponse a des valeurs nulles. Chaque
 * appel s'arrête assez tôt pour laisser le temps d'écrire avant `deadline`.
 */
export async function fetchOpenSeoKeywordMetrics(keywords: string[], opts: { deadline: number }): Promise<Map<string, KeywordMetrics>> {
  const key = openSeoApiKey()
  if (!key) throw new OpenSeoError("OpenSEO n'est pas configuré : Paramètres › Connexions.")
  if (keywords.length === 0) return new Map()
  const timeout = () => {
    const left = opts.deadline - Date.now() - DFS_WRITE_RESERVE_MS
    if (left < 1000) throw new OpenSeoError("OpenSEO n'a pas répondu à temps.")
    return Math.min(DFS_CALL_TIMEOUT_MS, left)
  }

  const session = await openSession(key, timeout())
  let projectId = process.env.OPENSEO_PROJECT_ID?.trim() || null
  if (!projectId) {
    projectId = pickProject(await callTool(session, "list_projects", {}, timeout()))
    if (!projectId) throw new OpenSeoError("OpenSEO : projet introuvable. Ajoutez OPENSEO_PROJECT_ID (Paramètres › Connexions).")
  }

  const found = new Map<string, KeywordMetrics>()
  for (let i = 0; i < keywords.length; i += OPENSEO_MAX_KEYWORDS) {
    const batch = keywords.slice(i, i + OPENSEO_MAX_KEYWORDS)
    const payload = await callTool(
      session,
      "get_keyword_metrics",
      { projectId, keywords: batch, locationCode: DFS_LOCATION_FRANCE, languageCode: DFS_LANGUAGE_FR, includeMonthlyTrends: false },
      timeout(),
    )
    parseOpenSeoMetrics(payload).forEach((metrics, keyword) => found.set(keyword, metrics))
  }

  const out = new Map<string, KeywordMetrics>()
  keywords.forEach((keyword) => out.set(keyword, found.get(keyword) ?? { volume: null, cpc: null, difficulty: null, intent: null }))
  return out
}
