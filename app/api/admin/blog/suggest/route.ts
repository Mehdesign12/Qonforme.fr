/**
 * POST /api/admin/blog/suggest — bouton « Proposer » du panneau Référencement
 * de l'éditeur d'articles : titre Google, description Google, adresse,
 * chapeau ou titre de l'article.
 *
 * Corps : SuggestRequest. Réponse : SuggestResponse (trois propositions au
 * plus, chacune avec sa longueur et la présence du mot-clé exact).
 *
 * - Modèle : celui du plan dans les Préférences (rapide), avec repli sur celui
 *   de la rédaction si sa clé manque (resolvePassModel) ; cinq propositions
 *   demandées en JSON.
 * - Concurrents : jamais dans une consigne. Un mot-clé qui en nomme un est
 *   refusé (422) ; titre, chapeau et texte sont caviardés.
 * - Chaque proposition passe le contrôle de lib/seo/articles/suggest.ts
 *   (longueur, affirmations interdites, « PDP », concurrents, forme) ; aucune
 *   ne passe : 422.
 * - 503 : clé du modèle absente ; 502 : échec du modèle.
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { errorPayload, seoDb } from "@/lib/seo/db"
import { zodError } from "@/lib/seo/articles/input"
import { getAllSettings } from "@/lib/seo/settings"
import { buildSystemPrompt } from "@/lib/seo/articles/prompt"
import { generateText, hasKey, ModelError, resolvePassModel } from "@/lib/seo/articles/models"
import { assertNoCompetitorInPrompt, CompetitorLeakError, findCompetitorMentions } from "@/lib/seo/competitors"
import { redactCompetitors } from "@/lib/seo/articles/check"
import { canonicalKeyword } from "@/lib/seo/keywords/normalize"
import {
  buildSuggestPrompt,
  filterSuggestions,
  parseSuggestOutput,
  SUGGEST_CONTENT_MAX,
  SUGGEST_FIELDS,
  SUGGEST_JSON_SCHEMA,
} from "@/lib/seo/articles/suggest"
import type { SuggestRequest, SuggestResponse } from "@/lib/seo/articles/editor-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

const suggestSchema = z.object({
  field: z.enum(["seoTitle", "seoDescription", "slug", "excerpt", "title"], { message: "Champ inconnu" }),
  keyword: z
    .string({ message: "Choisissez d'abord le mot-clé principal de l'article." })
    .transform((s) => canonicalKeyword(s))
    .pipe(z.string().min(2, "Choisissez d'abord le mot-clé principal de l'article.").max(120, "Mot-clé de 120 caractères au plus")),
  secondary: z.array(z.string().trim().max(120)).max(20).optional(),
  title: z.string().trim().max(300, "Titre trop long"),
  excerpt: z.string().trim().max(1000).optional(),
  // Le navigateur tronque déjà le texte ; garde-fou côté serveur
  content: z.string().max(60_000, "Article trop long pour une proposition").transform((s) => s.slice(0, SUGGEST_CONTENT_MAX)),
  current: z.string().trim().max(600).optional(),
})

/** Adresses des autres articles (une proposition d'adresse ne les reprend jamais). */
async function takenSlugs(db: ReturnType<typeof seoDb>): Promise<string[]> {
  const res = await db.from("blog_posts").select("slug").limit(5000)
  if (res.error) return []
  return ((res.data ?? []) as { slug: string | null }[]).map((r) => r.slug ?? "").filter(Boolean)
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  const parsed = suggestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json(zodError(parsed.error), { status: 400 })
  const input = parsed.data
  if (!input.title && !input.content.trim()) {
    return NextResponse.json({ error: "Écrivez d'abord le titre ou le début de l'article : les propositions s'appuient sur lui." }, { status: 400 })
  }

  const db = seoDb()
  let settings: Awaited<ReturnType<typeof getAllSettings>>
  try {
    settings = await getAllSettings(db)
  } catch (error) {
    const { status, body } = errorPayload(error)
    return NextResponse.json(body, { status })
  }
  const competitors = settings.targeting.value.competitors
  const prefs = settings.articles.value

  // Le mot-clé partirait tel quel dans la consigne
  if (findCompetitorMentions(input.keyword, competitors).length > 0) {
    return NextResponse.json({ error: "Le mot-clé principal nomme un concurrent : choisissez-en un autre." }, { status: 422 })
  }

  const redact = (s: string | undefined) => (s ? redactCompetitors(s, competitors) : s)
  const brief: SuggestRequest = {
    field: input.field,
    keyword: input.keyword,
    secondary: (input.secondary ?? []).filter((s) => findCompetitorMentions(s, competitors).length === 0),
    title: redact(input.title) ?? "",
    excerpt: redact(input.excerpt),
    content: redact(input.content) ?? "",
    current: redact(input.current),
  }
  const system = buildSystemPrompt({ brand: settings.brand.value, strategy: settings.strategy.value, prefs })
  const prompt = buildSuggestPrompt(brief)

  try {
    assertNoCompetitorInPrompt(`${system}\n${prompt}`, competitors)
    const choice = resolvePassModel(prefs.planModel, prefs.textModel, hasKey)
    const [res, taken] = await Promise.all([
      generateText({
        model: choice.model,
        system,
        prompt,
        // Réflexion comprise
        maxOutputTokens: 6_000,
        json: { schema: SUGGEST_JSON_SCHEMA },
        timeoutMs: 26_000,
      }),
      input.field === "slug" ? takenSlugs(db) : Promise.resolve([] as string[]),
    ])
    const raw = parseSuggestOutput(res.text)
    const body: SuggestResponse = filterSuggestions(input.field, raw, {
      keyword: input.keyword,
      current: input.current ?? null,
      competitors,
      taken,
    })
    if (body.suggestions.length === 0) {
      return NextResponse.json(
        {
          error: `Aucune proposition pour ${SUGGEST_FIELDS[input.field].label} ne respecte les règles (longueur, affirmations interdites, concurrents). Réessayez dans un instant.`,
          code: "no_suggestion",
          rejected: body.rejected,
        },
        { status: 422 },
      )
    }
    return NextResponse.json(body)
  } catch (error) {
    if (error instanceof CompetitorLeakError) {
      return NextResponse.json({ error: "Le titre ou le mot-clé nomme un concurrent : retirez-le avant de demander des propositions." }, { status: 422 })
    }
    if (error instanceof ModelError) {
      if (error.kind === "not_configured") {
        return NextResponse.json({ error: `Les propositions ne sont pas configurées : ${error.message}`, code: "not_configured" }, { status: 503 })
      }
      if (error.kind === "quota") {
        return NextResponse.json({ error: error.message, code: "quota" }, { status: 502 })
      }
      if (error.kind === "timeout") {
        return NextResponse.json({ error: "Le modèle n'a pas répondu à temps. Réessayez dans un instant." }, { status: 502 })
      }
      return NextResponse.json({ error: "Le modèle n'a pas pu faire de propositions. Réessayez dans un instant." }, { status: 502 })
    }
    console.error("[blog] propositions", error)
    return NextResponse.json({ error: "Le modèle n'a pas pu faire de propositions. Réessayez dans un instant." }, { status: 502 })
  }
}
