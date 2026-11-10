/**
 * POST /api/admin/affiliation/analyze  { site, partnerId?, force? }
 *
 * Recommandations de pages pour un partenaire : un appel OpenSEO (payant) sur le
 * classement Google France de son site, rapproché de nos pages et de notre Search
 * Console (lib/affiliation/recommend.ts). Avec un partenaire, le résultat est
 * gardé 30 jours. Admin seulement.
 */
import { NextRequest, NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { createAdminClient } from "@/lib/supabase/server"
import { analyzeSite } from "@/lib/affiliation/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  const body = (await request.json().catch(() => null)) as { site?: unknown; partnerId?: unknown; force?: unknown } | null
  const partnerId = typeof body?.partnerId === "string" && UUID.test(body.partnerId) ? body.partnerId : null
  const res = await analyzeSite(createAdminClient(), { site: typeof body?.site === "string" ? body.site : "", partnerId, force: body?.force === true })
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })
  return NextResponse.json(res)
}
