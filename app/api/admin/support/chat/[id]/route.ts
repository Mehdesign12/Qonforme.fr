import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { isUuid } from "@/lib/signature/server"
import { isChatStatus } from "@/lib/support-chat/rules"
import { adminPost, adminResend, adminUpdate } from "@/lib/support-chat/server"

export const runtime = "nodejs"
export const maxDuration = 30
type Ctx = { params: Promise<{ id: string }> }

async function guard(id: string): Promise<NextResponse | null> {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
  if (!isUuid(id)) return NextResponse.json({ error: "Conversation introuvable" }, { status: 404 })
  return null
}

/** POST — une réponse envoyée par email au visiteur, une note interne, ou le renvoi d'un email (multipart : body, kind, files ; ou JSON { action: "resend", messageId }). */
export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const denied = await guard(id)
  if (denied) return denied
  const db = createAdminClient()
  const type = request.headers.get("content-type") ?? ""
  if (type.includes("application/json")) {
    const payload = (await request.json().catch(() => null)) as { action?: string; messageId?: string } | null
    if (payload?.action !== "resend" || !isUuid(payload.messageId)) return NextResponse.json({ error: "Demande invalide" }, { status: 400 })
    const result = await adminResend(db, id, payload.messageId)
    return NextResponse.json(result.body, { status: result.status })
  }
  const form = await request.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: "Demande illisible" }, { status: 400 })
  const kind = form.get("kind") === "note" ? "note" : "reply"
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0)
  const result = await adminPost(db, id, { body: String(form.get("body") ?? ""), kind, files })
  return NextResponse.json(result.body, { status: result.status })
}

/** PATCH { status?, unread? } — statut de la conversation, lue ou non. */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const denied = await guard(id)
  if (denied) return denied
  const payload = (await request.json().catch(() => null)) as { status?: unknown; unread?: unknown } | null
  if (!payload) return NextResponse.json({ error: "Demande illisible" }, { status: 400 })
  if (payload.status !== undefined && !isChatStatus(payload.status)) return NextResponse.json({ error: "Statut invalide" }, { status: 400 })
  const result = await adminUpdate(createAdminClient(), id, {
    status: payload.status as never,
    adminUnread: typeof payload.unread === "boolean" ? payload.unread : undefined,
  })
  return NextResponse.json(result.body, { status: result.status })
}
