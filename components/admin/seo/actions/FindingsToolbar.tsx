"use client"

/**
 * Barre d'outils de « Pages à améliorer » : recherche, type de page, menu
 * « Filtres » (source), puce « Avec suggestions ». Tout passe par l'adresse
 * (filtres partageables) ; la recherche attend 300 ms après la frappe.
 */
import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, SlidersHorizontal, Sparkles, X } from "lucide-react"
import { SearchField } from "@/components/app/kit"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { FINDING_SOURCE_LABELS, PAGE_TYPE_LABELS, type FindingSource, type PageType } from "@/lib/seo/types"
import { actionsHref, type ActionsQuery } from "@/components/admin/seo/actions/url"

const SOURCES = Object.keys(FINDING_SOURCE_LABELS) as FindingSource[]
const TYPES = Object.keys(PAGE_TYPE_LABELS) as PageType[]

export function FindingsToolbar({ query, ruleLabel }: { query: ActionsQuery; ruleLabel?: string | null }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [text, setText] = useState(query.q)
  const first = useRef(true)
  // Dernière recherche connue de l'adresse : celle que la frappe y a écrite, ou celle
  // reçue d'un lien (« Effacer les filtres ») ou du bouton Retour.
  const synced = useRef(query.q)

  const go = (next: Partial<ActionsQuery>) => {
    if (next.q !== undefined) synced.current = next.q
    startTransition(() => router.replace(actionsHref({ ...query, ...next }), { scroll: false }))
  }

  // L'adresse a changé sans la frappe : le champ reprend sa recherche (sans relancer
  // la recherche, ni écraser une frappe en cours après notre propre mise à jour).
  useEffect(() => {
    if (query.q === synced.current) return
    synced.current = query.q
    setText(query.q)
  }, [query.q])

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const t = setTimeout(() => {
      if (text.trim() !== query.q) go({ q: text.trim() })
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seule la frappe relance la recherche
  }, [text])

  const sourceActive = query.source !== null
  return (
    <div className="flex flex-col gap-2 px-5 pb-4 pt-2" aria-busy={pending}>
      <div className="flex flex-wrap items-center gap-2">
        <SearchField
          value={text}
          onChange={setText}
          placeholder="Rechercher une page ou un constat…"
          aria-label="Rechercher une page ou un constat"
          className="min-w-0 basis-full sm:flex-1 sm:basis-[280px]"
        />
        <div className="-mx-5 flex max-w-[calc(100%+40px)] gap-2 overflow-x-auto px-5 [scrollbar-width:none] sm:mx-0 sm:max-w-none sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
          <label className="relative inline-flex shrink-0 items-center">
            <span className="sr-only">Type de page</span>
            <select
              value={query.type ?? ""}
              onChange={(e) => go({ type: (e.target.value || null) as PageType | null })}
              className="q-input h-11 w-auto appearance-none pr-9 text-base font-semibold md:h-[42px] md:text-sm"
            >
              <option value="">Tous les types de page</option>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {PAGE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 size-4 text-[var(--q-text-4)]" aria-hidden />
          </label>

          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                "q-btn q-btn-secondary h-11 shrink-0 md:h-[42px]",
                sourceActive && "border-[var(--q-accent)] text-[var(--q-accent-strong)]",
              )}
              aria-label={sourceActive ? `Filtres : source ${FINDING_SOURCE_LABELS[query.source as FindingSource]}` : "Filtres"}
            >
              <SlidersHorizontal aria-hidden />
              Filtres{sourceActive ? " · 1" : ""}
              <ChevronDown aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={6} className="w-[240px]">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="px-2 py-1.5 text-xs font-semibold text-[var(--q-text-4)]">Source</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={query.source ?? ""} onValueChange={(v) => go({ source: ((v as string) || null) as FindingSource | null })}>
                  <DropdownMenuRadioItem value="" className="min-h-11 px-2 text-sm md:min-h-10">
                    Toutes les sources
                  </DropdownMenuRadioItem>
                  {SOURCES.map((s) => (
                    <DropdownMenuRadioItem key={s} value={s} className="min-h-11 px-2 text-sm md:min-h-10">
                      {FINDING_SOURCE_LABELS[s]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            type="button"
            aria-pressed={query.suggestions}
            onClick={() => go({ suggestions: !query.suggestions })}
            className={cn(
              "inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition-colors md:h-[42px]",
              query.suggestions
                ? "border-[var(--q-accent)] bg-[var(--q-wash)] text-[var(--q-accent-strong)]"
                : "border-[var(--q-field)] bg-[var(--q-surface)] text-[var(--q-text-2)]",
            )}
          >
            <Sparkles className="size-4" aria-hidden />
            Avec suggestions
          </button>
        </div>
      </div>
      {query.regle && ruleLabel && (
        <p className="flex flex-wrap items-center gap-2 text-[13px] text-[var(--q-text-3)]">
          Règle : <span className="font-semibold text-[var(--q-ink)]">{ruleLabel}</span>
          <button type="button" onClick={() => go({ regle: null })} className="q-link inline-flex min-h-11 items-center gap-1 font-semibold md:min-h-0">
            <X className="size-3.5" aria-hidden />
            Retirer ce filtre
          </button>
        </p>
      )}
    </div>
  )
}
