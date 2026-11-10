/**
 * POST /api/affiliation/visit  { code, path }
 *
 * Arrivée sur qonforme.fr par un lien de partenaire (`?ref=code`), signalée par
 * RefTracker. Compte la visite (ni IP, ni identifiant) et pose le cookie `q_ref`
 * qui rattachera l'inscription au partenaire (90 jours, dernier lien suivi).
 * Un rechargement dans les 30 minutes ne compte pas une seconde visite.
 * Répond toujours 204 : un code inconnu ne se distingue pas d'un code valide.
 */
import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { activePartnerByCode, recordVisit } from "@/lib/affiliation/attribution"
import { REF_COOKIE, REF_COOKIE_MAX_AGE_S, landingPath, parseRefCookie, refCookieValue, refFromParam, shouldCountVisit } from "@/lib/affiliation/model"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const done = new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } })
  const body = (await request.json().catch(() => null)) as { code?: unknown; path?: unknown } | null
  const code = refFromParam(typeof body?.code === "string" ? body.code : null)
  if (!code) return done

  const db = createAdminClient()
  const partner = await activePartnerByCode(db, code)
  if (!partner) return done

  const now = Date.now()
  const previous = parseRefCookie(request.cookies.get(REF_COOKIE)?.value)
  if (shouldCountVisit(previous, code, now)) await recordVisit(db, partner.id, landingPath(body?.path))

  done.cookies.set(REF_COOKIE, refCookieValue(code, now), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: REF_COOKIE_MAX_AGE_S,
  })
  return done
}
