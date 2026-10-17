/**
 * POST /api/admin/seo/ideas/adopt — « Adopter » une idée de la Proposition IA.
 *
 * Corps : { keyword, title, articleType, intent?, volume?, difficulty?, cpc?,
 * note?, createTopic?, targeted? } (createTopic : vrai par défaut ; targeted :
 * l'éditeur confie le mot-clé à l'article en cours, sans créer de sujet).
 * Réponse 201 (ou 200 si tout existait déjà) :
 * { keywordId, keyword, keywordAdded, topicId, topicExisting }.
 *
 * Le mot-clé entre dans l'onglet Mots-clés (source « suggestion ») ; avec
 * `createTopic`, un sujet d'article « à planifier » est créé (ou rendu s'il en
 * existe un ouvert) et le mot-clé passe à « ciblé ». 409 : mot-clé ignoré.
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { errorPayload, seoDb } from "@/lib/seo/db"
import { zodError } from "@/lib/seo/articles/input"
import { getSettings } from "@/lib/seo/settings"
import { KEYWORD_INTENTS } from "@/lib/seo/keywords/types"
import type { KeywordIntent } from "@/lib/seo/types"
import { AdoptError, adoptIdea } from "@/lib/seo/ideas/adopt"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const adoptSchema = z.object({
  keyword: z.string({ message: "Mot-clé attendu" }).trim().min(2, "Mot-clé attendu").max(120, "Mot-clé de 120 caractères au plus"),
  title: z.string({ message: "Titre attendu" }).trim().min(5, "Le titre doit faire au moins 5 caractères").max(160, "Titre de 160 caractères au plus"),
  articleType: z.enum(["howto", "guide", "news", "faq"], { message: "Type d'article inconnu" }),
  intent: z.enum(KEYWORD_INTENTS as [KeywordIntent, ...KeywordIntent[]]).nullable().optional(),
  volume: z.number().int().min(0).max(100_000_000).nullable().optional(),
  difficulty: z.number().int().min(0).max(100).nullable().optional(),
  cpc: z.number().min(0).max(1_000).nullable().optional(),
  note: z.string().trim().max(300).nullable().optional(),
  createTopic: z.boolean().optional(),
  /** Éditeur : le mot-clé est confié à l'article en cours. */
  targeted: z.boolean().optional(),
})

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  const parsed = adoptSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json(zodError(parsed.error), { status: 400 })
  const { createTopic, targeted, ...idea } = parsed.data

  try {
    const db = seoDb()
    const targeting = await getSettings(db, "targeting")
    const result = await adoptIdea(db, idea, { createTopic: createTopic !== false, targeted: targeted === true, competitors: targeting.value.competitors })
    return NextResponse.json(result, { status: result.keywordAdded || (result.topicId && !result.topicExisting) ? 201 : 200 })
  } catch (error) {
    if (error instanceof AdoptError) return NextResponse.json({ error: error.message, ...(error.code ? { code: error.code } : {}) }, { status: error.status })
    const { status, body } = errorPayload(error)
    return NextResponse.json(body, { status })
  }
}
