/**
 * GET /api/invitation-comptable/[jeton] — lien de l'email d'invitation.
 *
 * Range le jeton dans un cookie HttpOnly puis redirige vers
 * /invitation-comptable : le jeton n'apparaît jamais dans l'adresse d'une
 * page (ni dans l'historique des pages vues, ni dans les outils de mesure
 * d'audience, ni dans un « Referer »). Aucune lecture en base ici.
 */
import { NextRequest, NextResponse } from "next/server"
import { INVITE_TTL_DAYS } from "@/lib/accountant/rules"
import { isInviteTokenShape } from "@/lib/accountant/token"
import { INVITE_COOKIE } from "@/lib/accountant/types"

export const dynamic = "force-dynamic"

interface Params { params: Promise<{ token: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { token } = await params
  const res = NextResponse.redirect(new URL("/invitation-comptable", request.url), 303)
  res.headers.set("Cache-Control", "no-store")
  res.headers.set("Referrer-Policy", "no-referrer")
  if (isInviteTokenShape(token)) {
    res.cookies.set(INVITE_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: INVITE_TTL_DAYS * 86_400,
    })
  } else {
    res.cookies.delete(INVITE_COOKIE)
  }
  return res
}
