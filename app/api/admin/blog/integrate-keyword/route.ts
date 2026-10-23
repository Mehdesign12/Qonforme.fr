/**
 * POST /api/admin/blog/integrate-keyword — boutons « Intégrer avec l'IA » de
 * l'éditeur d'articles : un mot-clé secondaire « Absent » (panneau Mots-clés
 * secondaires), le mot-clé du sous-titre ou de l'introduction (liste de
 * contrôle du score).
 *
 * Corps : IntegrateRequest (mode, mot-clé, texte de l'article en Markdown,
 * titre, mot-clé principal, passages déjà vus). Réponse : IntegrateResponse
 * — les passages retouchés (avant / après), jamais appliqués ici : l'éditeur
 * les montre et les remplace d'un coup, si l'admin accepte (Ctrl+Z annule).
 *
 * - Les passages qui peuvent recevoir le mot-clé sont choisis ici
 *   (lib/seo/articles/integrate.ts) : développement seulement, ni FAQ, ni
 *   conclusion, ni passage qui nomme un concurrent.
 * - Modèle : celui de la rédaction dans les Préférences, avec repli sur celui
 *   du plan si sa clé manque (resolvePassModel), consigne système commune.
 * - Concurrents : jamais dans une consigne. Un mot-clé qui en nomme un est
 *   refusé (422) ; titre et mot-clé principal sont caviardés.
 * - Chaque réécriture est contrôlée avant d'être montrée (mot-clé tel quel,
 *   longueur, liens, concurrents) ; les points à vérifier accompagnent le texte.
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
  buildIntegratePrompt,
  buildProposals,
  INTEGRATE_JSON_SCHEMA,
  INTEGRATE_SYSTEM_SUFFIX,
  integrationCandidates,
  parseIntegrateOutput,
} from "@/lib/seo/articles/integrate"
import type { IntegrateMode, IntegrateResponse } from "@/lib/seo/articles/editor-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const schema = z.object({
  mode: z.enum(["secondary", "heading", "intro"], { message: "Action inconnue" }),
  keyword: z
    .string({ message: "Mot-clé attendu" })
    .transform((s) => canonicalKeyword(s))
    .pipe(z.string().min(2, "Mot-clé attendu").max(120, "Mot-clé de 120 caractères au plus")),
  markdown: z.string({ message: "Texte attendu" }).max(300_000, "Article trop long"),
  title: z.string().trim().max(300).optional(),
  mainKeyword: z.string().trim().max(120).nullable().optional(),
  count: z.number().int().min(1).max(3).optional(),
  avoid: z.array(z.string().max(2000)).max(12).optional(),
})

const NO_CANDIDATE: Record<IntegrateMode, string> = {
  secondary: "Aucun passage du développement ne peut recevoir ce mot-clé : il figure déjà là où il irait, ou le texte est trop court (la FAQ et la conclusion sont laissées de côté).",
  heading: "Aucun sous-titre à retoucher : l'article n'a pas de titre 2 ou 3 hors FAQ et conclusion. Ajoutez d'abord un sous-titre.",
  intro: "L'article n'a pas encore de premier paragraphe : écrivez d'abord l'introduction.",
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json(zodError(parsed.error), { status: 400 })
  const input = parsed.data
  if (!input.markdown.trim()) {
    return NextResponse.json({ error: "Écrivez d'abord le texte de l'article : le mot-clé se place dans ses phrases." }, { status: 400 })
  }

  let settings: Awaited<ReturnType<typeof getAllSettings>>
  try {
    settings = await getAllSettings(seoDb())
  } catch (error) {
    const { status, body } = errorPayload(error)
    return NextResponse.json(body, { status })
  }
  const competitors = settings.targeting.value.competitors
  const prefs = settings.articles.value

  // Le mot-clé partirait tel quel dans la consigne
  if (findCompetitorMentions(input.keyword, competitors).length > 0) {
    return NextResponse.json({ error: "Ce mot-clé nomme un concurrent : il ne peut pas être intégré au texte." }, { status: 422 })
  }

  const candidates = integrationCandidates(input.markdown, input.keyword, input.mode, { competitors, avoid: input.avoid })
  if (candidates.length === 0) {
    const empty: IntegrateResponse = { proposals: [], note: NO_CANDIDATE[input.mode] }
    return NextResponse.json(empty)
  }

  const system = buildSystemPrompt({ brand: settings.brand.value, strategy: settings.strategy.value, prefs }) + INTEGRATE_SYSTEM_SUFFIX
  const prompt = buildIntegratePrompt({
    mode: input.mode,
    keyword: input.keyword,
    title: input.title ? redactCompetitors(input.title, competitors) : undefined,
    mainKeyword: input.mainKeyword && findCompetitorMentions(input.mainKeyword, competitors).length === 0 ? input.mainKeyword : null,
    count: input.count,
    candidates,
  })

  try {
    assertNoCompetitorInPrompt(`${system}\n${prompt}`, competitors)
    const choice = resolvePassModel(prefs.textModel, prefs.planModel, hasKey)
    const res = await generateText({
      model: choice.model,
      system,
      prompt,
      // Réflexion comprise (toujours active sur certains modèles)
      maxOutputTokens: 8_000,
      json: { schema: INTEGRATE_JSON_SCHEMA },
      timeoutMs: 55_000,
    })
    const edits = parseIntegrateOutput(res.text)
    const { proposals, rejected } = buildProposals(candidates, edits, { mode: input.mode, keyword: input.keyword, competitors, count: input.count })
    const body: IntegrateResponse = {
      proposals,
      note:
        proposals.length > 0
          ? rejected.length > 0
            ? `${rejected.length} réécriture${rejected.length > 1 ? "s ont été écartées" : " a été écartée"} par le contrôle.`
            : null
          : rejected.length > 0
            ? `Aucune réécriture ne tient : ${rejected.join(" ")}`
            : "Le modèle n'a trouvé aucun passage où ce mot-clé se lit naturellement. Placez-le à la main, ou réessayez.",
    }
    return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    if (error instanceof CompetitorLeakError) {
      return NextResponse.json(
        { error: "La consigne envoyée au modèle nomme un concurrent (titre, mot-clé ou réglages de la marque dans Paramètres) : retirez-le avant de demander une proposition." },
        { status: 422 },
      )
    }
    if (error instanceof ModelError) {
      if (error.kind === "not_configured") return NextResponse.json({ error: error.message, code: "not_configured" }, { status: 503 })
      if (error.kind === "quota") return NextResponse.json({ error: error.message, code: "quota" }, { status: 502 })
      if (error.kind === "refused") {
        return NextResponse.json({ error: "Le modèle a refusé de retoucher ces passages. Réessayez, ou changez de modèle de rédaction dans les Préférences." }, { status: 502 })
      }
      if (error.kind === "timeout") return NextResponse.json({ error: "Le modèle n'a pas répondu à temps. Réessayez dans un instant." }, { status: 502 })
      return NextResponse.json({ error: "Le modèle n'a pas pu proposer de retouche. Réessayez dans un instant." }, { status: 502 })
    }
    console.error("[blog] intégration de mot-clé", error)
    return NextResponse.json({ error: "Le modèle n'a pas pu proposer de retouche. Réessayez dans un instant." }, { status: 502 })
  }
}
