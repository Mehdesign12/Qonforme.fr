'use client'

/**
 * Recherche ⌘K (canevas « Recherche ») : aller à une rubrique ou créer un document.
 */
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, CornerDownLeft } from "lucide-react"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { CREATE_LINKS, NAV_MAIN, NAV_PILOTAGE, NAV_SETTINGS, hrefFor } from "@/components/layout/nav"
import type { ShellIdentity } from "@/components/layout/shell"

type Item = { id: string; group: string; label: string; hint?: string; href: string; icon: React.ElementType }

/** Recherche insensible à la casse et aux accents. */
function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

export function CommandPalette({ open, onOpenChange, identity }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  identity: ShellIdentity
}) {
  const router = useRouter()
  const mode = identity.mode
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const items = useMemo<Item[]>(() => {
    const go = [...NAV_MAIN, ...NAV_PILOTAGE, NAV_SETTINGS]
      .filter((l) => mode === "app" || l.demoHref)
      .map((l) => ({ id: `nav-${l.key}`, group: "Aller à", label: l.label, hint: l.hint, href: hrefFor(l, mode), icon: l.icon }))
    const create = CREATE_LINKS
      .filter((c) => mode === "app" || c.demoHref)
      .map((c) => ({ id: `new-${c.key}`, group: "Créer", label: c.label, hint: c.hint, href: hrefFor(c, mode), icon: c.icon }))
    return [...create, ...go]
  }, [mode])

  const results = useMemo(() => {
    const q = norm(query.trim())
    if (!q) return items
    return items.filter((i) => norm(`${i.label} ${i.hint ?? ""}`).includes(q))
  }, [items, query])

  useEffect(() => { setActive(0) }, [query, open])
  useEffect(() => { if (!open) setQuery("") }, [open])

  const choose = (item: Item | undefined) => {
    if (!item) return
    onOpenChange(false)
    router.push(item.href)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)) }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    else if (e.key === "Enter") { e.preventDefault(); choose(results[active]) }
  }

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" })
  }, [active])

  let lastGroup = ""
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="top-[14%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-[600px]">
        <DialogTitle className="sr-only">Rechercher</DialogTitle>
        <DialogDescription className="sr-only">Aller à une rubrique ou créer un document.</DialogDescription>
        <div className="flex items-center gap-3 border-b border-[var(--q-line-soft)] px-4">
          <Search className="size-[18px] shrink-0 text-[var(--q-text-4)]" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Rechercher une rubrique, une action…"
            aria-label="Rechercher"
            role="combobox"
            aria-expanded="true"
            aria-controls="q-palette-list"
            aria-activedescendant={results[active] ? `q-palette-${results[active].id}` : undefined}
            className="h-14 w-full bg-transparent text-base text-[var(--q-ink)] outline-none placeholder:text-[var(--q-placeholder)]"
          />
          <kbd className="q-kbd">Échap</kbd>
        </div>
        <div ref={listRef} id="q-palette-list" role="listbox" className="max-h-[min(60vh,440px)] overflow-y-auto p-2">
          {results.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-[var(--q-text-4)]">Aucun résultat pour « {query} ».</p>
          )}
          {results.map((item, i) => {
            const header = item.group !== lastGroup ? item.group : null
            lastGroup = item.group
            const Icon = item.icon
            return (
              <div key={item.id}>
                {header && <p className="px-3 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--q-text-4)]">{header}</p>}
                <button
                  type="button"
                  id={`q-palette-${item.id}`}
                  role="option"
                  aria-selected={i === active}
                  data-index={i}
                  onMouseMove={() => setActive(i)}
                  onClick={() => choose(item)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left",
                    i === active ? "bg-[var(--q-hover)]" : "",
                  )}
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-[var(--q-wash)] text-[var(--q-accent-strong)]">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold text-[var(--q-ink)]">{item.label}</span>
                    {item.hint && <span className="truncate text-xs text-[var(--q-text-4)]">{item.hint}</span>}
                  </span>
                  {i === active && <CornerDownLeft className="size-4 text-[var(--q-text-4)]" aria-hidden />}
                </button>
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
