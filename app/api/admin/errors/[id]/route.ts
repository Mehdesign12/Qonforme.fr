import { NextRequest, NextResponse } from "next/server"
import { createClient, createAdminClient } from "@/lib/supabase/server"

/** PATCH /api/admin/errors/[id] — Marque une erreur comme résolue */
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth guard — admin seulement
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const adminEmails = (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean)
    if (!adminEmails.includes(user.email?.toLowerCase() ?? '')) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const { id } = await params

    const admin = createAdminClient()
    const { error } = await admin
      .from('error_logs')
      .update({ resolved_at: new Date().toISOString(), resolved_by: user.id })
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('admin/errors PATCH error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
