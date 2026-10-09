/**
 * GET /api/admin/seo/settings/<section>  → { value, saved, updatedAt }
 * PUT /api/admin/seo/settings/<section>  { value } → { ok, value, updatedAt }
 *
 * Réglages de l'onglet SEO (lib/seo/settings.ts) : brand, strategy, targeting,
 * articles, geo, reports, pagespeed. Admin seulement ; valeurs validées par
 * le schéma de la section (messages en français, champ par champ).
 */
import { NextRequest, NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { errorPayload, seoDb } from "@/lib/seo/db"
import { getSettings, isSettingsKey, parseSettings, saveSettings } from "@/lib/seo/settings"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Params = { params: Promise<{ key: string }> | { key: string } }

export async function GET(_request: NextRequest, { params }: Params) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  const { key } = await params
  if (!isSettingsKey(key)) return NextResponse.json({ error: "Section inconnue" }, { status: 404 })
  try {
    return NextResponse.json(await getSettings(seoDb(), key))
  } catch (error) {
    const { status, body } = errorPayload(error)
    return NextResponse.json(body, { status })
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  const { key } = await params
  if (!isSettingsKey(key)) return NextResponse.json({ error: "Section inconnue" }, { status: 404 })

  const body = (await request.json().catch(() => null)) as { value?: unknown } | null
  if (!body || typeof body !== "object" || !("value" in body)) {
    return NextResponse.json({ error: "Corps attendu : { value }" }, { status: 400 })
  }
  const parsed = parseSettings(key, body.value)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error, fieldErrors: parsed.fieldErrors }, { status: 400 })

  try {
    const updatedAt = await saveSettings(seoDb(), key, parsed.value)
    return NextResponse.json({ ok: true, value: parsed.value, updatedAt })
  } catch (error) {
    const { status, body: payload } = errorPayload(error)
    return NextResponse.json(payload, { status })
  }
}
