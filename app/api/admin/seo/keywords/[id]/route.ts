/**
 * PATCH /api/admin/seo/keywords/<id>  { status?, target_path?, notes?, intent? } → { ok, keyword }
 *
 * Modifie un mot-clé suivi depuis son panneau de détail. Pas de DELETE : un
 * mot-clé dont on ne veut plus est ignoré (statut « ignored »), jamais supprimé,
 * pour que la découverte de Search Console ne le propose pas de nouveau.
 */
import { NextRequest, NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { errorPayload, must, seoDb } from "@/lib/seo/db"
import { isUuid, parsePatchKeyword } from "@/lib/seo/keywords/input"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> | { id: string } }

export async function PATCH(request: NextRequest, { params }: Params) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: "Mot-clé introuvable" }, { status: 404 })

  const parsed = parsePatchKeyword(await request.json().catch(() => null))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error, fieldErrors: parsed.fieldErrors }, { status: 400 })

  try {
    const rows = must(
      await seoDb()
        .from("seo_keywords")
        .update({ ...parsed.value, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("id, keyword, status, intent, target_path, notes, updated_at"),
      "la mise à jour du mot-clé",
    ) as Record<string, unknown>[] | null
    const row = rows?.[0]
    if (!row) return NextResponse.json({ error: "Mot-clé introuvable" }, { status: 404 })
    return NextResponse.json({ ok: true, keyword: row })
  } catch (error) {
    const { status, body } = errorPayload(error)
    return NextResponse.json(body, { status })
  }
}
