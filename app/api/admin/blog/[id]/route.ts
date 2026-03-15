import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { isAdminAuthenticated } from "@/lib/admin-require"

/** PATCH /api/admin/blog/[id] — Mettre à jour un article */
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

    const updates: Record<string, unknown> = {}
    if (body?.title    !== undefined) updates.title       = body.title.trim()
    if (body?.slug     !== undefined) updates.slug        = body.slug.trim()
    if (body?.content  !== undefined) updates.content     = body.content.trim()
    if (body?.excerpt  !== undefined) updates.excerpt     = body.excerpt?.trim() || null
    if (body?.cover_url !== undefined) updates.cover_url  = body.cover_url?.trim() || null
    if (body?.is_published !== undefined) {
      updates.is_published = !!body.is_published
      if (body.is_published) {
        updates.published_at = new Date().toISOString()
      }
    }

    const admin = createAdminClient()
    const { error } = await admin
      .from('blog_posts')
      .update(updates)
      .eq('id', id)

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Ce slug est déjà utilisé' }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('admin/blog PATCH error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/** DELETE /api/admin/blog/[id] — Supprimer un article */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const { id } = await params

    const admin = createAdminClient()
    const { error } = await admin.from('blog_posts').delete().eq('id', id)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('admin/blog DELETE error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
