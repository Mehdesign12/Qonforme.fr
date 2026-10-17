/**
 * POST /api/admin/seo/ideas — bouton « Proposition IA » (fenêtre « Générer un
 * article », écran Sujets, éditeur d'articles).
 *
 * Corps : IdeaRequest — { mode: "topics" | "article", focus?, trade?, count?,
 * article?: { title, content, keyword?, articleType? } }.
 * Réponse : IdeasResponse — { ideas, notes, model, autocomplete, metrics }.
 *
 * Le modèle du plan (Préférences d'écriture) pense comme l'artisan qui tape sa
 * recherche ; chaque phrase est ensuite contrôlée (concurrents, marque, valeurs
 * périmées), vérifiée dans la saisie semi-automatique de Google et mesurée par
 * DataForSEO si ses identifiants sont là (lib/seo/ideas/run.ts). Une panne de
 * Google ou de DataForSEO n'empêche pas la réponse : elle est signalée dans
 * `notes`.
 *
 * - 400 : corps invalide ; 422 : le titre ou l'angle nomme un concurrent ;
 * - 503 : aucun modèle configuré ; 502 : échec du modèle ou quota épuisé.
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { errorPayload, seoDb } from "@/lib/seo/db"
import { zodError } from "@/lib/seo/articles/input"
import { ModelError } from "@/lib/seo/articles/models"
import { CompetitorLeakError, findCompetitorMentions } from "@/lib/seo/competitors"
import { getSettings } from "@/lib/seo/settings"
import { TRADE_LABELS } from "@/lib/blog-images/trades"
import { IDEA_MAX_COUNT } from "@/lib/seo/ideas/types"
import { generateIdeas } from "@/lib/seo/ideas/run"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const ARTICLE_CONTENT_MAX = 6_000

const ideasSchema = z
  .object({
    mode: z.enum(["topics", "article"], { message: "Mode inconnu" }),
    focus: z.string().trim().max(300, "Angle de 300 caractères au plus").optional(),
    trade: z
      .string()
      .trim()
      .refine((t) => t === "" || t in TRADE_LABELS, "Métier inconnu")
      .optional(),
    count: z.number().int().min(3, "3 idées au moins").max(IDEA_MAX_COUNT, `${IDEA_MAX_COUNT} idées au plus`).optional(),
    article: z
      .object({
        title: z.string().trim().min(1, "Écrivez d'abord le titre de l'article").max(300, "Titre trop long"),
        // Le navigateur tronque déjà le texte ; garde-fou côté serveur
        content: z.string().max(60_000, "Article trop long").transform((s) => s.slice(0, ARTICLE_CONTENT_MAX)),
        keyword: z.string().trim().max(120).nullable().optional(),
        articleType: z.enum(["howto", "guide", "news", "faq"]).optional(),
      })
      .optional(),
  })
  .refine((v) => v.mode !== "article" || Boolean(v.article), { message: "Indiquez l'article", path: ["article"] })

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  const parsed = ideasSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json(zodError(parsed.error), { status: 400 })
  const input = parsed.data

  try {
    const db = seoDb()
    const targeting = await getSettings(db, "targeting")
    const competitors = targeting.value.competitors
    // Le titre et l'angle partiraient tels quels dans la consigne
    const typed = [input.focus, input.article?.title, input.article?.keyword].filter(Boolean).join("\n")
    if (findCompetitorMentions(typed, competitors).length > 0) {
      return NextResponse.json({ error: "Le titre ou l'angle nomme un concurrent : reformulez-le avant de demander des idées.", code: "competitor" }, { status: 422 })
    }
    const body = await generateIdeas(db, {
      mode: input.mode,
      focus: input.focus || undefined,
      trade: input.trade || undefined,
      count: input.count,
      article: input.article ? { ...input.article, keyword: input.article.keyword ?? null } : undefined,
    })
    return NextResponse.json(body)
  } catch (error) {
    if (error instanceof CompetitorLeakError) {
      return NextResponse.json({ error: "Le titre ou l'angle nomme un concurrent : reformulez-le avant de demander des idées.", code: "competitor" }, { status: 422 })
    }
    if (error instanceof ModelError) {
      if (error.kind === "not_configured") {
        return NextResponse.json({ error: `La Proposition IA n'est pas configurée : ${error.message}`, code: "not_configured" }, { status: 503 })
      }
      if (error.kind === "quota") return NextResponse.json({ error: error.message, code: "quota" }, { status: 502 })
      if (error.kind === "timeout") return NextResponse.json({ error: "Le modèle n'a pas répondu à temps. Réessayez dans un instant." }, { status: 502 })
      return NextResponse.json({ error: "Le modèle n'a pas pu faire de propositions. Réessayez dans un instant." }, { status: 502 })
    }
    const { status, body } = errorPayload(error)
    if (status >= 500 && status !== 503) console.error("[seo-ideas]", error instanceof Error ? error.message.slice(0, 200) : "erreur")
    return NextResponse.json(body, { status })
  }
}
