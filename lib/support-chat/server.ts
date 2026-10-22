/**
 * Discussion avec Christophe : lecture et écriture des conversations, côté serveur
 * (clé service_role). Le visiteur retrouve sa conversation par un cookie qui porte un
 * jeton ; la base ne garde que l'empreinte SHA-256 de ce jeton. Le jeton se recalcule
 * à partir de l'identifiant de la conversation (HMAC), ce qui permet de remettre le
 * lien dans chaque email sans stocker le jeton lui-même.
 *
 * Tout fonctionne sans la migration 20261023_support_chat.sql : les fonctions rendent
 * alors 503 `NOT_ACTIVE` et l'appelant retombe sur l'ancien envoi par email.
 */
import { createHmac, randomUUID } from "crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import { hashToken, isTokenFormat } from "@/lib/signature/crypto"
import { appUrl } from "@/lib/signature/server"
import { sniffImage } from "@/lib/blog-images/sniff"
import { BlogImageError, MAX_IMAGE_SIDE, MAX_INPUT_PIXELS, prepareImage } from "@/lib/blog-images/server"
import { sendEmail, type SendEmailOptions } from "@/lib/email/resend"
import { buildTeamNotificationEmail, buildVisitorReceiptEmail, buildVisitorReplyEmail } from "@/lib/email/templates/support-chat"
import {
  MAX_CONVERSATIONS_PER_EMAIL_DAY, MAX_FILES, MAX_FILES_BYTES, MAX_MESSAGES_PER_CONVERSATION, MAX_MESSAGES_PER_IP_HOUR,
  NOT_ACTIVE, SOURCE_LABELS, safeFileName, type ChatSource, type ChatStatus, type VisitorInput,
} from "@/lib/support-chat/rules"

export const ATTACHMENT_BUCKET = "support-attachments"
const SIGNED_SECONDS = 3600

export type Sender = (opts: SendEmailOptions) => Promise<unknown>
export type ServiceResult = { status: number; body: Record<string, unknown>; token?: string }
const fail = (status: number, error: string, extra: Record<string, unknown> = {}): ServiceResult => ({ status, body: { error, ...extra } })

export type Conversation = {
  id: string
  email: string
  name: string | null
  user_id: string | null
  source: ChatSource
  subject: string | null
  status: ChatStatus
  admin_unread: boolean
  access_hash: string
  created_at: string
}
const CONVERSATION_COLUMNS = "id, email, name, user_id, source, subject, status, admin_unread, access_hash, created_at"

/* ------------------------------------------------------------------ */
/* Jeton et empreintes                                                 */
/* ------------------------------------------------------------------ */

function secret(): string {
  return process.env.SUPPORT_CHAT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ""
}

/** Jeton (43 caractères base64url) de la conversation, recalculable par le serveur seul. */
export function tokenFor(conversationId: string): string {
  const key = secret()
  if (!key) throw new Error("Aucune clé pour les liens de conversation (SUPABASE_SERVICE_ROLE_KEY).")
  return createHmac("sha256", key).update(`support-chat:${conversationId}`).digest("base64url")
}

export function conversationLink(conversationId: string): string {
  return `${appUrl()}/contact/c/${tokenFor(conversationId)}`
}

/** Empreinte salée d'une adresse IP : sert à limiter les envois, ne permet pas de la retrouver. */
export function hashIp(ip: string | null): string | null {
  const key = secret()
  if (!ip || !key) return null
  return createHmac("sha256", key).update(`ip:${ip}`).digest("hex").slice(0, 32)
}

/* ------------------------------------------------------------------ */
/* Recherche d'une conversation                                        */
/* ------------------------------------------------------------------ */

export async function findByToken(db: SupabaseClient, token: unknown): Promise<{ conversation: Conversation | null; missing: boolean }> {
  if (!isTokenFormat(token)) return { conversation: null, missing: false }
  const { data, error } = await db.from("support_conversations").select(CONVERSATION_COLUMNS).eq("access_hash", hashToken(token)).maybeSingle()
  if (error) return { conversation: null, missing: isMissingSchemaError(error) }
  return { conversation: (data as Conversation | null) ?? null, missing: false }
}

export async function findForUser(db: SupabaseClient, userId: string, id: string): Promise<Conversation | null> {
  const { data } = await db.from("support_conversations").select(CONVERSATION_COLUMNS).eq("id", id).eq("user_id", userId).maybeSingle()
  return (data as Conversation | null) ?? null
}

/* ------------------------------------------------------------------ */
/* Pièces jointes                                                      */
/* ------------------------------------------------------------------ */

export type PreparedFile = { name: string; mime: "image/webp" | "application/pdf"; data: Buffer }

/** Contrôle et prépare les fichiers avant toute écriture : images en WebP sans métadonnées, PDF reconnus par leur signature. */
export async function prepareAttachments(files: File[]): Promise<{ ok: true; items: PreparedFile[] } | { ok: false; status: number; error: string }> {
  if (files.length === 0) return { ok: true, items: [] }
  if (files.length > MAX_FILES) return { ok: false, status: 400, error: `${MAX_FILES} fichiers au plus par message.` }
  const total = files.reduce((sum, f) => sum + f.size, 0)
  if (total > MAX_FILES_BYTES) return { ok: false, status: 413, error: "Pièces jointes trop lourdes : 4 Mo au plus par message." }
  const items: PreparedFile[] = []
  for (const file of files) {
    const raw = Buffer.from(await file.arrayBuffer())
    if (raw.length === 0) return { ok: false, status: 400, error: "Un des fichiers est vide." }
    const name = safeFileName(file.name)
    if (raw.subarray(0, 5).toString("latin1") === "%PDF-") {
      items.push({ name: /\.pdf$/i.test(name) ? name : `${name}.pdf`, mime: "application/pdf", data: raw })
      continue
    }
    const sniffed = sniffImage(raw)
    if (!sniffed) return { ok: false, status: 415, error: "Format non accepté : joignez une image JPEG, PNG ou WebP, ou un PDF." }
    if (sniffed.width > MAX_IMAGE_SIDE || sniffed.height > MAX_IMAGE_SIDE || sniffed.width * sniffed.height > MAX_INPUT_PIXELS) {
      return { ok: false, status: 413, error: "Image trop grande : réduisez-la puis réessayez." }
    }
    try {
      const prepared = await prepareImage(raw)
      items.push({ name: `${name.replace(/\.[A-Za-z0-9]{1,5}$/, "")}.webp`, mime: "image/webp", data: prepared.data })
    } catch (err) {
      if (err instanceof BlogImageError) return { ok: false, status: err.code === "upload" ? 503 : 415, error: err.message }
      throw err
    }
  }
  return { ok: true, items }
}

/** Range les fichiers dans le bucket privé ; rend le nombre de fichiers qui n'ont pas pu l'être. */
async function storeAttachments(db: SupabaseClient, conversationId: string, messageId: string, items: PreparedFile[]): Promise<number> {
  let failed = 0
  for (const item of items) {
    const path = `${conversationId}/${randomUUID()}.${item.mime === "application/pdf" ? "pdf" : "webp"}`
    const up = await db.storage.from(ATTACHMENT_BUCKET).upload(path, item.data, { contentType: item.mime, upsert: false })
    if (up.error) { console.error("[support-chat] pièce jointe :", up.error.message); failed++; continue }
    const ins = await db.from("support_chat_attachments").insert({
      message_id: messageId, conversation_id: conversationId, storage_path: path, file_name: item.name, mime_type: item.mime, size_bytes: item.data.length,
    })
    if (ins.error) { console.error("[support-chat] pièce jointe (ligne) :", ins.error.message); await db.storage.from(ATTACHMENT_BUCKET).remove([path]); failed++ }
  }
  return failed
}

/* ------------------------------------------------------------------ */
/* Envoi du visiteur                                                   */
/* ------------------------------------------------------------------ */

export type VisitorPost = {
  input: VisitorInput
  files: File[]
  existing: Conversation | null
  user: { id: string; email: string | null } | null
  ip: string | null
  device: string | null
}

const teamAddress = () => process.env.SUPPORT_NOTIFY_EMAIL || process.env.RESEND_FROM_EMAIL || "contact@qonforme.fr"
const sinceIso = (ms: number) => new Date(Date.now() - ms).toISOString()

export async function postVisitorMessage(db: SupabaseClient, post: VisitorPost, send: Sender = sendEmail): Promise<ServiceResult> {
  const prepared = await prepareAttachments(post.files)
  if (!prepared.ok) return fail(prepared.status, prepared.error)

  const ipHash = hashIp(post.ip)
  if (ipHash) {
    const recent = await db.from("support_chat_messages").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gt("created_at", sinceIso(3600_000))
    if (recent.error) return isMissingSchemaError(recent.error) ? fail(503, NOT_ACTIVE) : fail(500, "Impossible d'envoyer le message. Réessayez.")
    if ((recent.count ?? 0) >= MAX_MESSAGES_PER_IP_HOUR) return fail(429, "Trop de messages en peu de temps. Réessayez dans un moment.")
  }

  const isNew = !post.existing
  let conversation = post.existing
  const now = new Date().toISOString()

  if (conversation) {
    const total = await db.from("support_chat_messages").select("id", { count: "exact", head: true }).eq("conversation_id", conversation.id)
    if (total.error) return isMissingSchemaError(total.error) ? fail(503, NOT_ACTIVE) : fail(500, "Impossible d'envoyer le message. Réessayez.")
    if ((total.count ?? 0) >= MAX_MESSAGES_PER_CONVERSATION) return fail(429, "Cette conversation est pleine : démarrez-en une nouvelle depuis la page Contact.")
    const upd = await db.from("support_conversations").update({ status: "open", admin_unread: true, last_message_at: now, resolved_at: null }).eq("id", conversation.id)
    if (upd.error) return fail(500, "Impossible d'envoyer le message. Réessayez.")
  } else {
    const email = post.user?.email?.toLowerCase() || post.input.email
    if (!email) return fail(400, "Indiquez une adresse email valide pour recevoir la réponse.")
    const count = await db.from("support_conversations").select("id", { count: "exact", head: true }).eq("email", email).gt("created_at", sinceIso(86_400_000))
    if (count.error) return isMissingSchemaError(count.error) ? fail(503, NOT_ACTIVE) : fail(500, "Impossible d'envoyer le message. Réessayez.")
    if ((count.count ?? 0) >= MAX_CONVERSATIONS_PER_EMAIL_DAY) return fail(429, "Vous avez déjà écrit plusieurs fois aujourd'hui. Reprenez votre conversation depuis le lien reçu par email.")
    const id = randomUUID()
    const row = {
      id, email, name: post.input.name, user_id: post.user?.id ?? null, source: post.input.source, subject: post.input.subject,
      category: post.input.category, origin_path: post.input.path, device: post.device, access_hash: hashToken(tokenFor(id)),
      status: "open", admin_unread: true, last_message_at: now,
    }
    const ins = await db.from("support_conversations").insert(row).select(CONVERSATION_COLUMNS).single()
    if (ins.error || !ins.data) return isMissingSchemaError(ins.error) ? fail(503, NOT_ACTIVE) : fail(500, "Impossible d'envoyer le message. Réessayez.")
    conversation = ins.data as Conversation
  }

  const msg = await db.from("support_chat_messages").insert({ conversation_id: conversation.id, sender: "visitor", body: post.input.message, ip_hash: ipHash }).select("id").single()
  if (msg.error || !msg.data) {
    if (isNew) await db.from("support_conversations").delete().eq("id", conversation.id)
    return fail(500, "Impossible d'envoyer le message. Réessayez.")
  }
  const messageId = (msg.data as { id: string }).id
  const attachmentsFailed = await storeAttachments(db, conversation.id, messageId, prepared.items)

  const name = post.input.name ?? conversation.name
  const mails: Promise<unknown>[] = []
  try {
    const team = buildTeamNotificationEmail({
      name, email: conversation.email, message: post.input.message, source: SOURCE_LABELS[post.input.source] ?? "Contact",
      path: post.input.path, isNew, attachments: prepared.items.length - attachmentsFailed, inboxUrl: `${appUrl()}/admin/support`,
    })
    mails.push(send({ to: teamAddress(), subject: team.subject, html: team.html, fromName: "Qonforme", replyTo: conversation.email }))
    if (isNew) {
      const receipt = buildVisitorReceiptEmail({ name, link: conversationLink(conversation.id) })
      mails.push(send({ to: conversation.email, subject: receipt.subject, html: receipt.html, fromName: "Qonforme" }))
    }
  } catch (err) { console.error("[support-chat] emails :", err) }
  const outcomes = await Promise.allSettled(mails)
  for (const o of outcomes) if (o.status === "rejected") console.error("[support-chat] email :", o.reason instanceof Error ? o.reason.message : o.reason)

  return {
    status: 201,
    body: { ok: true, conversationId: conversation.id, messageId, isNew, attachmentsFailed },
    token: isNew ? tokenFor(conversation.id) : undefined,
  }
}

/* ------------------------------------------------------------------ */
/* Lecture par le visiteur                                             */
/* ------------------------------------------------------------------ */

type MessageRow = { id: string; sender: "visitor" | "admin" | "note"; body: string; created_at: string; visitor_seen_at: string | null }
type AttachmentRow = { id: string; message_id: string; storage_path: string; file_name: string; mime_type: string; size_bytes: number }

async function signedUrls(db: SupabaseClient, paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (paths.length === 0) return map
  const { data } = await db.storage.from(ATTACHMENT_BUCKET).createSignedUrls(paths, SIGNED_SECONDS)
  for (const item of data ?? []) if (item.path && item.signedUrl) map.set(item.path, item.signedUrl)
  return map
}

/** Les messages visibles par le visiteur (jamais les notes internes), pièces jointes avec lien signé d'une heure. */
export async function visitorThread(db: SupabaseClient, conversation: Conversation, opts: { markSeen?: boolean } = {}): Promise<ServiceResult> {
  const msgs = await db.from("support_chat_messages").select("id, sender, body, created_at, visitor_seen_at").eq("conversation_id", conversation.id).in("sender", ["visitor", "admin"]).order("created_at", { ascending: true }).limit(MAX_MESSAGES_PER_CONVERSATION)
  if (msgs.error) return isMissingSchemaError(msgs.error) ? fail(503, NOT_ACTIVE) : fail(500, "Impossible de charger la conversation.")
  const rows = (msgs.data ?? []) as MessageRow[]
  const ids = rows.map((r) => r.id)
  let attachments: AttachmentRow[] = []
  if (ids.length) {
    const att = await db.from("support_chat_attachments").select("id, message_id, storage_path, file_name, mime_type, size_bytes").in("message_id", ids)
    attachments = (att.data ?? []) as AttachmentRow[]
  }
  const urls = await signedUrls(db, attachments.map((a) => a.storage_path))
  const unreadIds = rows.filter((r) => r.sender === "admin" && !r.visitor_seen_at).map((r) => r.id)
  if (opts.markSeen && unreadIds.length) await db.from("support_chat_messages").update({ visitor_seen_at: new Date().toISOString() }).in("id", unreadIds)
  return {
    status: 200,
    body: {
      conversation: { id: conversation.id, status: conversation.status, email: conversation.email, name: conversation.name },
      unread: opts.markSeen ? 0 : unreadIds.length,
      messages: rows.map((r) => ({
        id: r.id, sender: r.sender, body: r.body, createdAt: r.created_at,
        attachments: attachments.filter((a) => a.message_id === r.id).map((a) => ({ id: a.id, name: a.file_name, mime: a.mime_type, size: a.size_bytes, url: urls.get(a.storage_path) ?? null })),
      })),
    },
  }
}

/** Les conversations d'un compte connecté, la plus récente d'abord, avec le dernier message. */
export async function historyForUser(db: SupabaseClient, userId: string): Promise<ServiceResult> {
  const convs = await db.from("support_conversations").select("id, subject, status, last_message_at").eq("user_id", userId).order("last_message_at", { ascending: false }).limit(20)
  if (convs.error) return isMissingSchemaError(convs.error) ? fail(503, NOT_ACTIVE) : fail(500, "Impossible de charger les messages.")
  const list = (convs.data ?? []) as { id: string; subject: string | null; status: ChatStatus; last_message_at: string }[]
  if (list.length === 0) return { status: 200, body: { conversations: [] } }
  const last = await db.from("support_chat_messages").select("conversation_id, sender, body, created_at, visitor_seen_at").in("conversation_id", list.map((c) => c.id)).in("sender", ["visitor", "admin"]).order("created_at", { ascending: false }).limit(200)
  const rows = (last.data ?? []) as { conversation_id: string; sender: string; body: string; created_at: string; visitor_seen_at: string | null }[]
  return {
    status: 200,
    body: {
      conversations: list.map((c) => {
        const mine = rows.filter((r) => r.conversation_id === c.id)
        const latest = mine[0]
        return {
          id: c.id, subject: c.subject, status: c.status, lastMessageAt: c.last_message_at,
          preview: latest ? { sender: latest.sender, body: latest.body.slice(0, 120) } : null,
          unread: mine.filter((r) => r.sender === "admin" && !r.visitor_seen_at).length,
        }
      }),
    },
  }
}

/* ------------------------------------------------------------------ */
/* Côté équipe                                                         */
/* ------------------------------------------------------------------ */

export async function adminPost(
  db: SupabaseClient, conversationId: string, post: { body: string; kind: "reply" | "note"; files: File[] }, send: Sender = sendEmail,
): Promise<ServiceResult> {
  const body = post.body.trim()
  if (!body) return fail(400, "Écrivez votre réponse.")
  if (body.length > 5000) return fail(400, "Réponse trop longue : 5 000 caractères au plus.")
  const found = await db.from("support_conversations").select(CONVERSATION_COLUMNS).eq("id", conversationId).maybeSingle()
  if (found.error) return isMissingSchemaError(found.error) ? fail(503, NOT_ACTIVE) : fail(500, "Impossible d'enregistrer la réponse.")
  const conversation = found.data as Conversation | null
  if (!conversation) return fail(404, "Conversation introuvable")

  const prepared = await prepareAttachments(post.files)
  if (!prepared.ok) return fail(prepared.status, prepared.error)

  const isReply = post.kind === "reply"
  const inserted = await db.from("support_chat_messages").insert({ conversation_id: conversation.id, sender: isReply ? "admin" : "note", body }).select("id").single()
  if (inserted.error || !inserted.data) return fail(500, "Impossible d'enregistrer la réponse.")
  const messageId = (inserted.data as { id: string }).id
  const attachmentsFailed = await storeAttachments(db, conversation.id, messageId, prepared.items)

  if (!isReply) return { status: 201, body: { ok: true, messageId, attachmentsFailed } }

  const now = new Date().toISOString()
  await db.from("support_conversations").update({ status: "pending", admin_unread: false, last_message_at: now, last_admin_reply_at: now, resolved_at: null }).eq("id", conversation.id)

  const mail = await emailReply(db, conversation, messageId, body, prepared.items.map((i) => i.name), send)
  if (!mail.ok) return fail(502, "La réponse est enregistrée, mais l'email n'a pas pu partir. Utilisez « Renvoyer l'email ».", { messageId, emailFailed: true })
  return { status: 201, body: { ok: true, messageId, attachmentsFailed } }
}

async function emailReply(db: SupabaseClient, conversation: Conversation, messageId: string, reply: string, attachmentNames: string[], send: Sender): Promise<{ ok: boolean }> {
  const first = await db.from("support_chat_messages").select("body").eq("conversation_id", conversation.id).eq("sender", "visitor").order("created_at", { ascending: true }).limit(1)
  const original = ((first.data ?? []) as { body: string }[])[0]?.body ?? null
  try {
    const mail = buildVisitorReplyEmail({ name: conversation.name, reply, original, attachments: attachmentNames, link: conversationLink(conversation.id) })
    await send({ to: conversation.email, subject: mail.subject, html: mail.html, fromName: "Christophe de Qonforme" })
    await db.from("support_chat_messages").update({ emailed_at: new Date().toISOString(), email_error: null }).eq("id", messageId)
    return { ok: true }
  } catch (err) {
    const text = (err instanceof Error ? err.message : String(err)).slice(0, 300)
    console.error("[support-chat] email de réponse :", text)
    await db.from("support_chat_messages").update({ email_error: text }).eq("id", messageId)
    return { ok: false }
  }
}

/** Renvoie par email une réponse dont l'envoi avait échoué. */
export async function adminResend(db: SupabaseClient, conversationId: string, messageId: string, send: Sender = sendEmail): Promise<ServiceResult> {
  const msg = await db.from("support_chat_messages").select("id, body, sender, conversation_id").eq("id", messageId).eq("conversation_id", conversationId).maybeSingle()
  const row = msg.data as { id: string; body: string; sender: string } | null
  if (msg.error || !row || row.sender !== "admin") return fail(404, "Réponse introuvable")
  const conv = await db.from("support_conversations").select(CONVERSATION_COLUMNS).eq("id", conversationId).maybeSingle()
  const conversation = conv.data as Conversation | null
  if (!conversation) return fail(404, "Conversation introuvable")
  const names = await db.from("support_chat_attachments").select("file_name").eq("message_id", messageId)
  const mail = await emailReply(db, conversation, messageId, row.body, ((names.data ?? []) as { file_name: string }[]).map((n) => n.file_name), send)
  return mail.ok ? { status: 200, body: { ok: true } } : fail(502, "L'email n'a pas pu partir. Réessayez plus tard.")
}

export async function adminUpdate(db: SupabaseClient, conversationId: string, patch: { status?: ChatStatus; adminUnread?: boolean }): Promise<ServiceResult> {
  const update: Record<string, unknown> = {}
  if (patch.status) {
    update.status = patch.status
    update.resolved_at = patch.status === "resolved" ? new Date().toISOString() : null
    if (patch.status === "resolved") update.admin_unread = false
  }
  if (typeof patch.adminUnread === "boolean") update.admin_unread = patch.adminUnread
  if (Object.keys(update).length === 0) return fail(400, "Rien à modifier.")
  const { data, error } = await db.from("support_conversations").update(update).eq("id", conversationId).select("id")
  if (error) return isMissingSchemaError(error) ? fail(503, NOT_ACTIVE) : fail(500, "Impossible de modifier la conversation.")
  if (!data || (Array.isArray(data) && data.length === 0)) return fail(404, "Conversation introuvable")
  return { status: 200, body: { ok: true } }
}

/** Une conversation entière pour la boîte admin : notes internes comprises, pièces jointes avec lien signé d'une heure. */
export async function adminThread(db: SupabaseClient, conversationId: string): Promise<ServiceResult> {
  const conv = await db.from("support_conversations")
    .select("id, email, name, user_id, source, subject, category, status, admin_unread, origin_path, device, created_at, last_message_at")
    .eq("id", conversationId).maybeSingle()
  if (conv.error) return isMissingSchemaError(conv.error) ? fail(503, NOT_ACTIVE) : fail(500, "Impossible de charger la conversation.")
  if (!conv.data) return fail(404, "Conversation introuvable")
  const msgs = await db.from("support_chat_messages")
    .select("id, sender, body, created_at, visitor_seen_at, emailed_at, email_error")
    .eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(MAX_MESSAGES_PER_CONVERSATION)
  if (msgs.error) return fail(500, "Impossible de charger les messages.")
  const rows = (msgs.data ?? []) as (MessageRow & { emailed_at: string | null; email_error: string | null })[]
  let attachments: AttachmentRow[] = []
  if (rows.length) {
    const att = await db.from("support_chat_attachments").select("id, message_id, storage_path, file_name, mime_type, size_bytes").in("message_id", rows.map((r) => r.id))
    attachments = (att.data ?? []) as AttachmentRow[]
  }
  const urls = await signedUrls(db, attachments.map((a) => a.storage_path))
  return {
    status: 200,
    body: {
      conversation: conv.data,
      messages: rows.map((r) => ({
        id: r.id, sender: r.sender, body: r.body, createdAt: r.created_at, seenAt: r.visitor_seen_at, emailedAt: r.emailed_at, emailError: r.email_error,
        attachments: attachments.filter((a) => a.message_id === r.id).map((a) => ({ id: a.id, name: a.file_name, mime: a.mime_type, size: a.size_bytes, url: urls.get(a.storage_path) ?? null })),
      })),
    },
  }
}
