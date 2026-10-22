/**
 * GET /scan/p/<jeton> — entrée du téléphone appairé (QR code de l'ordinateur).
 *
 * Le jeton ne reste pas dans l'adresse : il est posé dans un cookie HttpOnly qui
 * expire avec l'appairage, puis le navigateur est redirigé vers /scan-telephone.
 * Ni la mesure d'audience, ni l'en-tête Referer, ni l'historique ne le voient
 * (même principe que /s/<jeton>, la signature en ligne). Route publique
 * (middleware), jamais mise en cache.
 */
import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { PAIR_COOKIE, findPairing, markClaimed, pairingState } from "@/lib/scan/pairing"

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
  let row = null
  const admin = createAdminClient()
  try { row = await findPairing(admin, params.token) } catch { row = null }
  if (!row) return redirect(req, "/scan-telephone?etat=inconnu")
  const now = new Date()
  if (pairingState(row, now) !== "active") return redirect(req, "/scan-telephone?etat=expire")

  await markClaimed(admin, row.id, now).catch(() => {})
  const res = redirect(req, "/scan-telephone")
  res.cookies.set(PAIR_COOKIE, params.token, {
    httpOnly: true,
    secure: req.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: Math.max(1, Math.floor((new Date(row.expires_at).getTime() - now.getTime()) / 1000)),
  })
  return res
}
