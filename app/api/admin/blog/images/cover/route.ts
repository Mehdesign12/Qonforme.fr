/**
 * POST /api/admin/blog/images/cover — « Créer la couverture » de l'éditeur du
 * blog : la couverture Qonforme (fond blanc, titre en deux voix, logo, icônes
 * du sujet), dessinée par le code, enregistrée en WebP dans le stockage du blog.
 *
 * Corps : { title (3 à 200 caractères), keyword? (120 au plus) }.
 * Réponse : { url, width, height, alt, family } — l'adresse porte les
 * dimensions dans son fragment ; `alt` est le titre (texte de l'image).
 *
 * - 422 si le titre ou le mot-clé nomme un concurrent (Paramètres › Ciblage,
 *   usage interne : le titre est écrit sur l'image publique) ;
 * - 503 si les réglages ne se lisent pas ou si le stockage est indisponible ;
 * - 502 si le dessin échoue.
 *
 * Aucune clé de modèle, aucun coût : rien n'est facturé.
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { errorPayload, seoDb } from "@/lib/seo/db"
import { getAllSettings } from "@/lib/seo/settings"
import { zodError } from "@/lib/seo/articles/input"
import { findCompetitorMentions } from "@/lib/seo/competitors"
import { BlogImageError } from "@/lib/blog-images/server"
import { makeCover } from "@/lib/blog-images/cover/make"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

const schema = z.object({
  title: z
    .string({ message: "Écrivez d'abord le titre : il figure sur la couverture." })
    .trim()
    .min(3, "Écrivez d'abord le titre : il figure sur la couverture.")
    .max(200, "Titre trop long : 200 caractères au plus."),
  keyword: z.string().trim().max(120, "Mot-clé trop long : 120 caractères au plus.").optional(),
})

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json(zodError(parsed.error), { status: 400 })
  const input = parsed.data

  let competitors: string[]
  try {
    competitors = (await getAllSettings(seoDb())).targeting.value.competitors
  } catch (error) {
    const { status, body } = errorPayload(error)
    return NextResponse.json(body, { status })
  }
  if (findCompetitorMentions(`${input.title}\n${input.keyword ?? ""}`, competitors).length > 0) {
    return NextResponse.json({ error: "Le titre ou le mot-clé nomme un concurrent : il serait écrit sur l'image publique.", code: "competitor" }, { status: 422 })
  }

  try {
    const cover = await makeCover({ title: input.title, keyword: input.keyword || null })
    return NextResponse.json(cover)
  } catch (error) {
    if (error instanceof BlogImageError && error.code === "upload") {
      return NextResponse.json({ error: error.message, code: "upload" }, { status: 503 })
    }
    console.error("[blog-images] couverture en échec", error instanceof Error ? error.message.slice(0, 200) : error)
    return NextResponse.json({ error: "La couverture n'a pas pu être créée. Réessayez dans un instant.", code: "cover_failed" }, { status: 502 })
  }
}
