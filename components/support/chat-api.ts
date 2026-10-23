/** Appels du navigateur à /api/support/chat, et petits utilitaires de la discussion. */

export type ChatAttachment = { id: string; name: string; mime: string; size: number; url: string | null }
export type ChatMessage = { id: string; sender: "visitor" | "admin"; body: string; createdAt: string; attachments: ChatAttachment[] }
export type HistoryItem = {
  id: string; subject: string | null; status: "open" | "pending" | "resolved"; lastMessageAt: string
  preview: { sender: string; body: string } | null; unread: number
}
export type ThreadState = {
  available: boolean
  user: { email: string | null } | null
  conversation: { id: string; status: string; email: string; name: string | null } | null
  messages: ChatMessage[]
  unread: number
  history?: HistoryItem[]
}

/** Posé après un premier message : seuls ces visiteurs interrogent le serveur pour de nouvelles réponses. */
const HAS_CHAT_KEY = "q_support_has_chat"
export function rememberChat(): void {
  try { localStorage.setItem(HAS_CHAT_KEY, "1") } catch { /* stockage indisponible */ }
}
export function hasChat(): boolean {
  try { return localStorage.getItem(HAS_CHAT_KEY) === "1" } catch { return false }
}

export const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf"
export const MAX_FILES = 3
export const MAX_TOTAL_BYTES = 4 * 1024 * 1024

export async function fetchThread(opts: { seen?: boolean; history?: boolean; id?: string } = {}): Promise<ThreadState | null> {
  const query = new URLSearchParams()
  if (opts.seen) query.set("seen", "1")
  if (opts.history) query.set("history", "1")
  if (opts.id) query.set("c", opts.id)
  try {
    const res = await fetch(`/api/support/chat${query.size ? `?${query}` : ""}`, { cache: "no-store", credentials: "same-origin" })
    if (!res.ok) return null
    return (await res.json()) as ThreadState
  } catch {
    return null
  }
}

export type SendResult = { ok: boolean; status: number; error?: string; code?: string; isNew?: boolean; attachmentsFailed?: number }

export async function sendMessage(fields: Record<string, string>, files: File[]): Promise<SendResult> {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) if (value) form.set(key, value)
  for (const file of files) form.append("files", file)
  try {
    const res = await fetch("/api/support/chat", { method: "POST", body: form, credentials: "same-origin" })
    const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string; isNew?: boolean; attachmentsFailed?: number }
    return res.ok ? { ok: true, status: res.status, isNew: data.isNew, attachmentsFailed: data.attachmentsFailed } : { ok: false, status: res.status, error: data.error ?? "Impossible d'envoyer le message. Réessayez.", code: data.code }
  } catch {
    return { ok: false, status: 0, error: "Connexion impossible. Vérifiez votre réseau puis réessayez." }
  }
}

/** Image lourde (photo de téléphone) : réduite en JPEG avant l'envoi, pour tenir dans la limite de 4 Mo. */
export async function shrinkFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 900 * 1024) return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext("2d")
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.[A-Za-z0-9]+$/, "") + ".jpg", { type: "image/jpeg" })
  } catch {
    return file
  }
}

/** Ajoute des fichiers à ceux déjà choisis, en respectant les limites ; rend la liste et une erreur éventuelle. */
export async function addFiles(current: File[], added: File[]): Promise<{ files: File[]; error: string | null }> {
  const files = [...current]
  let error: string | null = null
  for (const raw of added) {
    if (files.length >= MAX_FILES) { error = `${MAX_FILES} fichiers au plus par message.`; break }
    if (!ACCEPT.split(",").includes(raw.type)) { error = "Joignez une image JPEG, PNG ou WebP, ou un PDF."; continue }
    const file = await shrinkFile(raw)
    if (files.reduce((sum, f) => sum + f.size, 0) + file.size > MAX_TOTAL_BYTES) { error = "Pièces jointes trop lourdes : 4 Mo au plus par message."; continue }
    files.push(file)
  }
  return { files, error }
}

export function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const parts = (d: Date) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(d)
  const time = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).format(date)
  if (parts(date) === parts(new Date())) return time
  return `${new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "short" }).format(date)}, ${time}`
}

export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())

export function kib(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} Mo` : `${Math.max(1, Math.round(bytes / 1024))} Ko`
}
