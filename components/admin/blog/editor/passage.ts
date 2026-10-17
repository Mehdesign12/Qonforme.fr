/**
 * Passage de l'éditeur visuel que l'on illustre, et endroit où la photo
 * s'insère (studio d'images : « Ce que montre l'image » est détecté d'après ce
 * passage, lib/blog-images/passage.ts).
 *
 * - Texte sélectionné : le passage est la sélection ; la photo s'insère
 *   APRÈS le bloc qui la termine (jamais à la place du texte sélectionné).
 * - Curseur sans sélection : le paragraphe (ou le titre) du curseur, et la
 *   photo s'insère après lui ; un paragraphe vide prend le titre de section
 *   au-dessus, et la photo prend sa place.
 * - Titre : la photo s'insère après le premier paragraphe qui le suit, pas
 *   entre le titre et son texte (même règle que les photos des articles
 *   générés, lib/seo/articles/images.ts).
 * - Liste, citation, tableau : après le bloc, comme avant (le blog n'affiche
 *   les images qu'au premier niveau).
 *
 * Fonctions pures sur l'état ProseMirror : testées sans navigateur.
 */
import { NodeSelection, type EditorState } from "@tiptap/pm/state"
import { PASSAGE_CONTEXT_MAX, PASSAGE_TEXT_MAX, type PassageContext } from "@/lib/blog-images/passage"
import { blockInsertPosition } from "@/components/admin/blog/editor/extensions"

const NESTING = new Set(["listItem", "blockquote", "table", "tableRow", "tableCell", "tableHeader"])

const squash = (text: string) => text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim()

/** Texte d'un bloc de premier niveau, sans image ni séparateur. */
function blockText(state: EditorState, index: number): string {
  if (index < 0 || index >= state.doc.childCount) return ""
  const node = state.doc.child(index)
  if (node.type.name === "image" || node.type.name === "horizontalRule") return ""
  return squash(node.textContent)
}

/**
 * Passage à illustrer d'après la sélection ; null si l'article est vide
 * (le studio retombe alors sur le titre et le mot-clé).
 */
export function passageAt(state: EditorState): PassageContext | null {
  const { selection, doc } = state
  if (selection instanceof NodeSelection) return null
  const { $from, $to } = selection
  if (doc.childCount === 0 || $from.depth === 0) return null

  const selected = !selection.empty
  const fromIndex = $from.index(0)

  let text = selected ? squash(doc.textBetween(selection.from, selection.to, "\n\n", "\n")) : blockText(state, fromIndex)

  // Titre de section : le plus proche au-dessus du passage (ou le passage lui-même)
  let heading: string | null = null
  for (let i = fromIndex; i >= 0; i--) {
    if (doc.child(i).type.name === "heading") {
      heading = blockText(state, i) || null
      break
    }
  }

  // Curseur dans un paragraphe vide (ou sur une image) : la section en cours
  if (!text) text = heading ?? ""
  if (!text) {
    for (let i = fromIndex + 1; i < doc.childCount && !text; i++) text = blockText(state, i)
  }
  if (!text) return null

  const from = selected ? selection.from : $from.start(1)
  const to = selected ? selection.to : $to.end(1)
  const before = squash(doc.textBetween(Math.max(0, from - PASSAGE_CONTEXT_MAX), from, "\n", " "))
  const after = squash(doc.textBetween(to, Math.min(doc.content.size, to + PASSAGE_CONTEXT_MAX), "\n", " "))

  return {
    text: text.slice(0, PASSAGE_TEXT_MAX),
    heading,
    before,
    after,
    selected,
  }
}

/**
 * Position où insérer la photo : null = à l'endroit du curseur (paragraphe
 * vide, que la photo remplace) ; sinon une position de premier niveau, après
 * le bloc du passage (et après le premier paragraphe qui suit un titre).
 */
export function illustrationPosition(state: EditorState): number | null {
  const { selection, doc } = state
  // Image sélectionnée ou bloc imbriqué : règle commune des blocs
  if (selection instanceof NodeSelection) return blockInsertPosition(state)
  const { $to } = selection
  for (let d = $to.depth; d > 0; d--) {
    if (NESTING.has($to.node(d).type.name)) return blockInsertPosition(state)
  }
  if ($to.depth === 0) return null
  const block = $to.node(1)
  if (selection.empty && block.isTextblock && block.content.size === 0) return null
  let pos = $to.after(1)
  if (block.type.name === "heading") {
    const index = $to.index(0)
    const next = index + 1 < doc.childCount ? doc.child(index + 1) : null
    if (next && next.type.name === "paragraph" && next.textContent.trim()) pos += next.nodeSize
  }
  return pos
}
