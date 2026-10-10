import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { revalidateBlog } from "@/lib/blog-revalidate"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import type { SeoDb } from "@/lib/seo/db"
import { loadCheckContext, publishNow, readPublishablePost } from "@/lib/seo/articles/publish"

/**
 * Article rédigé par l'onglet SEO (review_status ou audit_result présents) qui
 * passe en ligne : les modifications sont enregistrées, puis la publication
 * passe par publishNow (lib/seo/articles/publish.ts), qui refuse tant qu'une
 * valeur périmée, une affirmation interdite ou un concurrent reste dans le
 * texte (409 avec les passages). Rend null pour un article manuel ou ancien,
 * un article déjà publié, ou avant la migration de l'onglet SEO : comportement
 * habituel.
 */
async function publishWithSeoGuard(admin: SeoDb, id: string, updates: Record<string, unknown>): Promise<NextResponse | null> {
  const { data, error } = await admin.from('blog_posts').select('is_published, review_status, audit_result').eq('id', id).maybeSingle()
  if (error) {
    if (isMissingSchemaError(error)) return null
    throw error
  }
  if (!data) return NextResponse.json({ error: 'Article introuvable' }, { status: 404 })
  if (data.is_published || (!data.review_status && !data.audit_result)) return null

  if (Object.keys(updates).length > 0) {
    const { error: saveError } = await admin.from('blog_posts').update(updates).eq('id', id)
    if (saveError) {
      if (saveError.code === '23505') return NextResponse.json({ error: 'Ce slug est déjà utilisé' }, { status: 409 })
      throw saveError
    }
  }
  const post = await readPublishablePost(admin, id)
  if (!post) return NextResponse.json({ error: 'Article introuvable' }, { status: 404 })
  const result = await publishNow(admin, post, await loadCheckContext(admin))
  if (!result.ok) {
    return NextResponse.json(
      {
        error: `Publication refusée par le contrôle : ${Array.from(new Set(result.blockers.map((b) => b.label))).join(' ; ')}. Les modifications sont enregistrées ; corrigez ces passages puis publiez.`,
        code: 'check_failed',
        issues: result.blockers.map((b) => ({ label: b.label, excerpt: b.excerpt ?? null, detail: b.detail ?? null })),
      },
      { status: 409 },
    )
  }
  revalidateBlog(post.slug)
  return NextResponse.json({ success: true })
}

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
    if (typeof body?.seo_title === 'string') updates.seo_title = body.seo_title.trim().slice(0, 200) || null
    if (typeof body?.seo_description === 'string') updates.seo_description = body.seo_description.trim().slice(0, 400) || null

    const admin = createAdminClient()

    if (body?.is_published !== undefined) {
      // Article de l'onglet SEO passé en ligne : même garde serveur que « Publier maintenant »
      if (body.is_published) {
        const guarded = await publishWithSeoGuard(admin, id, updates)
        if (guarded) return guarded
      }
      updates.is_published = !!body.is_published
      if (body.is_published) {
        // La date de publication ne change qu'au passage en ligne : réenregistrer un
        // article publié ne doit pas le dater du jour (plan du site, date affichée)
        const { data: current, error: readError } = await admin
          .from('blog_posts')
          .select('is_published, published_at')
          .eq('id', id)
          .maybeSingle()
        if (readError) throw readError
        if (!current) return NextResponse.json({ error: 'Article introuvable' }, { status: 404 })
        if (!current.is_published || !current.published_at) updates.published_at = new Date().toISOString()
      }
    }

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

    revalidateBlog(typeof updates.slug === 'string' ? updates.slug : null)
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

    revalidateBlog()
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('admin/blog DELETE error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
