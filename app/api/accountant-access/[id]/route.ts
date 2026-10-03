/**
 * DELETE /api/accountant-access/[id] — l'artisan retire un accès ou annule une
 * invitation. Effet immédiat : chaque requête du comptable revérifie l'accès.
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { revokeAccess } from "@/lib/accountant/server"

export const dynamic = "force-dynamic"

interface Params { params: Promise<{ id: string }> }

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    const { id } = await params
    const result = await revokeAccess({ ownerId: user.id, accessId: id })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[accountant-access] DELETE", err)
    return NextResponse.json({ error: "Le retrait de l'accès a échoué. Réessayez." }, { status: 500 })
  }
}
