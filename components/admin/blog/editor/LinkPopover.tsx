"use client"

/**
 * Fenêtre « Lien » de l'éditeur d'articles, ouverte par Ctrl+K (⌘K), la barre
 * d'outils ou le menu de sélection, sous le passage sélectionné.
 *
 * - Un champ : « Rechercher une page du site ou coller une adresse ».
 * - Pages du site (GET /api/admin/blog/link-targets, chargées une fois puis
 *   gardées pour la session), rangées par type, chemin en police à chasse
 *   fixe ; liste au clavier (flèches, Entrée, Échap), motif « combobox » ARIA.
 * - Adresse libre : http(s), « /chemin » ou « #ancre » (règle du moteur du
 *   blog) ; « www.… » est complété en « https://www.… ». Lien vers un site
 *   non officiel : avertissement du contrôle (seuls .gouv.fr et
 *   service-public.fr sont admis).
 * - Sans sélection, le titre de la page choisie devient le texte du lien ;
 *   « Retirer le lien » quand le curseur est sur un lien.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { Editor } from "@tiptap/core"
import {
  BookA,
  BookOpen,
  Calculator,
  CornerDownLeft,
  ExternalLink,
  FileText,
  Globe,
  Hammer,
  Link2,
  Newspaper,
  RefreshCw,
  Rocket,
  Search,
  TriangleAlert,
  Unlink,
  X,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { isAllowedLink } from "@/lib/seo/articles/check"
import type { LinkTarget, LinkTargetKind, LinkTargetsResponse } from "@/lib/seo/articles/editor-types"
import { SAFE_LINK } from "@/components/admin/blog/editor/extensions"

/* ------------------------------------------------------------------ */
/* Pages du site (cache du module)                                     */
/* ------------------------------------------------------------------ */

let targetsCache: Promise<LinkTarget[]> | null = null

function loadTargets(force = false): Promise<LinkTarget[]> {
  if (!targetsCache || force) {
    targetsCache = fetch("/api/admin/blog/link-targets", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status))
        const json = (await res.json()) as LinkTargetsResponse
        return Array.isArray(json.targets) ? json.targets : []
      })
      .catch((error) => {
        targetsCache = null
        throw error
      })
  }
  return targetsCache
}

const KINDS: { kind: LinkTargetKind; label: string; icon: LucideIcon }[] = [
  { kind: "page", label: "Pages", icon: Globe },
  { kind: "article", label: "Articles du blog", icon: Newspaper },
  { kind: "guide", label: "Guides", icon: BookOpen },
  { kind: "modele", label: "Modèles", icon: FileText },
  { kind: "metier", label: "Métiers", icon: Hammer },
  { kind: "installation", label: "S'installer à son compte", icon: Rocket },
  { kind: "outil", label: "Outils gratuits", icon: Calculator },
  { kind: "glossaire", label: "Glossaire", icon: BookA },
]

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/\s+/g, " ")
    .trim()

/** Adresse tapée dans le champ : complétée (www.) et validée. */
function typedAddress(query: string): { href: string | null; looksLikeAddress: boolean } {
  const q = query.trim()
  if (!q) return { href: null, looksLikeAddress: false }
  if (/^(https?:\/\/|\/|#)/i.test(q)) {
    const valid = SAFE_LINK.test(q) && !/[\s"'<>`\\]/.test(q) && (!q.startsWith("#") || /^#[\w-]+$/.test(q))
    return { href: valid ? q : null, looksLikeAddress: true }
  }
  if (/^(www\.)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(q) && !/\s/.test(q)) return { href: `https://${q}`, looksLikeAddress: true }
  if (/^[a-z][a-z0-9+.-]*:/i.test(q)) return { href: null, looksLikeAddress: true }
  return { href: null, looksLikeAddress: false }
}

type Option = { id: string; kind: "address"; href: string } | { id: string; kind: "target"; target: LinkTarget }

/* ------------------------------------------------------------------ */
/* Fenêtre                                                             */
/* ------------------------------------------------------------------ */

export interface LinkPopoverProps {
  editor: Editor
  open: boolean
  /** `refocus` : rendre le focus à la zone d'écriture. */
  onClose: (opts?: { refocus?: boolean }) => void
  /** Conteneur positionné (relative) dans lequel la fenêtre se place. */
  container: HTMLElement | null
}

export function LinkPopover({ editor, open, onClose, container }: LinkPopoverProps) {
  const id = useId()
  const listId = `${id}-pages`
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState("")
  const [targets, setTargets] = useState<LinkTarget[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [active, setActive] = useState(0)
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null)
  const [context, setContext] = useState<{ editing: boolean; selectedText: string }>({ editing: false, selectedText: "" })

  const fetchTargets = useCallback((force = false) => {
    setLoadError(false)
    loadTargets(force)
      .then((list) => setTargets(list))
      .catch(() => setLoadError(true))
  }, [])

  // À l'ouverture : lien en cours, texte sélectionné, position sous la sélection
  useLayoutEffect(() => {
    if (!open) return
    const editing = editor.isActive("link")
    const { from, to, empty } = editor.state.selection
    const href = editing ? String(editor.getAttributes("link").href ?? "") : ""
    setQuery(href)
    setActive(0)
    setContext({ editing, selectedText: empty ? "" : editor.state.doc.textBetween(from, to, " ").trim() })
    if (container) {
      const box = container.getBoundingClientRect()
      let coords: { bottom: number; left: number }
      try {
        coords = editor.view.coordsAtPos(from)
      } catch {
        coords = { bottom: box.top + 48, left: box.left + 24 }
      }
      const width = Math.min(440, Math.max(260, box.width - 16))
      const left = Math.min(Math.max(8, coords.left - box.left - 24), Math.max(8, box.width - width - 8))
      setPosition({ top: coords.bottom - box.top + 10, left, width })
    }
    fetchTargets()
  }, [open, editor, container, fetchTargets])

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true })
      inputRef.current?.select()
      panelRef.current?.scrollIntoView({ block: "nearest" })
    })
    return () => cancelAnimationFrame(frame)
  }, [open, position])

  // Les pages du site arrivent après l'ouverture (premier chargement) : la fenêtre grandit, on la garde entière à l'écran
  const loaded = targets !== null
  useEffect(() => {
    if (!open || !loaded) return
    const frame = requestAnimationFrame(() => panelRef.current?.scrollIntoView({ block: "nearest" }))
    return () => cancelAnimationFrame(frame)
  }, [open, loaded])

  // Clic en dehors : ferme sans rien changer
  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Element | null
      if (!panelRef.current || panelRef.current.contains(target)) return
      // Le bouton « Lien » de la barre d'outils referme lui-même la fenêtre
      if (target?.closest?.('[data-trigger="link"]')) return
      onClose({ refocus: false })
    }
    document.addEventListener("mousedown", onDown, true)
    document.addEventListener("touchstart", onDown, true)
    return () => {
      document.removeEventListener("mousedown", onDown, true)
      document.removeEventListener("touchstart", onDown, true)
    }
  }, [open, onClose])

  const address = typedAddress(query)
  const external = address.href ? /^https?:\/\//i.test(address.href) && !isAllowedLink(address.href) : false

  const groups = useMemo(() => {
    if (!targets) return []
    const q = fold(query)
    const path = query.trim().toLowerCase()
    // « /guide… » : recherche dans les chemins ; adresse externe : aucune page
    const byPath = path.startsWith("/")
    const searching = q.length > 0 && !address.looksLikeAddress
    const limit = searching || byPath ? 8 : 5
    return KINDS.map((k) => {
      let items = targets.filter((t) => t.kind === k.kind)
      if (byPath) {
        items = items.filter((t) => t.path.toLowerCase().includes(path)).sort((a, b) => Number(!a.path.toLowerCase().startsWith(path)) - Number(!b.path.toLowerCase().startsWith(path)))
      } else if (searching) {
        items = items
          .map((t) => {
            const title = fold(t.title)
            const path = t.path.toLowerCase()
            const words = q.split(" ")
            const score = title.startsWith(q) ? 0 : title.includes(q) ? 1 : words.every((w) => title.includes(w) || path.includes(w)) ? 2 : -1
            return { t, score }
          })
          .filter((x) => x.score >= 0)
          .sort((a, b) => a.score - b.score)
          .map((x) => x.t)
      } else if (q.length > 0) {
        items = []
      }
      return { ...k, total: items.length, items: items.slice(0, limit) }
    }).filter((g) => g.items.length > 0)
  }, [targets, query, address.looksLikeAddress])

  const options: Option[] = useMemo(() => {
    const list: Option[] = []
    if (address.href) list.push({ id: `${id}-adresse`, kind: "address", href: address.href })
    groups.forEach((g) => g.items.forEach((t, i) => list.push({ id: `${id}-${g.kind}-${i}`, kind: "target", target: t })))
    return list
  }, [address.href, groups, id])

  useEffect(() => {
    setActive((a) => (options.length === 0 ? 0 : Math.min(a, options.length - 1)))
  }, [options.length])

  useEffect(() => {
    const el = options[active] ? document.getElementById(options[active].id) : null
    el?.scrollIntoView({ block: "nearest" })
  }, [active, options])

  function apply(href: string, title?: string) {
    const { empty } = editor.state.selection
    const chain = editor.chain().focus()
    if (editor.isActive("link") && empty) chain.extendMarkRange("link").setLink({ href }).run()
    else if (empty) {
      chain
        .insertContent({ type: "text", text: title?.trim() || href, marks: [{ type: "link", attrs: { href } }] })
        .unsetMark("link")
        .run()
    } else chain.setLink({ href }).run()
    onClose()
  }

  function choose(option: Option | undefined) {
    if (!option) return
    if (option.kind === "address") apply(option.href)
    else apply(option.target.path, option.target.title)
  }

  function removeLink() {
    editor.chain().focus().extendMarkRange("link").unsetLink().run()
    onClose()
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault()
      event.stopPropagation()
      onClose({ refocus: true })
      return
    }
    if (event.target !== inputRef.current) return
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      if (options.length === 0) return
      setActive((a) => (a + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length)
    } else if (event.key === "Enter") {
      event.preventDefault()
      choose(options[active])
    }
  }

  if (!open || !position) return null

  let optionIndex = address.href ? 1 : 0
  const loading = targets === null && !loadError
  const showInvalid = address.looksLikeAddress && !address.href && query.trim().length > 0

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={context.editing ? "Modifier le lien" : "Insérer un lien"}
      onKeyDown={onKeyDown}
      onBlur={(event) => {
        // Tab vers un élément hors de la fenêtre : elle se ferme (le clic en dehors est géré à part)
        const next = event.relatedTarget as Node | null
        if (next && !event.currentTarget.contains(next)) onClose({ refocus: false })
      }}
      style={{ top: position.top, left: position.left, width: position.width }}
      // Marges de défilement : jamais sous la barre d'outils collée ni sous la barre de navigation du bas (téléphone)
      className="q-pop absolute z-40 flex max-h-[min(460px,70dvh)] scroll-mb-28 scroll-mt-36 flex-col !p-0 animate-in fade-in-0 zoom-in-95 duration-100 motion-reduce:animate-none lg:scroll-mb-4 lg:scroll-mt-40"
    >
      <div className="flex items-center gap-2 border-b border-[var(--q-line-soft)] px-3 py-2">
        <Search className="size-4 shrink-0 text-[var(--q-text-4)]" aria-hidden />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={options.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={options[active]?.id}
          aria-label="Rechercher une page du site ou coller une adresse"
          placeholder="Rechercher une page du site ou coller une adresse"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          autoComplete="off"
          spellCheck={false}
          className="h-11 min-w-0 flex-1 bg-transparent text-base text-[var(--q-ink)] outline-none placeholder:text-[var(--q-placeholder)] md:h-10 md:text-sm"
        />
        <button
          type="button"
          onClick={() => onClose({ refocus: true })}
          aria-label="Fermer"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-[var(--q-text-4)] hover:bg-[var(--q-hover)] hover:text-[var(--q-ink)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--q-focus)] md:size-8"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      {context.selectedText ? (
        <p className="truncate border-b border-[var(--q-line-soft)] px-3.5 py-2 text-[12px] text-[var(--q-text-4)]">
          Texte du lien : <span className="font-medium text-[var(--q-text-2)]">« {context.selectedText.length > 70 ? `${context.selectedText.slice(0, 68)}…` : context.selectedText} »</span>
        </p>
      ) : (
        !context.editing && (
          <p className="border-b border-[var(--q-line-soft)] px-3.5 py-2 text-[12px] leading-snug text-[var(--q-text-4)]">
            Aucun texte sélectionné : le titre de la page choisie deviendra le texte du lien.
          </p>
        )
      )}

      <div id={listId} role="listbox" aria-label="Pages et adresses" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
        {address.href && (
          <div
            id={options[0]?.id}
            role="option"
            aria-selected={active === 0}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => choose(options[0])}
            onMouseMove={() => setActive(0)}
            className={cn("flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[9px] px-2.5 py-2", active === 0 && "bg-[var(--q-hover)]")}
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[var(--q-wash)] text-[var(--q-accent-strong)]">
              {/^https?:/i.test(address.href) ? <ExternalLink className="size-3.5" aria-hidden /> : <Link2 className="size-3.5" aria-hidden />}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[13px] font-semibold text-[var(--q-ink)]">Utiliser cette adresse</span>
              <span className="truncate font-mono text-[12px] text-[var(--q-text-3)]">{address.href}</span>
            </span>
            <CornerDownLeft className="size-3.5 shrink-0 text-[var(--q-text-4)]" aria-hidden />
          </div>
        )}

        {external && (
          <p role="status" className="mx-1 my-1.5 flex items-start gap-2 rounded-lg border border-[var(--q-warn-line)] bg-[var(--q-warn-bg)] px-2.5 py-2 text-[12px] leading-snug text-[var(--q-warn)]">
            <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
            Le contrôle signale les liens vers des sites non officiels : seuls .gouv.fr et service-public.fr sont admis.
          </p>
        )}

        {showInvalid && (
          <p role="status" className="mx-1 my-1.5 flex items-start gap-2 px-1.5 py-1 text-[12px] leading-snug text-[var(--q-danger)]">
            <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
            Adresse non valable : commencez par « https:// », « / » (page du site) ou « # » (ancre).
          </p>
        )}

        {loading && (
          <div className="flex flex-col gap-1.5 p-1.5" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="flex items-center gap-2.5">
                <span className="size-7 animate-pulse rounded-lg bg-[var(--q-sunken)] motion-reduce:animate-none" />
                <span className={cn("h-3.5 animate-pulse rounded bg-[var(--q-sunken)] motion-reduce:animate-none", i % 2 ? "w-1/2" : "w-2/3")} />
              </span>
            ))}
          </div>
        )}
        {loading && (
          <span role="status" className="sr-only">
            Chargement des pages du site…
          </span>
        )}

        {loadError && (
          <div role="alert" className="mx-1 my-1.5 flex flex-wrap items-center gap-2 rounded-lg bg-[var(--q-sunken)] px-2.5 py-2 text-[12px] text-[var(--q-text-3)]">
            <span className="min-w-0 flex-1">Pages du site indisponibles pour le moment. Vous pouvez coller une adresse.</span>
            <button type="button" onClick={() => fetchTargets(true)} className="q-link inline-flex min-h-8 items-center gap-1 text-[12px]">
              <RefreshCw className="size-3.5" aria-hidden />
              Réessayer
            </button>
          </div>
        )}

        {groups.map((g) => {
          const Icon = g.icon
          return (
            <div key={g.kind} role="group" aria-label={g.label} className="pt-1">
              <div className="flex items-center justify-between px-2.5 pb-1 pt-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--q-text-4)]">{g.label}</span>
                {g.total > g.items.length && <span className="q-count text-[11px]">{g.items.length} sur {g.total}</span>}
              </div>
              {g.items.map((t) => {
                const index = optionIndex++
                const option = options[index]
                const selected = active === index
                return (
                  <div
                    key={t.path}
                    id={option?.id}
                    role="option"
                    aria-selected={selected}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(option)}
                    onMouseMove={() => setActive(index)}
                    className={cn("flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[9px] px-2.5 py-1.5", selected && "bg-[var(--q-hover)]")}
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-[var(--q-line)] bg-[var(--q-surface-2)] text-[var(--q-text-3)]">
                      <Icon className="size-3.5" aria-hidden />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[13px] font-medium text-[var(--q-ink)]">{t.title}</span>
                      <span className="truncate font-mono text-[11px] text-[var(--q-text-4)]">{t.path}</span>
                    </span>
                    {selected && <CornerDownLeft className="size-3.5 shrink-0 text-[var(--q-text-4)]" aria-hidden />}
                  </div>
                )
              })}
            </div>
          )
        })}

        {!loading && !loadError && targets && options.length === 0 && !showInvalid && (
          <p className="px-3 py-6 text-center text-[13px] text-[var(--q-text-4)]">
            Aucune page ne correspond à « {query.trim()} ».
            <br />
            Collez une adresse complète pour un lien externe.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-[var(--q-line-soft)] px-2 py-1.5">
        {context.editing ? (
          <button
            type="button"
            onClick={removeLink}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold text-[var(--q-danger)] hover:bg-[var(--q-danger-bg)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--q-focus)] md:min-h-8"
          >
            <Unlink className="size-4" aria-hidden />
            Retirer le lien
          </button>
        ) : (
          <span />
        )}
        <span className="hidden items-center gap-1.5 text-[11px] text-[var(--q-text-4)] md:inline-flex">
          <kbd className="q-kbd">↑</kbd>
          <kbd className="q-kbd">↓</kbd>
          <span>choisir</span>
          <kbd className="q-kbd ml-1">↵</kbd>
          <span>insérer</span>
          <kbd className="q-kbd ml-1">Échap</kbd>
        </span>
      </div>
    </div>
  )
}
