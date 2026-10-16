/**
 * POST /api/admin/seo/keywords/plan → PlanImportResult { added, updated, total }
 *
 * « Ajouter au suivi » de la carte du plan mots-clés (admin › SEO ›
 * Mots-clés) : les mots-clés du plan du 16/10/2026 (lib/seo/keywords/plan.ts)
 * qui ne sont pas encore suivis sont ajoutés en « Ciblé » (source « import »,
 * volume, intention et page du plan, note qui renvoie au plan). Un mot-clé
 * déjà suivi (comparaison sans accents) garde son statut, même ignoré ; seuls
 * son volume, sa page et son intention sont complétés s'ils manquent.
 *
 * Rejouable : un second appel n'ajoute rien (index unique sur la forme
 * canonique, doublons ignorés).
 */
import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { errorPayload, must, seoDb } from "@/lib/seo/db"
import { listAllKeywords } from "@/lib/seo/keywords/data"
import { PLAN_KEYWORDS, PLAN_NOTE } from "@/lib/seo/keywords/plan"
import { planImportChanges } from "@/lib/seo/articles/secondary"
import type { PlanImportResult } from "@/lib/seo/articles/editor-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })

  try {
    const db = seoDb()
    const tracked = await listAllKeywords(db)
    const changes = planImportChanges(tracked, PLAN_NOTE)
    const now = new Date().toISOString()

    let added = 0
    if (changes.inserts.length > 0) {
      const inserted = must(
        await db
          .from("seo_keywords")
          .upsert(
            changes.inserts.map((row) => ({ ...row, created_at: now, updated_at: now })),
            { onConflict: "keyword", ignoreDuplicates: true },
          )
          .select("id"),
        "l'ajout des mots-clés du plan",
      ) as { id: string }[] | null
      added = inserted?.length ?? 0
    }

    let updated = 0
    for (const change of changes.updates) {
      must(await db.from("seo_keywords").update({ ...change.values, updated_at: now }).eq("id", change.id), "la mise à jour des mots-clés du plan")
      updated++
    }

    const body: PlanImportResult = { added, updated, total: PLAN_KEYWORDS.length }
    return NextResponse.json(body)
  } catch (error) {
    const { status, body } = errorPayload(error)
    return NextResponse.json(body, { status })
  }
}
