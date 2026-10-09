/**
 * Concurrents : usage interne seulement (règle de CLAUDE.md « Ne jamais nommer
 * un concurrent dans un contenu public »).
 *
 * Les domaines saisis dans Paramètres › Ciblage servent au suivi de la
 * visibilité IA et à la carte des sources citées. Ils ne doivent JAMAIS
 * atteindre le générateur d'articles ni un article publié :
 * - `assertNoCompetitorInPrompt` bloque une consigne qui en contiendrait un ;
 * - `findCompetitorMentions` repère un concurrent cité dans un texte produit
 *   (l'article est alors retenu en brouillon « À relire »).
 *
 * Module pur.
 */

/** Nom de marque déduit d'un domaine (« tolteck.com » → « tolteck », « btp.inprocess.ai » → « inprocess »). */
export function brandOfDomain(domain: string): string {
  const host = domain.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "")
  const labels = host.split(".").filter(Boolean)
  if (labels.length <= 1) return labels[0] ?? host
  // Le label qui précède l'extension (« inprocess » dans btp.inprocess.ai)
  return labels[labels.length - 2]
}

/** Termes qui désignent un concurrent : le domaine et le nom déduit (au moins 4 lettres). */
export function competitorTerms(domains: string[]): string[] {
  const terms = new Set<string>()
  for (const d of domains) {
    const domain = d.toLowerCase().trim()
    if (!domain) continue
    terms.add(domain)
    const brand = brandOfDomain(domain)
    if (brand.length >= 4) terms.add(brand)
  }
  return Array.from(terms)
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

/** Concurrents (domaines) cités dans un texte, en mot entier, sans tenir compte des accents ni de la casse. */
export function findCompetitorMentions(text: string, domains: string[]): string[] {
  const haystack = strip(text)
  const found = new Set<string>()
  for (const domain of domains) {
    for (const term of competitorTerms([domain])) {
      const re = new RegExp(`(^|[^a-z0-9])${escapeRegExp(strip(term))}([^a-z0-9]|$)`, "i")
      if (re.test(haystack)) {
        found.add(domain.toLowerCase())
        break
      }
    }
  }
  return Array.from(found)
}

export class CompetitorLeakError extends Error {
  constructor(readonly competitors: string[]) {
    super("Un concurrent figure dans la consigne du générateur d'articles : rédaction bloquée.")
    this.name = "CompetitorLeakError"
  }
}

/** Lève si la consigne envoyée au générateur nomme un concurrent. */
export function assertNoCompetitorInPrompt(prompt: string, domains: string[]): void {
  const found = findCompetitorMentions(prompt, domains)
  if (found.length > 0) throw new CompetitorLeakError(found)
}
