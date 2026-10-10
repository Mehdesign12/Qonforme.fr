/**
 * Libellé d'une page cible dans la liste des mots-clés : « Accueil / »,
 * « Guide « Mentions obligatoires d'une facture » », sinon le chemin seul.
 * Côté serveur (lit le catalogue des guides de lib/pseo/guides.ts).
 */
import { GUIDES } from "@/lib/pseo/guides"

export interface PageLabel {
  /** Nom lisible, ou null (le chemin suffit). */
  label: string | null
  path: string
}

const NBSP = String.fromCharCode(0xa0)
const GUIDE_TITLES = new Map(GUIDES.map((g) => [g.slug, g.titre.split(" : ")[0].trim()]))

export function pageLabel(path: string | null): PageLabel | null {
  if (!path) return null
  if (path === "/") return { label: "Accueil", path }
  const guide = /^\/guide\/([^/]+)$/.exec(path)
  if (guide) {
    const title = GUIDE_TITLES.get(guide[1])
    if (title) return { label: `Guide «${NBSP}${title}${NBSP}»`, path }
  }
  return { label: null, path }
}
