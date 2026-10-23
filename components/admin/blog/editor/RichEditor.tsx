"use client"

/**
 * Éditeur visuel des articles, façon traitement de texte (Tiptap).
 *
 * Le Markdown reste le format enregistré : l'éditeur charge le HTML produit
 * par le moteur du blog (markdownToHtml) — on voit ce que le blog affichera —
 * et réécrit le Markdown à chaque modification (lib/blog-editor/serialize.ts).
 *
 * - Fidélité au chargement : le Markdown d'origine et le Markdown réécrit
 *   doivent s'afficher pareil (lib/blog-editor/fidelity.ts). Sinon l'article
 *   s'ouvre en mode Markdown, avec une bannière qui dit pourquoi et un bouton
 *   « Passer quand même en mode visuel ».
 * - `onChange` n'est jamais appelé tant que rien n'a été modifié : ouvrir un
 *   article ne change pas son texte enregistré. Une modification annulée
 *   (Ctrl+Z) rend le Markdown d'origine, au caractère près.
 * - Mode Markdown : le texte enregistré dans une zone de texte ; repasser en
 *   visuel relit le Markdown, avec confirmation si une mise en forme serait
 *   perdue.
 * - Une valeur changée par le parent (brouillon restauré…) est rechargée.
 *   Un écho en retard d'une valeur que l'éditeur vient lui-même d'émettre
 *   (parent qui suit avec un rendu de retard) est ignoré : recharger un
 *   texte plus ancien effacerait la dernière frappe.
 *
 * Mise en page : carte du kit, barre d'outils collante (sous la barre
 * supérieure flottante sur ordinateur ; décalage réglable par les variables
 * CSS --q-editor-top et --q-editor-top-lg sur un parent), zone d'écriture à la
 * mesure du blog (68 caractères), barre d'état (mots, minutes de lecture,
 * mode).
 *
 * Chargé côté client seulement (next/dynamic, ssr: false ; squelette :
 * EditorSkeleton). next/dynamic ne transmet pas la `ref` : passer par
 * RichEditorWithRef et sa prop `editorRef`.
 */
import { forwardRef, useCallback, useDeferredValue, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react"
import { EditorContent, useEditor } from "@tiptap/react"
import type { Editor, JSONContent } from "@tiptap/core"
import { DOMParser as PMDOMParser, type Node as PMNode } from "@tiptap/pm/model"
import { NodeSelection } from "@tiptap/pm/state"
import { Code2, Eye, Highlighter, TriangleAlert } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { markdownToHtml } from "@/lib/markdown"
import { wordCount } from "@/lib/seo/articles/check"
import { markdownPlainText } from "@/lib/seo/articles/onpage"
import { docToMarkdown } from "@/lib/blog-editor/serialize"
import { applyPassageEdits, contextAround, fitPassageText, locateInMarkdown, textHasExcerpt, type PassageEdit, type PassageKind } from "@/lib/blog-editor/passages"
import { browserParseHtml, compareRendering } from "@/lib/blog-editor/fidelity"
import { readImageSize } from "@/lib/blog-images/policy"
import type { PickedImage } from "@/lib/seo/articles/editor-types"
import { buildExtensions, HIGHLIGHT_KEY, insertBlock, setHighlightTerms } from "@/components/admin/blog/editor/extensions"
import { illustrationPosition, passageAt } from "@/components/admin/blog/editor/passage"
import type { PassageContext } from "@/lib/blog-images/passage"
import { Toolbar, type EditorMode } from "@/components/admin/blog/editor/Toolbar"
import { SelectionMenu } from "@/components/admin/blog/editor/SelectionMenu"
import { LinkPopover } from "@/components/admin/blog/editor/LinkPopover"

/** Sélection du mode visuel (positions ProseMirror). */
export interface EditorSelection {
  from: number
  to: number
}

/** Passage du texte retrouvé par un extrait (refus du contrôle, intégration d'un mot-clé). */
export interface PassageInfo {
  /** Texte du passage en Markdown en ligne (sans « # » ni tiret de puce). */
  markdown: string
  kind: PassageKind
  /** Texte brut qui précède et qui suit (500 caractères au plus de chaque côté). */
  before: string
  after: string
}

export interface RichEditorHandle {
  /** Focus dans la zone d'écriture ; `selection` : curseur remis à cet endroit (mode visuel). */
  focus(selection?: EditorSelection): void
  /** Index dans la liste rendue par onOutline. */
  scrollToHeading(index: number): void
  getMarkdown(): string
  /** Sélection du mode visuel ; null en mode Markdown ou avant la création de l'éditeur. */
  getSelection(): EditorSelection | null
  /** Le passage qui contient l'extrait ; null s'il n'est plus dans le texte (déjà corrigé). */
  findPassage(excerpt: string): PassageInfo | null
  /** Sélectionne le passage et le montre à l'écran ; faux s'il est introuvable. */
  revealPassage(excerpt: string): boolean
  /**
   * Remplace des passages d'un coup (une seule étape d'annulation en mode visuel) ; `missed` : extraits
   * dont le passage est introuvable, ou dans un tableau ou une citation (non remplaçables).
   */
  replacePassages(edits: PassageEdit[]): { applied: number; missed: string[] }
}

export interface RichEditorProps {
  /** Markdown initial (lu au montage ; les changements suivants passent par onChange). */
  value: string
  onChange: (markdown: string) => void
  onOutline?: (headings: { level: number; text: string }[]) => void
  /** Termes surlignés (mot-clé principal, secondaires) ; insensible aux accents et à la casse. */
  highlightTerms?: string[]
  keyword?: string | null
  articleTitle?: string
  /**
   * Ouvre le studio d'images ; résout l'image à insérer. Le passage (texte
   * sélectionné, paragraphe du curseur) sert à détecter ce que montre l'image.
   */
  onRequestImage: (passage?: PassageContext | null) => Promise<PickedImage | null>
  /** Mode à l'ouverture : « markdown » rouvre la zone de texte Markdown (page de l'article juste créé). */
  initialMode?: EditorMode
  className?: string
}

type Heading = { level: number; text: string }

const HIGHLIGHT_PREF = "q-editor-highlight"

/** Émissions récentes (texte et heure) : un écho du parent plus ancien que 3 s n'est plus tenu pour un retard. */
const ECHO_WINDOW_MS = 3000
const ECHO_KEEP = 40

/* ------------------------------------------------------------------ */
/* Plan de l'article                                                   */
/* ------------------------------------------------------------------ */

function outlineOfDoc(doc: PMNode): { headings: Heading[]; positions: number[] } {
  const headings: Heading[] = []
  const positions: number[] = []
  doc.descendants((node, pos) => {
    if (node.type.name === "heading") {
      const text = node.textContent.replace(/\s+/g, " ").trim()
      if (text) {
        headings.push({ level: Number(node.attrs.level) || 2, text })
        positions.push(pos)
      }
      return false
    }
    return node.isBlock
  })
  return { headings, positions }
}

/** Titres du Markdown (hors blocs de code), avec leur position dans le texte. */
function outlineOfMarkdown(md: string): { headings: Heading[]; offsets: number[] } {
  const headings: Heading[] = []
  const offsets: number[] = []
  let inCode = false
  let offset = 0
  for (const line of md.split("\n")) {
    if (/^```/.test(line)) inCode = !inCode
    else if (!inCode) {
      const m = line.match(/^(#{1,4}) (.+)$/)
      if (m) {
        const text = markdownPlainText(m[2]).replace(/\s+/g, " ").trim()
        if (text) {
          headings.push({ level: m[1].length, text })
          offsets.push(offset)
        }
      }
    }
    offset += line.length + 1
  }
  return { headings, offsets }
}

/** Position verticale (px, dans la zone de texte) d'un caractère : mesure par un double invisible. */
function caretTop(textarea: HTMLTextAreaElement, offset: number): number {
  const style = window.getComputedStyle(textarea)
  const mirror = document.createElement("div")
  for (const prop of ["boxSizing", "width", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "borderTopWidth", "borderLeftWidth", "fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "tabSize"] as const) {
    mirror.style[prop] = style[prop]
  }
  mirror.style.position = "absolute"
  mirror.style.visibility = "hidden"
  mirror.style.whiteSpace = "pre-wrap"
  mirror.style.overflowWrap = "break-word"
  mirror.style.top = "0"
  mirror.style.left = "-9999px"
  mirror.textContent = textarea.value.slice(0, offset)
  const marker = document.createElement("span")
  marker.textContent = "​"
  mirror.appendChild(marker)
  document.body.appendChild(mirror)
  const top = marker.offsetTop
  mirror.remove()
  return top
}

function sameOutline(a: Heading[] | null, b: Heading[]): boolean {
  return !!a && a.length === b.length && a.every((h, i) => h.level === b[i].level && h.text === b[i].text)
}

/** Conteneurs dont le texte ne se réécrit pas (citation, tableau). */
const NOT_REWRITABLE = new Set(["blockquote", "table", "tableRow", "tableCell", "tableHeader"])

interface TextblockHit {
  pos: number
  node: PMNode
  kind: PassageKind
}

/** Premier bloc de texte de l'éditeur qui contient l'extrait. */
function findTextblock(doc: PMNode, excerpt: string): TextblockHit | null {
  let hit: TextblockHit | null = null
  doc.descendants((node, pos) => {
    if (hit) return false
    if (!node.isTextblock) return true
    if (!node.type.spec.code && textHasExcerpt(node.textContent, excerpt)) {
      const $pos = doc.resolve(pos)
      let kind: PassageKind = node.type.name === "heading" ? "heading" : node.type.name === "paragraph" ? "paragraph" : "other"
      for (let d = $pos.depth; d > 0; d--) {
        const name = $pos.node(d).type.name
        if (NOT_REWRITABLE.has(name)) kind = "other"
        else if (name === "listItem" && kind === "paragraph") kind = "list-item"
      }
      hit = { pos, node, kind }
    }
    return false
  })
  return hit
}

/** Contenu en ligne d'un Markdown d'un seul paragraphe, lu par le schéma de l'éditeur (même chemin que le blog) ; null s'il n'y en a pas. */
function inlineContentOf(editor: Editor, markdown: string) {
  const body = new DOMParser().parseFromString(markdownToHtml(markdown), "text/html").body
  const parsed = PMDOMParser.fromSchema(editor.schema).parse(body)
  const first = parsed.firstChild
  return first && first.isTextblock && first.content.size > 0 ? first.content : null
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
}

/* ------------------------------------------------------------------ */
/* Éditeur                                                             */
/* ------------------------------------------------------------------ */

export const RichEditor = forwardRef<RichEditorHandle, RichEditorProps>(function RichEditor(
  { value, onChange, onOutline, highlightTerms, keyword = null, articleTitle = "", onRequestImage, initialMode = "visual", className },
  ref,
) {
  const initialValue = useRef(value)
  const valueRef = useRef(value)
  valueRef.current = value

  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onOutlineRef = useRef(onOutline)
  onOutlineRef.current = onOutline

  /** Markdown chargé et sa réécriture par l'éditeur : une réécriture identique rend le texte d'origine. */
  const baseline = useRef<{ md: string; rt: string }>({ md: value, rt: value })
  // Faux jusqu'à onCreate : la mise en page de l'éditeur (paragraphe final) déclenche une mise à jour avant que
  // le Markdown d'origine et celui que l'éditeur écrirait (baseline) soient connus ; ce n'est pas une modification
  const created = useRef(false)
  /** Dernière valeur rendue au parent (ou reçue de lui). */
  const lastEmitted = useRef(value)
  /** Valeurs émises ces dernières secondes (échos en retard du parent). */
  const recentEmits = useRef<{ md: string; at: number }[]>([])
  /** Markdown courant (getMarkdown). */
  const current = useRef(value)
  const lastOutline = useRef<Heading[] | null>(null)

  const [mode, setModeState] = useState<EditorMode>(initialMode)
  const modeRef = useRef<EditorMode>(initialMode)
  const setMode = useCallback((m: EditorMode) => {
    modeRef.current = m
    setModeState(m)
  }, [])
  const [mdText, setMdText] = useState(value)
  const [statsSource, setStatsSource] = useState(value)
  const [fidelity, setFidelity] = useState<string[] | null>(null)
  const [confirmVisual, setConfirmVisual] = useState<string[] | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [imageBusy, setImageBusy] = useState(false)
  const [highlightOn, setHighlightOn] = useState(true)
  const [highlightCount, setHighlightCount] = useState(0)
  const [stuck, setStuck] = useState(false)

  const rootRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const openLinkRef = useRef<() => void>(() => {})

  /* ---------------------------------------------------------------- */
  /* Émission                                                          */
  /* ---------------------------------------------------------------- */

  const emit = useCallback((markdown: string) => {
    current.current = markdown
    setStatsSource(markdown)
    if (markdown === lastEmitted.current) return
    lastEmitted.current = markdown
    recentEmits.current.push({ md: markdown, at: Date.now() })
    if (recentEmits.current.length > ECHO_KEEP) recentEmits.current.splice(0, recentEmits.current.length - ECHO_KEEP)
    onChangeRef.current(markdown)
  }, [])

  const emitOutline = useCallback((headings: Heading[]) => {
    if (sameOutline(lastOutline.current, headings)) return
    lastOutline.current = headings
    onOutlineRef.current?.(headings)
  }, [])

  const countHighlights = useCallback((e: Editor) => {
    const set = HIGHLIGHT_KEY.getState(e.state)?.decorations
    setHighlightCount(set ? set.find().length : 0)
  }, [])

  /** Document que l'éditeur lirait pour ce Markdown, sans le charger. */
  const roundTripOf = useCallback((e: Editor, markdown: string) => {
    const body = browserParseHtml(markdownToHtml(markdown)).body
    const doc = PMDOMParser.fromSchema(e.schema).parse(body)
    return docToMarkdown(doc.toJSON())
  }, [])

  /**
   * Charge un Markdown dans l'éditeur, sans émettre. Le chargement entre dans
   * l'historique : Ctrl+Z revient au texte d'avant (sans quoi les anciennes
   * étapes seraient rejouées sur un autre document).
   */
  const loadIntoEditor = useCallback(
    (e: Editor, markdown: string, rt: string) => {
      e.commands.setContent(markdownToHtml(markdown), { emitUpdate: false })
      baseline.current = { md: markdown, rt }
      emitOutline(outlineOfDoc(e.state.doc).headings)
      countHighlights(e)
    },
    [emitOutline, countHighlights],
  )

  // Options stables : useEditor ne les réapplique pas à chaque rendu
  const extensions = useMemo(() => buildExtensions({ onLinkShortcut: () => openLinkRef.current() }), [])
  const [initialHtml] = useState(() => markdownToHtml(initialValue.current))
  const editorProps = useMemo(
    () => ({
      attributes: {
        class: "blog-prose q-editor-prose mx-auto min-h-[420px] focus:outline-none",
        "aria-label": "Texte de l'article",
        "aria-multiline": "true",
        spellcheck: "true",
        lang: "fr",
      },
    }),
    [],
  )

  const editor = useEditor({
    extensions,
    content: initialHtml,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editorProps,
    onCreate: ({ editor: e }) => {
      created.current = true
      let md = initialValue.current
      // Valeur changée entre le montage et la création de l'éditeur (hors historique : rien à annuler)
      if (valueRef.current !== md) {
        md = valueRef.current
        e.chain().setMeta("addToHistory", false).setContent(markdownToHtml(md), { emitUpdate: false }).run()
        lastEmitted.current = md
        current.current = md
        setMdText(md)
      }
      const rt = docToMarkdown(e.getJSON())
      baseline.current = { md, rt }
      const check = compareRendering(md, rt, browserParseHtml)
      if (!check.same) {
        setFidelity(check.reasons)
        setMdText(md)
        setMode("markdown")
        emitOutline(outlineOfMarkdown(md).headings)
      } else if (modeRef.current === "markdown") {
        // Ouvert en mode Markdown (initialMode) : le plan suit la zone de texte
        emitOutline(outlineOfMarkdown(md).headings)
      } else {
        emitOutline(outlineOfDoc(e.state.doc).headings)
      }
      countHighlights(e)
    },
    onUpdate: ({ editor: e }) => {
      if (modeRef.current !== "visual" || !created.current) return
      const md = docToMarkdown(e.getJSON())
      emit(md === baseline.current.rt ? baseline.current.md : md)
      emitOutline(outlineOfDoc(e.state.doc).headings)
      countHighlights(e)
    },
  })

  /* ---------------------------------------------------------------- */
  /* Valeur changée par le parent                                      */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    if (value === lastEmitted.current) return
    // Écho en retard d'une valeur émise juste avant la dernière : le parent va rattraper
    const now = Date.now()
    if (recentEmits.current.some((e) => e.md === value && now - e.at < ECHO_WINDOW_MS)) return
    lastEmitted.current = value
    current.current = value
    setMdText(value)
    setStatsSource(value)
    if (!editor || editor.isDestroyed) return
    if (modeRef.current === "markdown") {
      emitOutline(outlineOfMarkdown(value).headings)
      return
    }
    const rt = roundTripOf(editor, value)
    const check = compareRendering(value, rt, browserParseHtml)
    if (check.same) {
      loadIntoEditor(editor, value, rt)
      setFidelity(null)
    } else {
      setFidelity(check.reasons)
      setMode("markdown")
      emitOutline(outlineOfMarkdown(value).headings)
    }
  }, [value, editor, roundTripOf, loadIntoEditor, emitOutline, setMode])

  /* ---------------------------------------------------------------- */
  /* Surlignage                                                        */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    try {
      if (window.localStorage.getItem(HIGHLIGHT_PREF) === "off") setHighlightOn(false)
    } catch {
      // Stockage indisponible : surlignage par défaut
    }
  }, [])

  const terms = useMemo(() => Array.from(new Set((highlightTerms ?? []).map((t) => t.trim()).filter((t) => t.length >= 2))), [highlightTerms])
  const termsKey = terms.join("\u0000")

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    setHighlightTerms(editor, highlightOn ? terms : [])
    countHighlights(editor)
    // termsKey : mêmes termes, même surlignage
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, termsKey, highlightOn, countHighlights])

  const toggleHighlight = useCallback(() => {
    setHighlightOn((on) => {
      try {
        window.localStorage.setItem(HIGHLIGHT_PREF, on ? "off" : "on")
      } catch {
        // Préférence non gardée : sans conséquence
      }
      return !on
    })
  }, [])

  /* ---------------------------------------------------------------- */
  /* Modes                                                             */
  /* ---------------------------------------------------------------- */

  const enterVisual = useCallback(
    (markdown: string, rt?: string) => {
      if (!editor || editor.isDestroyed) return
      loadIntoEditor(editor, markdown, rt ?? roundTripOf(editor, markdown))
      setFidelity(null)
      setConfirmVisual(null)
      setMode("visual")
    },
    [editor, loadIntoEditor, roundTripOf, setMode],
  )

  const changeMode = useCallback(
    (next: EditorMode) => {
      if (next === modeRef.current || !editor) return
      if (next === "markdown") {
        setLinkOpen(false)
        setMdText(current.current)
        setMode("markdown")
        emitOutline(outlineOfMarkdown(current.current).headings)
        requestAnimationFrame(() => textareaRef.current?.focus({ preventScroll: true }))
        return
      }
      const text = current.current
      const rt = roundTripOf(editor, text)
      const check = compareRendering(text, rt, browserParseHtml)
      if (!check.same) {
        setConfirmVisual(check.reasons)
        return
      }
      enterVisual(text, rt)
    },
    [editor, roundTripOf, enterVisual, emitOutline, setMode],
  )

  const onMarkdownChange = useCallback(
    (text: string) => {
      setMdText(text)
      emit(text)
      emitOutline(outlineOfMarkdown(text).headings)
    },
    [emit, emitOutline],
  )

  /* ---------------------------------------------------------------- */
  /* Lien, image                                                       */
  /* ---------------------------------------------------------------- */

  const openLink = useCallback(() => {
    if (modeRef.current !== "visual") return
    setLinkOpen((open) => !open)
  }, [])
  openLinkRef.current = () => {
    // Ni dans un bloc de code, ni sur une image sélectionnée (un lien ne s'y pose pas)
    if (modeRef.current === "visual" && editor && !editor.isActive("codeBlock") && !(editor.state.selection instanceof NodeSelection)) setLinkOpen(true)
  }

  const closeLink = useCallback(
    (opts?: { refocus?: boolean }) => {
      setLinkOpen(false)
      if (opts?.refocus && editor && !editor.isDestroyed) editor.commands.focus()
    },
    [editor],
  )

  const insertImage = useCallback(async () => {
    if (!editor || imageBusy) return
    setImageBusy(true)
    let picked: PickedImage | null = null
    try {
      picked = await onRequestImage(passageAt(editor.state))
    } catch {
      toast.error("Le studio d'images n'a pas pu s'ouvrir. Réessayez.")
    } finally {
      setImageBusy(false)
    }
    if (editor.isDestroyed) return
    if (!picked) {
      editor.commands.focus()
      return
    }
    const { src } = readImageSize(picked.url)
    // Au premier niveau, après le bloc du passage (liste, citation, tableau, titre et son premier paragraphe) :
    // le blog n'affiche les images qu'ainsi, et un texte sélectionné n'est jamais remplacé par la photo
    insertBlock(
      editor,
      {
        type: "image",
        attrs: { src, alt: picked.alt, title: picked.caption?.trim() || null, width: picked.width || null, height: picked.height || null },
      },
      { at: illustrationPosition(editor.state) },
    )
  }, [editor, imageBusy, onRequestImage])

  /* ---------------------------------------------------------------- */
  /* Poignée                                                           */
  /* ---------------------------------------------------------------- */

  useImperativeHandle(
    ref,
    () => ({
      focus(selection?: EditorSelection) {
        if (modeRef.current === "markdown") {
          textareaRef.current?.focus()
          return
        }
        if (!editor || editor.isDestroyed) return
        if (selection) {
          // Deux commandes : focus() dans la même chaîne reprendrait la sélection d'avant
          const size = editor.state.doc.content.size
          editor.commands.setTextSelection({ from: Math.min(Math.max(selection.from, 0), size), to: Math.min(Math.max(selection.to, 0), size) })
          editor.commands.focus(null, { scrollIntoView: false })
          return
        }
        editor.commands.focus()
      },
      getMarkdown() {
        return current.current
      },
      getSelection() {
        if (modeRef.current !== "visual" || !editor || editor.isDestroyed) return null
        const { from, to } = editor.state.selection
        return { from, to }
      },
      findPassage(excerpt: string) {
        if (modeRef.current === "markdown") {
          const text = textareaRef.current?.value ?? current.current
          const unit = locateInMarkdown(text, excerpt)
          return unit ? { markdown: unit.text, kind: unit.kind, ...contextAround(text, unit) } : null
        }
        if (!editor || editor.isDestroyed) return null
        const hit = findTextblock(editor.state.doc, excerpt)
        if (!hit) return null
        const { doc } = editor.state
        const markdown = docToMarkdown({ type: "doc", content: [{ type: "paragraph", content: (hit.node.content.toJSON() as JSONContent[] | null) ?? [] }] }).trim()
        const squash = (t: string) => t.replace(/\s+/g, " ").trim()
        const from = hit.pos
        const to = hit.pos + hit.node.nodeSize
        return {
          markdown,
          kind: hit.kind,
          before: squash(doc.textBetween(Math.max(0, from - 700), from, "\n", " ")).slice(-500),
          after: squash(doc.textBetween(to, Math.min(doc.content.size, to + 700), "\n", " ")).slice(0, 500),
        }
      },
      revealPassage(excerpt: string) {
        const behavior: ScrollBehavior = prefersReducedMotion() ? "auto" : "smooth"
        if (modeRef.current === "markdown") {
          const textarea = textareaRef.current
          if (!textarea) return false
          const unit = locateInMarkdown(textarea.value, excerpt)
          if (!unit) return false
          textarea.focus({ preventScroll: true })
          textarea.setSelectionRange(unit.start, unit.end)
          const top = caretTop(textarea, unit.start)
          const scroller = textarea.closest<HTMLElement>("[data-admin-scroll]")
          const toolbarBottom = toolbarRef.current?.getBoundingClientRect().bottom ?? 0
          const target = textarea.getBoundingClientRect().top + top - Math.max(toolbarBottom, 0) - 120
          if (scroller) scroller.scrollBy({ top: target, behavior })
          else window.scrollBy({ top: target, behavior })
          return true
        }
        if (!editor || editor.isDestroyed) return false
        const hit = findTextblock(editor.state.doc, excerpt)
        if (!hit) return false
        editor.chain().setTextSelection({ from: hit.pos + 1, to: hit.pos + hit.node.nodeSize - 1 }).run()
        editor.view.focus()
        const dom = editor.view.nodeDOM(hit.pos)
        if (dom instanceof HTMLElement) dom.scrollIntoView({ block: "center", behavior })
        return true
      },
      replacePassages(edits: PassageEdit[]) {
        if (modeRef.current === "markdown") {
          const result = applyPassageEdits(textareaRef.current?.value ?? current.current, edits)
          if (result.applied > 0) onMarkdownChange(result.markdown)
          return { applied: result.applied, missed: result.missed }
        }
        if (!editor || editor.isDestroyed) return { applied: 0, missed: edits.map((e) => e.excerpt) }
        const missed: string[] = []
        const hits: { hit: TextblockHit; fragment: ReturnType<typeof inlineContentOf> }[] = []
        for (const edit of edits) {
          const hit = findTextblock(editor.state.doc, edit.excerpt)
          const text = hit ? fitPassageText(hit.kind, edit.text) : ""
          const fragment = hit && hit.kind !== "other" && text ? inlineContentOf(editor, text) : null
          if (!hit || !fragment || hits.some((h) => h.hit.pos === hit.pos)) missed.push(edit.excerpt)
          else hits.push({ hit, fragment })
        }
        if (hits.length === 0) return { applied: 0, missed }
        // De la fin vers le début : les positions des passages précédents ne bougent pas, et une seule étape d'annulation
        const tr = editor.state.tr
        for (const { hit, fragment } of hits.sort((a, b) => b.hit.pos - a.hit.pos)) {
          if (fragment) tr.replaceWith(hit.pos + 1, hit.pos + hit.node.nodeSize - 1, fragment)
        }
        editor.view.dispatch(tr.scrollIntoView())
        return { applied: hits.length, missed }
      },
      scrollToHeading(index: number) {
        const behavior: ScrollBehavior = prefersReducedMotion() ? "auto" : "smooth"
        if (modeRef.current === "markdown") {
          const textarea = textareaRef.current
          const { offsets } = outlineOfMarkdown(textarea?.value ?? current.current)
          const offset = offsets[index]
          if (!textarea || offset === undefined) return
          textarea.focus({ preventScroll: true })
          textarea.setSelectionRange(offset, offset)
          const top = caretTop(textarea, offset)
          const scroller = textarea.closest<HTMLElement>("[data-admin-scroll]")
          const toolbarBottom = toolbarRef.current?.getBoundingClientRect().bottom ?? 0
          const target = textarea.getBoundingClientRect().top + top - Math.max(toolbarBottom, 0) - 24
          if (scroller) scroller.scrollBy({ top: target, behavior })
          else window.scrollBy({ top: target, behavior })
          return
        }
        if (!editor || editor.isDestroyed) return
        const { positions } = outlineOfDoc(editor.state.doc)
        const pos = positions[index]
        if (pos === undefined) return
        editor.chain().setTextSelection(pos + 1).run()
        editor.view.focus()
        const dom = editor.view.nodeDOM(pos)
        if (dom instanceof HTMLElement) dom.scrollIntoView({ block: "start", behavior })
      },
    }),
    [editor, onMarkdownChange],
  )

  /* ---------------------------------------------------------------- */
  /* Barre d'outils collée : ombre                                     */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const bar = toolbarRef.current
    const root = rootRef.current
    if (!bar || !root) return
    const scroller = root.closest<HTMLElement>("[data-admin-scroll]") ?? window
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const top = parseFloat(window.getComputedStyle(bar).top) || 0
        const barRect = bar.getBoundingClientRect()
        const rootRect = root.getBoundingClientRect()
        setStuck(rootRect.top < barRect.top - 1 && barRect.top <= top + 1 + (scroller === window ? 0 : (scroller as HTMLElement).getBoundingClientRect().top))
      })
    }
    update()
    scroller.addEventListener("scroll", update, { passive: true })
    window.addEventListener("resize", update)
    return () => {
      cancelAnimationFrame(frame)
      scroller.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
    }
  }, [])

  /* ---------------------------------------------------------------- */
  /* Zone Markdown : hauteur au contenu                                */
  /* ---------------------------------------------------------------- */

  // Avant l'affichage, et sans faire bouger la page : « height: auto » raccourcit un instant la
  // zone (et la page qui défile), le navigateur ramènerait le défilement dans la nouvelle limite.
  // Le défilement de la zone qui défile (coque de l'admin, ou la fenêtre) est rendu tel quel.
  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea || mode !== "markdown") return
    const scroller = textarea.closest<HTMLElement>("[data-admin-scroll]")
    const top = scroller ? scroller.scrollTop : window.scrollY
    textarea.style.height = "auto"
    textarea.style.height = `${Math.max(480, textarea.scrollHeight)}px`
    if (scroller && scroller.scrollTop !== top) scroller.scrollTop = top
    else if (!scroller && window.scrollY !== top) window.scrollTo(window.scrollX, top)
  }, [mdText, mode])

  /* ---------------------------------------------------------------- */
  /* Rendu                                                             */
  /* ---------------------------------------------------------------- */

  const deferredStats = useDeferredValue(statsSource)
  const words = useMemo(() => wordCount(deferredStats), [deferredStats])
  const minutes = Math.max(1, Math.round(words / 220))
  const visual = mode === "visual"

  return (
    <div ref={rootRef} data-mode={mode} className={cn("q-card q-editor relative flex min-w-0 flex-col", className)}>
      <div
        ref={toolbarRef}
        data-editor-toolbar=""
        data-stuck={stuck ? "true" : undefined}
        // Collée : flottante (rayon, anneau d'un pixel et ombre), sans bordure ajoutée qui décalerait le texte d'un pixel
        className="sticky top-[var(--q-editor-top,8px)] z-20 rounded-t-[15px] border-b border-[var(--q-line-soft)] bg-[var(--q-surface)] transition-[box-shadow,border-radius] duration-150 data-[stuck=true]:rounded-xl data-[stuck=true]:border-transparent data-[stuck=true]:shadow-[shadow:0_0_0_1px_var(--q-line),var(--q-shadow-pop)] motion-reduce:transition-none lg:top-[var(--q-editor-top-lg,80px)]"
      >
        <Toolbar
          editor={editor}
          mode={mode}
          onModeChange={changeMode}
          onLink={openLink}
          onImage={() => void insertImage()}
          imageBusy={imageBusy}
          highlight={{ available: terms.length > 0, on: highlightOn, terms: terms.length, onToggle: toggleHighlight }}
        />
      </div>

      {fidelity && (
        <div role="status" className="q-banner q-banner-warn mx-4 mt-4 flex-wrap gap-x-3 gap-y-3 sm:mx-5 md:flex-nowrap md:items-center">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 md:mt-0" aria-hidden />
          <p className="min-w-0 flex-1 basis-[calc(100%-44px)] text-[14px] leading-snug md:basis-auto">
            Cet article contient une mise en forme que l&apos;éditeur visuel ne reproduit pas à l&apos;identique : {fidelity.join(", ")}. Il s&apos;ouvre en mode Markdown pour ne rien perdre.
          </p>
          <button type="button" className="q-btn q-btn-secondary q-btn-sm shrink-0 max-md:h-11 max-md:w-full" onClick={() => enterVisual(current.current)}>
            <Eye aria-hidden />
            Passer quand même en mode visuel
          </button>
        </div>
      )}

      <div ref={contentRef} className={cn("relative", !visual && "hidden")}>
        {/* Hauteur réservée (420 px de texte + marges) : rien ne saute pendant la création de l'éditeur */}
        <EditorContent editor={editor} className="relative min-h-[492px] px-5 pb-10 pt-8 sm:px-10" />
        {editor && (
          <SelectionMenu
            editor={editor}
            keyword={keyword?.trim() || null}
            articleTitle={articleTitle}
            onLink={openLink}
            linkOpen={linkOpen}
            onRequestImage={onRequestImage}
            onIllustrate={() => void insertImage()}
          />
        )}
        {editor && <LinkPopover editor={editor} open={linkOpen && visual} onClose={closeLink} container={contentRef.current} />}
      </div>

      {!visual && (
        <div className="px-5 pb-10 pt-6 sm:px-10">
          <label htmlFor="q-editor-markdown" className="sr-only">
            Texte de l&apos;article en Markdown
          </label>
          <textarea
            id="q-editor-markdown"
            ref={textareaRef}
            value={mdText}
            onChange={(e) => onMarkdownChange(e.target.value)}
            spellCheck
            lang="fr"
            className="mx-auto block min-h-[480px] w-full max-w-[80ch] resize-none overflow-hidden bg-transparent font-mono text-base leading-7 text-[var(--q-ink)] outline-none placeholder:text-[var(--q-placeholder)] md:text-[14px]"
            placeholder={"## Un titre de section\n\nUn paragraphe, avec du **gras** et un [lien](/guide/tva-travaux)."}
          />
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-b-[15px] border-t border-[var(--q-line-soft)] bg-[var(--q-surface-2)] px-5 py-2.5 text-[12px] text-[var(--q-text-4)]">
        <span className="tabular-nums" aria-live="off">
          {words.toLocaleString("fr-FR")} mot{words > 1 ? "s" : ""} · {minutes} min de lecture
        </span>
        <span className="flex items-center gap-3">
          {visual && highlightOn && terms.length > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Highlighter className="size-3.5 text-[var(--q-warn)]" aria-hidden />
              <span className="tabular-nums">
                {highlightCount === 0 ? "Mots-clés absents du texte" : `${highlightCount} passage${highlightCount > 1 ? "s" : ""} surligné${highlightCount > 1 ? "s" : ""}`}
              </span>
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 font-medium text-[var(--q-text-3)]">
            {visual ? <Eye className="size-3.5" aria-hidden /> : <Code2 className="size-3.5" aria-hidden />}
            {visual ? "Mode visuel" : "Mode Markdown"}
          </span>
        </span>
      </div>

      {/* Même style que les autres confirmations de l'éditeur (BlogEditor) */}
      <Dialog open={confirmVisual !== null} onOpenChange={(open) => !open && setConfirmVisual(null)}>
        <DialogContent showCloseButton={false} className="gap-3 pb-[max(20px,env(safe-area-inset-bottom))] sm:max-w-md">
          <DialogTitle className="q-display text-[22px] font-semibold leading-tight">Passer en mode visuel ?</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed !text-[var(--q-text-3)]">
            L&apos;éditeur visuel ne reproduit pas à l&apos;identique une partie de la mise en forme. Le texte enregistré ne change que si vous le modifiez ensuite.
          </DialogDescription>
          <ul className="flex flex-col gap-1.5 rounded-xl border border-[var(--q-warn-line)] bg-[var(--q-warn-bg)] px-4 py-3 text-[13px] leading-snug text-[var(--q-warn)]">
            {(confirmVisual ?? []).map((reason) => (
              <li key={reason} className="flex items-start gap-2">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span>{reason.charAt(0).toUpperCase() + reason.slice(1)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className="q-btn q-btn-ghost max-md:h-12" onClick={() => setConfirmVisual(null)}>
              Rester en Markdown
            </button>
            <button type="button" className="q-btn q-btn-primary max-md:h-12" onClick={() => enterVisual(current.current)}>
              <Eye aria-hidden />
              Passer en mode visuel
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
})

RichEditor.displayName = "RichEditor"

/**
 * Même éditeur, la poignée passée en prop : next/dynamic ne transmet pas la
 * `ref` (composant chargé = composant fonction).
 * `dynamic(() => import("…/RichEditor").then((m) => m.RichEditorWithRef), { ssr: false, loading: () => <EditorSkeleton /> })`
 */
export function RichEditorWithRef({ editorRef, ...props }: RichEditorProps & { editorRef?: React.Ref<RichEditorHandle> }) {
  return <RichEditor ref={editorRef} {...props} />
}
