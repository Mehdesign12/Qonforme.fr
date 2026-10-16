/**
 * Extensions Tiptap de l'éditeur d'articles, sans React : utilisables dans les
 * tests (happy-dom) comme dans RichEditor.
 *
 * Le schéma se limite à ce que le moteur du blog (lib/markdown.ts) sait
 * afficher — titres 1 à 4, paragraphes, gras, italique, code, liens, listes
 * à un niveau, citations, blocs de code, séparateurs, images du blog en
 * figure, tableaux — pour que l'éditeur montre exactement ce que le blog
 * affichera (le Markdown est écrit par lib/blog-editor/serialize.ts).
 *
 * - Image hors du compartiment du blog (HTML collé…) : grisée et signalée,
 *   car le blog ne l'affichera pas.
 * - Liens : http(s), chemins du site et ancres seulement (même règle que
 *   safeHref) ; jamais ouverts au clic ; liens automatiques seulement pour une
 *   adresse tapée avec « https:// ».
 * - « # » + espace donne un titre 2 (le titre de niveau 1 est celui de la page).
 * - Collage : du texte brut qui ressemble à du Markdown passe par le moteur du
 *   blog ; le HTML collé (Word, Google Docs) ne garde que ce que le schéma
 *   connaît. Titres collés ramenés aux niveaux du blog : le titre 1 est celui
 *   de la page (collé, il devient un titre 2), les niveaux 5 et 6 un titre 4.
 * - Tab dans une liste ne crée pas de sous-liste (le moteur ne les affiche
 *   pas) : la touche garde son rôle habituel (passer au contrôle suivant).
 * - Image, tableau, séparateur : le moteur ne les affiche qu'au premier
 *   niveau. Demandés depuis une liste, une citation ou un tableau, ils
 *   s'insèrent après le bloc qui contient le curseur (blockInsertPosition).
 * - Surlignage des mots-clés : décorations, termes passés par une transaction
 *   méta (setHighlightTerms), sans tenir compte des accents ni de la casse ;
 *   à chaque frappe, seuls les blocs modifiés sont relus (updateHighlights).
 * - Sélection gardée visible quand l'éditeur perd le focus (fenêtre de lien,
 *   assistant).
 */
import { Extension, textblockTypeInputRule, type Editor, type Extensions, type JSONContent } from "@tiptap/core"
import StarterKit from "@tiptap/starter-kit"
import Image from "@tiptap/extension-image"
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table"
import { Placeholder } from "@tiptap/extensions"
import { NodeSelection, Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import { DOMParser as PMDOMParser, type Node as PMNode } from "@tiptap/pm/model"
import { isSafeHref, markdownToHtml } from "@/lib/markdown"
import { isBlogImageUrl } from "@/lib/blog-images/policy"

/**
 * Début d'adresse admis (règle de safeHref, lib/markdown.ts) : http(s),
 * « /chemin » (pas « // » ni « /\ ») ou « #ancre ». Une adresse entière se
 * contrôle avec isSafeHref, qui refuse aussi barre oblique inverse et
 * caractères de contrôle (« /<tab>/hôte » mène à un autre site).
 */
export const SAFE_LINK = /^(https?:\/\/|\/(?![/\\])|#)/i

export const EDITOR_PLACEHOLDER = "Commencez à écrire… Tapez « ## » pour un titre, sélectionnez un passage pour le mettre en forme."

export interface BuildExtensionsOptions {
  /** Ctrl+K / ⌘K : ouvre la fenêtre de lien. */
  onLinkShortcut?: () => void
  placeholder?: string
}

/* ------------------------------------------------------------------ */
/* Image du blog (figure)                                              */
/* ------------------------------------------------------------------ */

function imgOf(el: HTMLElement): HTMLElement | null {
  return el.tagName.toLowerCase() === "img" ? el : (el.querySelector("img") as HTMLElement | null)
}

function dimension(value: string | null | undefined): number | null {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 && n <= 10000 ? Math.round(n) : null
}

/**
 * Image en bloc : lit <figure><img><figcaption> (rendu du blog) et <img>.
 * Attributs : src (sans le fragment des dimensions), alt, title = légende,
 * width, height.
 */
export const BlogImage = Image.extend({
  addOptions() {
    return { ...this.parent!(), inline: false, allowBase64: false }
  },
  addAttributes() {
    return {
      src: { default: null, parseHTML: (el: HTMLElement) => imgOf(el)?.getAttribute("src")?.split("#")[0] ?? null, renderHTML: () => ({}) },
      alt: { default: null, parseHTML: (el: HTMLElement) => imgOf(el)?.getAttribute("alt") ?? null, renderHTML: () => ({}) },
      title: {
        default: null,
        parseHTML: (el: HTMLElement) =>
          el.tagName.toLowerCase() === "figure" ? el.querySelector("figcaption")?.textContent?.replace(/\s+/g, " ").trim() || null : null,
        renderHTML: () => ({}),
      },
      width: { default: null, parseHTML: (el: HTMLElement) => dimension(imgOf(el)?.getAttribute("width")), renderHTML: () => ({}) },
      height: { default: null, parseHTML: (el: HTMLElement) => dimension(imgOf(el)?.getAttribute("height")), renderHTML: () => ({}) },
    }
  },
  parseHTML() {
    return [
      {
        tag: "figure",
        getAttrs: (el: HTMLElement) => {
          const src = imgOf(el)?.getAttribute("src")
          return src && !src.startsWith("data:") ? null : false
        },
      },
      { tag: 'img[src]:not([src^="data:"])' },
    ]
  },
  renderHTML({ node }) {
    const attrs = node.attrs as { src: string | null; alt: string | null; title: string | null; width: number | null; height: number | null }
    const img: [string, Record<string, string>] = [
      "img",
      {
        src: attrs.src ?? "",
        alt: attrs.alt ?? "",
        draggable: "false",
        ...(attrs.width ? { width: String(attrs.width) } : {}),
        ...(attrs.height ? { height: String(attrs.height) } : {}),
      },
    ]
    // Image hors du compartiment du blog : le blog ne l'affichera pas, l'éditeur le montre
    const figure = { "data-image": "", class: "q-editor-figure", ...(attrs.src && !isBlogImageUrl(attrs.src) ? { "data-external": "true" } : {}) }
    return attrs.title ? ["figure", figure, img, ["figcaption", {}, attrs.title]] : ["figure", figure, img]
  },
})

/* ------------------------------------------------------------------ */
/* Surlignage des mots-clés                                            */
/* ------------------------------------------------------------------ */

export const HIGHLIGHT_KEY = new PluginKey<{ terms: string[]; decorations: DecorationSet }>("qHighlight")

/** Forme comparable d'un caractère : sans accent, en minuscules, apostrophes et espaces unifiés. */
function foldChar(ch: string): string {
  if (/\s/.test(ch)) return " "
  if (ch === "’" || ch === "‘" || ch === "ʼ") return "'"
  if (ch === "œ" || ch === "Œ") return "oe"
  if (ch === "æ" || ch === "Æ") return "ae"
  return ch.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

export function foldTerm(term: string): string {
  return Array.from(term)
    .map(foldChar)
    .join("")
    .replace(/\s+/g, " ")
    .trim()
}

const ALNUM = /[a-z0-9]/

/**
 * Plages [début, fin) où les termes apparaissent dans `text`, en mots entiers,
 * sans tenir compte des accents ni de la casse. Les plages se recouvrant sont
 * fusionnées.
 */
export function findTermRanges(text: string, terms: string[]): [number, number][] {
  const wanted = Array.from(new Set(terms.map(foldTerm).filter((t) => t.length >= 2)))
  if (wanted.length === 0 || !text) return []
  // Texte replié et, pour chaque caractère replié, le début et la fin du caractère d'origine (UTF-16)
  let hay = ""
  const starts: number[] = []
  const ends: number[] = []
  let offset = 0
  for (const ch of Array.from(text)) {
    for (const c of foldChar(ch)) {
      hay += c
      starts.push(offset)
      ends.push(offset + ch.length)
    }
    offset += ch.length
  }
  const ranges: [number, number][] = []
  for (const term of wanted) {
    let from = 0
    for (;;) {
      const idx = hay.indexOf(term, from)
      if (idx < 0) break
      const before = idx > 0 ? hay[idx - 1] : " "
      const after = idx + term.length < hay.length ? hay[idx + term.length] : " "
      if (!ALNUM.test(before) && !ALNUM.test(after)) ranges.push([starts[idx], ends[idx + term.length - 1]])
      from = idx + 1
    }
  }
  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const merged: [number, number][] = []
  for (const r of ranges) {
    const last = merged[merged.length - 1]
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1])
    else merged.push([r[0], r[1]])
  }
  return merged
}

/** Surlignages d'un bloc de texte (`pos` : sa position dans le document) ; aucun dans un bloc de code. */
function blockHighlights(node: PMNode, pos: number, terms: string[]): Decoration[] {
  if (node.type.spec.code) return []
  // Texte du bloc et position de chaque caractère dans le document
  let text = ""
  const positions: number[] = []
  node.forEach((child, offset) => {
    if (child.isText && child.text) {
      for (let i = 0; i < child.text.length; i++) positions.push(pos + 1 + offset + i)
      text += child.text
    } else {
      positions.push(pos + 1 + offset)
      text += "\n"
    }
  })
  const decorations: Decoration[] = []
  for (const [start, end] of findTermRanges(text, terms)) {
    const from = positions[start]
    const to = positions[end - 1] + 1
    if (from !== undefined && to > from) decorations.push(Decoration.inline(from, to, { class: "q-hl" }))
  }
  return decorations
}

function highlightDecorations(doc: PMNode, terms: string[]): DecorationSet {
  if (terms.length === 0) return DecorationSet.empty
  const decorations: Decoration[] = []
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true
    decorations.push(...blockHighlights(node, pos, terms))
    return false
  })
  return DecorationSet.create(doc, decorations)
}

/**
 * Surlignages après une modification du document : ceux d'avant suivent le
 * texte (mapping), seuls les blocs touchés par la transaction sont relus. Un
 * article long n'est plus relu en entier à chaque frappe.
 */
export function updateHighlights(set: DecorationSet, tr: Transaction, terms: string[]): DecorationSet {
  if (terms.length === 0) return DecorationSet.empty
  const doc = tr.doc
  let next = set.map(tr.mapping, doc)
  const done = new Set<number>()
  tr.mapping.maps.forEach((map, i) => {
    const after = tr.mapping.slice(i + 1)
    map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
      // Plage modifiée, dans le document final, élargie d'une position (fusion ou coupure de blocs)
      const from = Math.max(0, after.map(newStart, -1) - 1)
      const to = Math.min(doc.content.size, after.map(newEnd, 1) + 1)
      doc.nodesBetween(from, to, (node, pos) => {
        if (!node.isTextblock) return true
        if (!done.has(pos)) {
          done.add(pos)
          next = next.remove(next.find(pos, pos + node.nodeSize)).add(doc, blockHighlights(node, pos, terms))
        }
        return false
      })
    })
  })
  return next
}

/** Remplace les termes surlignés (vide : aucun surlignage). */
export function setHighlightTerms(editor: Editor, terms: string[]): void {
  if (editor.isDestroyed) return
  const clean = Array.from(new Set(terms.map((t) => t.trim()).filter((t) => t.length >= 2)))
  const current = HIGHLIGHT_KEY.getState(editor.state)?.terms ?? []
  if (current.length === clean.length && current.every((t, i) => t === clean[i])) return
  editor.view.dispatch(editor.state.tr.setMeta(HIGHLIGHT_KEY, { terms: clean }).setMeta("addToHistory", false))
}

const KeywordHighlight = Extension.create({
  name: "qKeywordHighlight",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: HIGHLIGHT_KEY,
        state: {
          init: () => ({ terms: [] as string[], decorations: DecorationSet.empty }),
          apply(tr, value, _old, state: EditorState) {
            const meta = tr.getMeta(HIGHLIGHT_KEY) as { terms: string[] } | undefined
            if (meta) return { terms: meta.terms, decorations: highlightDecorations(state.doc, meta.terms) }
            if (tr.docChanged && value.terms.length > 0) return { terms: value.terms, decorations: updateHighlights(value.decorations, tr, value.terms) }
            return value
          },
        },
        props: {
          decorations(state) {
            return HIGHLIGHT_KEY.getState(state)?.decorations ?? DecorationSet.empty
          },
        },
      }),
    ]
  },
})

/* ------------------------------------------------------------------ */
/* Sélection visible hors focus                                        */
/* ------------------------------------------------------------------ */

const GHOST_KEY = new PluginKey<boolean>("qSelectionGhost")

const SelectionGhost = Extension.create({
  name: "qSelectionGhost",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: GHOST_KEY,
        state: {
          init: () => true,
          apply: (tr, focused: boolean) => {
            const meta = tr.getMeta(GHOST_KEY) as boolean | undefined
            return typeof meta === "boolean" ? meta : focused
          },
        },
        props: {
          decorations(state) {
            const focused = GHOST_KEY.getState(state)
            const { from, to, empty } = state.selection
            if (focused || empty || state.selection instanceof NodeSelection) return DecorationSet.empty
            return DecorationSet.create(state.doc, [Decoration.inline(from, to, { class: "q-sel-ghost" })])
          },
          handleDOMEvents: {
            focus: (view) => {
              if (!view.isDestroyed && GHOST_KEY.getState(view.state) === false) view.dispatch(view.state.tr.setMeta(GHOST_KEY, true).setMeta("addToHistory", false))
              return false
            },
            blur: (view) => {
              if (!view.isDestroyed && GHOST_KEY.getState(view.state) !== false) view.dispatch(view.state.tr.setMeta(GHOST_KEY, false).setMeta("addToHistory", false))
              return false
            },
          },
        },
      }),
    ]
  },
})

/* ------------------------------------------------------------------ */
/* Insertion d'un bloc au premier niveau                               */
/* ------------------------------------------------------------------ */

const NESTING = new Set(["listItem", "blockquote", "table", "tableRow", "tableCell", "tableHeader"])

/**
 * Où insérer une image, un tableau ou un séparateur : null à l'endroit du
 * curseur (bloc de premier niveau) ; sinon après le bloc de premier niveau
 * qui contient le curseur (liste, citation, tableau), ou après l'image
 * sélectionnée (qui serait sinon remplacée).
 */
export function blockInsertPosition(state: EditorState): number | null {
  const { selection } = state
  if (selection instanceof NodeSelection) return selection.$to.depth === 0 ? selection.to : selection.$to.after(1)
  const { $from } = selection
  for (let d = $from.depth; d > 0; d--) {
    if (NESTING.has($from.node(d).type.name)) return $from.after(1)
  }
  return null
}

/** Tableau vide (ligne d'en-tête comprise), au format JSON de Tiptap. */
export function emptyTable(rows: number, cols: number): JSONContent {
  const row = (type: "tableHeader" | "tableCell"): JSONContent => ({
    type: "tableRow",
    content: Array.from({ length: cols }, () => ({ type, content: [{ type: "paragraph" }] })),
  })
  return { type: "table", content: [row("tableHeader"), ...Array.from({ length: Math.max(0, rows - 1) }, () => row("tableCell"))] }
}

/**
 * Insère un bloc (image, tableau, séparateur) au bon niveau. Curseur : dans
 * la première cellule d'un tableau ; sinon au début du paragraphe qui suit
 * (créé s'il n'y en a pas).
 */
export function insertBlock(editor: Editor, content: JSONContent): boolean {
  const pos = blockInsertPosition(editor.state)
  const chain = editor.chain().focus()
  if (pos === null) return chain.insertContent(content).scrollIntoView().run()
  return chain
    .insertContentAt(pos, content)
    .command(({ tr }) => {
      if (content.type === "table") {
        tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(pos + 1, tr.doc.content.size)), 1))
        return true
      }
      const after = Math.min(tr.mapping.map(pos), tr.doc.content.size)
      const next = tr.doc.resolve(after).nodeAfter
      if (!next || !next.isTextblock) tr.insert(after, tr.doc.type.schema.nodes.paragraph.create())
      tr.setSelection(TextSelection.create(tr.doc, after + 1))
      return true
    })
    .scrollIntoView()
    .run()
}

/**
 * Tableau du curseur ramené à la forme du Markdown du blog : première ligne
 * en cellules d'en-tête, les autres en cellules simples (le sérialiseur écrit
 * toujours la première ligne en en-tête). À appeler dans la même transaction
 * qu'un ajout ou une suppression de ligne : une seule étape à annuler.
 */
export function normalizeTableHeader(tr: Transaction): Transaction {
  const { $from } = tr.selection
  let depth = -1
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === "table") {
      depth = d
      break
    }
  }
  if (depth < 0) return tr
  const table = $from.node(depth)
  const start = $from.start(depth)
  const { tableHeader, tableCell } = tr.doc.type.schema.nodes
  if (!tableHeader || !tableCell) return tr
  table.forEach((row, rowOffset, rowIndex) => {
    row.forEach((cell, cellOffset) => {
      const wanted = rowIndex === 0 ? tableHeader : tableCell
      if (cell.type !== wanted) tr.setNodeMarkup(start + rowOffset + 1 + cellOffset, wanted, cell.attrs)
    })
  })
  return tr
}

/* ------------------------------------------------------------------ */
/* Comportements : titres, collage, Tab, Ctrl+K                        */
/* ------------------------------------------------------------------ */

/** Texte collé qui ressemble à du Markdown du blog. */
export function looksLikeMarkdown(text: string): boolean {
  return (
    /^(#{1,4} \S|- \S|\d+\. \S|> \S|```|\|.*\|\s*$)/m.test(text) ||
    /\*\*[^*\n]+\*\*/.test(text) ||
    /\[[^\]\n]+\]\((https?:\/\/|\/|#)[^)\s]*\)/.test(text)
  )
}

/** Titres collés aux niveaux du blog : h1 → h2 (le titre 1 est celui de la page), h5 et h6 → h4. */
export function demotePastedHeadings(html: string): string {
  return html.replace(/<(\/?)h([1-6])(?=[\s>])/gi, (_m, slash: string, level: string) => {
    const n = Number(level)
    return `<${slash}h${n === 1 ? 2 : n > 4 ? 4 : n}`
  })
}

/** HTML collé qui porte une vraie structure (et non un simple texte coloré d'éditeur de code). */
function hasSemanticHtml(html: string): boolean {
  return /<(h[1-6]|ul|ol|li|strong|b|em|i|a|table|blockquote|pre)[\s>]/i.test(html)
}

function insideList(state: EditorState): boolean {
  const { $from } = state.selection
  let list = false
  for (let d = $from.depth; d > 0; d--) {
    const name = $from.node(d).type.name
    if (name === "table") return false
    if (name === "listItem") list = true
  }
  return list
}

function behaviour(opts: BuildExtensionsOptions) {
  return Extension.create({
    name: "qEditorBehaviour",
    priority: 1000,
    addInputRules() {
      // « # » + espace : titre 2 (avant la règle des titres, qui ferait un titre 1)
      const heading = this.editor.schema.nodes.heading
      return heading ? [textblockTypeInputRule({ find: /^#\s$/, type: heading, getAttributes: { level: 2 } })] : []
    },
    addKeyboardShortcuts() {
      return {
        "Mod-k": () => {
          if (!opts.onLinkShortcut) return false
          opts.onLinkShortcut()
          return true
        },
      }
    },
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: new PluginKey("qEditorBehaviour"),
          props: {
            handleDOMEvents: {
              // Avant le raccourci des listes : Tab garde son rôle (contrôle suivant), sans sous-liste
              keydown: (view, event) => {
                if (event.key !== "Tab" || event.ctrlKey || event.metaKey || event.altKey) return false
                return insideList(view.state)
              },
            },
            transformPastedHTML(html) {
              // Commentaires conditionnels de Word et métadonnées : jamais utiles
              return demotePastedHeadings(
                html
                  .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, "")
                  .replace(/<!--[\s\S]*?-->/g, "")
                  .replace(/<\/?o:p[^>]*>/gi, ""),
              )
            },
            handlePaste(view, event) {
              const text = event.clipboardData?.getData("text/plain") ?? ""
              const html = event.clipboardData?.getData("text/html") ?? ""
              if (!text || !looksLikeMarkdown(text)) return false
              if (html && hasSemanticHtml(html)) return false
              if (view.state.selection.$from.parent.type.spec.code) return false
              if (typeof DOMParser === "undefined") return false
              // DOMParser : aucun script exécuté, aucune image chargée
              const body = new DOMParser().parseFromString(demotePastedHeadings(markdownToHtml(text.replace(/\r\n?/g, "\n"))), "text/html").body
              const slice = PMDOMParser.fromSchema(view.state.schema).parseSlice(body)
              view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView().setMeta("paste", true).setMeta("uiEvent", "paste"))
              return true
            },
          },
        }),
      ]
    },
  })
}

/* ------------------------------------------------------------------ */
/* Ensemble                                                            */
/* ------------------------------------------------------------------ */

export function buildExtensions(opts: BuildExtensionsOptions = {}): Extensions {
  const placeholder = opts.placeholder ?? EDITOR_PLACEHOLDER
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4] },
      underline: false,
      strike: false,
      link: {
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: "https",
        protocols: ["http", "https"],
        isAllowedUri: (url: string) => isSafeHref(url),
        shouldAutoLink: (url: string) => /^https?:\/\//i.test(url),
        HTMLAttributes: { target: null, rel: "noopener noreferrer", class: null },
      },
      dropcursor: { color: "var(--q-accent)", width: 2 },
    }),
    BlogImage,
    Table.configure({ resizable: false, allowTableNodeSelection: false }),
    TableRow,
    TableHeader,
    TableCell,
    Placeholder.configure({
      showOnlyCurrent: true,
      includeChildren: false,
      placeholder: ({ editor, node }) => {
        if (editor.isEmpty) return placeholder
        if (node.type.name === "heading") return `Titre ${node.attrs.level as number}`
        return ""
      },
    }),
    KeywordHighlight,
    SelectionGhost,
    behaviour(opts),
  ]
}
