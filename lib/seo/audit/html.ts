/**
 * Lecture d'une page HTML du site pour l'audit (title, description, H1,
 * balise canonique, directives robots, liens internes, nombre de mots).
 *
 * Expressions régulières tolérantes, sans dépendance : les pages viennent de
 * notre propre site (Next.js), le but est de relever des balises, pas
 * d'interpréter n'importe quel HTML. Module pur, testé dans
 * __tests__/seo-audit-html.test.ts.
 */
import { decodeEntities } from "@/lib/html-entities"
import { siteUrl, toSitePath } from "@/lib/seo/site"

export interface ParsedPage {
  /** Contenu de <title>, espaces resserrés ; null si absent ou vide. */
  title: string | null
  /** <meta name="description"> ; null si absente ou vide. */
  description: string | null
  h1Count: number
  /** Texte du premier H1. */
  h1: string | null
  /** Adresse de la balise canonique, rendue absolue ; null si absente. */
  canonical: string | null
  /** Directives robots (meta robots, meta googlebot, en-tête X-Robots-Tag), jointes. */
  robots: string | null
  noindex: boolean
  /** Chemins du site liés depuis la page (sans doublon, sans la page elle-même). */
  internalLinks: string[]
  /** Nombre de mots approximatif du contenu (balise <main> si elle existe). */
  wordCount: number
}

const collapse = (s: string) => s.replace(/\s+/g, " ").trim()

/** Texte lisible d'un fragment HTML : balises retirées, entités décodées. */
export function textOf(fragment: string): string {
  return collapse(decodeEntities(stripBlocks(fragment).replace(/<[^>]*>/g, " ")))
}

/** Retire les blocs dont le texte n'est pas du contenu (scripts, styles, SVG…). */
function stripBlocks(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|iframe)\b[\s\S]*?<\/\1\s*>/gi, " ")
}

/** Attributs d'une balise ouvrante (`<meta name="x" content='y' data-z=w>`), noms en minuscules, valeurs décodées. */
export function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const body = tag.replace(/^<\s*[a-z0-9:-]+/i, "").replace(/\/?\s*>$/, "")
  const re = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(body))) {
    const name = m[1].toLowerCase()
    if (Object.prototype.hasOwnProperty.call(attrs, name)) continue
    attrs[name] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "")
  }
  return attrs
}

function tagsOf(html: string, name: string): Record<string, string>[] {
  const re = new RegExp(`<${name}\\b[^>]*>`, "gi")
  return (html.match(re) ?? []).map(parseAttributes)
}

/** Préfixes et extensions qui ne sont pas des pages (fichiers du framework, API, médias). */
const NOT_A_PAGE_PREFIXES = ["/_next/", "/api/", "/cdn-cgi/"]
const ASSET_EXTENSIONS = /\.(?:png|jpe?g|gif|webp|avif|svg|ico|css|js|mjs|map|woff2?|ttf|otf|mp4|webm|mp3|zip|json|txt|xml|webmanifest)$/i

/** Pages métier × ville (/facturation/<métier>/<ville>) : en noindex par décision (CLAUDE.md, 02/07/2026). */
export const GEO_PAGE_PATTERN = /^\/facturation\/[^/]+\/[^/]+$/

/** Vrai si un chemin du site désigne une page à vérifier (pas un fichier ni une route d'API). */
export function isPagePath(path: string): boolean {
  if (NOT_A_PAGE_PREFIXES.some((p) => path.startsWith(p))) return false
  return !ASSET_EXTENSIONS.test(path)
}

/**
 * Chemin du site d'un lien trouvé sur `pagePath` ; null pour un lien externe,
 * une ancre, un mailto:/tel:/javascript: ou un fichier.
 */
export function internalLinkPath(href: string, pagePath: string): string | null {
  const raw = href.trim()
  if (!raw || raw.startsWith("#")) return null
  if (/^(?:mailto|tel|sms|javascript|data|blob|ftp):/i.test(raw)) return null
  let url: URL
  try {
    url = new URL(raw, siteUrl(pagePath))
  } catch {
    return null
  }
  const path = toSitePath(url.href)
  if (!path || !isPagePath(path)) return null
  return path
}

/** Directives robots qui excluent la page de l'index. */
export function isNoindex(robots: string | null | undefined): boolean {
  return Boolean(robots && /(^|[\s,])(noindex|none)(\s|,|$)/i.test(robots))
}

/** Compte les mots (suites contenant au moins une lettre ou un chiffre). */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => /[0-9A-Za-zÀ-ÖØ-öø-ÿŒœ]/.test(w)).length
}

/**
 * Analyse une page. `pagePath` sert à résoudre les liens relatifs et à
 * retirer les liens vers la page elle-même ; `xRobotsTag` est l'en-tête HTTP
 * du même nom, s'il y en a un.
 */
export function parseHtml(html: string, pagePath: string, opts: { xRobotsTag?: string | null } = {}): ParsedPage {
  const clean = html.replace(/<!--[\s\S]*?-->/g, " ")
  const headEnd = clean.search(/<\/head\s*>/i)
  const head = headEnd >= 0 ? clean.slice(0, headEnd) : ""
  // Hors <head> (rendu en flux), on cherche dans le document sans les SVG, qui ont leurs propres <title>.
  const outsideSvg = clean.replace(/<svg\b[\s\S]*?<\/svg\s*>/gi, " ")
  const scopes = head ? [head, outsideSvg] : [outsideSvg]

  // Title
  let title: string | null = null
  for (const scope of scopes) {
    const m = scope.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)
    if (m) {
      title = collapse(decodeEntities(m[1].replace(/<[^>]*>/g, " "))) || null
      break
    }
  }

  // Meta et link
  let metas = head ? tagsOf(head, "meta") : []
  let links = head ? tagsOf(head, "link") : []
  if (!metas.some((a) => a.name)) metas = tagsOf(outsideSvg, "meta")
  if (!links.some((a) => (a.rel ?? "").toLowerCase().split(/\s+/).includes("canonical"))) links = tagsOf(outsideSvg, "link")

  const metaContent = (names: string[]) =>
    metas.filter((a) => names.includes((a.name ?? "").toLowerCase())).map((a) => collapse(a.content ?? ""))

  const description = metaContent(["description"]).find(Boolean) ?? null

  const robotsParts = metaContent(["robots", "googlebot"]).filter(Boolean)
  if (opts.xRobotsTag?.trim()) robotsParts.push(collapse(opts.xRobotsTag))
  const robots = robotsParts.length > 0 ? robotsParts.join(", ") : null

  const canonicalTag = links.find((a) => (a.rel ?? "").toLowerCase().split(/\s+/).includes("canonical") && a.href?.trim())
  let canonical: string | null = null
  if (canonicalTag) {
    try {
      canonical = new URL(canonicalTag.href.trim(), siteUrl(pagePath)).href
    } catch {
      canonical = canonicalTag.href.trim()
    }
  }

  // Corps
  const bodyStart = clean.search(/<body\b/i)
  const body = bodyStart >= 0 ? clean.slice(bodyStart) : clean.slice(Math.max(headEnd, 0))
  const h1s = body.match(/<h1\b[^>]*>[\s\S]*?<\/h1\s*>/gi) ?? []
  const h1Count = (body.match(/<h1\b/gi) ?? []).length
  const h1 = h1s.length > 0 ? textOf(h1s[0] ?? "") || null : null

  const selfPath = toSitePath(pagePath) ?? pagePath
  const seen = new Set<string>()
  const internalLinks: string[] = []
  tagsOf(body, "a").forEach((a) => {
    if (!a.href) return
    const p = internalLinkPath(a.href, selfPath)
    if (!p || p === selfPath || seen.has(p)) return
    seen.add(p)
    internalLinks.push(p)
  })
  internalLinks.sort()

  const mainStart = body.search(/<main\b/i)
  const mainEnd = body.search(/<\/main\s*>/i)
  const content = mainStart >= 0 && mainEnd > mainStart ? body.slice(mainStart, mainEnd) : body

  return {
    title,
    description,
    h1Count,
    h1: h1 ? h1.slice(0, 300) : null,
    canonical,
    robots,
    noindex: isNoindex(robots),
    internalLinks,
    wordCount: countWords(textOf(content)),
  }
}

/** Longueur affichée d'un texte (caractères, pas unités UTF-16). */
export function textLength(s: string | null | undefined): number {
  return s ? Array.from(s).length : 0
}
