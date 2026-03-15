import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { isAdminAuthenticated } from "@/lib/admin-require"

/** PATCH /api/admin/support/[id] — Met à jour le statut d'un message de support */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const { id } = await params
    const body   = await request.json()
    const status = body?.status

    if (!['new', 'read', 'resolved'].includes(status)) {
      return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { error } = await admin
      .from('support_messages')
      .update({ status })
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('admin/support PATCH error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
