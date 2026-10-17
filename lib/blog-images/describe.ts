/**
 * Lecture d'un passage par le modèle (sujet, scène, styles, texte alternatif) :
 * partagée par la route du studio d'images (POST /api/admin/blog/images/describe)
 * et par la rédaction automatique des articles (photos du texte,
 * lib/seo/articles/generate.ts). Voir lib/blog-images/passage.ts pour la consigne.
 *
 * Ne lève jamais : sans modèle (clé absente, panne, quota, réponse illisible,
 * scène qui nomme un concurrent), la proposition vient des mots du passage
 * (`source: "heuristic"`) et `notice` dit pourquoi.
 *
 * Les concurrents ne partent jamais au modèle : le passage, le titre et le
 * mot-clé sont caviardés avant l'appel.
 */
import { redactCompetitors } from "@/lib/seo/articles/check"
import { generateText, hasKey, ModelError, resolvePassModel } from "@/lib/seo/articles/models"
import { findCompetitorMentions } from "@/lib/seo/competitors"
import { altFromDescription } from "@/lib/blog-images/prompt"
import {
  PASSAGE_JSON_SCHEMA,
  PASSAGE_SYSTEM,
  buildPassagePrompt,
  heuristicPassage,
  parsePassageOutput,
  type PassageContext,
} from "@/lib/blog-images/passage"
import type { DescribePassageResponse } from "@/lib/seo/articles/editor-types"

/** Motif court affiché sous la proposition de repli. */
function noticeFor(error: unknown): string {
  if (error instanceof ModelError) {
    if (error.kind === "not_configured") return "Modèle d'écriture non configuré : proposition d'après les mots du passage."
    if (error.kind === "quota") return "Quota du modèle atteint : proposition d'après les mots du passage."
    if (error.kind === "timeout") return "Le modèle a mis trop de temps : proposition d'après les mots du passage."
  }
  return "Le modèle n'a pas répondu : proposition d'après les mots du passage."
}

export async function describePassage(input: {
  passage: PassageContext
  title: string
  keyword: string | null
  competitors: string[]
  /** Modèle demandé (celui du plan) et modèle de repli si sa clé manque. */
  model: string
  fallbackModel: string
  timeoutMs: number
}): Promise<DescribePassageResponse> {
  const { competitors } = input
  const redact = (s: string) => redactCompetitors(s, competitors)
  const passage: PassageContext = {
    ...input.passage,
    text: redact(input.passage.text),
    heading: input.passage.heading ? redact(input.passage.heading) : null,
    before: redact(input.passage.before),
    after: redact(input.passage.after),
  }
  const brief = {
    passage,
    title: redact(input.title),
    keyword: input.keyword && findCompetitorMentions(input.keyword, competitors).length === 0 ? input.keyword : null,
  }
  const fallback = (notice: string): DescribePassageResponse => ({ ...heuristicPassage(brief), source: "heuristic", notice })

  try {
    const choice = resolvePassModel(input.model, input.fallbackModel, hasKey)
    const res = await generateText({
      model: choice.model,
      system: PASSAGE_SYSTEM,
      prompt: buildPassagePrompt(brief),
      // Réflexion comprise
      maxOutputTokens: 3_000,
      json: { schema: PASSAGE_JSON_SCHEMA },
      timeoutMs: input.timeoutMs,
    })
    const suggestion = parsePassageOutput(res.text)
    if (!suggestion) return fallback("La réponse du modèle était illisible : proposition d'après les mots du passage.")
    // Un concurrent dans la scène : jamais affiché ni envoyé à l'image
    if (findCompetitorMentions(`${suggestion.subject} ${suggestion.scene} ${suggestion.alt}`, competitors).length > 0) {
      return fallback("La proposition du modèle nommait un concurrent : proposition d'après les mots du passage.")
    }
    return {
      ...suggestion,
      alt: suggestion.alt || altFromDescription(suggestion.scene),
      source: "model",
      notice: res.fallbackFrom ? `Proposition par un autre modèle : ${res.fallbackFrom.reason}.` : null,
    }
  } catch (error) {
    if (!(error instanceof ModelError)) console.error("[blog-images] description du passage", error)
    return fallback(noticeFor(error))
  }
}
