/**
 * POST /api/scan/pair/documents — le téléphone appairé crée un document pour le
 * compte de l'appairage (cookie posé par /scan/p/<jeton>). Seuls le type et les
 * champs de la photo sont acceptés : jamais de client ni de chantier (le téléphone
 * n'a pas accès à la liste des clients), le classement se termine sur l'ordinateur.
 * 20 documents au plus par appairage ; mêmes quotas et mêmes contrôles que le
 * compte connecté (lib/scan/service.ts).
 */
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createAdminClient } from "@/lib/supabase/server"
import { parseScanFields } from "@/lib/scan/documents"
import { PAIRING_MAX_DOCUMENTS, PAIR_COOKIE, authorizePairing, countPairingDocuments } from "@/lib/scan/pairing"
import { createScanDocument } from "@/lib/scan/service"

export const dynamic = "force-dynamic"

const ALLOWED = ["kind", "status", "supplier", "doc_number", "doc_date", "amount"] as const

export async function POST(request: NextRequest) {
  const admin = createAdminClient()
  const access = await authorizePairing(admin, cookies().get(PAIR_COOKIE)?.value)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const raw = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const body: Record<string, unknown> = {}
  for (const key of ALLOWED) if (raw[key] !== undefined) body[key] = raw[key]
  const parsed = parseScanFields(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  if ((await countPairingDocuments(admin, access.pairing.id)) >= PAIRING_MAX_DOCUMENTS) {
    return NextResponse.json({ error: `${PAIRING_MAX_DOCUMENTS} documents au plus par code. Générez un nouveau code sur votre ordinateur pour continuer.`, code: "PAIRING_LIMIT" }, { status: 409 })
  }
  const result = await createScanDocument(admin, access.pairing.user_id, parsed.value, { pairingId: access.pairing.id })
  return NextResponse.json(result.body, { status: result.status })
}
