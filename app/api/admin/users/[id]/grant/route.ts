/**
 * POST /api/admin/users/[id]/grant   offre une formule (Essentiel ou Artisan) à un
 * compte sans abonnement Stripe en cours : compte gratuit, résilié, ou formule déjà
 * offerte (alors remplacée). Body : { plan, period, months, note }. Admin seulement.
 */
import { NextRequest, NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { createAdminClient } from "@/lib/supabase/server"
import { grantPlan, parseGrantInput } from "@/lib/admin/grant"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 })
  const input = parseGrantInput(await request.json().catch(() => null))
  if ("error" in input) return NextResponse.json({ error: input.error }, { status: 400 })

  const admin = createAdminClient()
  const { data: user, error: userError } = await admin.auth.admin.getUserById(id)
  if (userError || !user?.user) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 })

  const res = await grantPlan(admin, id, input)
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })
  console.log(`[admin/grant] Formule ${input.plan} offerte à ${id} jusqu'au ${res.until ?? "sans limite"}`)
  return NextResponse.json({ ok: true, plan: input.plan, until: res.until })
}
