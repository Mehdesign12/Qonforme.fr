/**
 * GET /api/pa/superpdp/connect — départ vers Super PDP (« Continuer chez Super
 * PDP », planche 3). Compte connecté avec une formule seulement (le
 * raccordement est inclus dans Essentiel). Pose le cookie d'aller-retour puis
 * redirige vers la page d'autorisation de la plateforme, pré-remplie avec
 * l'adresse email et le SIREN du compte.
 */
import { NextRequest, NextResponse } from "next/server"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { superPdpConfig } from "@/lib/pa/superpdp/config"
import { randomToken } from "@/lib/pa/superpdp/crypto"
import { buildAuthorizeUrl } from "@/lib/pa/superpdp/oauth"
import { hasPlan, paModeFor } from "@/lib/pa/server"
import { OAUTH_COOKIE, OAUTH_COOKIE_MAX_AGE, OAUTH_COOKIE_PATH, sealOAuthCookie } from "@/lib/pa/oauth-cookie"

export const dynamic = "force-dynamic"

const PAGE = "/facturation-electronique"

function back(req: NextRequest, error: string) {
  return NextResponse.redirect(new URL(`${PAGE}?erreur=${error}`, req.url), 303)
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(PAGE)}`, req.url), 303)

  const admin = createAdminClient()
  const mode = await paModeFor(user.id)
  if (!mode) return back(req, "lecture")
  const cfg = superPdpConfig(mode)
  if (!cfg) return back(req, "indisponible")
  const plan = await hasPlan(admin, user.id)
  if (plan === null) return back(req, "lecture")
  if (!plan) return back(req, "formule")

  const company = await admin.from("companies").select("siren").eq("user_id", user.id).maybeSingle()
  const siren = (company.data as { siren?: string | null } | null)?.siren ?? null

  const state = randomToken(24)
  const verifier = randomToken(48)
  const url = buildAuthorizeUrl(cfg, { state, verifier, email: user.email ?? null, siren })
  const res = NextResponse.redirect(url, 303)
  res.headers.set("Cache-Control", "no-store")
  res.headers.set("Referrer-Policy", "no-referrer")
  res.cookies.set(OAUTH_COOKIE, sealOAuthCookie({ state, verifier, uid: user.id, mode, exp: Date.now() + OAUTH_COOKIE_MAX_AGE * 1000 }), {
    httpOnly: true,
    secure: req.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: OAUTH_COOKIE_PATH,
    maxAge: OAUTH_COOKIE_MAX_AGE,
  })
  return res
}
