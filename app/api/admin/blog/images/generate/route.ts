/**
 * POST /api/admin/blog/images/generate — studio d'images de l'éditeur du blog :
 * une photo générée par le modèle d'image des Préférences d'écriture
 * (Nano Banana 2.1, repli sur Nano Banana 2), enregistrée dans le compartiment
 * du blog.
 *
 * Corps : { description (3 à 1 200 caractères), aspect: "16:9" | "4:3" | "1:1",
 * purpose: "cover" | "inline", title? (200 au plus) }. Une couverture est
 * toujours en 16:9 (format du blog et des partages), quel que soit `aspect`.
 * Réponse : GeneratedImageResponse ({ url, width, height, model, notice }).
 *
 * - 422 si la description nomme un concurrent (Paramètres › Ciblage, usage
 *   interne : jamais envoyé à un modèle ; le reste de la consigne est fixe) ;
 *   un titre qui en nommerait un ne sert pas au nom du fichier public ;
 * - 503 si la clé du modèle manque (message de ModelError, qui dit quoi faire)
 *   ou si les réglages ne se lisent pas ;
 * - 502 pour tout autre échec du modèle (code « quota » quand Google n'a plus
 *   ou pas de quota pour la clé : la raison est dans le message) ou une image
 *   inexploitable.
 *
 * Chaque image est facturée par Google : rien n'est relancé automatiquement.
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { errorPayload, seoDb } from "@/lib/seo/db"
import { getAllSettings } from "@/lib/seo/settings"
import { zodError } from "@/lib/seo/articles/input"
import { ModelError, generateImage, modelLabel } from "@/lib/seo/articles/models"
import { findCompetitorMentions } from "@/lib/seo/competitors"
import { IMAGE_ASPECTS } from "@/lib/blog-images/policy"
import { MAX_IMAGE_DESCRIPTION, altFromDescription, buildImagePrompt } from "@/lib/blog-images/prompt"
import { BlogImageError, storeBlogImage } from "@/lib/blog-images/server"
import type { GeneratedImageResponse } from "@/lib/seo/articles/editor-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 90

/** Délai de toute la génération (appel principal, repli et nouvel essai compris). */
const GENERATION_TIMEOUT_MS = 75_000
/** Une image de 2K renvoyée en PNG peut dépasser 5 Mo avant recompression. */
const GENERATED_MAX_BYTES = 15 * 1024 * 1024

const schema = z.object({
  description: z
    .string({ message: "Décrivez l'image en quelques mots." })
    .trim()
    .min(3, "Décrivez l'image en quelques mots.")
    .max(MAX_IMAGE_DESCRIPTION, "La description est trop longue : 1 200 caractères au plus."),
  aspect: z.enum(IMAGE_ASPECTS, { message: "Format inconnu : 16:9, 4:3 ou 1:1." }),
  purpose: z.enum(["cover", "inline"], { message: "Usage inconnu : couverture ou image du texte." }),
  title: z.string().trim().max(200, "Titre trop long : 200 caractères au plus.").optional(),
  /** Mot-clé principal de l'article : nom du fichier et mots-clés de l'image. */
  keyword: z.string().trim().max(120, "Mot-clé trop long : 120 caractères au plus.").optional(),
})

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json(zodError(parsed.error), { status: 400 })
  const input = parsed.data
  const aspect = input.purpose === "cover" ? "16:9" : input.aspect

  let competitors: string[]
  let model: string
  try {
    const settings = await getAllSettings(seoDb())
    competitors = settings.targeting.value.competitors
    model = settings.articles.value.imageModel
  } catch (error) {
    const { status, body } = errorPayload(error)
    return NextResponse.json(body, { status })
  }

  // Seule la description vient de l'admin : le cadre et les règles de la consigne sont fixes
  // (les y chercher ferait refuser à tort un concurrent dont le nom est un mot courant)
  if (findCompetitorMentions(input.description, competitors).length > 0) {
    return NextResponse.json({ error: "La description nomme un concurrent : retirez-le.", code: "competitor" }, { status: 422 })
  }
  const prompt = buildImagePrompt({ description: input.description, aspect, purpose: input.purpose })
  // Ni le titre ni le mot-clé ne partent au modèle ; ils nomment le fichier public et ses métadonnées,
  // sauf s'ils citent un concurrent
  const clean = (value: string | undefined) => (value && findCompetitorMentions(value, competitors).length === 0 ? value : undefined)
  const title = clean(input.title)
  const keyword = clean(input.keyword)
  const hint = keyword || title || input.description
  const caption = altFromDescription(input.description)

  let image: Awaited<ReturnType<typeof generateImage>>
  try {
    image = await generateImage({ model, prompt, aspect, timeoutMs: GENERATION_TIMEOUT_MS })
  } catch (error) {
    if (error instanceof ModelError && error.kind === "not_configured") {
      return NextResponse.json({ error: error.message, code: "not_configured" }, { status: 503 })
    }
    // Quota Google absent ou épuisé : la raison dit quoi faire, et « réessayez » ne servirait à rien
    if (error instanceof ModelError && error.kind === "quota") {
      return NextResponse.json({ error: `La génération de l'image a échoué. ${error.message}`, code: "quota" }, { status: 502 })
    }
    const reason = error instanceof ModelError ? ` ${error.message}` : ""
    if (!(error instanceof ModelError)) console.error("[blog-images] génération en échec", error)
    return NextResponse.json(
      { error: `La génération de l'image a échoué.${reason} Réessayez, ou modifiez la description.`, code: "generation_failed" },
      { status: 502 },
    )
  }

  try {
    const stored = await storeBlogImage({
      data: image.data,
      hint,
      // Rangée sous editor/ia/ : le blog affiche « Illustration générée par IA » sous elle
      generated: true,
      meta: {
        title: title || caption || undefined,
        description: caption || title || undefined,
        keywords: [keyword],
        creator: "Qonforme",
        source: "ai",
      },
      maxBytes: GENERATED_MAX_BYTES,
    })
    const notice = image.fallbackFrom
      ? `Image par ${modelLabel(image.model)} au lieu de ${modelLabel(image.fallbackFrom.model)} : ${image.fallbackFrom.reason}`
      : null
    const body: GeneratedImageResponse = { ...stored, model: modelLabel(image.model), notice }
    return NextResponse.json(body)
  } catch (error) {
    if (error instanceof BlogImageError && error.code === "upload") {
      return NextResponse.json({ error: error.message, code: "upload" }, { status: 503 })
    }
    if (error instanceof BlogImageError) {
      return NextResponse.json({ error: "Le modèle a renvoyé une image inexploitable. Réessayez.", code: "generation_failed" }, { status: 502 })
    }
    console.error("[blog-images] enregistrement en échec", error)
    return NextResponse.json({ error: "L'image n'a pas pu être enregistrée. Réessayez dans un instant." }, { status: 500 })
  }
}
