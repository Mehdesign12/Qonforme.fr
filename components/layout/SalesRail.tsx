'use client'

/**
 * Rail des ventes (mobile) : devis → bons de commande → factures, puis avoirs,
 * en tête des quatre listes (maquette « rail B », 23/10/2026). Il remplace
 * l'entrée de menu par type de document sur téléphone. Le bon de commande est
 * facultatif (le devis signé vaut commande) : trait en pointillé après lui.
 *
 * Partagé avec la démo (même composant, chemins /demo). Ni backdrop-filter ni
 * will-change (règle iOS de CLAUDE.md).
 */
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { NAV_MAIN, SALES_KEYS, hrefFor, type ShellMode } from "@/components/layout/nav"

/** Les écrans qui portent le rail : la racine de chaque liste, pas les fiches ni les formulaires. */
export function salesRailMode(pathname: string | null): ShellMode | null {
  if (!pathname) return null
  const demo = pathname === "/demo" || pathname.startsWith("/demo/")
  const mode: ShellMode = demo ? "demo" : "app"
  const roots = SALES_KEYS.map((k) => hrefFor(NAV_MAIN.find((l) => l.key === k)!, mode))
  return roots.includes(pathname.replace(/\/$/, "")) ? mode : null
}

export function SalesRail() {
  const pathname = usePathname()
  const mode = salesRailMode(pathname)
  if (!mode) return null
  const steps = SALES_KEYS.map((k) => NAV_MAIN.find((l) => l.key === k)!)
  const current = pathname.replace(/\/$/, "")
  return (
    <nav aria-label="Chaîne des ventes" className="q-card px-3.5 pb-3.5 pt-4 lg:hidden print:hidden">
      <ol className="flex items-start">
        {steps.map((link, i) => {
          const href = hrefFor(link, mode)
          const active = href === current
          const Icon = link.icon
          return (
            <li key={link.key} className="contents">
              {i > 0 && (
                <span
                  aria-hidden
                  className={cn("mt-[22px] h-px min-w-3 flex-[0_0_14px]", i === 2 ? "border-t border-dashed border-[var(--q-field)]" : "bg-[var(--q-field)]")}
                />
              )}
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn("flex min-w-0 flex-1 flex-col items-center gap-1.5 text-[11px] font-semibold touch-manipulation", active ? "text-[var(--q-accent-strong)]" : "text-[var(--q-text-3)]")}
              >
                <span
                  className={cn(
                    "grid size-[46px] place-items-center rounded-full border-[1.5px]",
                    active ? "border-[var(--q-accent)] bg-[var(--q-accent)] text-white" : "border-[var(--q-line)] bg-[var(--q-surface)] text-[var(--q-text-2)]",
                    link.key === "purchase-orders" && !active && "border-dashed",
                  )}
                >
                  <Icon className="size-[22px]" strokeWidth={1.75} aria-hidden />
                </span>
                <span className="whitespace-nowrap">{link.label}</span>
              </Link>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
