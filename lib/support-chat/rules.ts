/**
 * Discussion avec Christophe (bulle de contact, page Contact) : règles pures,
 * sans accès à la base. Les réponses arrivent par email, jamais en direct :
 * aucun texte de ce module ne promet un délai.
 */

/** Cookie HttpOnly qui rattache le navigateur à sa conversation en cours. */
export const CHAT_COOKIE = "q_support_chat"
export const CHAT_COOKIE_MAX_AGE = 60 * 60 * 24 * 30

export const MAX_BODY = 5000
export const MAX_FILES = 3
/** Poids total des pièces jointes d'un envoi : sous la limite de 4,5 Mo du corps d'une fonction serveur. */
export const MAX_FILES_BYTES = 4 * 1024 * 1024
export const MAX_MESSAGES_PER_CONVERSATION = 200
/** Messages par heure et par empreinte d'adresse IP. */
export const MAX_MESSAGES_PER_IP_HOUR = 12
/** Nouvelles conversations par adresse email et par jour. */
export const MAX_CONVERSATIONS_PER_EMAIL_DAY = 5

export const SOURCES = ["bubble", "contact_page", "app"] as const
export type ChatSource = (typeof SOURCES)[number]
export const CATEGORIES = ["account", "billing", "problem", "other"] as const
export type ChatCategory = (typeof CATEGORIES)[number]
export const CATEGORY_LABELS: Record<ChatCategory, string> = {
  account: "Une question sur mon compte",
  billing: "La facturation",
  problem: "Un problème à signaler",
  other: "Autre chose",
}
export const SOURCE_LABELS: Record<ChatSource, string> = {
  bubble: "Bulle de l'accueil",
  contact_page: "Page Contact",
  app: "Application",
}

export const NOT_ACTIVE = "La discussion n'est pas encore activée : écrivez-nous depuis la page Contact."

export type VisitorInput = {
  email: string | null
  name: string | null
  message: string
  source: ChatSource
  category: ChatCategory | null
  subject: string | null
  path: string | null
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null
  const email = value.trim().toLowerCase()
  return email.length <= 254 && email.length >= 5 && EMAIL_RE.test(email) ? email : null
}

const clean = (value: unknown, max: number): string | null => {
  if (typeof value !== "string") return null
  const text = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim()
  return text ? text.slice(0, max) : null
}

export type ParsedInput =
  | { ok: true; value: VisitorInput }
  | { ok: false; error: string; honeypot?: boolean }

/**
 * Valide un envoi. `email` peut manquer quand la conversation existe déjà
 * (`hasConversation`) ou quand le compte connecté le fournit (`knownEmail`).
 * Le champ piège `website` est invisible pour une personne : rempli, c'est un robot.
 */
export function parseVisitorInput(
  raw: Record<string, unknown>,
  ctx: { knownEmail: string | null; hasConversation: boolean },
): ParsedInput {
  if (typeof raw.website === "string" && raw.website.trim()) return { ok: false, error: "Message refusé.", honeypot: true }
  const message = clean(raw.message, MAX_BODY + 1)
  if (!message) return { ok: false, error: "Écrivez votre message." }
  if (message.length > MAX_BODY) return { ok: false, error: `Message trop long : ${MAX_BODY.toLocaleString("fr-FR")} caractères au plus.` }

  let email = ctx.knownEmail
  if (!email && !ctx.hasConversation) {
    email = normalizeEmail(raw.email)
    if (!email) return { ok: false, error: "Indiquez une adresse email valide pour recevoir la réponse." }
  }
  const source = SOURCES.find((s) => s === raw.source) ?? "bubble"
  const category = CATEGORIES.find((c) => c === raw.category) ?? null
  const path = typeof raw.path === "string" && raw.path.startsWith("/") ? raw.path.split(/[?#]/)[0].slice(0, 300) : null
  return {
    ok: true,
    value: { email, name: clean(raw.name, 120), message, source, category, subject: clean(raw.subject, 160), path },
  }
}

/** « iPhone · Safari » : appareil et navigateur, sans identifiant précis. */
export function deviceOf(userAgent: string | null): string | null {
  if (!userAgent) return null
  const ua = userAgent
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : null
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /(Chrome|CriOS)\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : null
  const label = [os, browser].filter(Boolean).join(" · ")
  return label || null
}

/** Nom de fichier sûr pour l'affichage et le téléchargement. */
export function safeFileName(name: string, fallback = "piece-jointe"): string {
  const base = name.split(/[\\/]/).pop() ?? ""
  const cleaned = base.replace(/[^A-Za-z0-9À-ÿ._ -]/g, "").replace(/\s+/g, " ").trim().slice(0, 120)
  return cleaned && !/^\.+$/.test(cleaned) ? cleaned : fallback
}

export const ATTACHMENT_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const

export const STATUS_LABELS = { open: "Ouvert", pending: "En attente", resolved: "Résolu" } as const
export type ChatStatus = keyof typeof STATUS_LABELS
export const isChatStatus = (v: unknown): v is ChatStatus => v === "open" || v === "pending" || v === "resolved"
