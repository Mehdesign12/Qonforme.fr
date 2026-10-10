/**
 * Repérage dans une réponse de moteur IA (module pur, PLAN-SEO-INTERNE-2026-10.md § 3) :
 * - mention : la marque est nommée dans le texte (un terme de marque en mot entier,
 *   sans tenir compte des accents ni de la casse), liens et adresses retirés : une
 *   citation en ligne (« ([qonforme.fr](https://qonforme.fr/…)) ») n'est pas une mention ;
 * - citation : le site figure parmi les sources (qonforme.fr ou un sous-domaine) ;
 * - concurrents mentionnés (lib/seo/competitors.ts) et cités (domaine de source).
 *
 * Les concurrents servent au suivi interne seulement (règle de CLAUDE.md).
 */
import { findCompetitorMentions } from "@/lib/seo/competitors"
import { SITE_HOST } from "@/lib/seo/site"
import type { GeoSource } from "@/lib/seo/geo/types"

/** Terme toujours recherché, quels que soient les réglages. */
export const BRAND_NAME = "Qonforme"

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Domaine d'une URL : hôte en minuscules sans « www. » (« https://www.Qonforme.fr/x » → « qonforme.fr »).
 * Chaîne vide pour une URL invalide ou qui n'est pas http(s).
 */
export function domainOf(url: string | null | undefined): string {
  if (!url) return ""
  try {
    const u = new URL(url.trim())
    if (u.protocol !== "https:" && u.protocol !== "http:") return ""
    return u.hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "")
  } catch {
    return ""
  }
}

/** Vrai si `domain` est `base` ou l'un de ses sous-domaines. */
export function isDomainOrSubdomain(domain: string, base: string): boolean {
  const d = domain.toLowerCase().replace(/^www\./, "")
  const b = base.toLowerCase().replace(/^www\./, "")
  if (!d || !b) return false
  return d === b || d.endsWith(`.${b}`)
}

/** Vrai pour qonforme.fr et ses sous-domaines. */
export function isSiteDomain(domain: string): boolean {
  return isDomainOrSubdomain(domain, SITE_HOST)
}

/** Termes de marque recherchés : réglage targeting.brandTerms plus « Qonforme », sans doublon. */
export function brandTermsOf(settingsTerms: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  ;[BRAND_NAME, ...settingsTerms].forEach((t) => {
    const term = t.trim()
    const key = strip(term)
    if (!key || seen.has(key)) return
    seen.add(key)
    out.push(term)
  })
  return out
}

/** Vrai si l'un des termes figure dans le texte en mot entier (sans accents ni casse). */
export function mentionsBrand(text: string | null | undefined, terms: string[]): boolean {
  if (!text) return false
  const haystack = strip(text)
  return terms.some((term) => {
    const needle = strip(term.trim())
    if (!needle) return false
    return new RegExp(`(^|[^a-z0-9])${escapeRegExp(needle)}([^a-z0-9]|$)`).test(haystack)
  })
}

/**
 * Texte où chercher les mentions (marque et concurrents) : sans liens Markdown (intitulé
 * compris : ChatGPT y écrit le domaine de la source citée) ni adresses http(s) ou www.
 * Ces liens sont des citations, comptées à part d'après les sources.
 */
export function mentionText(text: string): string {
  return text
    .replace(/!?\[[^\]\n]*\]\([^)\s]*(?:\s+"[^"\n]*")?\)/g, " ")
    .replace(/<?\bhttps?:\/\/[^\s<>()[\]"']+>?/gi, " ")
    .replace(/\bwww\.[^\s<>()[\]"']+/gi, " ")
    .replace(/\(\s*\)/g, " ")
}

export interface Detection {
  brand_mentioned: boolean
  site_cited: boolean
  /** Domaines concurrents nommés dans le texte. */
  competitors_mentioned: string[]
  /** Domaines concurrents parmi les sources. */
  competitors_cited: string[]
}

/** Repérage complet d'une réponse. `brandTerms` : déjà complétés par brandTermsOf. */
export function detect(
  input: { answer: string | null; sources: GeoSource[] },
  opts: { brandTerms: string[]; competitors: string[] },
): Detection {
  const domains = input.sources.map((s) => (s.domain || domainOf(s.url)).toLowerCase()).filter(Boolean)
  const competitors = opts.competitors.map((c) => c.toLowerCase().trim()).filter(Boolean)
  const text = input.answer ? mentionText(input.answer) : ""
  return {
    brand_mentioned: mentionsBrand(text, opts.brandTerms),
    site_cited: domains.some(isSiteDomain),
    competitors_mentioned: text ? findCompetitorMentions(text, competitors) : [],
    competitors_cited: competitors.filter((c) => domains.some((d) => isDomainOrSubdomain(d, c))),
  }
}

/** Classement d'une source pour l'écran de détail. */
export function sourceKind(source: GeoSource, competitors: string[]): "site" | "competitor" | "other" {
  const domain = source.domain || domainOf(source.url)
  if (isSiteDomain(domain)) return "site"
  if (competitors.some((c) => isDomainOrSubdomain(domain, c))) return "competitor"
  return "other"
}

/**
 * Sources dédoublonnées par URL, dans l'ordre d'arrivée ; une URL non http(s) est
 * écartée (elle ne sera jamais un lien cliquable dans l'admin).
 */
export function dedupeSources(sources: GeoSource[]): GeoSource[] {
  const seen = new Set<string>()
  const out: GeoSource[] = []
  sources.forEach((s) => {
    const url = (s.url ?? "").trim()
    const key = url || `${s.domain}|${s.title}`
    if (!key || seen.has(key)) return
    if (url && !/^https?:\/\//i.test(url)) return
    seen.add(key)
    out.push({ url, domain: (s.domain || domainOf(url)).toLowerCase(), title: (s.title ?? "").trim().slice(0, 300) })
  })
  return out
}
