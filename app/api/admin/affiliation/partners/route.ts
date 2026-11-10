/**
 * GET  /api/admin/affiliation/partners   liste des partenaires et leurs chiffres
 * POST /api/admin/affiliation/partners   crée un partenaire (pages et recommandations retenues comprises)
 * Admin seulement.
 */
import { NextRequest, NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { createAdminClient } from "@/lib/supabase/server"
import { listPartners } from "@/lib/affiliation/data"
import { createPartner } from "@/lib/affiliation/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const denied = () => NextResponse.json({ error: "Non autorisé" }, { status: 401 })

export async function GET() {
  if (!(await isAdminAuthenticated())) return denied()
  const res = await listPartners(createAdminClient())
  if (!res.ok) return NextResponse.json({ error: res.message }, { status: res.kind === "unavailable" ? 503 : 500 })
  return NextResponse.json({ partners: res.data })
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) return denied()
  const body = await request.json().catch(() => null)
  const res = await createPartner(createAdminClient(), body)
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })
  return NextResponse.json({ id: res.id }, { status: 201 })
}
