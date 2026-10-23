/**
 * Photos dans le texte des articles générés : combien, et où.
 *
 * Ce que disent les recommandations (Google Search Central, « Bonnes pratiques
 * pour les images » ; Yoast, Ahrefs, Backlinko, HubSpot) :
 * - une image toutes les 300 à 500 mots, pour aérer sans noyer le texte ; la
 *   couverture ne compte pas, elle ouvre déjà l'article ;
 * - chaque image prend place à côté du texte qu'elle illustre (Google lit le
 *   texte autour pour comprendre l'image), avec un texte alternatif descriptif
 *   et un nom de fichier lisible ;
 * - jamais de photo décorative sans rapport, ni d'image dans la FAQ ou la
 *   conclusion, que les lecteurs parcourent pour la réponse.
 *
 * Règles retenues (révisées le 20/10/2026 : l'ancienne règle « un paragraphe
 * d'introduction sous chaque titre H2 » écartait presque tous les articles,
 * dont les sections « H2 » commencent par des « H3 », et ne laissait qu'une
 * photo) :
 * - 3 photos dès 1 125 mots, 4 dès 1 575 mots (une par tranche de 450 mots, au
 *   moins 2), au plus le plafond des Préférences (4 par défaut, 6 au maximum) ;
 *   aucune sous 600 mots ;
 * - uniquement dans le développement : ni l'introduction (la couverture est
 *   juste au-dessus), ni la FAQ, ni la conclusion, ni les sources ;
 * - réparties à intervalles réguliers sur ce développement (à 1/5, 2/5, 3/5 et
 *   4/5 du texte pour quatre photos), jamais deux à moins de 250 mots l'une de
 *   l'autre ni de 150 mots d'une image déjà là ;
 * - jamais collées aux extrémités du développement : au moins 150 mots de texte
 *   avant la première photo (la couverture est juste au-dessus) et 120 mots
 *   après la dernière, avant la FAQ ou la conclusion ;
 * - toujours APRÈS un paragraphe de texte, de préférence le premier d'une
 *   sous-partie (titre « H2 » ou « H3 ») : le lecteur lit d'abord le titre et
 *   son idée, puis l'image qui l'illustre ; jamais entre un titre et son texte,
 *   jamais après une phrase qui annonce une liste (« … : »), jamais au milieu
 *   d'une liste ou d'un tableau.
 *
 * Module pur : planification (serveur) et tests. Le texte est du Markdown du
 * blog ; les blocs de code sont ignorés.
 */
import type { PassageContext } from "@/lib/blog-images/passage"
import { PASSAGE_CONTEXT_MAX } from "@/lib/blog-images/passage"
import { foldPlain } from "@/lib/seo/links/text"

/** Une photo par tranche de ce nombre de mots (au moins deux dès 600 mots) : 3 dès 1 125 mots, 4 dès 1 575. */
export const WORDS_PER_IMAGE = 450
/** Plafond des Préférences. */
export const MAX_INLINE_IMAGES = 6
/** Longueur minimale d'un paragraphe pour porter une photo (mots). */
const MIN_PARAGRAPH_WORDS = 18
/** Longueur minimale d'un article pour recevoir une photo (mots). */
const MIN_ARTICLE_WORDS = 600
/** Écart minimal entre deux photos, et avec une image déjà dans le texte (mots). */
const MIN_GAP_WORDS = 250
const MIN_GAP_EXISTING_WORDS = 150
/** Surcoût (mots) d'un paragraphe qui n'est pas le premier d'une sous-partie. */
const NOT_FIRST_PENALTY = 90
/** Texte qui doit rester après une photo, dans le développement (mots) : jamais de photo tout en bas, collée à la FAQ. */
const MIN_TAIL_WORDS = 120
/** Texte qui précède la première photo, dans le développement (mots) : la couverture est déjà juste au-dessus. */
const MIN_HEAD_WORDS = 150

/** Nombre de photos du texte pour un article de `words` mots, sous le plafond `cap` (0 : aucune). */
export function inlineImageCount(words: number, cap: number): number {
  const limit = Math.max(0, Math.min(MAX_INLINE_IMAGES, Math.floor(cap)))
  if (limit === 0 || words < MIN_ARTICLE_WORDS) return 0
  return Math.min(limit, Math.max(2, Math.round(words / WORDS_PER_IMAGE)))
}

/* ------------------------------------------------------------------ */
/* Lecture du Markdown                                                 */
/* ------------------------------------------------------------------ */

export type BlockKind = "heading" | "paragraph" | "list" | "table" | "quote" | "image" | "code" | "html"

export interface Block {
  kind: BlockKind
  /** Niveau d'un titre. */
  level: number
  /** Position du début et de la fin du bloc dans le texte (fin = après le dernier caractère de la dernière ligne). */
  start: number
  end: number
  text: string
}

function kindOf(first: string): BlockKind {
  const line = first.trimStart()
  if (/^#{1,6}\s/.test(line)) return "heading"
  if (/^!\[[^\]]*\]\([^)]*\)\s*$/.test(line)) return "image"
  if (/^([-*+]|\d+[.)])\s/.test(line)) return "list"
  if (line.startsWith("|")) return "table"
  if (line.startsWith(">")) return "quote"
  if (line.startsWith("<")) return "html"
  return "paragraph"
}

/** Blocs du Markdown (séparés par des lignes vides ; un bloc de code reste entier). */
export function parseBlocks(markdown: string): Block[] {
  const blocks: Block[] = []
  const lines = markdown.split("\n")
  let offset = 0
  let current: { start: number; end: number; lines: string[] } | null = null
  let fence = false
  let fenceStart = 0
  let fenceLines: string[] = []

  const flush = () => {
    if (!current) return
    const text = current.lines.join("\n")
    const kind = kindOf(current.lines[0])
    blocks.push({ kind, level: kind === "heading" ? (text.match(/^\s*(#{1,6})/)?.[1].length ?? 2) : 0, start: current.start, end: current.end, text })
    current = null
  }

  for (const line of lines) {
    const lineEnd = offset + line.length
    if (/^\s*(```|~~~)/.test(line)) {
      if (!fence) {
        flush()
        fence = true
        fenceStart = offset
        fenceLines = [line]
      } else {
        fence = false
        fenceLines.push(line)
        blocks.push({ kind: "code", level: 0, start: fenceStart, end: lineEnd, text: fenceLines.join("\n") })
        fenceLines = []
      }
    } else if (fence) {
      fenceLines.push(line)
    } else if (line.trim() === "") {
      flush()
    } else if (current && (/^#{1,6}\s/.test(line.trimStart()) || /^#{1,6}\s/.test(current.lines[0].trimStart()))) {
      // Un titre coupe le bloc en cours, et le texte collé sous un titre n'en fait pas partie (même sans ligne vide)
      flush()
      current = { start: offset, end: lineEnd, lines: [line] }
    } else if (current) {
      current.lines.push(line)
      current.end = lineEnd
    } else {
      current = { start: offset, end: lineEnd, lines: [line] }
    }
    offset = lineEnd + 1
  }
  flush()
  if (fence && fenceLines.length > 0) blocks.push({ kind: "code", level: 0, start: fenceStart, end: markdown.length, text: fenceLines.join("\n") })
  return blocks
}

/** Texte lisible d'un bloc : titres, gras, italique, liens et code réduits à leur texte. */
export function plainBlockText(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/[*_`>]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

const words = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0)

/* ------------------------------------------------------------------ */
/* Plan                                                                */
/* ------------------------------------------------------------------ */

/** Sections qui ne reçoivent jamais de photo : FAQ, conclusion, sources, à lire aussi. */
export const NO_IMAGE_HEADING =
  /\b(faq|foire aux questions|questions? (frequentes?|courantes?)|conclusion|pour conclure|en resume|en bref|a retenir|l.?essentiel|pour aller plus loin|a lire aussi|sources?|ressources?|liens utiles)\b/

export interface ImageSlot {
  /** Rang du titre (« ## » ou « ### ») qui précède le paragraphe, parmi les titres de l'article. */
  headingIndex: number
  /** Rang du paragraphe parmi ceux qui suivent ce titre, avant le titre suivant. */
  paragraphIndex: number
  heading: string
  /** Passage que la photo illustre : le paragraphe qui la précède. */
  passage: PassageContext
}

interface Candidate {
  headingIndex: number
  paragraphIndex: number
  heading: string
  /** Premier paragraphe sous son titre. */
  first: boolean
  /** Mots du texte avant la fin du paragraphe (position de la photo). */
  end: number
  block: Block
  blockIndex: number
}

/** Lecture des blocs : candidats (paragraphes du développement) et position des images déjà là. */
function scan(blocks: Block[]): { candidates: Candidate[]; existing: number[]; total: number } {
  const candidates: Candidate[] = []
  const existing: number[] = []
  let cum = 0
  let headingIndex = -1
  let heading = ""
  let paragraphIndex = 0
  let excluded = false
  let h2Seen = false
  let sinceHeading = 0
  blocks.forEach((block, blockIndex) => {
    if (block.kind === "heading") {
      if (block.level === 1) return
      headingIndex++
      heading = plainBlockText(block.text)
      paragraphIndex = 0
      sinceHeading = 0
      if (block.level === 2) {
        h2Seen = true
        excluded = NO_IMAGE_HEADING.test(foldPlain(heading))
      } else if (NO_IMAGE_HEADING.test(foldPlain(heading))) {
        excluded = true
      }
      return
    }
    if (block.kind === "image") {
      existing.push(cum)
      sinceHeading++
      return
    }
    if (block.kind === "code") return
    const text = plainBlockText(block.text)
    const count = words(text)
    cum += count
    if (block.kind === "paragraph") {
      const index = paragraphIndex++
      // Le développement seulement : après le premier titre « ## », hors FAQ, conclusion et sources
      if (h2Seen && !excluded && headingIndex >= 0 && count >= MIN_PARAGRAPH_WORDS && !/[:：]\s*$/.test(text)) {
        candidates.push({ headingIndex, paragraphIndex: index, heading, first: sinceHeading === 0, end: cum, block, blockIndex })
      }
    }
    sinceHeading++
  })
  return { candidates, existing, total: cum }
}

/**
 * Places de `count` photos : à intervalles réguliers sur le développement,
 * chacune après un paragraphe (de préférence le premier d'une sous-partie),
 * à 250 mots au moins de la précédente. Moins de photos que demandé si le
 * texte n'offre pas assez de places espacées.
 */
export function planImageSlots(markdown: string, count: number): ImageSlot[] {
  const blocks = parseBlocks(markdown)
  const { candidates, existing } = scan(blocks)
  const wanted = Math.max(0, count - existing.length)
  if (wanted === 0 || candidates.length === 0) return []

  const start = candidates[0].end - words(plainBlockText(candidates[0].block.text))
  const finish = candidates[candidates.length - 1].end
  const span = finish - start
  const chosen: Candidate[] = []
  const free = (c: Candidate) =>
    c.end - start >= MIN_HEAD_WORDS &&
    finish - c.end >= MIN_TAIL_WORDS &&
    chosen.every((o) => Math.abs(o.end - c.end) >= MIN_GAP_WORDS) &&
    existing.every((e) => Math.abs(e - c.end) >= MIN_GAP_EXISTING_WORDS)
  for (let i = 0; i < wanted; i++) {
    const target = start + ((i + 1) * span) / (wanted + 1)
    const best = candidates
      .filter((c) => !chosen.includes(c) && free(c))
      .map((c) => ({ c, cost: Math.abs(c.end - target) + (c.first ? 0 : NOT_FIRST_PENALTY) }))
      .sort((a, b) => a.cost - b.cost)[0]
    if (best) chosen.push(best.c)
  }
  chosen.sort((a, b) => a.end - b.end)

  return chosen.map((c) => {
    const after = blocks
      .slice(c.blockIndex + 1)
      .filter((b) => b.kind !== "image" && b.kind !== "code")
      .map((b) => plainBlockText(b.text))
      .join(" ")
    const before = blocks
      .slice(0, c.blockIndex)
      .filter((b) => b.kind === "paragraph")
      .slice(-1)
      .map((b) => plainBlockText(b.text))
      .join(" ")
    return {
      headingIndex: c.headingIndex,
      paragraphIndex: c.paragraphIndex,
      heading: c.heading,
      passage: {
        text: plainBlockText(c.block.text),
        heading: c.heading,
        before: before.slice(-PASSAGE_CONTEXT_MAX),
        after: after.slice(0, PASSAGE_CONTEXT_MAX),
        selected: false,
      },
    }
  })
}

/* ------------------------------------------------------------------ */
/* Insertion                                                           */
/* ------------------------------------------------------------------ */

/** Syntaxe Markdown d'une image : texte alternatif sans crochets ni parenthèses, adresse inchangée. */
export function imageMarkdown(alt: string, url: string): string {
  const clean = alt.replace(/[[\]()<>\n\r]/g, " ").replace(/\s+/g, " ").trim().slice(0, 180)
  return `![${clean}](${url})`
}

/**
 * Insère l'image juste après le paragraphe du créneau (titre de rang
 * `headingIndex`, paragraphe de rang `paragraphIndex`) ; le titre doit toujours
 * porter le même texte. null si le titre ou le paragraphe a disparu, ou si une
 * image suit déjà ce paragraphe. Insérer une image ne change ni les titres ni
 * les paragraphes : les créneaux restent valables après chaque insertion.
 */
export function insertImageAfterParagraph(markdown: string, slot: Pick<ImageSlot, "headingIndex" | "paragraphIndex" | "heading">, image: string): string | null {
  const blocks = parseBlocks(markdown)
  let headingIndex = -1
  let paragraphIndex = 0
  let host: Block | null = null
  let hostIndex = -1
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    if (block.kind === "heading") {
      if (block.level === 1) continue
      headingIndex++
      paragraphIndex = 0
      if (headingIndex === slot.headingIndex && plainBlockText(block.text) !== slot.heading) return null
      continue
    }
    if (headingIndex !== slot.headingIndex || block.kind !== "paragraph") continue
    if (paragraphIndex++ === slot.paragraphIndex) {
      host = block
      hostIndex = i
      break
    }
  }
  if (!host) return null
  if (blocks[hostIndex + 1]?.kind === "image") return null
  return `${markdown.slice(0, host.end)}\n\n${image}${markdown.slice(host.end)}`
}

/** Nombre d'images dans le texte (syntaxe Markdown, hors blocs de code). */
export function countBodyImages(markdown: string): number {
  return parseBlocks(markdown).filter((b) => b.kind === "image").length
}
