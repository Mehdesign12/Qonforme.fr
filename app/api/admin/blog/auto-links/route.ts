/**
 * POST /api/admin/blog/auto-links — bouton « Ajouter les liens internes » du
 * panneau Maillage interne de l'éditeur d'articles.
 *
 * Corps : { markdown (texte de l'article), title?, keyword?, slug? }.
 * Réponse : AutoLinksResponse — { before, after, goal, words, proposals,
 * markdown, relatedBlock }.
 * - `proposals` : liens à poser (ancre, page, texte qui précède) ; l'éditeur
 *   visuel les pose sur le texte affiché, un seul pas d'annulation ;
 * - `markdown` : le texte avec ces liens posés (mode Markdown) ;
 * - `relatedBlock` : bloc « Pour aller plus loin » proposé quand le texte ne
 *   contient pas assez d'expressions à lier (null sinon).
 *
 * Rien n'est enregistré ici : l'article l'est par l'éditeur, à l'enregistrement.
 * Aucun modèle d'IA, aucun coût : les pages et leurs expressions viennent du
 * catalogue du site (lib/seo/links/catalog.ts).
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { errorPayload, seoDb } from "@/lib/seo/db"
import { zodError } from "@/lib/seo/articles/input"
import { applyProposals, internalLinksOf, linkGoal, proposeLinks, relatedBlock } from "@/lib/seo/links/engine"
import { loadLinkCandidates } from "@/lib/seo/links/catalog"
import { wordCount } from "@/lib/seo/links/text"
import type { AutoLinksResponse } from "@/lib/seo/articles/editor-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const schema = z.object({
  markdown: z.string({ message: "Texte attendu" }).max(300_000, "Article trop long"),
  title: z.string().trim().max(300).optional(),
  keyword: z.string().trim().max(160).nullable().optional(),
  slug: z
    .string()
    .trim()
    .max(160)
    .regex(/^[a-z0-9-]*$/, "Adresse invalide")
    .optional(),
})

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json(zodError(parsed.error), { status: 400 })
  const { markdown, title, keyword, slug } = parsed.data
  if (!markdown.trim()) return NextResponse.json({ error: "Écrivez d'abord le texte de l'article : les liens se posent sur ses phrases." }, { status: 400 })

  try {
    const candidates = await loadLinkCandidates(seoDb())
    const headings = Array.from(markdown.matchAll(/^##+\s+(.+)$/gm)).map((m) => m[1])
    const topic = [title, keyword, ...headings].filter(Boolean).join(" ")
    const selfPath = slug ? `/blog/${slug}` : null
    const words = wordCount(markdown)
    const goal = linkGoal(words)
    const before = internalLinksOf(markdown).length
    const proposals = proposeLinks(markdown, candidates, { selfPath, keyword, topic, target: goal.goal })
    const applied = applyProposals(markdown, proposals)
    const after = before + proposals.length
    const block = after < goal.min ? relatedBlock(applied, candidates, { count: Math.min(3, goal.min - after + 1), topic, selfPath, keyword }) : null
    const body: AutoLinksResponse = {
      before,
      after,
      goal,
      words,
      proposals: proposals.map((p) => ({ path: p.path, title: p.title, kind: p.kind, anchor: p.anchor, before: p.before, section: p.section })),
      markdown: applied,
      relatedBlock: block,
    }
    return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    const { status, body } = errorPayload(error)
    return NextResponse.json(body, { status })
  }
}
