import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { revalidateBlog } from "@/lib/blog-revalidate"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import type { SeoDb } from "@/lib/seo/db"
import { loadCheckContext, markTopic, publishNow, readPublishablePost } from "@/lib/seo/articles/publish"
import { parseCoverUrl, parseEditorFields, parseSlug } from "@/lib/seo/articles/editor-input"
import { ID } from "@/lib/seo/articles/input"

/**
 * Colonnes ajoutées par les migrations 20261006 (titre, description, texte
 * alternatif) et 20261009 (mot-clé, programmation, relecture) : absentes
 * avant elles. Une écriture refusée pour une colonne inconnue est rejouée
 * sans elles (règle « migration pas encore appliquée » de schema-guard.ts),
 * sauf une programmation, qui ne peut pas être enregistrée sans sa colonne.
 */
const OPTIONAL_COLUMNS = ["seo_title", "seo_description", "cover_alt", "target_keyword", "scheduled_at", "review_status", "held_reason"]

const SCHEDULE_PENDING = "La programmation s'active après la mise à jour de la base de données (migration 20261009_seo_admin.sql)."
const SLUG_TAKEN = "Cette adresse est déjà utilisée par un autre article."

type DbError = { code?: string | null; message?: string | null } | null

function withoutOptional(updates: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(updates).filter(([k]) => !OPTIONAL_COLUMNS.includes(k)))
}

/**
 * Écrit les modifications ; rejoue sans les colonnes facultatives si l'une
 * manque. Rend l'erreur restante, ou « schedule_pending » si une date
 * programmée ne peut pas être enregistrée.
 */
async function writePost(admin: SeoDb, id: string, updates: Record<string, unknown>): Promise<DbError | "schedule_pending"> {
  if (Object.keys(updates).length === 0) return null
  const { error } = await admin.from("blog_posts").update(updates).eq("id", id)
  if (!error || !isMissingSchemaError(error)) return error
  if (typeof updates.scheduled_at === "string") return "schedule_pending"
  const fallback = withoutOptional(updates)
  if (Object.keys(fallback).length === 0) return null
  const retry = await admin.from("blog_posts").update(fallback).eq("id", id)
  return retry.error
}

/**
 * Article qui passe en ligne, qu'il vienne de l'onglet SEO ou qu'il soit écrit
 * à la main : les modifications sont enregistrées, puis la publication passe
 * par publishNow (lib/seo/articles/publish.ts), qui refuse tant qu'une valeur
 * périmée, une affirmation interdite ou un concurrent reste dans le texte, le
 * titre Google ou le texte alternatif (409 avec les passages) : même contrôle
 * que « Publier maintenant » et que la publication à l'heure prévue. Rend null
 * pour un article déjà publié, ou avant la migration de l'onglet SEO :
 * comportement habituel.
 */
async function publishWithSeoGuard(admin: SeoDb, id: string, updates: Record<string, unknown>): Promise<NextResponse | null> {
  const { data, error } = await admin.from('blog_posts').select('is_published, review_status, audit_result').eq('id', id).maybeSingle()
  if (error) {
    if (isMissingSchemaError(error)) return null
    throw error
  }
  if (!data) return NextResponse.json({ error: 'Article introuvable' }, { status: 404 })
  if (data.is_published) return null

  const saveError = await writePost(admin, id, updates)
  if (saveError === "schedule_pending") return NextResponse.json({ error: SCHEDULE_PENDING }, { status: 503 })
  if (saveError) {
    if (saveError.code === '23505') return NextResponse.json({ error: SLUG_TAKEN }, { status: 409 })
    throw saveError
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

/**
 * PATCH /api/admin/blog/[id] — Mettre à jour un article
 *
 * En plus du contenu : `target_keyword` (mot-clé principal), `cover_alt`
 * (texte alternatif de la couverture) et `scheduled_at` (lib/seo/articles/editor-input.ts).
 * - `scheduled_at` posé (instant à venir) : l'article quitte le blog s'il y
 *   était, attend son heure, et aucune décision de relecture ne reste
 *   (`review_status`, `held_reason` remis à null) : la tâche planifiée le
 *   publiera, après le contrôle (lib/seo/articles/publish.ts) ;
 * - publication (`is_published: true`) : la date programmée est retirée ;
 * - `scheduled_at: null` : programmation retirée.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const { id } = await params
    // Identifiant illisible : la base répondrait par une erreur de type (500)
    if (!ID.safeParse(id).success) return NextResponse.json({ error: 'Identifiant invalide' }, { status: 400 })
    const body   = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })

    const fields = parseEditorFields(body)
    if (!fields.ok) return NextResponse.json({ error: fields.error }, { status: 400 })
    const scheduling = typeof fields.value.scheduled_at === 'string'
    if (scheduling && body.is_published === true) {
      return NextResponse.json({ error: 'Choisissez entre publier maintenant et programmer la publication.' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    if (typeof body.title   === 'string') updates.title       = body.title.trim()
    if (typeof body.content === 'string') updates.content     = body.content.trim()
    if (body.excerpt   !== undefined) updates.excerpt   = typeof body.excerpt === 'string' ? body.excerpt.trim() || null : null
    if (body.cover_url !== undefined) {
      const cover = parseCoverUrl(body.cover_url)
      if (!cover.ok) return NextResponse.json({ error: cover.error }, { status: 400 })
      updates.cover_url = cover.value
    }
    // Adresse : mêmes règles qu'à la création ; une adresse ancienne hors de ces règles
    // et renvoyée telle quelle (aucun changement) reste acceptée, voir plus bas
    let legacySlug: string | null = null
    if (typeof body.slug === 'string') {
      const slug = parseSlug(body.slug)
      if (slug.ok) updates.slug = slug.value
      else if (body.slug.trim()) legacySlug = body.slug.trim()
      else updates.slug = ''
    }
    if (typeof body.seo_title === 'string') updates.seo_title = body.seo_title.trim().slice(0, 200) || null
    if (typeof body.seo_description === 'string') updates.seo_description = body.seo_description.trim().slice(0, 400) || null
    if (fields.value.target_keyword !== undefined) updates.target_keyword = fields.value.target_keyword
    if (fields.value.cover_alt !== undefined) updates.cover_alt = fields.value.cover_alt
    if (fields.value.scheduled_at !== undefined) updates.scheduled_at = fields.value.scheduled_at

    if (updates.title === '' || updates.slug === '' || updates.content === '') {
      return NextResponse.json({ error: 'Titre, adresse et contenu ne peuvent pas être vides.' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Article avant modification, lu à chaque fois (une petite lecture) : l'éditeur n'envoie que
    // les champs changés, l'adresse de la page à rafraîchir n'est donc pas dans la requête ; date
    // de publication à garder
    type CurrentPost = { slug: string; is_published: boolean; published_at: string | null }
    const { data: currentRow, error: readError } = await admin.from('blog_posts').select('slug, is_published, published_at').eq('id', id).maybeSingle()
    if (readError) throw readError
    if (!currentRow) return NextResponse.json({ error: 'Article introuvable' }, { status: 404 })
    const current = currentRow as CurrentPost
    if (legacySlug !== null && legacySlug !== current.slug) {
      const slug = parseSlug(legacySlug)
      return NextResponse.json({ error: slug.ok ? 'Adresse invalide.' : slug.error }, { status: 400 })
    }

    if (scheduling) {
      // Programmé : hors ligne jusqu'à l'heure prévue, sans décision de relecture qui empêcherait la tâche de le reprendre
      updates.is_published = false
      updates.review_status = null
      updates.held_reason = null
    } else if (body.is_published !== undefined) {
      if (body.is_published) {
        updates.scheduled_at = null
        // Article passé en ligne (onglet SEO ou écrit à la main) : même garde serveur que « Publier maintenant »
        const guarded = await publishWithSeoGuard(admin, id, updates)
        if (guarded) return guarded
      }
      updates.is_published = !!body.is_published
      // La date de publication ne change qu'au passage en ligne : réenregistrer un
      // article publié ne doit pas le dater du jour (plan du site, date affichée)
      if (body.is_published && (!current.is_published || !current.published_at)) {
        updates.published_at = new Date().toISOString()
      }
    }

    const error = await writePost(admin, id, updates)
    if (error === 'schedule_pending') return NextResponse.json({ error: SCHEDULE_PENDING }, { status: 503 })
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: SLUG_TAKEN }, { status: 409 })
      }
      throw error
    }

    if (scheduling) {
      // Article rédigé depuis un sujet de l'onglet SEO : à l'heure prévue, la tâche suit le
      // mode de ses sujets, quel que soit leur statut (un sujet « Brouillon » retiendrait
      // l'article « À relire »). L'admin vient de choisir la date dans l'éditeur, comme
      // « Publier maintenant » : tous les sujets de l'article passent en « Directement »
      // (seuls les passages bloquants retiennent l'article), y compris un sujet déjà publié
      // puis repassé en brouillon, ou archivé ; pas un sujet en cours de rédaction. La date
      // n'est recopiée que sur un sujet rédigé ou planifié.
      const nowIso = new Date().toISOString()
      const { error: modeError } = await admin
        .from('seo_topics')
        .update({ publish_mode: 'direct', updated_at: nowIso })
        .eq('post_id', id)
        .neq('status', 'generating')
      if (modeError && !isMissingSchemaError(modeError)) throw modeError
      const { error: topicError } = await admin
        .from('seo_topics')
        .update({ scheduled_at: updates.scheduled_at, updated_at: nowIso })
        .eq('post_id', id)
        .in('status', ['drafted', 'planned'])
      if (topicError && !isMissingSchemaError(topicError)) throw topicError
    } else if (body.is_published === false && current.is_published) {
      // Article retiré du blog : son sujet redevient « rédigé », comme « Repasser en brouillon »
      await markTopic(admin, id, 'drafted', new Date().toISOString())
    }

    revalidateBlog(current.slug)
    // Adresse changée : la nouvelle page est rafraîchie aussi (l'ancienne l'est juste au-dessus)
    if (typeof updates.slug === 'string' && updates.slug !== current.slug) revalidateBlog(updates.slug)
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
    if (!ID.safeParse(id).success) return NextResponse.json({ error: 'Identifiant invalide' }, { status: 400 })

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
