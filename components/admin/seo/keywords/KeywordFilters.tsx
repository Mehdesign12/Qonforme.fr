"use client"

/**
 * Recherche et menu « Intention » de la liste des mots-clés, reportés dans
 * l'adresse (`?q=`, `?intention=`) : la page serveur filtre. La recherche part
 * après 300 ms sans frappe. Sur téléphone, le menu devient un bouton
 * « entonnoir » de 48 px (sélecteur natif du système par-dessus).
 */
import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ChevronDown, Funnel, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { KEYWORD_INTENT_LABELS } from "@/lib/seo/types"
import { KEYWORD_INTENTS } from "@/lib/seo/keywords/types"

const OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Intention : toutes" },
  ...KEYWORD_INTENTS.map((i) => ({ value: i, label: KEYWORD_INTENT_LABELS[i] })),
  { value: "aucune", label: "Non précisée" },
]

export function KeywordFilters({ q, intention }: { q: string; intention: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [search, setSearch] = useState(q)
  const lastPushed = useRef(q)

  const go = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params.toString())
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
    next.delete("page")
    next.delete("mot-cle")
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  // Filtres effacés par un lien (« Effacer les filtres ») : le champ suit l'adresse.
  useEffect(() => {
    if (q !== lastPushed.current) {
      lastPushed.current = q
      setSearch(q)
    }
  }, [q])

  useEffect(() => {
    const value = search.trim()
    if (value === lastPushed.current) return
    const timer = setTimeout(() => {
      lastPushed.current = value
      go({ q: value })
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const intentLabel = OPTIONS.find((o) => o.value === intention)?.label ?? OPTIONS[0].label

  return (
    <div className="flex items-center gap-2 md:flex-wrap md:justify-between md:gap-3">
      <label className="q-fw relative flex h-12 min-w-0 flex-1 items-center gap-2 rounded-[10px] border border-[var(--q-field)] bg-[var(--q-surface)] px-3 md:h-[42px] md:max-w-[380px] md:flex-[1_1_280px]">
        <Search className="size-4 shrink-0 text-[var(--q-text-4)]" aria-hidden />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un mot-clé"
          aria-label="Rechercher un mot-clé"
          className="h-full w-full min-w-0 bg-transparent text-base text-[var(--q-ink)] outline-none placeholder:text-[var(--q-placeholder)] md:text-sm"
        />
      </label>

      {/* Ordinateur : menu déroulant de 220 px */}
      <div className="relative hidden w-[220px] md:block">
        <select
          aria-label="Intention"
          value={intention}
          onChange={(e) => go({ intention: e.target.value })}
          className="q-input appearance-none pr-9"
        >
          {OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[var(--q-text-4)]" aria-hidden />
      </div>

      {/* Téléphone : bouton entonnoir, sélecteur natif par-dessus (16 px : pas de zoom iOS) */}
      <div
        className={cn(
          // q-fw : anneau de focus visible quand le sélecteur transparent a le focus clavier.
          "q-fw relative grid size-12 shrink-0 place-items-center rounded-[10px] border bg-[var(--q-surface)] shadow-[0_1px_2px_rgba(10,17,34,.05)] md:hidden",
          intention ? "border-[var(--q-accent)] text-[var(--q-accent-strong)]" : "border-[var(--q-field)] text-[var(--q-ink)]",
        )}
      >
        <Funnel className="size-[18px]" aria-hidden />
        <select
          aria-label={`Filtrer par intention (${intentLabel})`}
          value={intention}
          onChange={(e) => go({ intention: e.target.value })}
          className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 text-base"
        >
          {OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
