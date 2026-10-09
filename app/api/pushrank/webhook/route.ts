/**
 * Réception des articles PushRank (webhook CMS, contrat « 2026-07 »).
 *
 * - Signature HMAC vérifiée sur le corps brut, requêtes de plus de 5 minutes refusées.
 * - Test de connexion : 200 sans rien enregistrer.
 * - create : la clé X-PushRank-Idempotency-Key est enregistrée sur l'article
 *   (colonne unique) ; un renvoi de la même clé rend le même article, jamais un
 *   second. Réponse : { id, url }.
 * - update : remplace l'article à la même adresse ; unpublish et delete le
 *   repassent en brouillon sans le supprimer.
 * - Seuls les articles venus de PushRank peuvent être modifiés par ce webhook.
 *
 * Codes : 4xx quand l'événement ne réussira jamais tel quel (PushRank ne
 * réessaie pas), 5xx quand le problème est passager (PushRank réessaie 3 fois),
 * 2xx seulement une fois l'article enregistré. Variable : PUSHRANK_WEBHOOK_SECRET.
 * Migration : supabase/migrations/20261006_pushrank_webhook.sql.
 */
import { NextResponse, type NextRequest } from "next/server"
import { revalidateBlog } from "@/lib/blog-revalidate"
import { createAdminClient } from "@/lib/supabase/server"
import { rehostCover } from "@/lib/pushrank/cover"
import {
  articleUrl,
  isUuid,
  parsePushrankEvent,
  publicationDecision,
  toBlogPost,
  verifyPushrankSignature,
  type PushrankArticle,
} from "@/lib/pushrank/webhook"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

type Admin = ReturnType<typeof createAdminClient>
type DbError = { code?: string; message?: string } | null

class StorageError extends Error {
  constructor(public where: string, public dbError: DbError) {
    super(where)
  }
}

const json = (body: unknown, status = 200) => NextResponse.json(body, { status })

/** Base injoignable ou migration absente : 503, PushRank réessaie. */
function storageResponse(err: StorageError) {
  const e = err.dbError
  const migration = e?.code === "42703" || e?.code === "PGRST204" || /column .* does not exist|could not find the .* column/i.test(e?.message ?? "")
  console.error(`[pushrank] ${err.where} :`, e?.code, e?.message, migration ? "— migration 20261006_pushrank_webhook.sql à appliquer" : "")
  return json({ error: migration ? "migration_pending" : "storage_unavailable" }, 503)
}

function revalidate(slug: string) {
  revalidateBlog(slug)
}

async function findByCreateKey(admin: Admin, key: string) {
  const { data, error } = await admin.from("blog_posts").select("id, slug").eq("external_create_key", key).maybeSingle()
  if (error) throw new StorageError("recherche de la clé", error)
  return data as { id: string; slug: string } | null
}

/** Article venu de PushRank, sinon null (un id inconnu ou d'un autre article donne 404). */
async function findPushrankPost(admin: Admin, id: string) {
  if (!isUuid(id)) return null
  const { data, error } = await admin
    .from("blog_posts")
    .select("id, slug, source, published_at, cover_url, cover_source_url")
    .eq("id", id)
    .maybeSingle()
  if (error) throw new StorageError("recherche de l'article", error)
  const post = data as { id: string; slug: string; source: string | null; published_at: string | null; cover_url: string | null; cover_source_url: string | null } | null
  return post && post.source === "pushrank" ? post : null
}

/** Première adresse libre : slug, slug-2, slug-3… */
async function freeSlug(admin: Admin, base: string): Promise<string> {
  for (let n = 1; n <= 30; n++) {
    const slug = n === 1 ? base : `${base.slice(0, 86)}-${n}`
    const { data, error } = await admin.from("blog_posts").select("id").eq("slug", slug).maybeSingle()
    if (error) throw new StorageError("adresse de l'article", error)
    if (!data) return slug
  }
  return `${base.slice(0, 80)}-${Date.now().toString(36)}`
}

async function create(admin: Admin, article: PushrankArticle, key: string) {
  if (!key) return json({ error: "missing_idempotency_key" }, 400)

  // Renvoi d'un événement déjà traité : même réponse, aucun second article
  const known = await findByCreateKey(admin, key)
  if (known) return json({ id: known.id, url: articleUrl(known.slug) })

  const fields = toBlogPost(article)
  if (!fields.content) return json({ error: "empty_content" }, 400)
  const decision = publicationDecision(fields)
  const cover = await rehostCover(article.featured_image_url, fields.slug)

  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = await freeSlug(admin, fields.slug)
    const now = new Date().toISOString()
    const { data, error } = await admin
      .from("blog_posts")
      .insert({
        title: fields.title,
        slug,
        excerpt: fields.excerpt,
        content: fields.content,
        seo_title: fields.seo_title,
        seo_description: fields.seo_description,
        cover_url: cover,
        cover_source_url: cover ? article.featured_image_url : null,
        cover_alt: fields.cover_alt,
        robots: fields.robots,
        is_published: decision.publish,
        published_at: decision.publish ? now : null,
        held_reason: decision.heldReason,
        source: "pushrank",
        external_create_key: key,
        ai_generated: true,
        ai_model: "PushRank",
        ai_prompt: fields.ai_prompt,
        ai_keywords: fields.ai_keywords,
        auto_publish: decision.publish,
      })
      .select("id, slug")
      .single()

    if (!error && data) {
      revalidate(data.slug)
      console.info(`[pushrank] Article ${decision.publish ? "publié" : "retenu en brouillon"} : /blog/${data.slug}`, decision.heldReason ?? "")
      return json({ id: data.id, url: articleUrl(data.slug) })
    }
    if (error?.code === "23505") {
      // Même clé reçue deux fois en même temps : rendre l'article déjà créé
      const again = await findByCreateKey(admin, key)
      if (again) return json({ id: again.id, url: articleUrl(again.slug) })
      continue // adresse prise entre-temps : nouvel essai
    }
    throw new StorageError("création de l'article", error)
  }
  return json({ error: "slug_conflict" }, 503)
}

async function update(admin: Admin, id: string, article: PushrankArticle) {
  const current = await findPushrankPost(admin, id)
  if (!current) return json({ error: "not_found" }, 404)

  const fields = toBlogPost(article)
  if (!fields.content) return json({ error: "empty_content" }, 400)
  const decision = publicationDecision(fields)

  // Couverture : re-hébergée seulement si l'image source a changé ; retirée si l'article n'en a plus
  let cover = current.cover_url
  let coverSource = current.cover_source_url
  if (!article.featured_image_url) {
    cover = null
    coverSource = null
  } else if (article.featured_image_url !== current.cover_source_url) {
    const rehosted = await rehostCover(article.featured_image_url, current.slug)
    if (rehosted) {
      cover = rehosted
      coverSource = article.featured_image_url
    }
  }

  const { error } = await admin
    .from("blog_posts")
    .update({
      title: fields.title,
      excerpt: fields.excerpt,
      content: fields.content,
      seo_title: fields.seo_title,
      seo_description: fields.seo_description,
      cover_url: cover,
      cover_source_url: coverSource,
      cover_alt: fields.cover_alt,
      robots: fields.robots,
      ai_prompt: fields.ai_prompt,
      ai_keywords: fields.ai_keywords,
      is_published: decision.publish,
      published_at: decision.publish ? current.published_at ?? new Date().toISOString() : current.published_at,
      held_reason: decision.heldReason,
      auto_publish: decision.publish,
    })
    .eq("id", current.id)
  if (error) throw new StorageError("mise à jour de l'article", error)

  // L'adresse ne change pas : un lien déjà partagé ou indexé reste bon
  revalidate(current.slug)
  return json({ id: current.id, url: articleUrl(current.slug) })
}

async function unpublish(admin: Admin, id: string) {
  const current = await findPushrankPost(admin, id)
  if (!current) return json({ error: "not_found" }, 404)
  const { error } = await admin.from("blog_posts").update({ is_published: false, auto_publish: false }).eq("id", current.id)
  if (error) throw new StorageError("retrait de l'article", error)
  revalidate(current.slug)
  return json({ id: current.id, url: articleUrl(current.slug) })
}

export async function POST(req: NextRequest) {
  const secret = process.env.PUSHRANK_WEBHOOK_SECRET
  if (!secret) {
    console.error("[pushrank] PUSHRANK_WEBHOOK_SECRET n'est pas configurée")
    return json({ error: "webhook_not_configured" }, 503)
  }

  // Corps brut : la signature porte sur ces octets exacts
  const raw = Buffer.from(await req.arrayBuffer())
  const signed = verifyPushrankSignature({
    rawBody: raw,
    timestamp: req.headers.get("x-pushrank-timestamp"),
    signature: req.headers.get("x-pushrank-signature"),
    secret,
    nowSeconds: Date.now() / 1000,
  })
  if (!signed) return json({ error: "invalid_signature" }, 401)

  let body: unknown
  try {
    body = JSON.parse(raw.toString("utf8"))
  } catch {
    return json({ error: "invalid_json" }, 400)
  }
  const parsed = parsePushrankEvent(body)
  if (!parsed.ok) return json({ error: parsed.error }, 400)
  const { event } = parsed

  if (event.kind === "test") return new NextResponse(null, { status: 200 })

  const admin = createAdminClient()
  try {
    if (event.kind === "create") return await create(admin, event.article, req.headers.get("x-pushrank-idempotency-key")?.trim() ?? "")
    if (event.kind === "update") return await update(admin, event.remotePostId, event.article)
    // « delete » n'est pas encore envoyé par PushRank : traité comme un retrait, sans suppression
    return await unpublish(admin, event.remotePostId)
  } catch (err) {
    if (err instanceof StorageError) return storageResponse(err)
    console.error("[pushrank] Erreur inattendue :", err)
    return json({ error: "internal_error" }, 500)
  }
}
