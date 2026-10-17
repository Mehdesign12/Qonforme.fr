/**
 * Texte pour le maillage interne : pliage sans accents ni casse avec la
 * correspondance des positions (on cherche dans le texte plié, on pose le lien
 * sur le texte d'origine), mots significatifs d'un sujet, nombre de mots d'un
 * article en Markdown.
 *
 * Module pur : serveur, navigateur et tests.
 */

export interface Folded {
  /** Texte plié : minuscules, sans accents, apostrophes droites, espaces (insécables compris) simples. */
  text: string
  /** `map[i]` : position dans l'original du caractère plié `i` ; `map[text.length]` : longueur de l'original. */
  map: number[]
}

/** Pliage d'un caractère : lettre de base en minuscule, apostrophe droite, espace simple. */
function foldChar(ch: string): string {
  if (/[\s   ]/.test(ch)) return " "
  if (/[’‘`´ʼ]/.test(ch)) return "'"
  const base = ch.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  if (base === "œ") return "oe"
  if (base === "æ") return "ae"
  return base
}

export function foldWithMap(original: string): Folded {
  let out = ""
  const map: number[] = []
  let i = 0
  for (const ch of original) {
    const folded = foldChar(ch)
    for (let k = 0; k < folded.length; k++) {
      out += folded[k]
      map.push(i)
    }
    i += ch.length
  }
  map.push(original.length)
  return { text: out, map }
}

/** Texte plié sans correspondance de positions, espaces réduits. */
export function foldPlain(text: string): string {
  return foldWithMap(text).text.replace(/\s+/g, " ").trim()
}

const STOP_WORDS = new Set(
  (
    "le la les un une des du de d l et ou en au aux a à son sa ses leur leurs ce cet cette ces mon ma mes votre vos notre nos " +
    "que qui quoi dont où pour par sur sous avec sans dans chez entre vers comme plus moins très tout tous toute toutes " +
    "est sont être avoir fait faire faut peut doit il elle ils elles on nous vous je tu y ne pas non oui si se s " +
    "quel quelle quels quelles comment quand pourquoi combien ainsi aussi donc mais car or ni"
  )
    .split(/\s+/)
    .map((w) => foldPlain(w)),
)

/** Mots significatifs d'un texte : pliés, sans mots vides, pluriel simple retiré. */
export function topicTokens(text: string): string[] {
  const out: string[] = []
  for (const raw of foldPlain(text).split(/[^a-z0-9]+/)) {
    if (raw.length < 3 || STOP_WORDS.has(raw)) continue
    // Pluriel simple : « factures » → « facture » ; « devis », « bus », « repas » gardent leur « s »
    const stem = raw.length > 4 && /[^siua]s$/.test(raw) ? raw.slice(0, -1) : raw
    out.push(stem)
  }
  return out
}

/** Nombre de mots du texte lu (liens, images, titres et marques du Markdown comptés pour ce qu'ils affichent). */
export function wordCount(markdown: string): number {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^[ \t]*(?:#{1,6}|[-*+]|\d+\.|>)[ \t]+/gm, "")
    .replace(/[*_`|]/g, " ")
  return (plain.match(/[A-Za-z0-9À-ÖØ-öø-ÿŒœ]+(?:['’][A-Za-z0-9À-ÖØ-öø-ÿŒœ]+)*/g) ?? []).length
}
