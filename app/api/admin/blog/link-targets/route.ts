/**
 * GET /api/admin/blog/link-targets — pages du site proposées dans la fenêtre
 * « Lien » de l'éditeur d'articles (Ctrl+K) : articles publiés, guides,
 * modèles, pages métier, « S'installer à son compte », glossaire, outils et
 * pages principales. Mêmes pages que le plan du site (app/plan-du-site/page.tsx)
 * et que le maillage automatique (lib/seo/links/catalog.ts).
 *
 * Lecture tolérante : si les articles ne se lisent pas, les autres pages sont
 * quand même rendues (elles ne dépendent pas de la base).
 * Réponse : LinkTargetsResponse (lib/seo/articles/editor-types.ts).
 */
import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { seoDb } from "@/lib/seo/db"
import { linkTargetsOf, loadLinkCandidates } from "@/lib/seo/links/catalog"
import type { LinkTargetsResponse } from "@/lib/seo/articles/editor-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  const body: LinkTargetsResponse = { targets: linkTargetsOf(await loadLinkCandidates(seoDb())) }
  return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } })
}
