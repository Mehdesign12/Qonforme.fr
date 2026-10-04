/**
 * Longueurs des balises <title> et des descriptions, d'après les contrôles de
 * PushRank (04/10/2026) : un title au-delà de 70 caractères est tronqué par
 * Google ; une description doit tenir sous le lien en une ou deux phrases
 * (entre 120 et 155 caractères environ).
 *
 * Les textes écrits à la main dans les pages respectent déjà ces bornes ;
 * ces fonctions servent aux textes produits ailleurs (articles du blog en
 * base, données pSEO) et ne réécrivent rien qui tient déjà.
 */
import type { Metadata } from "next"

/** Suffixe ajouté par le gabarit du layout racine (`%s | Qonforme`). */
const SUFFIX = " | Qonforme"
export const TITLE_MAX = 70
export const DESCRIPTION_MAX = 155

/** Espaces normales seulement : les espaces insécables (« 20 % ») restent. */
const collapse = (s: string) => s.replace(/[ \t\r\n]+/g, " ").trim()

/** Articulations où un titre trop long peut s'arrêter sans perdre son sens. */
const BREAKS = [" : ", " — ", " – ", " ? ", ", ", " et ", " pour ", " face ", " grâce ", " avec ", " sans ", " en "]
const TRAILING_WORDS = /\s+(?:de|du|des|d'|la|le|les|l'|et|ou|pour|à|au|aux|en|un|une|vos|votre|sur|par|face|avec|sans|:)$/i
const TRAILING_PUNCT = /[\s,;:–—-]+$/

function trimEnd(s: string): string {
  let out = s.replace(TRAILING_PUNCT, "")
  while (TRAILING_WORDS.test(out)) out = out.replace(TRAILING_WORDS, "").replace(TRAILING_PUNCT, "")
  return out
}

/**
 * Raccourcit un titre à `max` caractères : retire d'abord les parenthèses,
 * puis coupe à la dernière articulation naturelle (au moins 30 caractères
 * gardés), sinon au dernier mot entier.
 */
export function shortenTitle(raw: string, max = TITLE_MAX): string {
  const title = collapse(raw)
  if (title.length <= max) return title
  const noParens = collapse(title.replace(/\s*\([^)]*\)/g, ""))
  if (noParens.length <= max) return noParens

  let cut = -1
  for (const b of BREAKS) {
    const i = noParens.lastIndexOf(b, max)
    // « ? » se garde : on coupe juste après lui.
    const end = b === " ? " ? i + 2 : i
    if (i >= 0 && end <= max && end >= 30 && end > cut) cut = end
  }
  if (cut > 0) return trimEnd(noParens.slice(0, cut))
  const space = noParens.lastIndexOf(" ", max)
  return space > 0 ? trimEnd(noParens.slice(0, space)) : noParens.slice(0, max)
}

/**
 * Titre de page sous 70 caractères une fois rendu : garde le suffixe
 * « | Qonforme » quand il tient, sinon le retire, sinon raccourcit.
 */
export function fitTitle(raw: string): NonNullable<Metadata["title"]> {
  const title = collapse(raw)
  if (title.length + SUFFIX.length <= TITLE_MAX) return title
  return { absolute: shortenTitle(title, TITLE_MAX) }
}

/**
 * Description sous `max` caractères : garde les phrases entières qui
 * tiennent (au moins `minSentences` caractères), sinon coupe au dernier mot
 * et termine par « … ».
 */
export function fitDescription(raw: string, max = DESCRIPTION_MAX, minSentences = 90): string {
  const text = collapse(raw)
  if (text.length <= max) return text
  let cut = -1
  const end = /[.!?…](?=\s|$)/g
  let m: RegExpExecArray | null
  while ((m = end.exec(text)) && m.index < max) cut = m.index + 1
  if (cut >= minSentences) return text.slice(0, cut)
  const space = text.lastIndexOf(" ", max - 1)
  let cutText = space > 0 ? text.slice(0, space) : text.slice(0, max - 1)
  // Jamais de parenthèse laissée ouverte : on coupe juste avant elle.
  const open = cutText.lastIndexOf("(")
  if (open > cutText.lastIndexOf(")") && open > 60) cutText = cutText.slice(0, open)
  return `${trimEnd(cutText)}…`
}

/**
 * Description d'une entrée courte (définition du glossaire) complétée par
 * le texte qui suit, jusqu'à atteindre une description de 120 caractères au
 * moins, sans dépasser `max`.
 */
export function composeDescription(parts: string[], max = DESCRIPTION_MAX, min = 120): string {
  let out = ""
  for (const part of parts) {
    const sentences = collapse(part).match(/[^.!?…]+[.!?…]+(?=\s|$)|[^.!?…]+$/g) ?? []
    for (const s of sentences) {
      const next = collapse(out ? `${out} ${s}` : s)
      // Trop long : coupe au mot, pour atteindre la longueur minimale.
      if (next.length > max) return fitDescription(next, max, min)
      out = next
      if (out.length >= min) return out
    }
  }
  return out
}
