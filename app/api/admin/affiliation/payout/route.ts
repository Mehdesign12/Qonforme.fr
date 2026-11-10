/**
 * POST /api/admin/affiliation/payout  { partnerId }
 *
 * Note comme versées les commissions dues d'un partenaire (garantie de 30 jours
 * passée, production seulement), après le virement fait à la main. Admin seulement.
 */
import { NextRequest, NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { createAdminClient } from "@/lib/supabase/server"
import { markPaidOut } from "@/lib/affiliation/data"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  const body = (await request.json().catch(() => null)) as { partnerId?: unknown } | null
  const partnerId = typeof body?.partnerId === "string" && UUID.test(body.partnerId) ? body.partnerId : null
  if (!partnerId) return NextResponse.json({ error: "Partenaire invalide." }, { status: 400 })
  const res = await markPaidOut(createAdminClient(), partnerId)
  if (!res.ok) return NextResponse.json({ error: res.message }, { status: res.kind === "unavailable" ? 503 : 500 })
  return NextResponse.json(res.data)
}
