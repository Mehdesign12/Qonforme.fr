"use client"

/**
 * Menu flottant de l'éditeur d'articles (BubbleMenu de Tiptap).
 *
 * - Texte sélectionné : Gras, Italique, Lien | « Illustrer » (studio d'images
 *   sur le passage : sujet et style détectés, photo insérée après lui) |
 *   « Assistant » → Reformuler,
 *   Raccourcir, Développer, Simplifier, Corriger l'orthographe, Intégrer le
 *   mot-clé « … » (désactivé sans mot-clé principal). L'assistant reçoit le
 *   passage en Markdown et 500 caractères de contexte avant et après
 *   (POST /api/admin/blog/assist). Pendant l'appel : état de chargement dans
 *   le menu, « Annuler ». Résultat : carte au même endroit avec le texte
 *   proposé, les points à vérifier, « Remplacer », « Insérer après »,
 *   « Annuler » (Échap). Remplacer tient en une seule transaction : Ctrl+Z
 *   rend le passage d'origine.
 * - Curseur sur un lien : adresse, « Modifier », « Ouvrir », « Retirer ».
 * - Image sélectionnée : texte alternatif et légende, « Remplacer »,
 *   « Supprimer ».
 *
 * Clavier : Tab depuis la zone d'écriture atteint le menu (il suit la zone
 * d'écriture dans le document), flèches pour passer d'un bouton à l'autre,
 * Échap pour revenir au texte. Sur écran tactile, le menu se place sous la
 * sélection (au-dessus, il cacherait le menu du système).
 *
 * Placement : le menu ne passe jamais sous la barre d'outils collée ni sous
 * la barre de navigation du bas (téléphone) ; il suit le défilement de la
 * zone admin ([data-admin-scroll]) et se cache quand la sélection sort de
 * l'écran.
 *
 * Passage envoyé à l'assistant : dans un seul bloc (paragraphe, titre,
 * élément de liste, cellule, citation), son seul texte en ligne, sans
 * marque de liste, de citation ni de tableau ; sur plusieurs blocs, leur
 * Markdown.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { BubbleMenu } from "@tiptap/react/menus"
import { useEditorState } from "@tiptap/react"
import { isTextSelection, posToDOMRect, type Editor, type JSONContent } from "@tiptap/core"
import { NodeSelection, PluginKey, TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state"
import type { EditorView } from "@tiptap/pm/view"
import { DOMParser as PMDOMParser } from "@tiptap/pm/model"
import {
  ArrowDownToLine,
  Bold,
  Captions,
  Check,
  ChevronDown,
  ExternalLink,
  Feather,
  ImagePlus,
  Italic,
  Link2,
  Loader2,
  Maximize2,
  Minimize2,
  PencilLine,
  RefreshCw,
  Repeat2,
  Sparkles,
  SpellCheck,
  Target,
  Trash2,
  TriangleAlert,
  Unlink,
  X,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { isSafeHref, markdownToHtml } from "@/lib/markdown"
import { docToMarkdown } from "@/lib/blog-editor/serialize"
import { ASSIST_LABELS } from "@/lib/blog-editor/assist"
import type { AssistAction, AssistResponse, PickedImage } from "@/lib/seo/articles/editor-types"
import { readImageSize } from "@/lib/blog-images/policy"
import type { PassageContext } from "@/lib/blog-images/passage"
import { shortcut, ToolButton, ToolSeparator, TOOL_BUTTON, useIsMac, useRovingFocus } from "@/components/admin/blog/editor/Toolbar"

const MENU_KEY = new PluginKey("qSelectionMenu")

const ACTION_ICONS: Record<AssistAction, LucideIcon> = {
  rephrase: Repeat2,
  shorten: Minimize2,
  expand: Maximize2,
  simplify: Feather,
  fix: SpellCheck,
  keyword: Target,
}

const ACTION_ORDER: AssistAction[] = ["rephrase", "shorten", "expand", "simplify", "fix", "keyword"]

type View =
  | { kind: "format" }
  | { kind: "actions" }
  | { kind: "loading"; action: AssistAction }
  | { kind: "result"; action: AssistAction; text: string; warnings: string[] }
  | { kind: "error"; action: AssistAction; message: string; retryable: boolean }
  | { kind: "image-edit" }

interface Session {
  from: number
  to: number
  controller: AbortController | null
}

const MAX_PASSAGE = 4000

const SURFACE = "rounded-[14px] border border-[var(--q-line)] bg-[var(--q-surface)] shadow-[shadow:var(--q-shadow-pop)]"

function actionLabel(action: AssistAction, keyword: string | null): string {
  if (action === "keyword") return keyword ? `${ASSIST_LABELS.keyword} « ${keyword} »` : ASSIST_LABELS.keyword
  return ASSIST_LABELS[action]
}

/** Contenu du Markdown proposé, lu par le schéma de l'éditeur (même chemin que le blog). */
function parseMarkdown(editor: Editor, markdown: string) {
  const body = new DOMParser().parseFromString(markdownToHtml(markdown), "text/html").body
  return { body, parser: PMDOMParser.fromSchema(editor.schema) }
}

/**
 * Markdown du passage sélectionné. Dans un seul bloc de texte : son contenu
 * en ligne seulement (un passage de cellule ne part pas en tableau, ni un
 * passage de citation avec son « > ») ; sur plusieurs blocs : leur Markdown.
 */
export function passageMarkdown(state: EditorState, from: number, to: number): string {
  const $from = state.doc.resolve(from)
  const $to = state.doc.resolve(to)
  if ($from.parent.isTextblock && $from.sameParent($to)) {
    const inline = $from.parent.slice($from.parentOffset, $to.parentOffset).content.toJSON() as JSONContent[] | null
    return docToMarkdown({ type: "doc", content: [{ type: "paragraph", content: inline ?? [] }] })
  }
  return docToMarkdown({ type: "doc", content: state.doc.slice(from, to).content.toJSON() as JSONContent[] })
}

/** Marges de placement du menu : barre d'outils collée en haut, barre de navigation du bas sur téléphone et tablette. */
function menuInsets(editor: Editor): { top: number; right: number; bottom: number; left: number } {
  let top = 12
  let bottom = 12
  try {
    const bar = editor.view.dom.closest(".q-editor")?.querySelector<HTMLElement>("[data-editor-toolbar]")
    const barBottom = bar ? bar.getBoundingClientRect().bottom : 0
    if (barBottom > 0) top = barBottom + 8
    // Barre de navigation flottante de l'admin (sous 1 024 px) : 68 px + 16 px de marge
    if (!window.matchMedia?.("(min-width: 1024px)").matches) bottom = 96
  } catch {
    // Éditeur détruit ou DOM indisponible : marges par défaut
  }
  return { top, right: 12, bottom, left: 12 }
}

export interface SelectionMenuProps {
  editor: Editor
  keyword: string | null
  articleTitle: string
  /** Ouvre la fenêtre de lien. */
  onLink: () => void
  /** Fenêtre de lien ouverte : le menu se cache. */
  linkOpen: boolean
  onRequestImage: (passage?: PassageContext | null) => Promise<PickedImage | null>
  /** « Illustrer » : ouvre le studio d'images sur le passage sélectionné et insère la photo après lui. */
  onIllustrate: () => void
}

export function SelectionMenu({ editor, keyword, articleTitle, onLink, linkOpen, onRequestImage, onIllustrate }: SelectionMenuProps) {
  const isMac = useIsMac()
  const [view, setViewState] = useState<View>({ kind: "format" })
  const viewRef = useRef<View>(view)
  const session = useRef<Session | null>(null)
  const linkOpenRef = useRef(linkOpen)
  const menuRef = useRef<HTMLDivElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const actionsRef = useRef<HTMLDivElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)
  const roving = useRovingFocus(rowRef)
  const actionsRoving = useRovingFocus(actionsRef, { vertical: true })
  const [elapsed, setElapsed] = useState(0)
  const [touch, setTouch] = useState(false)
  const [alt, setAlt] = useState("")
  const [caption, setCaption] = useState("")
  const [altError, setAltError] = useState<string | null>(null)
  const [replacing, setReplacing] = useState(false)
  /** Image dont on modifie le texte alternatif (position suivie au fil des modifications). */
  const imagePos = useRef<number | null>(null)
  /** Zone qui défile (coque admin) : le menu s'y recale. */
  const [scroller, setScroller] = useState<HTMLElement | null>(null)

  const setView = useCallback((next: View) => {
    viewRef.current = next
    setViewState(next)
  }, [])

  useEffect(() => {
    setTouch(typeof window !== "undefined" && window.matchMedia?.("(hover: none)").matches)
  }, [])

  useEffect(() => {
    if (!editor.isDestroyed) setScroller(editor.view.dom.closest<HTMLElement>("[data-admin-scroll]"))
  }, [editor])

  // Démontage : l'appel en cours est abandonné
  useEffect(
    () => () => {
      session.current?.controller?.abort()
      session.current = null
    },
    [],
  )

  // Proposition (ou erreur) plus haute que la place sous le passage, surtout sur téléphone : la page
  // défile juste assez pour la montrer entière, sans cacher son haut sous la barre d'outils collée
  // ni son bas sous la barre de navigation du bas
  useEffect(() => {
    if (view.kind !== "result" && view.kind !== "error") return
    const frame = requestAnimationFrame(() => {
      const rect = menuRef.current?.getBoundingClientRect()
      if (!rect || !scroller || editor.isDestroyed) return
      const insets = menuInsets(editor)
      const overflow = rect.bottom - (window.innerHeight - insets.bottom)
      const by = Math.min(overflow, rect.top - insets.top)
      if (by <= 0) return
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      scroller.scrollBy({ top: by, behavior: reduce ? "auto" : "smooth" })
    })
    return () => cancelAnimationFrame(frame)
  }, [view.kind, scroller, editor])

  // Le menu n'est pas lui-même un arrêt de tabulation (ses boutons le sont)
  useEffect(() => {
    if (menuRef.current) menuRef.current.tabIndex = -1
  }, [editor])

  const selection = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const sel = e.state.selection
      const image = sel instanceof NodeSelection && sel.node.type.name === "image"
      return {
        image,
        imageAlt: image ? String((sel as NodeSelection).node.attrs.alt ?? "") : "",
        imageCaption: image ? String((sel as NodeSelection).node.attrs.title ?? "") : "",
        link: !image && e.isActive("link"),
        href: e.isActive("link") ? String(e.getAttributes("link").href ?? "") : "",
        empty: sel.empty,
        bold: e.isActive("bold"),
        italic: e.isActive("italic"),
      }
    },
  })

  /* ---------------------------------------------------------------- */
  /* Session de l'assistant                                            */
  /* ---------------------------------------------------------------- */

  const refresh = useCallback(() => {
    if (!editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta(MENU_KEY, "updatePosition").setMeta("addToHistory", false))
  }, [editor])

  const endSession = useCallback(
    (focusEditor: boolean) => {
      session.current?.controller?.abort()
      session.current = null
      setView({ kind: "format" })
      setReplacing(false)
      if (focusEditor && !editor.isDestroyed) editor.commands.focus()
    },
    [editor, setView],
  )

  // Le passage (et l'image en cours de description) suivent les modifications du document
  useEffect(() => {
    const onTransaction = ({ transaction }: { transaction: Transaction }) => {
      if (!transaction.docChanged) return
      if (imagePos.current !== null) {
        const mapped = transaction.mapping.mapResult(imagePos.current, 1)
        imagePos.current = mapped.deleted ? null : mapped.pos
      }
      const s = session.current
      if (!s) return
      const from = transaction.mapping.map(s.from, 1)
      const to = transaction.mapping.map(s.to, -1)
      if (to <= from) endSession(false)
      else session.current = { ...s, from, to }
    }
    editor.on("transaction", onTransaction)
    return () => {
      editor.off("transaction", onTransaction)
    }
  }, [editor, endSession])

  // Échap dans la zone d'écriture ferme la proposition
  useEffect(() => {
    const dom = editor.view.dom
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && (session.current || viewRef.current.kind !== "format")) {
        event.preventDefault()
        endSession(true)
      }
    }
    dom.addEventListener("keydown", onKey)
    return () => dom.removeEventListener("keydown", onKey)
  }, [editor, endSession])

  // Fenêtre de lien ouverte : menu caché
  useEffect(() => {
    linkOpenRef.current = linkOpen
    if (!editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta(MENU_KEY, linkOpen ? "hide" : "updatePosition").setMeta("addToHistory", false))
  }, [linkOpen, editor])

  // Taille du menu changée : nouvelle position (et focus sur la carte du résultat)
  useEffect(() => {
    refresh()
    if (view.kind === "actions") requestAnimationFrame(() => actionsRef.current?.querySelector<HTMLElement>("[data-tb]:not(:disabled)")?.focus())
    if (view.kind === "loading" || view.kind === "result" || view.kind === "error") {
      requestAnimationFrame(() => resultRef.current?.querySelector<HTMLElement>("[data-primary]")?.focus({ preventScroll: true }))
    }
  }, [view, refresh])

  // Chronomètre pendant l'appel
  useEffect(() => {
    if (view.kind !== "loading") return
    setElapsed(0)
    const started = Date.now()
    const timer = window.setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [view.kind])

  const shouldShow = useCallback(
    ({ editor: e, state, view: pmView, element, from, to }: { editor: Editor; state: EditorState; view: EditorView; element: HTMLElement; from: number; to: number }) => {
      if (!e.isEditable) return false
      if (session.current) return true
      // Description d'une image : tant que cette image reste sélectionnée (le champ a le focus, pas l'éditeur)
      if (viewRef.current.kind === "image-edit") {
        const sel = state.selection
        return sel instanceof NodeSelection && sel.node.type.name === "image" && sel.from === imagePos.current
      }
      if (linkOpenRef.current) return false
      const focused = pmView.hasFocus() || element.contains(document.activeElement)
      if (!focused) return false
      const sel = state.selection
      if (sel instanceof NodeSelection) return sel.node.type.name === "image"
      if (!isTextSelection(sel)) return false
      if (sel.$from.parent.type.spec.code) return false
      if (sel.empty) return e.isActive("link")
      return state.doc.textBetween(from, to, " ").trim().length > 0
    },
    [],
  )

  const virtualElement = useCallback(() => {
    const s = session.current
    if (!s || editor.isDestroyed) return null
    const size = editor.state.doc.content.size
    const from = Math.min(s.from, size)
    const to = Math.min(s.to, size)
    const rect = posToDOMRect(editor.view, from, to)
    return { getBoundingClientRect: () => rect, getClientRects: () => [rect] }
  }, [editor])

  const options = useMemo(
    () => ({
      placement: (touch ? "bottom" : "top") as "bottom" | "top",
      offset: 10,
      // Marges recalculées à chaque placement : la barre d'outils n'est collée qu'une fois le texte défilé
      flip: () => ({ padding: menuInsets(editor) }),
      shift: () => ({ padding: menuInsets(editor) }),
      hide: () => ({ padding: menuInsets(editor) }),
      ...(scroller ? { scrollTarget: scroller } : {}),
      onHide: () => {
        // Le menu disparaît (clic en dehors de l'éditeur) : la proposition en cours est abandonnée
        if (session.current || viewRef.current.kind !== "format") {
          session.current?.controller?.abort()
          session.current = null
          viewRef.current = { kind: "format" }
          setViewState({ kind: "format" })
        }
        imagePos.current = null
      },
    }),
    [touch, scroller, editor],
  )

  async function runAssist(action: AssistAction) {
    const { state } = editor
    const { from, to } = state.selection
    if (from === to) return
    const text = passageMarkdown(state, from, to)
    if (!text.trim()) return
    session.current = { from, to, controller: null }
    if (text.length > MAX_PASSAGE) {
      setView({
        kind: "error",
        action,
        retryable: false,
        message: `Passage trop long (${text.length.toLocaleString("fr-FR")} caractères) : sélectionnez-en ${MAX_PASSAGE.toLocaleString("fr-FR")} au plus.`,
      })
      return
    }
    const before = state.doc.textBetween(Math.max(0, from - 2000), from, "\n", " ").slice(-500)
    const after = state.doc.textBetween(to, Math.min(state.doc.content.size, to + 2000), "\n", " ").slice(0, 500)
    const controller = new AbortController()
    session.current = { from, to, controller }
    setView({ kind: "loading", action })
    try {
      const res = await fetch("/api/admin/blog/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Bornes du schéma de la route (assistSchema) : titre de 200 caractères, mot-clé de 120
        body: JSON.stringify({ action, text, keyword: keyword ? keyword.slice(0, 120) : null, title: articleTitle.trim().slice(0, 200) || undefined, before, after }),
        signal: controller.signal,
        cache: "no-store",
      })
      const json = (await res.json().catch(() => null)) as (AssistResponse & { error?: string }) | null
      if (controller.signal.aborted || session.current?.controller !== controller) return
      if (!res.ok || !json || typeof json.text !== "string") {
        const message =
          json?.error ??
          (res.status === 401 ? "Session expirée : reconnectez-vous." : res.status === 503 ? "L'assistant n'est pas disponible pour le moment." : "L'assistant n'a pas pu réécrire le passage. Réessayez dans un instant.")
        // 400 et 422 : la demande elle-même est refusée (sélection, concurrent cité) ; la répéter ne changerait rien
        setView({ kind: "error", action, message, retryable: res.status !== 400 && res.status !== 422 })
        return
      }
      setView({ kind: "result", action, text: json.text, warnings: Array.isArray(json.warnings) ? json.warnings : [] })
    } catch {
      if (controller.signal.aborted || session.current?.controller !== controller) return
      setView({ kind: "error", action, message: "Connexion impossible. Vérifiez votre réseau puis réessayez.", retryable: true })
    }
  }

  function retry(action: AssistAction) {
    const s = session.current
    if (!s) return
    // Reprend le passage d'origine (la sélection a pu bouger)
    editor.commands.setTextSelection({ from: s.from, to: s.to })
    void runAssist(action)
  }

  function replace() {
    const s = session.current
    const v = viewRef.current
    if (!s || v.kind !== "result" || replacing) return
    setReplacing(true)
    const { body, parser } = parseMarkdown(editor, v.text)
    const slice = parser.parseSlice(body)
    const tr = editor.state.tr.replaceRange(s.from, s.to, slice)
    const end = Math.min(tr.mapping.map(s.to), tr.doc.content.size)
    tr.setSelection(TextSelection.near(tr.doc.resolve(end), -1))
    session.current = null
    editor.view.dispatch(tr.scrollIntoView())
    endSession(true)
  }

  function insertAfter() {
    const s = session.current
    const v = viewRef.current
    if (!s || v.kind !== "result") return
    const { body, parser } = parseMarkdown(editor, v.text)
    const content = parser.parse(body).content
    const $to = editor.state.doc.resolve(Math.min(s.to, editor.state.doc.content.size))
    const pos = $to.depth > 0 ? $to.after(1) : $to.pos
    const tr = editor.state.tr.insert(pos, content)
    tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(pos + content.size, tr.doc.content.size)), -1))
    session.current = null
    editor.view.dispatch(tr.scrollIntoView())
    endSession(true)
  }

  /* ---------------------------------------------------------------- */
  /* Image                                                             */
  /* ---------------------------------------------------------------- */

  function openImageEdit() {
    const sel = editor.state.selection
    if (!(sel instanceof NodeSelection) || sel.node.type.name !== "image") return
    imagePos.current = sel.from
    setAlt(selection?.imageAlt ?? "")
    setCaption(selection?.imageCaption ?? "")
    setAltError(null)
    setView({ kind: "image-edit" })
    requestAnimationFrame(() => menuRef.current?.querySelector<HTMLInputElement>("input")?.focus())
  }

  function closeImageEdit() {
    imagePos.current = null
    setView({ kind: "format" })
    editor.commands.focus()
  }

  function saveImage(event?: React.FormEvent) {
    event?.preventDefault()
    const a = alt.replace(/\s+/g, " ").trim()
    if (a.length < 5) {
      setAltError("Décrivez l'image en 5 caractères au moins.")
      return
    }
    const pos = imagePos.current
    if (pos === null || editor.state.doc.nodeAt(pos)?.type.name !== "image") {
      closeImageEdit()
      return
    }
    // Toujours l'image d'origine, même si la sélection a bougé entre-temps
    editor
      .chain()
      .focus()
      .setNodeSelection(pos)
      .updateAttributes("image", { alt: a.slice(0, 180), title: caption.replace(/\s+/g, " ").trim().slice(0, 200) || null })
      .run()
    imagePos.current = null
    setView({ kind: "format" })
  }

  async function replaceImage() {
    const sel = editor.state.selection
    if (!(sel instanceof NodeSelection)) return
    const pos = sel.from
    const picked = await onRequestImage()
    if (!picked || editor.isDestroyed) {
      editor.commands.focus()
      return
    }
    const { src } = readImageSize(picked.url)
    editor
      .chain()
      .focus()
      .setNodeSelection(pos)
      .updateAttributes("image", { src, width: picked.width || null, height: picked.height || null, alt: picked.alt, title: picked.caption?.trim() || null })
      .run()
  }

  /* ---------------------------------------------------------------- */
  /* Rendu                                                             */
  /* ---------------------------------------------------------------- */

  function onMenuKeyDown(event: React.KeyboardEvent) {
    // Le BubbleMenu de Tiptap passe un objet bâti sur l'événement natif (Object.create) : ses
    // accesseurs (key…) lèvent « Illegal invocation », d'où la lecture sur nativeEvent
    if ((event.nativeEvent as KeyboardEvent).key !== "Escape") return
    event.preventDefault()
    event.stopPropagation()
    if (viewRef.current.kind === "image-edit") {
      closeImageEdit()
      return
    }
    if (viewRef.current.kind === "actions") {
      setView({ kind: "format" })
      editor.commands.focus()
      return
    }
    endSession(true)
  }

  const statusText =
    view.kind === "loading"
      ? `${actionLabel(view.action, keyword)} : l'assistant réécrit le passage.`
      : view.kind === "result"
        ? `Proposition prête${view.warnings.length > 0 ? `, ${view.warnings.length} point${view.warnings.length > 1 ? "s" : ""} à vérifier` : ""}.`
        : view.kind === "error"
          ? view.message
          : ""

  const showFormatRow = view.kind === "format" || view.kind === "actions"

  return (
    <BubbleMenu
      ref={menuRef}
      editor={editor}
      pluginKey={MENU_KEY}
      updateDelay={120}
      shouldShow={shouldShow}
      getReferencedVirtualElement={virtualElement}
      options={options}
      className="z-30 outline-none"
      onKeyDown={onMenuKeyDown}
    >
      <span className="sr-only" aria-live="polite">
        {statusText}
      </span>

      {/* Image sélectionnée */}
      {selection?.image && view.kind === "format" && (
        <div ref={rowRef} role="toolbar" aria-label="Image" onKeyDown={roving.onKeyDown} onFocus={roving.onFocus} className={cn(SURFACE, "flex items-center gap-0.5 p-1")}>
          <button type="button" data-tb="" onMouseDown={(e) => e.preventDefault()} onClick={openImageEdit} className={cn(TOOL_BUTTON, "!w-auto gap-1.5 px-2.5 text-[13px] font-semibold")}>
            <Captions aria-hidden />
            Texte alternatif et légende
          </button>
          <ToolButton label="Remplacer l'image" icon={<ImagePlus aria-hidden />} onClick={() => void replaceImage()} haspopup="dialog" />
          <ToolSeparator />
          <ToolButton
            label="Supprimer l'image"
            icon={<Trash2 aria-hidden />}
            onClick={() => editor.chain().focus().deleteSelection().run()}
            className="text-[var(--q-danger)] hover:bg-[var(--q-danger-bg)] hover:text-[var(--q-danger)]"
          />
        </div>
      )}

      {view.kind === "image-edit" && (
        <form onSubmit={saveImage} className={cn(SURFACE, "flex w-[min(360px,calc(100vw-32px))] flex-col gap-3 p-3.5")} aria-label="Texte alternatif et légende de l'image">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="q-editor-image-alt" className="q-label">
              Texte alternatif
            </label>
            <input
              id="q-editor-image-alt"
              className="q-input"
              value={alt}
              maxLength={180}
              aria-invalid={altError ? true : undefined}
              aria-describedby="q-editor-image-alt-aide"
              onChange={(e) => {
                setAlt(e.target.value)
                setAltError(null)
              }}
            />
            <span id="q-editor-image-alt-aide" role={altError ? "alert" : undefined} className={altError ? "q-field-error" : "q-field-hint"}>
              {altError ?? `Décrit l'image pour Google et les lecteurs d'écran · ${alt.trim().length}/180`}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="q-editor-image-caption" className="q-label">
              Légende <span className="font-normal text-[var(--q-text-4)]">(facultatif)</span>
            </label>
            <input id="q-editor-image-caption" className="q-input" value={caption} maxLength={200} onChange={(e) => setCaption(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="q-btn q-btn-ghost q-btn-sm max-md:h-11" onClick={closeImageEdit}>
              Annuler
            </button>
            <button type="submit" className="q-btn q-btn-primary q-btn-sm max-md:h-11">
              <Check aria-hidden />
              Enregistrer
            </button>
          </div>
        </form>
      )}

      {/* Curseur sur un lien */}
      {!selection?.image && selection?.empty && selection.link && view.kind === "format" && (
        <div ref={rowRef} role="toolbar" aria-label="Lien" onKeyDown={roving.onKeyDown} onFocus={roving.onFocus} className={cn(SURFACE, "flex max-w-[min(440px,calc(100vw-32px))] items-center gap-0.5 p-1")}>
          <span className="flex min-w-0 items-center gap-1.5 px-2 text-[12px] text-[var(--q-text-3)]">
            <Link2 className="size-3.5 shrink-0 text-[var(--q-text-4)]" aria-hidden />
            <span className="truncate font-mono" title={selection.href}>
              {selection.href}
            </span>
          </span>
          <ToolSeparator />
          <ToolButton label="Modifier le lien" keys={shortcut(isMac, "K")} icon={<PencilLine aria-hidden />} onClick={onLink} haspopup="dialog" />
          <ToolButton
            label={selection.href.startsWith("#") ? "Ancre dans l'article : rien à ouvrir" : "Ouvrir dans un nouvel onglet"}
            icon={<ExternalLink aria-hidden />}
            disabled={selection.href.startsWith("#") || !isSafeHref(selection.href)}
            onClick={() => {
              // « /\hôte » ou « /<tab>/hôte » mèneraient à un autre site : jamais ouverts
              if (!selection.href.startsWith("#") && isSafeHref(selection.href)) window.open(selection.href, "_blank", "noopener,noreferrer")
            }}
          />
          <ToolButton
            label="Retirer le lien"
            icon={<Unlink aria-hidden />}
            onClick={() => editor.chain().focus().extendMarkRange("link").unsetLink().run()}
            className="text-[var(--q-danger)] hover:bg-[var(--q-danger-bg)] hover:text-[var(--q-danger)]"
          />
        </div>
      )}

      {/* Texte sélectionné */}
      {!selection?.image && !(selection?.empty && selection.link) && showFormatRow && (
        <div className={cn(SURFACE, "flex flex-col overflow-hidden")}>
          <div ref={rowRef} role="toolbar" aria-label="Mise en forme de la sélection" onKeyDown={roving.onKeyDown} onFocus={roving.onFocus} className="flex items-center gap-0.5 p-1">
            <ToolButton label="Gras" keys={shortcut(isMac, "B")} icon={<Bold aria-hidden />} active={!!selection?.bold} onClick={() => editor.chain().focus().toggleBold().run()} />
            <ToolButton label="Italique" keys={shortcut(isMac, "I")} icon={<Italic aria-hidden />} active={!!selection?.italic} onClick={() => editor.chain().focus().toggleItalic().run()} />
            <ToolButton label="Lien" keys={shortcut(isMac, "K")} icon={<Link2 aria-hidden />} active={!!selection?.link} onClick={onLink} haspopup="dialog" />
            <ToolSeparator />
            <button
              type="button"
              data-tb=""
              title="Générer ou importer une photo pour ce passage"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onIllustrate}
              className={cn(TOOL_BUTTON, "!w-auto gap-1.5 px-2.5 text-[13px] font-semibold")}
            >
              <ImagePlus aria-hidden />
              Illustrer
            </button>
            <button
              type="button"
              data-tb=""
              aria-expanded={view.kind === "actions"}
              aria-haspopup="menu"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setView(view.kind === "actions" ? { kind: "format" } : { kind: "actions" })}
              className={cn(TOOL_BUTTON, "!w-auto gap-1.5 px-2.5 text-[13px] font-semibold text-[var(--q-accent-strong)] hover:text-[var(--q-accent-strong)]", view.kind === "actions" && "bg-[var(--q-wash)]")}
            >
              <Sparkles aria-hidden />
              Assistant
              <ChevronDown className={cn("!size-3.5 transition-transform duration-150 motion-reduce:transition-none", view.kind === "actions" && "rotate-180")} aria-hidden />
            </button>
          </div>
          {view.kind === "actions" && (
            <div
              ref={actionsRef}
              role="menu"
              aria-label="Assistant de rédaction"
              onKeyDown={actionsRoving.onKeyDown}
              onFocus={actionsRoving.onFocus}
              className="flex w-[min(300px,calc(100vw-32px))] flex-col border-t border-[var(--q-line-soft)] p-1.5"
            >
              {ACTION_ORDER.map((action) => {
                const Icon = ACTION_ICONS[action]
                const disabled = action === "keyword" && !keyword
                return (
                  <button
                    key={action}
                    type="button"
                    role="menuitem"
                    data-tb=""
                    disabled={disabled}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => void runAssist(action)}
                    className="flex min-h-11 w-full items-center gap-2.5 rounded-[9px] px-2.5 text-left text-[13px] font-medium text-[var(--q-text-2)] outline-none transition-colors duration-100 hover:bg-[var(--q-hover)] hover:text-[var(--q-ink)] focus-visible:bg-[var(--q-hover)] focus-visible:text-[var(--q-ink)] focus-visible:ring-4 focus-visible:ring-[var(--q-focus)] disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none md:min-h-9"
                  >
                    <Icon className="size-4 shrink-0 text-[var(--q-text-4)]" aria-hidden />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{actionLabel(action, keyword)}</span>
                      {disabled && <span className="text-[11px] font-normal text-[var(--q-text-4)]">Choisissez d&apos;abord le mot-clé principal</span>}
                    </span>
                  </button>
                )
              })}
              <p className="mt-1 border-t border-[var(--q-line-soft)] px-2.5 pb-0.5 pt-2 text-[11px] leading-snug text-[var(--q-text-4)]">
                Aucun chiffre, date ni référence légale n&apos;est ajouté : vous relisez avant de remplacer.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Appel en cours */}
      {view.kind === "loading" && (
        <div ref={resultRef} aria-busy="true" className={cn(SURFACE, "flex w-[min(380px,calc(100vw-32px))] flex-col gap-3 p-3.5")}>
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center text-[var(--q-accent-strong)] q-glyph">
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[13px] font-semibold text-[var(--q-ink)]">{actionLabel(view.action, keyword)}…</span>
              <span className="text-[12px] text-[var(--q-text-4)]">
                L&apos;assistant réécrit le passage{elapsed > 0 ? <span className="tabular-nums"> · {elapsed} s</span> : null}
              </span>
            </span>
          </div>
          <div className="flex flex-col gap-2" aria-hidden>
            <span className="h-3 w-full animate-pulse rounded bg-[var(--q-sunken)] motion-reduce:animate-none" />
            <span className="h-3 w-[92%] animate-pulse rounded bg-[var(--q-sunken)] motion-reduce:animate-none" />
            <span className="h-3 w-[64%] animate-pulse rounded bg-[var(--q-sunken)] motion-reduce:animate-none" />
          </div>
          <div className="flex justify-end">
            <button type="button" data-primary="" className="q-btn q-btn-ghost q-btn-sm max-md:h-11" onClick={() => endSession(true)}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Proposition */}
      {view.kind === "result" && (
        <div ref={resultRef} role="dialog" aria-label="Proposition de l'assistant" className={cn(SURFACE, "flex w-[min(460px,calc(100vw-32px))] flex-col")}>
          <div className="flex items-center gap-2 border-b border-[var(--q-line-soft)] px-3.5 py-2.5">
            <Sparkles className="size-4 shrink-0 text-[var(--q-accent-strong)]" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[var(--q-ink)]">{actionLabel(view.action, keyword)}</span>
            <span className="q-tag">Proposition</span>
            <button
              type="button"
              aria-label="Fermer la proposition"
              onClick={() => endSession(true)}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-[var(--q-text-4)] hover:bg-[var(--q-hover)] hover:text-[var(--q-ink)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--q-focus)] md:size-7"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <div
            className="blog-prose q-assist-preview max-h-[min(300px,45dvh)] max-w-none overflow-y-auto overscroll-contain px-4 py-3 !text-[15px] !leading-[1.65]"
            // Markdown renvoyé par l'assistant, nettoyé côté serveur (HTML neutralisé, liens d'origine seulement)
            dangerouslySetInnerHTML={{ __html: markdownToHtml(view.text) }}
          />
          {view.warnings.length > 0 && (
            <div className="mx-3.5 mb-1 flex flex-col gap-1.5 rounded-xl border border-[var(--q-warn-line)] bg-[var(--q-warn-bg)] px-3 py-2.5">
              <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--q-warn)]">
                <TriangleAlert className="size-3.5" aria-hidden />À vérifier avant d&apos;utiliser
              </span>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-[12px] leading-snug text-[var(--q-warn)]">
                {view.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 px-3.5 py-3">
            <button type="button" data-primary="" className="q-btn q-btn-primary q-btn-sm max-md:h-11" onClick={replace} disabled={replacing}>
              <Check aria-hidden />
              Remplacer
            </button>
            <button type="button" className="q-btn q-btn-secondary q-btn-sm max-md:h-11" onClick={insertAfter}>
              <ArrowDownToLine aria-hidden />
              Insérer après
            </button>
            <button type="button" className="q-btn q-btn-ghost q-btn-sm max-md:h-11" onClick={() => retry(view.action)} title="Demander une autre proposition">
              <RefreshCw aria-hidden />
              <span className="max-sm:sr-only">Autre proposition</span>
            </button>
            <button type="button" className="q-btn q-btn-ghost q-btn-sm ml-auto max-md:h-11" onClick={() => endSession(true)}>
              Annuler
              <kbd className="q-kbd hidden md:inline">Échap</kbd>
            </button>
          </div>
        </div>
      )}

      {/* Échec */}
      {view.kind === "error" && (
        <div ref={resultRef} role="alert" className={cn(SURFACE, "flex w-[min(380px,calc(100vw-32px))] flex-col gap-3 p-3.5")}>
          <div className="flex items-start gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center text-[var(--q-danger)] q-glyph">
              <TriangleAlert className="size-4" aria-hidden />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[13px] font-semibold text-[var(--q-ink)]">{actionLabel(view.action, keyword)} : échec</span>
              <span className="text-[13px] leading-snug text-[var(--q-text-3)]">{view.message}</span>
            </span>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" data-primary={view.retryable ? undefined : ""} className="q-btn q-btn-ghost q-btn-sm max-md:h-11" onClick={() => endSession(true)}>
              Fermer
            </button>
            {view.retryable && (
              <button type="button" data-primary="" className="q-btn q-btn-secondary q-btn-sm max-md:h-11" onClick={() => retry(view.action)}>
                <RefreshCw aria-hidden />
                Réessayer
              </button>
            )}
          </div>
        </div>
      )}
    </BubbleMenu>
  )
}
