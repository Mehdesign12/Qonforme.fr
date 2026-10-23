import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { isTokenFormat } from "@/lib/signature/crypto"
import { CHAT_COOKIE, CHAT_COOKIE_MAX_AGE } from "@/lib/support-chat/rules"
import { findByToken } from "@/lib/support-chat/server"

export const runtime = "nodejs"

/**
 * GET /contact/c/<jeton> — lien « Ouvrir la conversation » des emails. Le jeton ne reste pas
 * dans l'adresse : il est posé dans un cookie HttpOnly puis le navigateur est renvoyé vers
 * la page Contact, qui rouvre la discussion. Un jeton inconnu mène à la page Contact seule.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const target = new URL("/contact", request.url)
  if (!isTokenFormat(token)) return NextResponse.redirect(target, 303)
  const found = await findByToken(createAdminClient(), token)
  if (!found.conversation) return NextResponse.redirect(target, 303)
  target.searchParams.set("conversation", "1")
  const res = NextResponse.redirect(target, 303)
  res.cookies.set(CHAT_COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: CHAT_COOKIE_MAX_AGE,
  })
  res.headers.set("Referrer-Policy", "no-referrer")
  res.headers.set("Cache-Control", "no-store")
  return res
}
