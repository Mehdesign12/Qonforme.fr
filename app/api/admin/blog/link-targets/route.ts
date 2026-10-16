/**
 * GET /api/admin/blog/link-targets — pages du site proposées dans la fenêtre
 * « Lien » de l'éditeur d'articles (Ctrl+K) : articles publiés, guides,
 * modèles, pages métier, « S'installer à son compte », glossaire, outils et
 * pages principales. Mêmes pages que le plan du site (app/plan-du-site/page.tsx).
 *
 * Lecture tolérante : si les articles ne se lisent pas, les autres pages sont
 * quand même rendues (elles ne dépendent pas de la base).
 * Réponse : LinkTargetsResponse (lib/seo/articles/editor-types.ts).
 */
import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { seoDb } from "@/lib/seo/db"
import { GUIDES } from "@/lib/pseo/guides"
import { MODELES } from "@/lib/pseo/modeles"
import { METIERS } from "@/lib/pseo/metiers"
import { INSTALLATIONS } from "@/lib/pseo/installation"
import { GLOSSAIRE } from "@/lib/pseo/glossaire"
import { OUTILS_CATEGORIES } from "@/components/layout/public-links"
import type { LinkTarget, LinkTargetsResponse } from "@/lib/seo/articles/editor-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Pages principales, dans l'ordre où on les cherche le plus. */
const PAGES: LinkTarget[] = [
  { title: "Accueil", path: "/", kind: "page" },
  { title: "Tarifs", path: "/pricing", kind: "page" },
  { title: "Modèle de devis gratuit", path: "/modele", kind: "page" },
  { title: "Outils gratuits", path: "/outils", kind: "page" },
  { title: "Guides de facturation", path: "/guide", kind: "page" },
  { title: "Logiciel de devis par métier", path: "/facturation", kind: "page" },
  { title: "S'installer à son compte dans le bâtiment", path: "/devenir-a-son-compte", kind: "page" },
  { title: "Glossaire", path: "/glossaire", kind: "page" },
  { title: "Blog", path: "/blog", kind: "page" },
  { title: "Démo du tableau de bord", path: "/demo", kind: "page" },
  { title: "Créer un compte", path: "/signup", kind: "page" },
]

/** Outils absents du menu public (hub /outils seulement). */
const EXTRA_TOOLS: LinkTarget[] = [
  { title: "Calculateur de béton", path: "/outils/calculateur-beton", kind: "outil" },
  { title: "Calculateur de pente", path: "/outils/calculateur-pente", kind: "outil" },
]

/** Pages qui ne dépendent pas de la base. */
function staticLinkTargets(): LinkTarget[] {
  const tools: LinkTarget[] = OUTILS_CATEGORIES.flatMap((c) => c.items.map((o) => ({ title: o.label, path: o.href, kind: "outil" as const })))
  return [
    ...PAGES,
    ...GUIDES.map((g) => ({ title: g.titre, path: `/guide/${g.slug}`, kind: "guide" as const })),
    ...MODELES.map((m) => ({ title: m.titre, path: `/modele/${m.slug}`, kind: "modele" as const })),
    ...METIERS.map((m) => ({ title: m.titre, path: `/facturation/${m.slug}`, kind: "metier" as const })),
    ...INSTALLATIONS.map((i) => ({ title: `Devenir ${i.metier} à son compte`, path: `/devenir-a-son-compte/${i.slug}`, kind: "installation" as const })),
    ...tools,
    ...EXTRA_TOOLS,
    ...GLOSSAIRE.map((t) => ({ title: t.terme, path: `/glossaire/${t.slug}`, kind: "glossaire" as const })),
  ]
}

/** Une seule entrée par chemin (la première). */
function dedupe(targets: LinkTarget[]): LinkTarget[] {
  const seen = new Set<string>()
  return targets.filter((t) => {
    if (seen.has(t.path)) return false
    seen.add(t.path)
    return true
  })
}

async function publishedArticles(): Promise<LinkTarget[]> {
  try {
    const { data, error } = await seoDb()
      .from("blog_posts")
      .select("slug, title")
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .limit(500)
    if (error) {
      console.error("[blog] liens : articles illisibles", error.message)
      return []
    }
    return ((data ?? []) as { slug: string | null; title: string | null }[])
      .filter((p) => p.slug && p.title)
      .map((p) => ({ title: p.title as string, path: `/blog/${p.slug}`, kind: "article" as const }))
  } catch (error) {
    console.error("[blog] liens : articles illisibles", error)
    return []
  }
}

export async function GET() {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  const articles = await publishedArticles()
  const body: LinkTargetsResponse = { targets: dedupe([...articles, ...staticLinkTargets()]) }
  return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } })
}
