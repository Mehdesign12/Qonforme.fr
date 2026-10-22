/**
 * POST /api/scan/pairings — crée l'appairage d'un téléphone (QR code de
 * l'ordinateur). Réservé au compte connecté ; l'adresse rendue contient le jeton
 * (affiché une seule fois). 503 PAIRING_UNAVAILABLE tant que la migration
 * 20261022_scan_pairings.sql n'est pas appliquée : l'ordinateur propose alors le
 * QR code simple vers la page Documents.
 */
import { NextResponse } from "next/server"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { loadUsage } from "@/lib/scan/server"
import { createPairing } from "@/lib/scan/pairing"
import { appUrl } from "@/lib/signature/server"

export const dynamic = "force-dynamic"

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  let used
  try { used = await loadUsage(supabase, user.id) } catch { used = undefined }
  if (used === null) return NextResponse.json({ error: "Les documents scannés ne sont pas encore activés.", code: "PAIRING_UNAVAILABLE" }, { status: 503 })

  const created = await createPairing(createAdminClient(), user.id)
  if (!created.ok) {
    return NextResponse.json(
      { error: created.unavailable ? "L'appairage du téléphone n'est pas encore activé." : "Impossible de créer le code. Réessayez.", code: created.unavailable ? "PAIRING_UNAVAILABLE" : undefined },
      { status: created.unavailable ? 503 : 500 },
    )
  }
  return NextResponse.json(
    { id: created.id, url: `${appUrl()}/scan/p/${created.token}`, expires_at: created.expiresAt },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  )
}
