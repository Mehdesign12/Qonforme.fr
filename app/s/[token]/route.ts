import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { isTokenFormat } from "@/lib/signature/crypto"
import { findLinkIdByToken, linkCookieName } from "@/lib/signature/server"

/**
 * GET /s/<jeton> — entrée du lien de signature reçu par le client.
 *
 * Le jeton ne reste pas dans l'adresse de la page : il est posé dans un cookie
 * HttpOnly propre au lien, puis le navigateur est redirigé vers
 * /signer/<identifiant>. Ainsi, ni la mesure d'audience, ni l'en-tête Referer,
 * ni l'historique partagé d'un écran ne voient jamais le jeton, et
 * l'identifiant seul ne donne accès à rien.
 *
 * Route publique (middleware), jamais mise en cache (service worker : hors
 * des pages publiques mises en cache ; réponse no-store).
 */
export const dynamic = "force-dynamic"

const HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
}

function redirect(req: NextRequest, path: string) {
  const res = NextResponse.redirect(new URL(path, req.url), 303)
  for (const [k, v] of Object.entries(HEADERS)) res.headers.set(k, v)
  return res
}

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const token = params.token
  if (!isTokenFormat(token)) return redirect(req, "/signer/introuvable")

  let id: string | null = null
  try {
    id = await findLinkIdByToken(createAdminClient(), token)
  } catch {
    id = null
  }
  if (!id) return redirect(req, "/signer/introuvable")

  const onSite = req.nextUrl.searchParams.get("sur-place") === "1"
  // Lien « Changer d'avis » de l'email de confirmation : formulaire de rétractation ouvert
  const withdraw = req.nextUrl.searchParams.get("retractation") === "1"
  const res = redirect(req, `/signer/${id}${onSite ? "?sur-place=1" : withdraw ? "?retractation=1" : ""}`)
  res.cookies.set(linkCookieName(id), token, {
    httpOnly: true,
    secure: req.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 60,
  })
  return res
}
