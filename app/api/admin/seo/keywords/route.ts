/**
 * POST /api/admin/seo/keywords  { keyword, target_path?, status? } → 201 { id, keyword }
 *
 * Ajoute un mot-clé suivi (source « manual ») : forme canonique
 * (lib/seo/keywords/normalize.ts), page cible facultative (chemin du site),
 * statut initial candidat, ciblé ou couvert. Doublon → 409 « Ce mot-clé est
 * déjà suivi » (avec l'identifiant du mot-clé existant).
 */
import { NextRequest, NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { errorPayload, must, seoDb } from "@/lib/seo/db"
import { parseCreateKeyword } from "@/lib/seo/keywords/input"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DUPLICATE = "Ce mot-clé est déjà suivi"

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })

  const parsed = parseCreateKeyword(await request.json().catch(() => null))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error, fieldErrors: parsed.fieldErrors }, { status: 400 })
  const input = parsed.value

  try {
    const db = seoDb()
    const existing = must(
      await db.from("seo_keywords").select("id").eq("keyword", input.keyword).maybeSingle(),
      "les mots-clés",
    ) as { id: string } | null
    if (existing) return NextResponse.json({ error: DUPLICATE, fieldErrors: { keyword: DUPLICATE }, id: existing.id }, { status: 409 })

    const now = new Date().toISOString()
    const res = await db
      .from("seo_keywords")
      .insert({ keyword: input.keyword, status: input.status, target_path: input.target_path, source: "manual", created_at: now, updated_at: now })
      .select("id, keyword")
      .single()
    if (res.error?.code === "23505") {
      return NextResponse.json({ error: DUPLICATE, fieldErrors: { keyword: DUPLICATE } }, { status: 409 })
    }
    const row = must(res, "l'ajout du mot-clé") as { id: string; keyword: string }
    return NextResponse.json({ id: row.id, keyword: row.keyword }, { status: 201 })
  } catch (error) {
    const { status, body } = errorPayload(error)
    return NextResponse.json(body, { status })
  }
}
