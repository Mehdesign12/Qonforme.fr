/**
 * Le site suivi par l'onglet SEO : origine, chemins, types de pages.
 *
 * L'exploration et PageSpeed ne visent que ce site (SITE_ORIGIN) : aucune URL
 * fournie par une requête n'est appelée telle quelle (pas de SSRF).
 * Module pur.
 */
import type { PageType } from "@/lib/seo/types"

/** Origine canonique (metadataBase de app/layout.tsx). */
export const SITE_ORIGIN = "https://qonforme.fr"
export const SITE_HOST = "qonforme.fr"

/** Hôtes considérés comme le même site (Search Console renvoie parfois www). */
const SAME_SITE_HOSTS = new Set(["qonforme.fr", "www.qonforme.fr"])

/**
 * Chemin normalisé d'une URL du site (« https://qonforme.fr/modele/ » → « /modele ») ;
 * null pour une URL d'un autre site ou invalide. Un chemin seul est accepté.
 */
export function toSitePath(urlOrPath: string): string | null {
  const raw = urlOrPath.trim()
  if (!raw) return null
  let url: URL
  try {
    url = raw.startsWith("/") ? new URL(raw, SITE_ORIGIN) : new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null
  if (!SAME_SITE_HOSTS.has(url.hostname.toLowerCase())) return null
  let path = url.pathname.replace(/\/{2,}/g, "/")
  try {
    path = decodeURI(path)
  } catch {
    /* chemin mal encodé : gardé tel quel */
  }
  if (path.length > 1) path = path.replace(/\/+$/, "")
  return path || "/"
}

/** URL absolue d'un chemin du site. */
export function siteUrl(path: string): string {
  const clean = toSitePath(path)
  return `${SITE_ORIGIN}${clean === "/" || !clean ? "/" : encodeURI(clean)}`
}

/** Type d'une page d'après son chemin (filtres des Actions SEO, colonnes des tableaux). */
export function pageTypeOf(path: string): PageType {
  const p = toSitePath(path) ?? path
  if (p === "/") return "accueil"
  const first = p.split("/")[1] ?? ""
  switch (first) {
    case "guide":
      return "guide"
    case "modele":
      return "modele"
    case "facturation":
      return "metier"
    case "devenir-a-son-compte":
      return "installation"
    case "blog":
      return "blog"
    case "glossaire":
      return "glossaire"
    case "outils":
      return "outil"
    default:
      return "autre"
  }
}
