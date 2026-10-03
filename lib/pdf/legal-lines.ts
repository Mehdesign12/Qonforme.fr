/**
 * Mentions légales en pied de PDF : chaque mention est coupée aux espaces pour
 * tenir dans la largeur de la page, jamais tronquée (une mention d'assurance
 * coupée par « … » perdrait l'assureur ou la couverture).
 */

/** Coupe un texte en lignes de largeur maximale ; un mot trop long reste entier sur sa ligne. */
export function wrapText(text: string, measure: (s: string) => number, maxWidth: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean)
  const out: string[] = []
  let current = ""
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (!current || measure(candidate) <= maxWidth) {
      current = candidate
    } else {
      out.push(current)
      current = word
    }
  }
  if (current) out.push(current)
  return out
}

/**
 * Mentions prêtes à dessiner : coupées à la largeur, sans doublon, au plus
 * `maxLines` lignes (au-delà, le pied de page serait recouvert).
 */
export function legalPdfLines(
  mentions: string[],
  measure: (s: string) => number,
  maxWidth: number,
  maxLines = 16,
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const m of mentions) {
    const key = m.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(...wrapText(m, measure, maxWidth))
  }
  return out.slice(0, maxLines)
}
