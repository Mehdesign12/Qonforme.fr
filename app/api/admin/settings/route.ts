/**
 * GET /api/admin/settings?key=blog_auto_publish
 * PUT /api/admin/settings  { key, value }
 *
 * Admin-only API to read/write app_settings.
 */

import { NextRequest, NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { createAdminClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const key = request.nextUrl.searchParams.get("key")
  if (!key) {
    return NextResponse.json({ error: "Paramètre 'key' requis" }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("app_settings")
    .select("value, updated_at")
    .eq("key", key)
    .single()

  if (error) {
    return NextResponse.json({ key, value: null }, { status: 200 })
  }

  return NextResponse.json({ key, value: data.value, updated_at: data.updated_at })
}

export async function PUT(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { key, value } = body as { key?: string; value?: string }

  if (!key || value === undefined) {
    return NextResponse.json({ error: "Paramètres 'key' et 'value' requis" }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from("app_settings")
    .upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, key, value })
}
