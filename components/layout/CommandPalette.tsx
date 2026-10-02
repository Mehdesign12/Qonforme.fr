'use client'

/**
 * Recherche ⌘K (canevas « Recherche ») : aller à une rubrique, créer un
 * document, et à partir de 2 caractères retrouver un client, une facture ou un
 * devis. Réel : GET /api/search (200 ms après la frappe, requête précédente
 * annulée) ; démo : recherche locale dans lib/demo/data, mêmes groupes.
 */
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, CornerDownLeft } from "lucide-react"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { DocStatusPill, initialsOf } from "@/components/app/kit"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils/invoice"
import { CREATE_LINKS, NAV_MAIN, NAV_PILOTAGE, NAV_SETTINGS, hrefFor } from "@/components/layout/nav"
import type { ShellIdentity } from "@/components/layout/shell"
import {
  EMPTY_RESULTS, SEARCH_MIN, normalizeText,
  type ClientHit, type DocHit, type SearchResults,
} from "@/components/search/model"

type Option =
  | { kind: "action"; id: string; label: string; hint?: string; href: string; icon: React.ElementType; group: "Créer" | "Aller à" }
  | { kind: "client"; id: string; href: string; hit: ClientHit }
  | { kind: "invoice" | "quote"; id: string; href: string; hit: DocHit }

type Group = { label: string; options: Option[] }

type SearchState = { status: "idle" | "loading" | "done" | "error"; data: SearchResults }

/** Actions affichées au-dessus des documents quand on cherche. */
const MAX_ACTIONS_WHILE_SEARCHING = 4

async function runSearch(mode: ShellIdentity["mode"], q: string, signal: AbortSignal): Promise<SearchResults> {
  if (mode === "demo") {
    const { demoSearch } = await import("@/components/search/demo")
    return demoSearch(q)
  }
  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { cache: "no-store", signal })
  if (!res.ok) throw new Error(`search ${res.status}`)
  return res.json()
}

/** Surligne la première occurrence de `query` (sans tenir compte des accents ni de la casse). */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = normalizeText(query.trim())
  if (!q) return <>{text}</>
  let norm = ""
  const map: number[] = []
  for (let i = 0; i < text.length; i++) {
    for (const ch of normalizeText(text[i])) { norm += ch; map.push(i) }
  }
  const at = norm.indexOf(q)
  if (at < 0) return <>{text}</>
  const start = map[at]
  const end = map[at + q.length - 1] + 1
  return (
    <>
      {text.slice(0, start)}
      <mark className="rounded-[3px] bg-[#FDE68A] px-px text-[#0F172A]">{text.slice(start, end)}</mark>
      {text.slice(end)}
    </>
  )
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
  const [search, setSearch] = useState<SearchState>({ status: "idle", data: EMPTY_RESULTS })
  const listRef = useRef<HTMLDivElement>(null)

  const term = query.trim()
  const deep = term.length >= SEARCH_MIN

  const actions = useMemo<Option[]>(() => {
    const create = CREATE_LINKS
      .filter((c) => mode === "app" || c.demoHref)
      .map((c): Option => ({ kind: "action", id: `new-${c.key}`, group: "Créer", label: c.label, hint: c.hint, href: hrefFor(c, mode), icon: c.icon }))
    const go = [...NAV_MAIN, ...NAV_PILOTAGE, NAV_SETTINGS]
      .filter((l) => mode === "app" || l.demoHref)
      .map((l): Option => ({ kind: "action", id: `nav-${l.key}`, group: "Aller à", label: l.label, hint: l.hint, href: hrefFor(l, mode), icon: l.icon }))
    return [...create, ...go]
  }, [mode])

  // Documents et clients : 200 ms après la frappe, la requête précédente annulée
  useEffect(() => {
    if (!open || !deep) {
      setSearch({ status: "idle", data: EMPTY_RESULTS })
      return
    }
    const ctrl = new AbortController()
    setSearch((s) => ({ ...s, status: "loading" }))
    const timer = window.setTimeout(() => {
      runSearch(mode, term, ctrl.signal)
        .then((data) => { if (!ctrl.signal.aborted) setSearch({ status: "done", data }) })
        .catch(() => { if (!ctrl.signal.aborted) setSearch({ status: "error", data: EMPTY_RESULTS }) })
    }, 200)
    return () => { window.clearTimeout(timer); ctrl.abort() }
  }, [open, deep, term, mode])

  const groups = useMemo<Group[]>(() => {
    const q = normalizeText(term)
    const matching = q
      ? actions.filter((a) => a.kind === "action" && normalizeText(`${a.label} ${a.hint ?? ""}`).includes(q))
      : actions
    if (!deep) {
      return (["Créer", "Aller à"] as const)
        .map((label) => ({ label, options: matching.filter((a) => a.kind === "action" && a.group === label) }))
        .filter((g) => g.options.length > 0)
    }
    const { clients, invoices, quotes } = search.data
    // Le premier client trouvé par son nom : « Nouvelle facture pour … » (le
    // formulaire présélectionne le client passé dans « ?client= »)
    const named = clients[0] && normalizeText(clients[0].name).includes(q) ? clients[0] : null
    const prefix = mode === "demo" ? "/demo" : ""
    const contextual: Option[] = named
      ? (["invoice", "quote"] as const).flatMap((key) => CREATE_LINKS.filter((c) => c.key === key)).map((c): Option => ({
          kind: "action",
          id: `for-${c.key}-${named.id}`,
          group: "Créer",
          label: `${c.label} pour ${named.name}`,
          href: `${prefix}/${c.key === "invoice" ? "invoices" : "quotes"}/new?client=${encodeURIComponent(named.id)}`,
          icon: c.icon,
        }))
      : []
    return [
      { label: "Actions", options: [...contextual, ...matching].slice(0, MAX_ACTIONS_WHILE_SEARCHING) },
      { label: "Clients", options: clients.map((hit): Option => ({ kind: "client", id: `client-${hit.id}`, href: hit.href, hit })) },
      { label: "Factures", options: invoices.map((hit): Option => ({ kind: "invoice", id: `invoice-${hit.id}`, href: hit.href, hit })) },
      { label: "Devis", options: quotes.map((hit): Option => ({ kind: "quote", id: `quote-${hit.id}`, href: hit.href, hit })) },
    ].filter((g) => g.options.length > 0)
  }, [actions, deep, term, mode, search.data])

  const flat = useMemo(() => groups.flatMap((g) => g.options), [groups])
  const docCount = search.data.clients.length + search.data.invoices.length + search.data.quotes.length

  useEffect(() => { setActive(0) }, [query, open, search.data])
  useEffect(() => { if (!open) setQuery("") }, [open])

  const choose = (option: Option | undefined) => {
    if (!option) return
    onOpenChange(false)
    router.push(option.href)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, flat.length - 1)) }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    else if (e.key === "Home") { e.preventDefault(); setActive(0) }
    else if (e.key === "End") { e.preventDefault(); setActive(Math.max(flat.length - 1, 0)) }
    else if (e.key === "Enter") { e.preventDefault(); choose(flat[active]) }
  }

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" })
  }, [active])

  const searching = deep && search.status === "loading" && docCount === 0
  const failed = deep && search.status === "error"
  const empty = flat.length === 0 && !searching && !failed && (!deep || search.status === "done")
  const announce = !deep ? "" : search.status === "loading" ? "Recherche en cours" : search.status === "done"
    ? `${docCount} résultat${docCount > 1 ? "s" : ""} dans vos documents` : ""

  let index = -1
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-3 translate-y-0 gap-0 overflow-hidden rounded-[20px] p-0 sm:top-[120px] sm:max-w-[680px]"
      >
        <DialogTitle className="sr-only">Rechercher</DialogTitle>
        <DialogDescription className="sr-only">
          Aller à une rubrique, créer un document ou retrouver une facture, un devis, un client.
        </DialogDescription>

        <div className="flex items-center gap-3 border-b border-[var(--q-line-soft)] px-[18px] py-1.5 sm:py-2">
          <Search className="size-5 shrink-0 text-[var(--q-text-3)]" strokeWidth={2} aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Rechercher une facture, un client, une action…"
            aria-label="Rechercher ou lancer une action"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded="true"
            aria-controls="q-palette-list"
            aria-activedescendant={flat[active] ? `q-palette-${flat[active].id}` : undefined}
            className="h-12 min-w-0 flex-1 text-ellipsis bg-transparent text-[19px] text-[var(--q-ink)] outline-none placeholder:text-[var(--q-placeholder)]"
          />
          <button type="button" onClick={() => onOpenChange(false)} className="q-kbd hidden sm:inline-block" aria-label="Fermer la recherche">
            esc
          </button>
          <button type="button" onClick={() => onOpenChange(false)} className="text-sm font-semibold text-[var(--q-accent-strong)] sm:hidden">
            Fermer
          </button>
        </div>

        {/* La liste (role listbox) ne contient que ses groupes d'options : les messages d'état et
            l'annonce vocale restent à côté, dans la même zone de défilement. */}
        <div ref={listRef} className="max-h-[calc(100dvh-160px)] overflow-y-auto p-2 sm:max-h-[min(60vh,520px)]">
          <div id="q-palette-list" role="listbox" aria-label="Résultats">
            {groups.map((group) => (
              <div key={group.label} role="group" aria-label={group.label} className="flex flex-col gap-0.5">
                <p className="px-3 pb-1.5 pt-2.5 text-xs font-semibold text-[var(--q-text-4)]" aria-hidden>{group.label}</p>
                {group.options.map((option) => {
                  index += 1
                  const i = index
                  const isActive = i === active
                  return (
                    <button
                      key={option.id}
                      type="button"
                      id={`q-palette-${option.id}`}
                      role="option"
                      aria-selected={isActive}
                      data-index={i}
                      onMouseMove={() => { if (!isActive) setActive(i) }}
                      onClick={() => choose(option)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left",
                        isActive
                          ? "bg-[var(--q-accent)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.2)] dark:bg-[#2563EB]"
                          : "text-[var(--q-ink)]",
                      )}
                    >
                      <OptionBody option={option} active={isActive} query={term} />
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          {searching && (
            <p className="px-3 py-3 text-[13px] text-[var(--q-text-4)]">Recherche dans vos documents…</p>
          )}
          {failed && (
            <p className="px-3 py-3 text-[13px] text-[var(--q-text-4)]" role="alert">La recherche n&apos;a pas abouti. Réessayez dans un instant.</p>
          )}
          {empty && (
            <p className="px-3 py-8 text-center text-sm text-[var(--q-text-4)]">Aucun résultat pour « {term} ».</p>
          )}
          <p className="sr-only" aria-live="polite">{announce}</p>
        </div>

        <div className="hidden items-center gap-[18px] border-t border-[var(--q-line-soft)] bg-[var(--q-surface-2)] px-[18px] py-3 text-xs text-[var(--q-text-3)] sm:flex">
          <span className="inline-flex items-center gap-1.5"><kbd className="q-kbd">↑↓</kbd>Naviguer</span>
          <span className="inline-flex items-center gap-1.5"><kbd className="q-kbd">↵</kbd>Ouvrir</span>
          <span className="flex-1" />
          <span className="inline-flex items-center gap-1.5"><kbd className="q-kbd">⌘K</kbd>Ouvrir ou fermer</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Contenu d'une ligne selon son type (action, client, facture, devis). */
function OptionBody({ option, active, query }: { option: Option; active: boolean; query: string }) {
  // Méta sur fond bleu : blanc à 95 % (4,8:1 ; à 80 % le texte de 13 px tombait à 3,9:1)
  const meta = active ? "text-white/95" : "text-[var(--q-text-4)]"

  if (option.kind === "action") {
    const Icon = option.icon
    return (
      <>
        <span className={cn(
          "grid size-[30px] shrink-0 place-items-center rounded-lg",
          active ? "bg-white/[.18]" : "bg-[var(--q-neutral-bg)] text-[var(--q-text-3)]",
        )}>
          <Icon className="size-4" strokeWidth={2} aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className={cn("truncate text-[15px]", active && "font-semibold")}>{option.label}</span>
          {option.hint && <span className={cn("hidden truncate text-[13px] sm:inline", meta)}>{option.hint}</span>}
        </span>
        {active && <Enter />}
      </>
    )
  }

  if (option.kind === "client") {
    return (
      <>
        <span className="q-avatar q-avatar-ink !size-[30px] shrink-0 !rounded-lg !text-[11px]" aria-hidden>{initialsOf(option.hit.name)}</span>
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="truncate text-[15px] font-semibold"><Highlight text={option.hit.name} query={query} /></span>
          <span className={cn("q-num text-xs sm:truncate", meta)}>{option.hit.meta}</span>
        </span>
        {active && <Enter />}
      </>
    )
  }

  const { hit } = option
  return (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-px sm:flex-row sm:items-center sm:gap-3">
        <span className={cn("shrink-0 font-mono text-[13px] sm:min-w-[96px]", active ? "text-white/95" : "text-[var(--q-text-3)]")}>
          <Highlight text={hit.number} query={query} />
        </span>
        <span className="truncate text-sm">{hit.client ? <Highlight text={hit.client} query={query} /> : "Sans client"}</span>
      </span>
      <span className="q-num shrink-0 text-sm font-semibold">{formatCurrency(hit.amount)}</span>
      <DocStatusPill kind={option.kind} status={hit.status} className="shrink-0" />
    </>
  )
}

function Enter() {
  return (
    <kbd className="hidden rounded-md bg-white/20 px-[7px] py-0.5 font-mono text-xs sm:inline-flex" aria-hidden>
      <CornerDownLeft className="size-3.5" aria-hidden />
    </kbd>
  )
}
