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
 * Règles retenues :
 * - une photo par tranche de 400 mots (au moins une dès 600 mots), au plus le
 *   plafond des Préférences (4 par défaut, 6 au maximum) ;
 * - uniquement dans les sections « H2 » de développement : ni l'introduction
 *   (la couverture est juste au-dessus), ni la FAQ, ni la conclusion, ni les
 *   sources, ni une section qui a déjà une image ;
 * - répartie sur l'article (une section sur deux ou trois), la toute première
 *   section restant libre quand il y a assez de place ;
 * - juste APRÈS le premier paragraphe de la section : le lecteur lit d'abord
 *   le titre et son idée, puis l'image qui l'illustre ; jamais entre le titre
 *   et son texte, jamais au milieu d'une liste ou d'un tableau.
 *
 * Module pur : planification (serveur) et tests. Le texte est du Markdown du
 * blog ; les blocs de code sont ignorés.
 */
import type { PassageContext } from "@/lib/blog-images/passage"
import { PASSAGE_CONTEXT_MAX } from "@/lib/blog-images/passage"
import { foldPlain } from "@/lib/seo/links/text"

/** Une photo par tranche de ce nombre de mots. */
export const WORDS_PER_IMAGE = 400
/** Plafond des Préférences. */
export const MAX_INLINE_IMAGES = 6
/** Longueur minimale d'un paragraphe pour porter une photo (mots). */
const MIN_PARAGRAPH_WORDS = 18
/** Longueur minimale d'un article pour recevoir une photo (mots). */
const MIN_ARTICLE_WORDS = 600

/** Nombre de photos du texte pour un article de `words` mots, sous le plafond `cap` (0 : aucune). */
export function inlineImageCount(words: number, cap: number): number {
  const limit = Math.max(0, Math.min(MAX_INLINE_IMAGES, Math.floor(cap)))
  if (limit === 0 || words < MIN_ARTICLE_WORDS) return 0
  return Math.max(1, Math.min(limit, Math.round(words / WORDS_PER_IMAGE)))
}

/* ------------------------------------------------------------------ */
/* Lecture du Markdown                                                 */
/* ------------------------------------------------------------------ */

type BlockKind = "heading" | "paragraph" | "list" | "table" | "quote" | "image" | "code" | "html"

interface Block {
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
function parseBlocks(markdown: string): Block[] {
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
/* Sections                                                            */
/* ------------------------------------------------------------------ */

interface Section {
  /** Rang du titre parmi les « ## » de l'article. */
  h2Index: number
  heading: string
  blocks: Block[]
}

function sectionsOf(markdown: string): Section[] {
  const sections: Section[] = []
  let current: Section | null = null
  let h2 = 0
  for (const block of parseBlocks(markdown)) {
    if (block.kind === "heading" && block.level === 2) {
      current = { h2Index: h2++, heading: plainBlockText(block.text), blocks: [] }
      sections.push(current)
    } else if (block.kind === "heading" && block.level === 1) {
      current = null
    } else if (current) {
      current.blocks.push(block)
    }
  }
  return sections
}

/** Sections qui ne reçoivent jamais de photo : FAQ, conclusion, sources, à lire aussi. */
const NO_IMAGE_HEADING =
  /\b(faq|foire aux questions|questions? (frequentes?|courantes?)|conclusion|pour conclure|en resume|en bref|a retenir|l.?essentiel|pour aller plus loin|a lire aussi|sources?|ressources?|liens utiles)\b/

/** Premier paragraphe de la section qui peut porter la photo (assez long, avant tout autre contenu non textuel hors liste d'introduction). */
function hostParagraph(section: Section): Block | null {
  for (const block of section.blocks) {
    if (block.kind === "image") return null
    if (block.kind === "paragraph" && words(plainBlockText(block.text)) >= MIN_PARAGRAPH_WORDS) return block
    // Un sous-titre avant tout paragraphe : la section commence par une sous-section, pas de photo ici
    if (block.kind === "heading") return null
  }
  return null
}

function hasImage(section: Section): boolean {
  return section.blocks.some((b) => b.kind === "image")
}

function eligible(section: Section): Block | null {
  if (NO_IMAGE_HEADING.test(foldPlain(section.heading))) return null
  if (hasImage(section)) return null
  return hostParagraph(section)
}

/* ------------------------------------------------------------------ */
/* Plan                                                                */
/* ------------------------------------------------------------------ */

export interface ImageSlot {
  /** Rang du titre « ## » de la section : repère stable tant que les titres ne changent pas. */
  h2Index: number
  heading: string
  /** Passage que la photo illustre : le premier paragraphe de la section. */
  passage: PassageContext
}

/** Sections choisies pour `count` photos, réparties sur l'article. */
export function planImageSlots(markdown: string, count: number): ImageSlot[] {
  if (count <= 0) return []
  const sections = sectionsOf(markdown)
  let candidates = sections.map((section) => ({ section, host: eligible(section) })).filter((c): c is { section: Section; host: Block } => c.host !== null)
  // La couverture est juste au-dessus de la première section : elle reste libre quand il y a assez de place
  if (candidates.length > count) candidates = candidates.slice(1)
  const n = candidates.length
  const k = Math.min(count, n)
  if (k === 0) return []
  const picked: typeof candidates = []
  for (let i = 0; i < k; i++) picked.push(candidates[Math.floor(((i + 0.5) * n) / k)])

  return picked.map(({ section, host }) => {
    const index = section.blocks.indexOf(host)
    const after = section.blocks
      .slice(index + 1)
      .filter((b) => b.kind !== "image" && b.kind !== "code")
      .map((b) => plainBlockText(b.text))
      .join(" ")
    const sectionIndex = sections.indexOf(section)
    const previous = sectionIndex > 0 ? sections[sectionIndex - 1] : null
    const before = previous ? plainBlockText(previous.blocks.filter((b) => b.kind === "paragraph").slice(-1)[0]?.text ?? "") : ""
    return {
      h2Index: section.h2Index,
      heading: section.heading,
      passage: {
        text: plainBlockText(host.text),
        heading: section.heading,
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
 * Insère l'image juste après le premier paragraphe de la section du titre
 * `slot.h2Index` (le titre doit toujours porter le même texte) ; null si la
 * section a disparu, a déjà une image ou n'a plus de paragraphe qui convienne.
 */
export function insertImageAfterParagraph(markdown: string, slot: Pick<ImageSlot, "h2Index" | "heading">, image: string): string | null {
  const section = sectionsOf(markdown).find((s) => s.h2Index === slot.h2Index)
  if (!section || section.heading !== slot.heading) return null
  if (hasImage(section)) return null
  const host = hostParagraph(section)
  if (!host) return null
  return `${markdown.slice(0, host.end)}\n\n${image}${markdown.slice(host.end)}`
}

/** Nombre d'images dans le texte (syntaxe Markdown, hors blocs de code). */
export function countBodyImages(markdown: string): number {
  return parseBlocks(markdown).filter((b) => b.kind === "image").length
}
