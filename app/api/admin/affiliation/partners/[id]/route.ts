/**
 * PATCH /api/admin/affiliation/partners/[id]   modifie un partenaire (nom, site, contact, commission, archive)
 * Admin seulement. Un partenaire n'est jamais supprimé : il s'archive (ses chiffres restent).
 */
import { NextRequest, NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { createAdminClient } from "@/lib/supabase/server"
import { updatePartner } from "@/lib/affiliation/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: "Partenaire invalide." }, { status: 400 })
  const body = await request.json().catch(() => null)
  const res = await updatePartner(createAdminClient(), id, body)
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })
  return NextResponse.json({ ok: true })
}
