"use client"

/**
 * Barre d'outils de l'éditeur d'articles, au style d'un traitement de texte :
 * Annuler/Rétablir · style du paragraphe (aperçu du style dans le menu) ·
 * Gras, Italique, Code · listes et citation · Lien, Image, Tableau,
 * Séparateur · surlignage des mots-clés · Visuel / Markdown. Quand le curseur
 * est dans un tableau, une seconde rangée propose d'ajouter ou de supprimer
 * lignes et colonnes.
 *
 * Accessibilité : motif « toolbar » ARIA (un seul arrêt de tabulation, flèches
 * pour passer d'un bouton à l'autre), chaque bouton porte son nom et son
 * raccourci (« Gras (Ctrl+B) », ⌘ sur Mac), état « pressé » pour les bascules.
 * Boutons de 32 px (44 px sur écran tactile). Sur petit écran, la rangée
 * défile horizontalement, bords en fondu.
 *
 * Seulement ce que le blog affiche (lib/markdown.ts) : pas de titre dans une
 * liste, une citation ou un tableau ; pas de liste dans une citation ni de
 * citation dans une liste ; image, tableau et séparateur insérés au premier
 * niveau (après la liste, la citation ou le tableau du curseur).
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useEditorState } from "@tiptap/react"
import type { Editor } from "@tiptap/core"
import { NodeSelection } from "@tiptap/pm/state"
import {
  BetweenHorizontalEnd,
  BetweenHorizontalStart,
  BetweenVerticalEnd,
  BetweenVerticalStart,
  Bold,
  Check,
  ChevronDown,
  Code,
  Code2,
  Eye,
  Highlighter,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Minus,
  Quote,
  Redo2,
  Table2,
  Trash2,
  Undo2,
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { emptyTable, insertBlock, normalizeTableHeader } from "@/components/admin/blog/editor/extensions"

export type EditorMode = "visual" | "markdown"

/* ------------------------------------------------------------------ */
/* Raccourcis                                                          */
/* ------------------------------------------------------------------ */

/** Vrai sur Mac, iPhone et iPad (⌘ au lieu de Ctrl). */
export function useIsMac(): boolean {
  return useMemo(() => typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent), [])
}

/** « Ctrl+B » ou « ⌘B », « Ctrl+Maj+8 » ou « ⇧⌘8 ». */
export function shortcut(isMac: boolean, key: string, opts: { shift?: boolean; alt?: boolean } = {}): string {
  if (isMac) return `${opts.alt ? "⌥" : ""}${opts.shift ? "⇧" : ""}⌘${key}`
  return `Ctrl+${opts.alt ? "Alt+" : ""}${opts.shift ? "Maj+" : ""}${key}`
}

/* ------------------------------------------------------------------ */
/* Navigation au clavier (motif « toolbar »)                           */
/* ------------------------------------------------------------------ */

const ITEM = "[data-tb]:not(:disabled)"

/**
 * Un seul arrêt de tabulation dans un groupe de boutons ; flèches gauche et
 * droite (ou haut et bas avec `vertical`), Début et Fin pour se déplacer.
 * L'élément actif garde tabindex=0, les autres -1 (posés dans le DOM, pas par
 * React, pour survivre aux rendus).
 */
export function useRovingFocus(ref: React.RefObject<HTMLElement | null>, opts: { vertical?: boolean } = {}) {
  const current = useRef<HTMLElement | null>(null)

  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    const items = Array.from(root.querySelectorAll<HTMLElement>(ITEM))
    if (items.length === 0) return
    if (!current.current || !items.includes(current.current)) current.current = items[0]
    for (const item of items) item.tabIndex = item === current.current ? 0 : -1
  })

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      const root = ref.current
      if (!root) return
      const next = opts.vertical ? "ArrowDown" : "ArrowRight"
      const prev = opts.vertical ? "ArrowUp" : "ArrowLeft"
      if (![next, prev, "Home", "End"].includes(event.key)) return
      const items = Array.from(root.querySelectorAll<HTMLElement>(ITEM))
      const index = items.indexOf(document.activeElement as HTMLElement)
      if (index < 0) return
      event.preventDefault()
      const target =
        event.key === "Home" ? items[0] : event.key === "End" ? items[items.length - 1] : items[(index + (event.key === next ? 1 : -1) + items.length) % items.length]
      for (const item of items) item.tabIndex = item === target ? 0 : -1
      current.current = target
      target.focus()
      target.scrollIntoView({ block: "nearest", inline: "nearest" })
    },
    [ref, opts.vertical],
  )

  const onFocus = useCallback((event: React.FocusEvent<HTMLElement>) => {
    const el = event.target as HTMLElement
    if (!el.matches?.(ITEM)) return
    const root = ref.current
    if (!root) return
    for (const item of Array.from(root.querySelectorAll<HTMLElement>(ITEM))) item.tabIndex = item === el ? 0 : -1
    current.current = el
  }, [ref])

  return { onKeyDown, onFocus }
}

/* ------------------------------------------------------------------ */
/* Boutons                                                             */
/* ------------------------------------------------------------------ */

export const TOOL_BUTTON =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-[var(--q-text-2)] transition-colors duration-100 hover:bg-[var(--q-hover)] hover:text-[var(--q-ink)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--q-focus)] disabled:pointer-events-none disabled:opacity-35 motion-reduce:transition-none md:size-8 [&_svg]:size-4"

export const TOOL_BUTTON_ACTIVE = "bg-[var(--q-wash)] text-[var(--q-accent-strong)] hover:bg-[var(--q-wash)] hover:text-[var(--q-accent-strong)]"

export function ToolButton({
  label,
  keys,
  icon,
  active,
  disabled,
  onClick,
  haspopup,
  trigger,
  className,
}: {
  label: string
  /** Raccourci affiché après le libellé. */
  keys?: string
  icon: React.ReactNode
  /** Bascule : état « pressé » (aria-pressed). Absent pour une simple action. */
  active?: boolean
  disabled?: boolean
  onClick: () => void
  haspopup?: "dialog" | "menu"
  /** Ouvre une fenêtre qui se ferme au clic en dehors (« link ») : ce bouton la referme sans la rouvrir. */
  trigger?: string
  className?: string
}) {
  const title = keys ? `${label} (${keys})` : label
  return (
    <button
      type="button"
      data-tb=""
      aria-label={title}
      title={title}
      aria-pressed={active === undefined ? undefined : active}
      aria-haspopup={haspopup}
      data-trigger={trigger}
      disabled={disabled}
      // Le clic ne retire pas le focus (ni la sélection) de la zone d'écriture
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(TOOL_BUTTON, active && TOOL_BUTTON_ACTIVE, className)}
    >
      {icon}
    </button>
  )
}

export function ToolSeparator({ className }: { className?: string }) {
  return <span aria-hidden className={cn("mx-1 h-5 w-px shrink-0 bg-[var(--q-line)]", className)} />
}

/**
 * Bords en fondu d'une rangée qui défile horizontalement, seulement du côté
 * où elle déborde (petit écran) : signale qu'il reste des outils à faire
 * défiler. `active` : la rangée est affichée (outils du tableau).
 */
function useEdgeFade(ref: React.RefObject<HTMLElement | null>, active = true): string {
  const [overflow, setOverflow] = useState({ left: false, right: false })
  useEffect(() => {
    const row = ref.current
    if (!row || !active) return
    const update = () => setOverflow({ left: row.scrollLeft > 2, right: row.scrollLeft + row.clientWidth < row.scrollWidth - 2 })
    update()
    row.addEventListener("scroll", update, { passive: true })
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null
    observer?.observe(row)
    return () => {
      row.removeEventListener("scroll", update)
      observer?.disconnect()
    }
  }, [ref, active])
  if (overflow.left && overflow.right) return "[mask-image:linear-gradient(to_right,transparent,#000_20px,#000_calc(100%-20px),transparent)]"
  if (overflow.left) return "[mask-image:linear-gradient(to_right,transparent,#000_20px)]"
  if (overflow.right) return "[mask-image:linear-gradient(to_left,transparent,#000_20px)]"
  return ""
}

/* ------------------------------------------------------------------ */
/* Style du paragraphe                                                 */
/* ------------------------------------------------------------------ */

type BlockStyle = "paragraph" | 1 | 2 | 3 | 4

const BLOCK_OPTIONS: { value: Exclude<BlockStyle, 1>; label: string; preview: string; key: string }[] = [
  { value: "paragraph", label: "Paragraphe", preview: "text-[14px] font-medium text-[var(--q-text-2)]", key: "0" },
  { value: 2, label: "Titre 2", preview: "q-display text-[19px] leading-tight text-[var(--q-ink-strong)]", key: "2" },
  { value: 3, label: "Titre 3", preview: "q-display text-[16px] leading-tight text-[var(--q-ink-strong)]", key: "3" },
  { value: 4, label: "Titre 4", preview: "text-[14px] font-semibold text-[var(--q-ink-strong)]", key: "4" },
]

function blockLabel(style: BlockStyle): string {
  return style === "paragraph" ? "Paragraphe" : `Titre ${style}`
}

function BlockMenu({
  editor,
  current,
  disabled,
  headingsAllowed,
  isMac,
}: {
  editor: Editor
  current: BlockStyle
  disabled: boolean
  /** Faux dans une liste, une citation ou un tableau : le blog y écrirait le titre comme du texte. */
  headingsAllowed: boolean
  isMac: boolean
}) {
  const chosen = useRef(false)
  const apply = (value: Exclude<BlockStyle, 1>) => {
    chosen.current = true
    const chain = editor.chain().focus()
    if (value === "paragraph") chain.setParagraph().run()
    else chain.setHeading({ level: value }).run()
  }
  return (
    <DropdownMenu onOpenChange={(open) => open && (chosen.current = false)}>
      <DropdownMenuTrigger
        data-tb=""
        disabled={disabled}
        aria-label={`Style du paragraphe : ${blockLabel(current)}`}
        title="Style du paragraphe"
        onMouseDown={(e) => e.preventDefault()}
        className={cn(
          TOOL_BUTTON,
          "!w-auto min-w-[124px] justify-between gap-2 px-2.5 text-[13px] font-semibold text-[var(--q-ink)] data-[popup-open]:bg-[var(--q-hover)] md:min-w-[118px]",
        )}
      >
        <span className="truncate">{blockLabel(current)}</span>
        <ChevronDown className="!size-3.5 text-[var(--q-text-4)]" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className="w-60" finalFocus={() => !chosen.current}>
        {BLOCK_OPTIONS.map((o) => {
          const active = current === o.value
          const unavailable = o.value !== "paragraph" && !headingsAllowed
          return (
            <DropdownMenuItem
              key={String(o.value)}
              disabled={unavailable}
              onClick={() => apply(o.value)}
              className={cn("min-h-11 justify-between md:min-h-[42px]", active && "bg-[var(--q-wash)]")}
            >
              <span className={o.preview}>{o.label}</span>
              <span className="flex items-center gap-2">
                <span className="hidden font-mono text-[11px] font-normal text-[var(--q-text-4)] md:inline">{shortcut(isMac, o.key, { alt: true })}</span>
                {active ? <Check className="size-4 text-[var(--q-accent-strong)]" aria-hidden /> : <span className="size-4" aria-hidden />}
              </span>
            </DropdownMenuItem>
          )
        })}
        {!headingsAllowed && (
          <p className="mx-1 mt-1 border-t border-[var(--q-line-soft)] px-2 pb-1 pt-2 text-[12px] leading-snug text-[var(--q-text-4)]">
            Pas de titre dans une liste, une citation ou un tableau : le blog l&apos;afficherait comme du texte.
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ------------------------------------------------------------------ */
/* Barre                                                               */
/* ------------------------------------------------------------------ */

export interface ToolbarProps {
  editor: Editor | null
  mode: EditorMode
  onModeChange: (mode: EditorMode) => void
  onLink: () => void
  onImage: () => void
  /** Studio d'images ouvert. */
  imageBusy?: boolean
  highlight: { available: boolean; on: boolean; terms: number; onToggle: () => void }
  className?: string
}

export function Toolbar({ editor, mode, onModeChange, onLink, onImage, imageBusy, highlight, className }: ToolbarProps) {
  const isMac = useIsMac()
  const rowRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<HTMLDivElement>(null)
  const roving = useRovingFocus(rowRef)
  const tableRoving = useRovingFocus(tableRef)
  const visual = mode === "visual"

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return null
      const heading = [1, 2, 3, 4].find((level) => e.isActive("heading", { level }))
      return {
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
        bold: e.isActive("bold"),
        italic: e.isActive("italic"),
        code: e.isActive("code"),
        bulletList: e.isActive("bulletList"),
        orderedList: e.isActive("orderedList"),
        blockquote: e.isActive("blockquote"),
        link: e.isActive("link"),
        inTable: e.isActive("table"),
        inHeaderRow: e.isActive("tableHeader"),
        inList: e.isActive("listItem"),
        inCode: e.isActive("codeBlock"),
        nodeSelected: e.state.selection instanceof NodeSelection,
        block: (heading ?? "paragraph") as BlockStyle,
      }
    },
  })

  // Bords en fondu seulement quand une rangée déborde (petit écran) : outils, puis outils du tableau
  const fade = useEdgeFade(rowRef)
  const tableFade = useEdgeFade(tableRef, visual && !!state?.inTable)

  const off = !visual || !editor || !state
  const run = (fn: (e: Editor) => void) => () => {
    if (editor) fn(editor)
  }
  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center gap-1 px-1.5 py-1.5 md:px-2">
        <div
          ref={rowRef}
          role="toolbar"
          aria-label="Mise en forme du texte"
          aria-orientation="horizontal"
          onKeyDown={roving.onKeyDown}
          onFocus={roving.onFocus}
          className={cn("flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", fade)}
        >
          <ToolButton label="Annuler" keys={shortcut(isMac, "Z")} icon={<Undo2 aria-hidden />} disabled={off || !state?.canUndo} onClick={run((e) => e.chain().focus().undo().run())} />
          <ToolButton
            label="Rétablir"
            keys={isMac ? shortcut(isMac, "Z", { shift: true }) : shortcut(isMac, "Y")}
            icon={<Redo2 aria-hidden />}
            disabled={off || !state?.canRedo}
            onClick={run((e) => e.chain().focus().redo().run())}
          />
          <ToolSeparator />
          {editor && state ? (
            <BlockMenu
              editor={editor}
              current={state.block}
              disabled={off || state.inCode || state.nodeSelected}
              headingsAllowed={!state.inList && !state.blockquote && !state.inTable}
              isMac={isMac}
            />
          ) : (
            <span aria-hidden className={cn(TOOL_BUTTON, "!w-[124px] opacity-35")} />
          )}
          <ToolSeparator />
          <ToolButton label="Gras" keys={shortcut(isMac, "B")} icon={<Bold aria-hidden />} active={!!state?.bold} disabled={off || state?.inCode || state?.nodeSelected} onClick={run((e) => e.chain().focus().toggleBold().run())} />
          <ToolButton label="Italique" keys={shortcut(isMac, "I")} icon={<Italic aria-hidden />} active={!!state?.italic} disabled={off || state?.inCode || state?.nodeSelected} onClick={run((e) => e.chain().focus().toggleItalic().run())} />
          <ToolButton label="Code" keys={shortcut(isMac, "E")} icon={<Code aria-hidden />} active={!!state?.code} disabled={off || state?.inCode || state?.nodeSelected} onClick={run((e) => e.chain().focus().toggleCode().run())} />
          <ToolSeparator />
          <ToolButton
            label="Liste à puces"
            keys={shortcut(isMac, "8", { shift: true })}
            icon={<List aria-hidden />}
            active={!!state?.bulletList}
            // Une liste dans une citation s'afficherait en texte : seulement pour en sortir
            disabled={off || state?.inTable || state?.inCode || state?.nodeSelected || (state?.blockquote && !state.bulletList)}
            onClick={run((e) => e.chain().focus().toggleBulletList().run())}
          />
          <ToolButton
            label="Liste numérotée"
            keys={shortcut(isMac, "7", { shift: true })}
            icon={<ListOrdered aria-hidden />}
            active={!!state?.orderedList}
            disabled={off || state?.inTable || state?.inCode || state?.nodeSelected || (state?.blockquote && !state.orderedList)}
            onClick={run((e) => e.chain().focus().toggleOrderedList().run())}
          />
          <ToolButton
            label="Citation"
            keys={shortcut(isMac, "B", { shift: true })}
            icon={<Quote aria-hidden />}
            active={!!state?.blockquote}
            // Une citation dans une liste perdrait sa mise en forme sur le blog
            disabled={off || state?.inTable || state?.inCode || state?.nodeSelected || (state?.inList && !state.blockquote)}
            onClick={run((e) => e.chain().focus().toggleBlockquote().run())}
          />
          <ToolSeparator />
          <ToolButton
            label="Lien"
            keys={shortcut(isMac, "K")}
            icon={<Link2 aria-hidden />}
            active={!!state?.link}
            haspopup="dialog"
            trigger="link"
            disabled={off || state?.inCode || state?.nodeSelected}
            onClick={onLink}
          />
          <ToolButton
            label={imageBusy ? "Studio d'images ouvert" : "Image"}
            icon={imageBusy ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <ImagePlus aria-hidden />}
            haspopup="dialog"
            disabled={off || imageBusy || state?.inCode}
            onClick={onImage}
          />
          <ToolButton
            label={state?.inTable ? "Tableau (inséré après celui-ci)" : "Tableau"}
            icon={<Table2 aria-hidden />}
            disabled={off || state?.inCode}
            onClick={run((e) => insertBlock(e, emptyTable(3, 3)))}
          />
          <ToolButton label="Séparateur" icon={<Minus aria-hidden />} disabled={off || state?.inCode} onClick={run((e) => insertBlock(e, { type: "horizontalRule" }))} />
          {highlight.available && (
            <>
              <ToolSeparator />
              <ToolButton
                label={`${highlight.on ? "Ne plus surligner" : "Surligner"} les mots-clés (${highlight.terms} terme${highlight.terms > 1 ? "s" : ""})`}
                icon={<Highlighter aria-hidden />}
                active={highlight.on}
                disabled={off}
                onClick={highlight.onToggle}
              />
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center border-l border-[var(--q-line-soft)] pl-1.5 md:pl-2">
          {/* Téléphone : rail sans marge, boutons de 44 px (cible tactile) */}
          <div role="group" aria-label="Mode d'édition" className="q-seg max-md:!p-0">
            <button
              type="button"
              aria-pressed={visual}
              onClick={() => onModeChange("visual")}
              title="Mode visuel : le texte tel qu'il paraîtra sur le blog"
              className="max-md:!h-11 max-md:!min-w-11 max-md:!px-2.5"
            >
              <Eye className="size-3.5" aria-hidden />
              <span className="max-sm:sr-only">Visuel</span>
            </button>
            <button
              type="button"
              aria-pressed={!visual}
              onClick={() => onModeChange("markdown")}
              title="Mode Markdown : le texte enregistré, tel quel"
              className="max-md:!h-11 max-md:!min-w-11 max-md:!px-2.5"
            >
              <Code2 className="size-3.5" aria-hidden />
              <span className="max-sm:sr-only">Markdown</span>
            </button>
          </div>
        </div>
      </div>

      {visual && state?.inTable && editor && (
        <div className="flex items-center gap-2 border-t border-[var(--q-line-soft)] px-2 py-1 md:px-3">
          <span className="hidden shrink-0 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--q-text-4)] sm:inline">Tableau</span>
          <div
            ref={tableRef}
            role="toolbar"
            aria-label="Tableau"
            onKeyDown={tableRoving.onKeyDown}
            onFocus={tableRoving.onFocus}
            className={cn("flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", tableFade)}
          >
            {/* La première ligne reste l'en-tête (Markdown du blog) : rien au-dessus d'elle */}
            <ToolButton
              label={state.inHeaderRow ? "Ligne au-dessus : la première ligne reste l'en-tête du tableau" : "Ligne au-dessus"}
              icon={<BetweenHorizontalStart aria-hidden />}
              disabled={state.inHeaderRow}
              onClick={run((e) => e.chain().focus().addRowBefore().command(({ tr }) => !!normalizeTableHeader(tr)).run())}
            />
            <ToolButton
              label="Ligne en dessous"
              icon={<BetweenHorizontalEnd aria-hidden />}
              onClick={run((e) => e.chain().focus().addRowAfter().command(({ tr }) => !!normalizeTableHeader(tr)).run())}
            />
            <ToolButton
              label="Colonne avant"
              icon={<BetweenVerticalStart aria-hidden />}
              onClick={run((e) => e.chain().focus().addColumnBefore().command(({ tr }) => !!normalizeTableHeader(tr)).run())}
            />
            <ToolButton
              label="Colonne après"
              icon={<BetweenVerticalEnd aria-hidden />}
              onClick={run((e) => e.chain().focus().addColumnAfter().command(({ tr }) => !!normalizeTableHeader(tr)).run())}
            />
            <ToolSeparator />
            <button
              type="button"
              data-tb=""
              onMouseDown={(e) => e.preventDefault()}
              // Première ligne supprimée : la suivante devient l'en-tête, comme sur le blog
              onClick={run((e) => e.chain().focus().deleteRow().command(({ tr }) => !!normalizeTableHeader(tr)).run())}
              aria-label="Supprimer la ligne"
              title="Supprimer la ligne"
              className={cn(TOOL_BUTTON, "!w-auto gap-1.5 px-2.5 text-[13px] font-semibold")}
            >
              <Trash2 aria-hidden />
              Ligne
            </button>
            <button
              type="button"
              data-tb=""
              onMouseDown={(e) => e.preventDefault()}
              onClick={run((e) => e.chain().focus().deleteColumn().run())}
              aria-label="Supprimer la colonne"
              title="Supprimer la colonne"
              className={cn(TOOL_BUTTON, "!w-auto gap-1.5 px-2.5 text-[13px] font-semibold")}
            >
              <Trash2 aria-hidden />
              Colonne
            </button>
            <button
              type="button"
              data-tb=""
              onMouseDown={(e) => e.preventDefault()}
              onClick={run((e) => e.chain().focus().deleteTable().run())}
              className={cn(TOOL_BUTTON, "!w-auto gap-1.5 px-2.5 text-[13px] font-semibold text-[var(--q-danger)] hover:bg-[var(--q-danger-bg)] hover:text-[var(--q-danger)]")}
            >
              <Trash2 aria-hidden />
              Supprimer le tableau
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
