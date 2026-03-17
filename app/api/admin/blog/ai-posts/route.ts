/**
 * GET /api/admin/blog/ai-posts
 *
 * Returns all AI-generated blog posts for the admin panel.
 * Auth: Admin cookie
 */

import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { createAdminClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("blog_posts")
    .select("id, slug, title, excerpt, is_published, published_at, ai_keywords, ai_model, created_at")
    .eq("ai_generated", true)
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ posts: data ?? [] })
}
