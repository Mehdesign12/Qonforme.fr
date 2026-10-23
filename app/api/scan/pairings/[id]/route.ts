/**
 * Un appairage, vu de l'ordinateur : état (actif, expiré, révoqué), téléphone
 * connecté ou non, nombre de documents reçus ; révocation (fermeture de la
 * fenêtre du QR code). Limité aux appairages du compte connecté.
 */
import { NextResponse } from "next/server"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { countPairingDocuments, pairingState, type PairingRow } from "@/lib/scan/pairing"

export const dynamic = "force-dynamic"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: "Code introuvable" }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { data, error } = await createAdminClient().from("scan_pairings").select("id, user_id, expires_at, claimed_at, revoked_at").eq("id", id).eq("user_id", user.id).maybeSingle()
  if (error) return NextResponse.json({ error: "Impossible de lire l'état du code." }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Code introuvable" }, { status: 404 })
  const row = data as Pick<PairingRow, "expires_at" | "revoked_at" | "claimed_at">
  return NextResponse.json(
    { state: pairingState(row), claimed: Boolean(row.claimed_at), documents: await countPairingDocuments(supabase, id), expires_at: row.expires_at },
    { headers: { "Cache-Control": "no-store" } },
  )
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: "Code introuvable" }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { error } = await createAdminClient().from("scan_pairings").update({ revoked_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id).is("revoked_at", null)
  if (error) return NextResponse.json({ error: "Impossible de révoquer le code." }, { status: 500 })
  return NextResponse.json({ ok: true })
}
