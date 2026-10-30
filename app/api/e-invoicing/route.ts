/**
 * Facturation électronique d'un compte.
 *
 * GET    : vue de la page (disponibilité, formule, raccordement, compteurs).
 * DELETE : retire le raccordement (« Retirer le raccordement », « Annuler et
 *          recommencer ») : jeton révoqué chez Super PDP (RFC 7009), ligne
 *          supprimée. Les factures déjà reçues restent dans Qonforme.
 */
import { NextResponse } from "next/server"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { loadEInvoicingView } from "@/lib/pa/server"
import { loadConnection, PA_TABLE } from "@/lib/pa/store"
import { superPdpConfig } from "@/lib/pa/superpdp/config"
import { paKey, unseal } from "@/lib/pa/superpdp/crypto"
import { revokeToken } from "@/lib/pa/superpdp/oauth"

export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  const res = await loadEInvoicingView(createAdminClient(), user.id)
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })
  return NextResponse.json({ view: res.view }, { headers: { "Cache-Control": "no-store" } })
}

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  const admin = createAdminClient()
  const loaded = await loadConnection(admin, user.id)
  if (!loaded.ok) return NextResponse.json({ error: "Lecture impossible pour le moment." }, { status: 503 })
  if (loaded.row) {
    const cfg = superPdpConfig(loaded.row.mode)
    const refresh = unseal(loaded.row.refresh_token_enc, paKey("token"))
    if (cfg && refresh) await revokeToken(cfg, refresh)
    const { error } = await admin.from(PA_TABLE).delete().eq("user_id", user.id)
    if (error) return NextResponse.json({ error: "Retrait impossible pour le moment. Réessayez." }, { status: 500 })
  }
  const res = await loadEInvoicingView(admin, user.id)
  return NextResponse.json({ view: res.ok ? res.view : null })
}
