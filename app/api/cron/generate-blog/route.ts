/**
 * GET /api/cron/generate-blog
 *
 * Cron endpoint called daily by cron-job.org to auto-generate a blog post using Gemini AI.
 * Auth: Authorization: Bearer {CRON_SECRET}
 *
 * Flow:
 * 1. Authenticate via CRON_SECRET
 * 2. Get existing slugs to avoid duplicates
 * 3. Select next SEO topic
 * 4. Generate blog post via Gemini
 * 5. Generate cover image via Gemini Imagen
 * 6. Insert into blog_posts with AI metadata
 * 7. Log result in cron_logs
 */

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { generateBlogPost, generateCoverImage } from "@/lib/ai/gemini"
import { getNextTopic } from "@/lib/ai/seo-topics"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error("[cron/generate-blog] CRON_SECRET non défini")
    return NextResponse.json({ error: "Configuration manquante" }, { status: 500 })
  }

  const authHeader = request.headers.get("Authorization")
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const startedAt = Date.now()
  const admin = createAdminClient()

  try {
    // ── Get existing slugs ──────────────────────────────────────────────────
    const { data: existingPosts } = await admin
      .from("blog_posts")
      .select("slug")

    const existingSlugs = (existingPosts ?? []).map((p) => p.slug)

    // ── Select next topic ───────────────────────────────────────────────────
    const topic = getNextTopic(existingSlugs)
    if (!topic) {
      const duration = Date.now() - startedAt
      await admin.from("cron_logs").insert({
        job_name: "generate-blog",
        status: "ok",
        results: { message: "Tous les sujets ont été couverts", skipped: true },
        duration_ms: duration,
      })
      return NextResponse.json({ ok: true, skipped: true, message: "Tous les sujets ont été couverts" })
    }

    // ── Generate blog post ──────────────────────────────────────────────────
    const post = await generateBlogPost(topic.topic, topic.keywords)

    // ── Generate cover image ────────────────────────────────────────────────
    const coverUrl = await generateCoverImage(post.title, post.excerpt)

    // ── Determine publish state ─────────────────────────────────────────────
    const autoPublish = process.env.BLOG_AUTO_PUBLISH === "true"
    const now = new Date().toISOString()

    // ── Insert into blog_posts ──────────────────────────────────────────────
    const { data: inserted, error: insertError } = await admin
      .from("blog_posts")
      .insert({
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        content: post.content,
        cover_url: coverUrl || null,
        is_published: autoPublish,
        published_at: autoPublish ? now : null,
        ai_generated: true,
        ai_model: "gemini-2.0-flash",
        ai_prompt: `Sujet: ${topic.topic} | Mots-clés: ${topic.keywords.join(", ")}`,
        ai_keywords: post.keywords,
        auto_publish: autoPublish,
      })
      .select("id, slug, title")
      .single()

    if (insertError) throw insertError

    // ── Log success ─────────────────────────────────────────────────────────
    const duration = Date.now() - startedAt
    await admin.from("cron_logs").insert({
      job_name: "generate-blog",
      status: "ok",
      results: {
        post_id: inserted.id,
        slug: inserted.slug,
        title: inserted.title,
        auto_published: autoPublish,
        has_cover: !!coverUrl,
        topic: topic.topic,
      },
      duration_ms: duration,
    })

    console.log(`[cron/generate-blog] Article généré : "${inserted.title}" (${inserted.slug})`)
    return NextResponse.json({ ok: true, post: inserted, auto_published: autoPublish })
  } catch (err) {
    const duration = Date.now() - startedAt
    const errorMsg = err instanceof Error ? err.message : String(err)

    await admin.from("cron_logs").insert({
      job_name: "generate-blog",
      status: "error",
      results: { error: errorMsg },
      duration_ms: duration,
    })

    console.error("[cron/generate-blog] Erreur :", err)
    return NextResponse.json({ ok: false, error: errorMsg }, { status: 500 })
  }
}
