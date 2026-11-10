/**
 * GET /api/emails/c?e=<email>&p=<chemin>&s=<signature>
 *
 * Lien de retour d'un email envoyé à un compte (lib/email/journal.ts) : compte
 * le clic, puis renvoie vers la page du site visée. Lien invalide : accueil,
 * jamais une erreur pour la personne qui clique. Publique (l'artisan n'est pas
 * forcément connecté) : le middleware envoie vers la connexion si besoin.
 */
import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { recordClick, verifyTrackedLink } from "@/lib/email/journal"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams
  const link = verifyTrackedLink({ e: q.get("e"), p: q.get("p"), s: q.get("s") })
  const target = new URL(link?.path ?? "/", request.nextUrl.origin)
  if (link) await recordClick(createAdminClient(), link.emailId)
  const res = NextResponse.redirect(target, 302)
  res.headers.set("Cache-Control", "no-store")
  res.headers.set("Referrer-Policy", "no-referrer")
  return res
}
