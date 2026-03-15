import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { isAdminAuthenticated } from "@/lib/admin-require"

/** POST /api/admin/blog — Créer un article */
export async function POST(request: NextRequest) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const body        = await request.json()
    const title       = (body?.title ?? '').trim()
    const slug        = (body?.slug ?? '').trim()
    const content     = (body?.content ?? '').trim()
    const excerpt     = (body?.excerpt ?? '').trim() || null
    const cover_url   = (body?.cover_url ?? '').trim() || null
    const is_published = !!body?.is_published

    if (!title || !slug || !content) {
      return NextResponse.json({ error: 'Titre, slug et contenu obligatoires' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('blog_posts')
      .insert({
        title,
        slug,
        content,
        excerpt,
        cover_url,
        is_published,
        published_at: is_published ? new Date().toISOString() : null,
      })
      .select('id')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Ce slug est déjà utilisé' }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({ success: true, id: data.id }, { status: 201 })
  } catch (err) {
    console.error('admin/blog POST error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
