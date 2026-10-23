/**
 * POST /api/admin/blog/assist — assistant de rédaction de l'éditeur
 * d'articles (menu de sélection › « Assistant ») : reformuler, raccourcir,
 * développer, simplifier, corriger l'orthographe, intégrer le mot-clé ; et,
 * avec l'action « resolve », corriger un passage refusé par le contrôle de
 * publication (bannière « Publication refusée par le contrôle »).
 *
 * Corps : AssistRequest (passage en Markdown, mot-clé, titre, 500 caractères
 * de contexte avant et après) ou ResolveRequest (en plus : le problème repéré
 * et ce que le contrôle précise). Réponse : AssistResponse { text, warnings }.
 *
 * - Modèle : celui de la rédaction dans les Préférences, avec repli sur celui
 *   du plan si sa clé manque (resolvePassModel), consigne système commune
 *   (buildSystemPrompt : marque, faits de référence, règles).
 * - Concurrents : jamais dans une consigne. Un passage qui en nomme un est
 *   refusé (422) ; le contexte et le titre sont caviardés.
 * - Réponse nettoyée et contrôlée (lib/blog-editor/assist.ts) : liens ajoutés
 *   et images retirés, HTML neutralisé ; valeurs périmées, affirmations
 *   interdites, concurrents et nombres nouveaux signalés.
 * - 503 : clé du modèle absente ; 502 : échec du modèle.
 */
import { NextRequest, NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { errorPayload, seoDb } from "@/lib/seo/db"
import { zodError } from "@/lib/seo/articles/input"
import { getAllSettings } from "@/lib/seo/settings"
import { buildSystemPrompt } from "@/lib/seo/articles/prompt"
import { generateText, hasKey, ModelError, resolvePassModel } from "@/lib/seo/articles/models"
import { assertNoCompetitorInPrompt, CompetitorLeakError, findCompetitorMentions } from "@/lib/seo/competitors"
import { redactCompetitors } from "@/lib/seo/articles/check"
import {
  ASSIST_SYSTEM_SUFFIX,
  assistSchema,
  assistWarnings,
  buildAssistPrompt,
  buildResolvePrompt,
  cleanAssistOutput,
  decodeForModel,
  resolveSchema,
  resolveWarnings,
} from "@/lib/blog-editor/assist"
import type { AssistResponse } from "@/lib/seo/articles/editor-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  const raw: unknown = await request.json().catch(() => null)
  const resolving = Boolean(raw && typeof raw === "object" && (raw as { action?: unknown }).action === "resolve")
  const parsed = resolving ? resolveSchema.safeParse(raw) : assistSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json(zodError(parsed.error), { status: 400 })
  const input = parsed.data
  if (input.action === "keyword" && !input.keyword) {
    return NextResponse.json({ error: "Choisissez d'abord le mot-clé principal de l'article." }, { status: 400 })
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

  // Le passage lui-même ne doit pas nommer un concurrent (il partirait dans la consigne)
  if (findCompetitorMentions(decodeForModel(input.text), competitors).length > 0) {
    return NextResponse.json({ error: "Le passage sélectionné nomme un concurrent : retirez-le avant de demander une réécriture." }, { status: 422 })
  }

  const system =
    buildSystemPrompt({ brand: settings.brand.value, strategy: settings.strategy.value, prefs }) + ASSIST_SYSTEM_SUFFIX
  const context = {
    keyword: input.keyword ? redactCompetitors(input.keyword, competitors) : null,
    title: input.title ? redactCompetitors(input.title, competitors) : undefined,
    before: input.before ? redactCompetitors(decodeForModel(input.before), competitors) : undefined,
    after: input.after ? redactCompetitors(decodeForModel(input.after), competitors) : undefined,
  }
  // Le problème signalé et sa précision viennent du contrôle (jamais d'un concurrent : ils sont caviardés aussi)
  const prompt =
    input.action === "resolve"
      ? buildResolvePrompt({
          text: input.text,
          issue: { label: redactCompetitors(input.issue.label, competitors), detail: input.issue.detail ? redactCompetitors(input.issue.detail, competitors) : null },
          ...context,
        })
      : buildAssistPrompt({ action: input.action, text: input.text, ...context })

  try {
    assertNoCompetitorInPrompt(`${system}\n${prompt}`, competitors)
    const choice = resolvePassModel(prefs.textModel, prefs.planModel, hasKey)
    const res = await generateText({
      model: choice.model,
      system,
      prompt,
      // Réflexion comprise (toujours active sur certains modèles)
      maxOutputTokens: 8_000,
      timeoutMs: 55_000,
    })
    const cleaned = cleanAssistOutput(res.text, input.text)
    if (!cleaned.text) {
      return NextResponse.json({ error: "L'assistant n'a rien proposé. Réessayez, ou reformulez la sélection." }, { status: 502 })
    }
    const body: AssistResponse = {
      text: cleaned.text,
      warnings:
        input.action === "resolve"
          ? resolveWarnings({ original: input.text, result: cleaned.text, competitors, removedLinks: cleaned.removedLinks, detail: input.issue.detail, excerpt: input.excerpt })
          : assistWarnings({ original: input.text, result: cleaned.text, competitors, removedLinks: cleaned.removedLinks }),
    }
    return NextResponse.json(body)
  } catch (error) {
    if (error instanceof CompetitorLeakError) {
      // Passage, titre, mot-clé et contexte sont déjà contrôlés ou caviardés : reste la consigne de la marque (Paramètres)
      return NextResponse.json(
        { error: "La consigne envoyée au modèle nomme un concurrent (titre, mot-clé ou réglages de la marque dans Paramètres) : retirez-le avant de demander une réécriture." },
        { status: 422 },
      )
    }
    if (error instanceof ModelError) {
      if (error.kind === "not_configured") {
        // « Clé … absente : ajoutez-la dans les variables d'environnement (Paramètres › Connexions). »
        return NextResponse.json({ error: error.message, code: "not_configured" }, { status: 503 })
      }
      if (error.kind === "quota") {
        return NextResponse.json({ error: error.message, code: "quota" }, { status: 502 })
      }
      if (error.kind === "refused") {
        return NextResponse.json({ error: "Le modèle a refusé de réécrire ce passage. Modifiez la sélection, ou changez de modèle de rédaction dans les Préférences." }, { status: 502 })
      }
      if (error.kind === "timeout") {
        return NextResponse.json({ error: "Le modèle n'a pas répondu à temps. Réessayez, ou sélectionnez un passage plus court." }, { status: 502 })
      }
      return NextResponse.json({ error: "L'assistant n'a pas pu réécrire le passage. Réessayez dans un instant." }, { status: 502 })
    }
    console.error("[blog] assistant", error)
    return NextResponse.json({ error: "L'assistant n'a pas pu réécrire le passage. Réessayez dans un instant." }, { status: 502 })
  }
}
