/**
 * POST /api/admin/blog/images/describe — « Ce que montre l'image » : le studio
 * d'images de l'éditeur envoie le passage choisi (texte sélectionné, paragraphe
 * du curseur) et reçoit le sujet repéré, la scène à photographier, les puces
 * de style et le texte alternatif. Aucune image n'est créée ici : rien n'est
 * facturé par Google, seulement un court appel au modèle du plan.
 *
 * Corps : { passage: { text, heading, before, after, selected }, title?, keyword? }.
 * Réponse : DescribePassageResponse. Toujours 200 quand le passage est lisible :
 * sans modèle (clé absente, panne, quota, réponse illisible), `source` vaut
 * « heuristic » et la proposition vient du métier ou du sujet repérés dans le
 * passage (heuristicPassage) ; la fenêtre s'ouvre donc toujours préremplie.
 *
 * - La lecture elle-même (consigne, modèle, repli, concurrents) est dans
 *   lib/blog-images/describe.ts, partagée avec la rédaction automatique.
 * - Concurrents : jamais dans une consigne. Le texte du passage, le titre et le
 *   mot-clé sont caviardés avant l'appel ; la scène rendue qui en nommerait un
 *   est remplacée par le repli.
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { errorPayload, seoDb } from "@/lib/seo/db"
import { getAllSettings } from "@/lib/seo/settings"
import { zodError } from "@/lib/seo/articles/input"
import { describePassage } from "@/lib/blog-images/describe"
import { PASSAGE_CONTEXT_MAX, PASSAGE_TEXT_MAX } from "@/lib/blog-images/passage"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

const schema = z.object({
  passage: z.object({
    text: z.string({ message: "Passage attendu" }).max(20_000, "Passage trop long").transform((s) => s.slice(0, PASSAGE_TEXT_MAX)),
    heading: z.string().max(400).nullable().optional(),
    before: z.string().max(20_000).optional().transform((s) => (s ?? "").slice(-PASSAGE_CONTEXT_MAX)),
    after: z.string().max(20_000).optional().transform((s) => (s ?? "").slice(0, PASSAGE_CONTEXT_MAX)),
    selected: z.boolean().optional(),
  }),
  title: z.string().trim().max(300).optional(),
  keyword: z.string().trim().max(160).nullable().optional(),
})

/** Délai de l'appel : la fenêtre attend ce résultat avant de se préremplir. */
const DESCRIBE_TIMEOUT_MS = 20_000

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json(zodError(parsed.error), { status: 400 })
  const { passage: raw, title, keyword } = parsed.data
  if (!raw.text.trim() && !(raw.heading ?? "").trim()) {
    return NextResponse.json({ error: "Placez le curseur dans un paragraphe ou sélectionnez un texte : l'image s'en inspire." }, { status: 400 })
  }

  let settings: Awaited<ReturnType<typeof getAllSettings>>
  try {
    settings = await getAllSettings(seoDb())
  } catch (error) {
    const { status, body } = errorPayload(error)
    return NextResponse.json(body, { status })
  }

  const body = await describePassage({
    passage: { text: raw.text, heading: raw.heading ?? null, before: raw.before, after: raw.after, selected: raw.selected === true },
    title: title ?? "",
    keyword: keyword ?? null,
    competitors: settings.targeting.value.competitors,
    model: settings.articles.value.planModel,
    fallbackModel: settings.articles.value.textModel,
    timeoutMs: DESCRIBE_TIMEOUT_MS,
  })
  return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } })
}
