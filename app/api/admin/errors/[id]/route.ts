import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { isAdminAuthenticated } from "@/lib/admin-require"

/** PATCH /api/admin/errors/[id] — Marque une erreur comme résolue */
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const { id } = await params

    const admin = createAdminClient()
    const { error } = await admin
      .from('error_logs')
      .update({ resolved_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('admin/errors PATCH error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
