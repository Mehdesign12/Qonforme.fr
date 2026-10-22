import { NextRequest, NextResponse } from "next/server"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { requestMeta } from "@/lib/signature/server"
import {
  CHAT_COOKIE, CHAT_COOKIE_MAX_AGE, MAX_FILES, NOT_ACTIVE, deviceOf, normalizeEmail, parseVisitorInput,
} from "@/lib/support-chat/rules"
import { findByToken, findForUser, historyForUser, postVisitorMessage, visitorThread } from "@/lib/support-chat/server"

export const runtime = "nodejs"
export const maxDuration = 30
const NO_STORE = { "Cache-Control": "no-store" }

async function currentUser(): Promise<{ id: string; email: string | null } | null> {
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    return data.user ? { id: data.user.id, email: normalizeEmail(data.user.email) } : null
  } catch {
    return null
  }
}

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: NO_STORE })
}

/**
 * POST /api/support/chat — un message du visiteur (formulaire multipart : message, email,
 * name, source, category, subject, path, fichiers « files », champ piège « website »).
 * Ouvert à tous, connectés ou non : un compte connecté n'a pas à donner son email.
 */
export async function POST(request: NextRequest) {
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return json(400, { error: "Message illisible. Réessayez." })
  }
  const raw: Record<string, unknown> = {}
  for (const key of ["message", "email", "name", "source", "category", "subject", "path", "website"]) raw[key] = form.get(key)
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0)
  if (files.length > MAX_FILES) return json(400, { error: `${MAX_FILES} fichiers au plus par message.` })

  const db = createAdminClient()
  const user = await currentUser()
  const found = await findByToken(db, request.cookies.get(CHAT_COOKIE)?.value)
  if (found.missing) return json(503, { error: NOT_ACTIVE, code: "NOT_ACTIVE" })

  const parsed = parseVisitorInput(raw, { knownEmail: user?.email ?? null, hasConversation: !!found.conversation })
  // Un robot croit avoir réussi : rien n'est enregistré
  if (!parsed.ok) return parsed.honeypot ? json(201, { ok: true }) : json(400, { error: parsed.error })

  const meta = requestMeta(request)
  const result = await postVisitorMessage(db, {
    input: parsed.value, files, existing: found.conversation, user, ip: meta.ip, device: deviceOf(meta.userAgent),
  })
  if (result.status === 503) return json(503, { ...result.body, code: "NOT_ACTIVE" })
  const response = json(result.status, result.body)
  if (result.token) {
    response.cookies.set(CHAT_COOKIE, result.token, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: CHAT_COOKIE_MAX_AGE,
    })
  }
  return response
}

/**
 * GET /api/support/chat — la conversation du navigateur (cookie) ou, pour un compte connecté,
 * `?c=<id>` pour l'une des siennes ; sans cookie ni compte, `{ conversation: null }`.
 * `?seen=1` marque les réponses de Christophe comme lues. Pour un compte connecté,
 * `?history=1` ajoute la liste de ses conversations.
 */
export async function GET(request: NextRequest) {
  const db = createAdminClient()
  const url = new URL(request.url)
  const user = await currentUser()
  const wantsHistory = url.searchParams.get("history") === "1" && user
  const markSeen = url.searchParams.get("seen") === "1"

  let conversation = null
  const asked = url.searchParams.get("c")
  if (asked && user) conversation = await findForUser(db, user.id, asked)
  if (!conversation) {
    const found = await findByToken(db, request.cookies.get(CHAT_COOKIE)?.value)
    if (found.missing) return json(200, { available: false, conversation: null, messages: [], unread: 0 })
    conversation = found.conversation
  }

  const body: Record<string, unknown> = { available: true, conversation: null, messages: [], unread: 0 }
  if (conversation) {
    const thread = await visitorThread(db, conversation, { markSeen })
    if (thread.status !== 200) return json(thread.status, thread.body)
    Object.assign(body, thread.body)
  }
  if (wantsHistory && user) {
    const history = await historyForUser(db, user.id)
    if (history.status === 200) body.history = history.body.conversations
  }
  return json(200, body)
}
