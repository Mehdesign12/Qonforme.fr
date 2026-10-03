/**
 * POST /api/emails/unsubscribe
 *
 * Désinscription des conseils de démarrage, sans connexion, par le jeton signé
 * du lien (lib/onboarding/unsubscribe.ts) :
 * - depuis la page /desinscription : JSON { token, subscribe? } (subscribe:
 *   true pour se réabonner) ;
 * - depuis le logiciel de messagerie (RFC 8058, « List-Unsubscribe-Post ») :
 *   POST ?t=<jeton> avec le corps « List-Unsubscribe=One-Click ».
 *
 * Aucune action sur une requête GET : les analyseurs de liens des messageries
 * ouvrent les URL des emails, et désinscriraient les gens à leur insu.
 * Les emails transactionnels (documents, copies, relances de factures,
 * sécurité) ne sont pas concernés.
 */
import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { saveOnboardingEmailsEnabled } from "@/lib/onboarding/store"
import { verifyUnsubscribeToken } from "@/lib/onboarding/unsubscribe"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  let token: unknown = request.nextUrl.searchParams.get("t")
  let subscribe = false

  const type = request.headers.get("content-type") ?? ""
  if (type.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as { token?: unknown; subscribe?: unknown } | null
    if (body?.token) token = body.token
    subscribe = body?.subscribe === true
  }

  const userId = verifyUnsubscribeToken(token)
  if (!userId) return NextResponse.json({ error: "Lien de désinscription invalide." }, { status: 400 })

  const res = await saveOnboardingEmailsEnabled(createAdminClient(), userId, subscribe)
  if (res.error) {
    console.error("[emails/unsubscribe] enregistrement en échec :", res.error.message)
    return NextResponse.json({ error: "Enregistrement impossible. Réessayez dans un instant." }, { status: 503 })
  }
  return NextResponse.json({ ok: true, subscribed: subscribe }, { headers: { "Cache-Control": "no-store" } })
}
