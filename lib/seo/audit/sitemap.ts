/**
 * Lecture du plan du site (https://qonforme.fr/sitemap.xml) pour l'exploration :
 * un `<urlset>` ou un `<sitemapindex>` dont les sous-plans sont lus à leur tour
 * (sur qonforme.fr seulement, un niveau, 20 sous-plans au plus).
 */
import { decodeEntities } from "@/lib/html-entities"
import { toSitePath } from "@/lib/seo/site"
import { fetchSitePath, type FetchLike } from "@/lib/seo/audit/fetcher"
import { isPagePath } from "@/lib/seo/audit/html"

export const SITEMAP_PATH = "/sitemap.xml"
const MAX_CHILD_SITEMAPS = 20
/** Plafond de pages explorées en un passage complet. */
export const MAX_SITEMAP_PAGES = 1000

export interface ParsedSitemap {
  kind: "index" | "urlset" | "unknown"
  locs: string[]
}

/** Adresses <loc> d'un plan du site (CDATA et entités acceptés). */
export function parseSitemap(xml: string): ParsedSitemap {
  const kind = /<sitemapindex\b/i.test(xml) ? "index" : /<urlset\b/i.test(xml) ? "urlset" : "unknown"
  const locs: string[] = []
  const re = /<loc\b[^>]*>\s*(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?\s*<\/loc\s*>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) {
    const loc = decodeEntities(m[1].trim())
    if (loc) locs.push(loc)
  }
  return { kind, locs }
}

/** Chemins du site d'une liste d'adresses, sans doublon, dans l'ordre (adresses d'un autre site écartées). */
export function sitePathsOf(locs: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  locs.forEach((loc) => {
    const p = toSitePath(loc)
    if (!p || !isPagePath(p) || seen.has(p)) return
    seen.add(p)
    out.push(p)
  })
  return out
}

export class SitemapError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SitemapError"
  }
}

async function readXml(path: string, fetchImpl?: FetchLike): Promise<string> {
  const res = await fetchSitePath(path, { readBody: true, fetchImpl, accept: "application/xml,text/xml;q=0.9,*/*;q=0.5" })
  if (res.error) throw new SitemapError(`Plan du site illisible (${path}) : ${res.error}`)
  if (res.status !== 200 || res.body === null) throw new SitemapError(`Plan du site illisible (${path}) : réponse ${res.status ?? "—"}`)
  return res.body
}

/** Chemins des pages du plan du site de qonforme.fr. Lève SitemapError s'il est illisible ou vide. */
export async function readSitemapPaths(fetchImpl?: FetchLike): Promise<string[]> {
  const root = parseSitemap(await readXml(SITEMAP_PATH, fetchImpl))
  let locs = root.locs
  if (root.kind === "index") {
    locs = []
    const children = sitePathsOfAny(root.locs).slice(0, MAX_CHILD_SITEMAPS)
    for (const child of children) {
      const parsed = parseSitemap(await readXml(child, fetchImpl))
      if (parsed.kind !== "index") locs = locs.concat(parsed.locs)
    }
  }
  const paths = sitePathsOf(locs).slice(0, MAX_SITEMAP_PAGES)
  if (paths.length === 0) throw new SitemapError("Plan du site vide : aucune page de qonforme.fr à explorer.")
  return paths
}

/** Chemins du site (fichiers .xml compris) : sous-plans d'un index. */
function sitePathsOfAny(locs: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  locs.forEach((loc) => {
    const p = toSitePath(loc)
    if (!p || seen.has(p)) return
    seen.add(p)
    out.push(p)
  })
  return out
}
