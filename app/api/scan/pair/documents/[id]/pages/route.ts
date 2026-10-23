/** POST — le téléphone appairé envoie une page d'un document de SON appairage (mêmes contrôles que le compte connecté). */
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createAdminClient } from "@/lib/supabase/server"
import { PAIR_COOKIE, authorizePairing } from "@/lib/scan/pairing"
import { addScanPage } from "@/lib/scan/service"

export const dynamic = "force-dynamic"
export const maxDuration = 30

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: "Document introuvable" }, { status: 404 })
  const admin = createAdminClient()
  const access = await authorizePairing(admin, cookies().get(PAIR_COOKIE)?.value)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const form = await request.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: "Aucune image reçue." }, { status: 400 })
  const result = await addScanPage(admin, access.pairing.user_id, id, form.get("file"), Number(form.get("position")), { pairingId: access.pairing.id })
  return NextResponse.json(result.body, { status: result.status })
}
