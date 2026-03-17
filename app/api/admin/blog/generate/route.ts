/**
 * POST /api/admin/blog/generate
 *
 * Manual blog generation from the admin panel.
 * Auth: Admin cookie (isAdminAuthenticated)
 *
 * Body: { topic?: string, keywords?: string[], auto_publish?: boolean }
 *
 * - If topic is provided, generates an article on that topic
 * - Otherwise, selects the next available SEO topic
 */

import { NextRequest, NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { createAdminClient } from "@/lib/supabase/server"
import { generateBlogPost, generateCoverImage } from "@/lib/ai/gemini"
import { getNextTopic } from "@/lib/ai/seo-topics"
import type { TopicCategory } from "@/lib/ai/seo-topics"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const admin = createAdminClient()

  try {
    const body = await request.json().catch(() => ({}))
    const customTopic = body.topic as string | undefined
    const customKeywords = body.keywords as string[] | undefined
    const autoPublish = body.auto_publish === true

    let topic: string
    let keywords: string[]
    let category: TopicCategory = "guide"

    if (customTopic) {
      // Custom topic from admin
      topic = customTopic
      keywords = customKeywords ?? []
    } else {
      // Auto-select next SEO topic — match against ai_prompt to avoid re-using topics
      const { data: existingPosts } = await admin
        .from("blog_posts")
        .select("ai_prompt")

      const existingPrompts = (existingPosts ?? [])
        .map((p) => p.ai_prompt)
        .filter(Boolean) as string[]

      const nextTopic = getNextTopic(existingPrompts)

      if (!nextTopic) {
        return NextResponse.json(
          { error: "Tous les sujets ont été couverts. Utilisez un sujet personnalisé." },
          { status: 400 }
        )
      }

      topic = nextTopic.topic
      keywords = nextTopic.keywords
      category = nextTopic.category
    }

    // ── Generate blog post ──────────────────────────────────────────────────
    const post = await generateBlogPost(topic, keywords)

    // ── Generate cover image ────────────────────────────────────────────────
    const coverUrl = await generateCoverImage(post.title, post.excerpt, category)

    // ── Insert ──────────────────────────────────────────────────────────────
    const now = new Date().toISOString()

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
        ai_model: "gemini-2.5-flash + nano-banana-2",
        ai_prompt: `Sujet: ${topic} | Mots-clés: ${keywords.join(", ")}`,
        ai_keywords: post.keywords,
        auto_publish: autoPublish,
      })
      .select("id, slug, title, excerpt, is_published, ai_keywords, created_at")
      .single()

    if (insertError) throw insertError

    console.log(`[admin/blog/generate] Article généré : "${inserted.title}" (cover: ${!!coverUrl})`)
    return NextResponse.json({ ok: true, post: inserted, has_cover: !!coverUrl })
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error("[admin/blog/generate] Erreur :", err)
    return NextResponse.json({ ok: false, error: errorMsg }, { status: 500 })
  }
}
