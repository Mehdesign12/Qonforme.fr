'use client'

/**
 * Choix du client d'un document : bouton riche (initiales, nom, SIREN ou
 * ville), liste déroulante sur ordinateur, feuille du bas sur mobile.
 * Canevas « Nouveau devis » (Pour qui ?) et « Mobile-devis-creation ».
 */
import { useEffect, useId, useRef, useState } from "react"
import Link from "next/link"
import { Check, ChevronsUpDown, Plus, Search } from "lucide-react"
import { Initials } from "@/components/app/kit"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { clientSubtitle, type DocClient } from "./model"
import { useIsMobile } from "./useIsMobile"

export function ClientPicker({
  clients,
  value,
  onChange,
  newClientHref,
  invalid,
  describedBy,
}: {
  clients: DocClient[]
  value: string
  onChange: (id: string) => void
  newClientHref: string
  invalid?: boolean
  describedBy?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const isMobile = useIsMobile()
  const rootRef = useRef<HTMLDivElement>(null)
  const sheetHeadRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const selected = clients.find((c) => c.id === value) ?? null

  // Ordinateur : clic à l'extérieur et Échap ferment la liste
  useEffect(() => {
    if (!open || isMobile) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open, isMobile])

  useEffect(() => { if (!open) setSearch("") }, [open])

  const q = search.trim().toLowerCase()
  const visible = q
    ? clients.filter((c) => c.name.toLowerCase().includes(q) || (c.siren ?? "").includes(q.replace(/\s/g, "")) || (c.city ?? "").toLowerCase().includes(q))
    : clients

  const pick = (id: string) => {
    onChange(id)
    setOpen(false)
  }

  const options = (
    <>
      {clients.length > 6 && (
        <label className="q-fw mb-1 flex h-[42px] shrink-0 items-center gap-2 rounded-[10px] border border-[var(--q-field)] bg-[var(--q-surface)] px-3">
          <Search className="size-4 shrink-0 text-[var(--q-text-4)]" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un client…"
            aria-label="Rechercher un client"
            autoFocus={!isMobile}
            className="h-full min-w-0 flex-1 bg-transparent text-base text-[var(--q-ink)] outline-none placeholder:text-[var(--q-placeholder)] md:text-sm"
          />
        </label>
      )}
      <div id={listId} role="listbox" aria-label="Clients" className="flex flex-col gap-0.5">
        {visible.map((c) => {
          const on = c.id === value
          return (
            <button
              key={c.id}
              type="button"
              role="option"
              aria-selected={on}
              onClick={() => pick(c.id)}
              className="flex min-h-[52px] w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-left text-[var(--q-ink)] transition-colors hover:bg-[var(--q-hover)] focus-visible:bg-[var(--q-hover)] focus-visible:outline-none"
            >
              <Initials name={c.name} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-semibold md:text-sm">{c.name}</span>
                <span className="truncate text-[13px] text-[var(--q-text-4)] md:text-xs">{clientSubtitle(c)}</span>
              </span>
              {on && <Check className="size-4 shrink-0 text-[var(--q-accent)]" strokeWidth={2.5} aria-hidden />}
            </button>
          )
        })}
        {visible.length === 0 && (
          <p className="px-2.5 py-4 text-sm text-[var(--q-text-4)]">Aucun client ne correspond.</p>
        )}
      </div>
      <Link
        href={newClientHref}
        className="mt-1 flex min-h-[44px] items-center gap-2.5 rounded-[10px] border-t border-[var(--q-line-soft)] px-2.5 text-sm font-semibold text-[var(--q-accent-strong)] hover:bg-[var(--q-hover)]"
      >
        <Plus className="size-4" strokeWidth={2.25} aria-hidden />
        Nouveau client
      </Link>
    </>
  )

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open && !isMobile ? listId : undefined}
        aria-describedby={describedBy}
        data-invalid={invalid || undefined}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border bg-[var(--q-surface)] px-3 py-2.5 text-left text-[var(--q-ink)] transition-[border-color,box-shadow] focus-visible:border-[var(--q-accent)] focus-visible:shadow-[0_0_0_4px_var(--q-focus)] focus-visible:outline-none",
          invalid ? "border-[var(--q-danger)] shadow-[0_0_0_4px_var(--q-danger-bg)]" : "border-[var(--q-field)]",
        )}
      >
        {selected ? (
          <Initials name={selected.name} ink className="!size-9 !rounded-[10px]" />
        ) : (
          <span className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-dashed border-[var(--q-field)] text-[var(--q-text-4)]" aria-hidden>
            <Plus className="size-4" />
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span className={cn("truncate text-[15px] font-semibold", !selected && "text-[var(--q-text-3)]")}>
            {selected ? selected.name : "Choisir un client"}
          </span>
          <span className="truncate text-xs text-[var(--q-text-4)]">
            {selected ? clientSubtitle(selected) : `${clients.length} client${clients.length > 1 ? "s" : ""} enregistré${clients.length > 1 ? "s" : ""}`}
          </span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-[var(--q-text-4)]" aria-hidden />
      </button>

      {/* Ordinateur : liste sous le bouton */}
      {open && !isMobile && (
        <div className="q-pop absolute inset-x-0 top-[calc(100%+6px)] z-20 max-h-[360px] overflow-auto">
          {options}
        </div>
      )}

      {/* Mobile : feuille du bas */}
      {isMobile && (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            // Au doigt, pas de clavier qui surgit sur la recherche : le focus va au titre
            initialFocus={(type) => (type === "keyboard" ? true : sheetHeadRef.current)}
            className="max-h-[80dvh] gap-3 overflow-auto px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-2"
          >
            <span className="q-sheet-grip !mt-0" aria-hidden />
            <div ref={sheetHeadRef} tabIndex={-1} className="flex flex-col gap-1 pr-10 outline-none">
              <SheetTitle className="q-display text-[22px] text-[var(--q-ink)]">Pour qui ?</SheetTitle>
              <SheetDescription className="text-sm text-[var(--q-text-4)]">Choisissez un client existant.</SheetDescription>
            </div>
            {options}
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}
