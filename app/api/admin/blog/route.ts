import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { revalidateBlog } from "@/lib/blog-revalidate"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import { parseCoverUrl, parseEditorFields, parseSlug } from "@/lib/seo/articles/editor-input"
import { blockersBeforeCreate } from "@/lib/seo/articles/publish"

/**
 * Colonnes ajoutées par les migrations 20261006 et 20261009 : absentes avant
 * elles. Une création refusée pour une colonne inconnue est rejouée sans
 * elles, sauf une publication programmée (sans sa colonne, l'article ne
 * partirait jamais).
 */
const OPTIONAL_COLUMNS = ["seo_title", "seo_description", "cover_alt", "target_keyword", "scheduled_at"]

/**
 * POST /api/admin/blog — Créer un article → 201 { success, id, slug }
 *
 * Champs de l'éditeur : titre, adresse, contenu (obligatoires), chapeau,
 * couverture et son texte alternatif, titre et description Google, mot-clé
 * principal, publication immédiate (`is_published`) ou programmée
 * (`scheduled_at`, instant à venir : lib/seo/articles/editor-input.ts).
 *
 * Publication immédiate : même contrôle que « Publier maintenant » avant tout
 * enregistrement (valeur périmée, affirmation interdite, concurrent nommé,
 * dans le texte, le titre Google ou le texte alternatif) ; un passage bloquant
 * répond 409 « check_failed » avec les passages, et rien n'est créé.
 */
export async function POST(request: NextRequest) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })

    const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
    const title       = str(body.title)
    const content     = str(body.content)
    const excerpt     = str(body.excerpt) || null
    const is_published = body.is_published === true

    if (!title || !str(body.slug) || !content) {
      return NextResponse.json({ error: 'Titre, adresse et contenu sont obligatoires.' }, { status: 400 })
    }
    // Tirets en trop retirés (adresse coupée à 80 caractères juste après un tiret), puis contrôlée
    const slugInput = parseSlug(body.slug)
    if (!slugInput.ok) return NextResponse.json({ error: slugInput.error }, { status: 400 })
    const slug = slugInput.value
    const cover = parseCoverUrl(body.cover_url)
    if (!cover.ok) return NextResponse.json({ error: cover.error }, { status: 400 })
    const cover_url = cover.value

    const fields = parseEditorFields(body)
    if (!fields.ok) return NextResponse.json({ error: fields.error }, { status: 400 })
    const scheduledAt = fields.value.scheduled_at ?? null
    if (scheduledAt && is_published) {
      return NextResponse.json({ error: 'Choisissez entre publier maintenant et programmer la publication.' }, { status: 400 })
    }

    const row: Record<string, unknown> = {
      title,
      slug,
      content,
      excerpt,
      cover_url,
      is_published,
      published_at: is_published ? new Date().toISOString() : null,
    }
    if (typeof body.seo_title === 'string' && body.seo_title.trim()) row.seo_title = body.seo_title.trim().slice(0, 200)
    if (typeof body.seo_description === 'string' && body.seo_description.trim()) row.seo_description = body.seo_description.trim().slice(0, 400)
    if (fields.value.cover_alt) row.cover_alt = fields.value.cover_alt
    if (fields.value.target_keyword) row.target_keyword = fields.value.target_keyword
    if (scheduledAt) row.scheduled_at = scheduledAt

    const admin = createAdminClient()
    if (is_published) {
      const blockers = await blockersBeforeCreate(admin, {
        slug,
        title,
        excerpt,
        content,
        seo_description: typeof row.seo_description === 'string' ? row.seo_description : null,
        seo_title: typeof row.seo_title === 'string' ? row.seo_title : null,
        cover_alt: typeof row.cover_alt === 'string' ? row.cover_alt : null,
      })
      if (blockers.length > 0) {
        return NextResponse.json(
          {
            error: `Publication refusée par le contrôle : ${Array.from(new Set(blockers.map((b) => b.label))).join(' ; ')}. L'article n'est pas encore enregistré : corrigez ces passages, ou enregistrez-le en brouillon.`,
            code: 'check_failed',
            created: false,
            issues: blockers.map((b) => ({ label: b.label, excerpt: b.excerpt ?? null, detail: b.detail ?? null })),
          },
          { status: 409 },
        )
      }
    }
    let res = await admin.from('blog_posts').insert(row).select('id, slug').single()
    if (res.error && isMissingSchemaError(res.error)) {
      if (scheduledAt) {
        return NextResponse.json(
          { error: "La programmation s'active après la mise à jour de la base de données (migration 20261009_seo_admin.sql)." },
          { status: 503 },
        )
      }
      const fallback = Object.fromEntries(Object.entries(row).filter(([k]) => !OPTIONAL_COLUMNS.includes(k)))
      res = await admin.from('blog_posts').insert(fallback).select('id, slug').single()
    }

    if (res.error) {
      if (res.error.code === '23505') {
        return NextResponse.json({ error: 'Cette adresse est déjà utilisée par un autre article.' }, { status: 409 })
      }
      throw res.error
    }
    const created = res.data as { id: string; slug: string }

    if (is_published) revalidateBlog(created.slug)
    return NextResponse.json({ success: true, id: created.id, slug: created.slug }, { status: 201 })
  } catch (err) {
    console.error('admin/blog POST error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
