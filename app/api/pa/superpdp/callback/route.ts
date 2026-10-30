/**
 * GET /api/pa/superpdp/callback — retour de Super PDP après l'autorisation
 * (ou le refus). Vérifie l'état OAuth contre le cookie d'aller-retour et le
 * compte connecté, échange le code (PKCE), enregistre les jetons chiffrés,
 * interroge aussitôt l'état du raccordement, puis renvoie sur la page
 * « Facturation électronique », qui affiche l'avancement.
 *
 * Adresse déclarée telle quelle dans l'application Super PDP.
 */
import { NextRequest, NextResponse } from "next/server"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { superPdpConfig } from "@/lib/pa/superpdp/config"
import { exchangeCode, OAuthError } from "@/lib/pa/superpdp/oauth"
import { saveNewConnection } from "@/lib/pa/store"
import { runConnection } from "@/lib/pa/run"
import { OAUTH_COOKIE, OAUTH_COOKIE_PATH, openOAuthCookie, sameState } from "@/lib/pa/oauth-cookie"

export const dynamic = "force-dynamic"
export const maxDuration = 30

const PAGE = "/facturation-electronique"

function back(req: NextRequest, query: string) {
  const res = NextResponse.redirect(new URL(`${PAGE}?${query}`, req.url), 303)
  res.headers.set("Cache-Control", "no-store")
  res.headers.set("Referrer-Policy", "no-referrer")
  res.cookies.set(OAUTH_COOKIE, "", { path: OAUTH_COOKIE_PATH, maxAge: 0 })
  return res
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const cookie = openOAuthCookie(req.cookies.get(OAUTH_COOKIE)?.value)
  if (!cookie || !sameState(cookie.state, params.get("state"))) return back(req, "erreur=session")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== cookie.uid) return back(req, "erreur=session")

  // Refus de l'autorisation, ou parcours interrompu chez Super PDP
  if (params.get("error")) return back(req, "raccordement=annule")
  const code = params.get("code")
  if (!code) return back(req, "erreur=session")

  const cfg = superPdpConfig(cookie.mode)
  if (!cfg) return back(req, "erreur=indisponible")

  let tokens
  try {
    tokens = await exchangeCode(cfg, code, cookie.verifier)
  } catch (err) {
    console.error("[pa] échange du code:", err instanceof Error ? err.message : err)
    return back(req, `erreur=${err instanceof OAuthError && err.kind === "unavailable" ? "plateforme" : "echange"}`)
  }

  const admin = createAdminClient()
  const company = await admin.from("companies").select("siren").eq("user_id", user.id).maybeSingle()
  const siren = (company.data as { siren?: string | null } | null)?.siren ?? null
  const saved = await saveNewConnection(admin, {
    userId: user.id,
    mode: cookie.mode,
    siren: siren && /^\d{9}$/.test(siren) ? siren : null,
    tokens,
    email: user.email ?? null,
  })
  if (!saved) return back(req, "erreur=enregistrement")

  // Premier état tout de suite (la page reste juste si la plateforme ne répond pas)
  await runConnection(admin, user.id, { forceCheck: true }).catch(() => null)
  return back(req, "raccordement=retour")
}
