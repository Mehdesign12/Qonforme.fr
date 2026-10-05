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
  { pattern: /mentions?\s+obligatoires?\s+(d['’]un|du|sur\s+un)\s+devis/i, href: "/guide/mentions-obligatoires-devis" },
  { pattern: /(?:comment\s+)?(?:faire|r[ée]diger|[ée]tablir|chiffrer)\s+(?:un|son|ses|vos|votre)\s+devis/i, href: "/guide/comment-faire-un-devis" },
  { pattern: /(?:comment\s+)?(?:faire|r[ée]diger|[ée]tablir|[ée]mettre)\s+(?:une|sa|ses|vos|votre)\s+(?:premi[èe]re\s+)?facture/i, href: "/guide/premiere-facture" },
  { pattern: /taux\s+de\s+TVA\s+(?:des|pour\s+les|sur\s+les|applicables?\s+aux)\s+travaux|TVA\s+(?:à|de)\s+(?:10|5,5)\s?%/i, href: "/guide/tva-travaux" },
  { pattern: /(s['’]installer|se\s+mettre)\s+à\s+son\s+compte/i, href: "/devenir-a-son-compte" },
  { pattern: /facture?\s+[eé]lectronique\s+2026/i, href: "/guide/facture-electronique-2026" },
  { pattern: /facture?\s+auto[- ]?entrepreneur/i, href: "/guide/facture-auto-entrepreneur" },
  { pattern: /d[eé]lais?\s+de\s+paiement/i, href: "/guide/delai-paiement-facture" },
  { pattern: /autoliquidation\s+(de\s+)?(la\s+)?TVA/i, href: "/guide/tva-autoliquidation-sous-traitance" },
  { pattern: /facture?\s+d['']acompte/i, href: "/guide/facture-acompte" },
  { pattern: /avoir\s+(ou\s+)?note\s+de\s+cr[eé]dit/i, href: "/guide/avoir-facture" },
  { pattern: /conservation\s+des?\s+factures?/i, href: "/guide/conservation-factures" },
  { pattern: /plateformes?\s+agr[eé]{2}es?/i, href: "/guide/plateforme-agreee" },
  { pattern: /\bPDP\b/, href: "/guide/plateforme-agreee" },
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

  for (const { pattern: keyword, href } of KEYWORD_LINKS) {
    if (usedHrefs.has(href)) continue
    // Jamais à l'intérieur d'une balise (attribut alt, title…) : le texte trouvé ne doit pas être suivi d'un « > » avant le prochain « < »
    const pattern = new RegExp(`(?:${keyword.source})(?![^<]*>)`, keyword.flags)

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
