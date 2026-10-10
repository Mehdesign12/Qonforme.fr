/**
 * PATCH /api/admin/seo/articles/posts/<id>  { action: "publish" | "unpublish" }
 *
 * - publish (« Publier maintenant ») : le contrôle repasse sur le texte actuel ;
 *   refusé (409, liste des passages) tant qu'une valeur périmée ou une
 *   affirmation interdite reste ;
 * - unpublish (« Repasser en brouillon ») : l'article quitte le blog.
 * Le blog, l'article et les plans du site sont rafraîchis (revalidateBlog).
 */
import { NextRequest, NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { errorPayload, seoDb } from "@/lib/seo/db"
import { ID, postPatchSchema, zodError } from "@/lib/seo/articles/input"
import { loadCheckContext, publishNow, readPublishablePost, unpublish } from "@/lib/seo/articles/publish"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> | { id: string } }

export async function PATCH(request: NextRequest, { params }: Params) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  const { id } = await params
  if (!ID.safeParse(id).success) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 })
  const parsed = postPatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json(zodError(parsed.error), { status: 400 })

  try {
    const db = seoDb()
    const post = await readPublishablePost(db, id)
    if (!post) return NextResponse.json({ error: "Article introuvable." }, { status: 404 })

    if (parsed.data.action === "unpublish") {
      if (!post.is_published) return NextResponse.json({ ok: true })
      await unpublish(db, post)
      return NextResponse.json({ ok: true })
    }

    const result = await publishNow(db, post, await loadCheckContext(db))
    if (!result.ok) {
      return NextResponse.json(
        {
          error: "Publication refusée : le contrôle repère une valeur périmée ou une affirmation interdite. Corrigez l'article puis réessayez.",
          code: "check_failed",
          issues: result.blockers.map((b) => ({ label: b.label, excerpt: b.excerpt ?? null, detail: b.detail ?? null })),
        },
        { status: 409 },
      )
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    const { status, body } = errorPayload(error)
    return NextResponse.json(body, { status })
  }
}
