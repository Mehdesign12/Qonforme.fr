"use client"

/**
 * Menu de filtre de l'onglet Performance (« Appareil : Tous », « Pays : France »,
 * « Page : /modele ») : liste déroulante native habillée en petit bouton
 * secondaire. Le choix change l'adresse (`?appareil=`, `?pays=`, `?chemin=`),
 * la page serveur relit les données. 16 px et 44 px de haut sur téléphone (règle
 * iOS de CLAUDE.md, cibles tactiles).
 */
import { useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ChevronDown, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export function FilterMenu({
  label,
  param,
  value,
  options,
  size = "sm",
  mono,
  className,
}: {
  /** Libellé affiché avant la valeur (« Appareil »). */
  label: string
  param: string
  value: string
  options: { value: string; label: string }[]
  size?: "sm" | "md"
  /** Valeur en DM Mono (chemins). */
  mono?: boolean
  className?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  const onChange = (next: string) => {
    const qs = new URLSearchParams(searchParams?.toString() ?? "")
    qs.set(param, next)
    startTransition(() => router.push(`${pathname}?${qs}`, { scroll: false }))
  }

  return (
    <label
      className={cn(
        "q-btn q-btn-secondary q-fw relative min-w-0 cursor-pointer gap-1.5 pr-8",
        size === "sm" ? "q-btn-sm" : "",
        // Cible de 44 px sur téléphone
        "max-md:h-11",
        pending && "opacity-70",
        className,
      )}
    >
      <span className="shrink-0 font-medium text-[var(--q-text-3)]">{label}&nbsp;:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className={cn(
          "min-w-0 cursor-pointer appearance-none truncate bg-transparent text-base font-semibold text-[var(--q-ink)] outline-none",
          size === "sm" ? "md:text-[13px]" : "md:text-sm",
          mono && "font-mono font-medium",
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {pending ? (
        <Loader2 className="pointer-events-none absolute right-3 animate-spin" aria-hidden />
      ) : (
        <ChevronDown className="pointer-events-none absolute right-3 text-[var(--q-text-4)]" aria-hidden />
      )}
    </label>
  )
}
