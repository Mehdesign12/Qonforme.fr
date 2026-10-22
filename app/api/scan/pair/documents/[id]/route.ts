/** DELETE — le téléphone retire un document de SON appairage (reprise après une page qui n'a pas pu être envoyée). */
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createAdminClient } from "@/lib/supabase/server"
import { PAIR_COOKIE, authorizePairing } from "@/lib/scan/pairing"
import { deleteScanDocument } from "@/lib/scan/service"

export const dynamic = "force-dynamic"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: "Document introuvable" }, { status: 404 })
  const admin = createAdminClient()
  const access = await authorizePairing(admin, cookies().get(PAIR_COOKIE)?.value)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  const result = await deleteScanDocument(admin, access.pairing.user_id, id, { pairingId: access.pairing.id })
  return NextResponse.json(result.body, { status: result.status })
}
