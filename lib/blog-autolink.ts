/**
 * Auto-links keywords in blog HTML content to pSEO pages.
 *
 * Replaces the FIRST occurrence of each keyword (case-insensitive)
 * with an internal link, avoiding replacements inside existing <a> tags
 * or HTML attributes. Each keyword is linked at most once per article.
 */

const KEYWORD_LINKS: { pattern: RegExp; href: string }[] = [
  // Guides
  { pattern: /mentions?\s+obligatoires?\s+(sur\s+une\s+)?facture/i, href: "/guide/mentions-obligatoires-facture" },
  { pattern: /facture?\s+[eé]lectronique\s+2026/i, href: "/guide/facture-electronique-2026" },
  { pattern: /facture?\s+auto[- ]?entrepreneur/i, href: "/guide/facture-auto-entrepreneur" },
  { pattern: /d[eé]lais?\s+de\s+paiement/i, href: "/guide/delai-paiement-facture" },
  { pattern: /autoliquidation\s+(de\s+)?(la\s+)?TVA/i, href: "/guide/tva-autoliquidation-sous-traitance" },
  { pattern: /facture?\s+d['']acompte/i, href: "/guide/facture-acompte" },
  { pattern: /avoir\s+(ou\s+)?note\s+de\s+cr[eé]dit/i, href: "/guide/avoir-facture" },
  { pattern: /conservation\s+des?\s+factures?/i, href: "/guide/conservation-factures" },
  // Modèles
  { pattern: /mod[eè]le\s+de\s+facture\s+classique/i, href: "/modele/facture-classique" },
  { pattern: /mod[eè]le\s+de\s+devis\s+travaux/i, href: "/modele/devis-travaux" },
  { pattern: /mod[eè]le\s+d['']avoir/i, href: "/modele/avoir-annulation" },
  // Glossaire
  { pattern: /Factur-X/i, href: "/glossaire/factur-x" },
  { pattern: /(?:fichier|export)\s+FEC/i, href: "/glossaire/fec" },
  { pattern: /franchise\s+(?:en\s+base\s+)?de\s+TVA/i, href: "/glossaire/franchise-tva" },
  { pattern: /p[eé]nalit[eé]s?\s+de\s+retard/i, href: "/glossaire/penalites-retard" },
  { pattern: /indemnit[eé]\s+(?:forfaitaire\s+)?de\s+recouvrement/i, href: "/glossaire/indemnite-recouvrement" },
  { pattern: /garantie\s+d[eé]cennale/i, href: "/glossaire/garantie-decennale" },
  { pattern: /mise\s+en\s+demeure/i, href: "/glossaire/mise-en-demeure" },
  // Pages index
  { pattern: /facturation\s+par\s+m[eé]tier/i, href: "/facturation" },
]

export function autoLinkPseo(html: string): string {
  let result = html
  const usedHrefs = new Set<string>()

  for (const { pattern, href } of KEYWORD_LINKS) {
    if (usedHrefs.has(href)) continue

    // Only replace if not already inside an <a> tag
    // Strategy: split by <a...>...</a>, only replace in non-link segments
    const parts = result.split(/(<a\s[^>]*>[\s\S]*?<\/a>)/gi)
    let replaced = false

    for (let i = 0; i < parts.length; i++) {
      // Skip parts that are <a> tags (odd indices after split)
      if (i % 2 === 1) continue
      // Skip parts inside HTML tags
      if (parts[i].match(pattern)) {
        parts[i] = parts[i].replace(pattern, (match) => {
          if (replaced) return match
          replaced = true
          return `<a href="${href}" class="text-[#2563EB] underline underline-offset-2 hover:text-[#1D4ED8]">${match}</a>`
        })
        if (replaced) break
      }
    }

    if (replaced) {
      result = parts.join("")
      usedHrefs.add(href)
    }
  }

  return result
}
