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
import { useEffect, useState } from "react"
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

/** Nombre de documents par type (clés = clés de navigation) ; `null` : inconnu, pas de chiffre. */
export type SalesCounts = Record<(typeof SALES_KEYS)[number], number | null>

const FROM_API: Record<string, (typeof SALES_KEYS)[number]> = {
  quotes: "quotes", purchaseOrders: "purchase-orders", invoices: "invoices", creditNotes: "credit-notes",
}

/** Démo : totaux fournis par la coque. Application : lus une fois sur la liste affichée, jamais bloquants. */
function useSalesCounts(active: boolean, demoCounts?: SalesCounts): SalesCounts | null {
  const [counts, setCounts] = useState<SalesCounts | null>(null)
  const pathname = usePathname()
  useEffect(() => {
    if (!active || demoCounts) return
    let cancelled = false
    fetch("/api/sales-counts", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Record<string, unknown> | null) => {
        if (cancelled || !j) return
        const next = { quotes: null, "purchase-orders": null, invoices: null, "credit-notes": null } as SalesCounts
        for (const [k, key] of Object.entries(FROM_API)) next[key] = typeof j[k] === "number" ? (j[k] as number) : null
        setCounts(next)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [active, demoCounts, pathname])
  return demoCounts ?? counts
}

export function SalesRail({ demoCounts }: { demoCounts?: SalesCounts }) {
  const pathname = usePathname()
  const mode = salesRailMode(pathname)
  const counts = useSalesCounts(mode !== null, demoCounts)
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
                    "relative grid size-[46px] place-items-center rounded-full border-[1.5px]",
                    active ? "border-[var(--q-accent)] bg-[var(--q-accent)] text-white" : "border-[var(--q-line)] bg-[var(--q-surface)] text-[var(--q-text-2)]",
                    link.key === "purchase-orders" && !active && "border-dashed",
                  )}
                >
                  <Icon className="size-[22px]" strokeWidth={1.75} aria-hidden />
                  {counts?.[link.key as keyof SalesCounts] != null && (
                    <span
                      className={cn(
                        "absolute -right-2 -top-1.5 min-w-5 rounded-full px-1.5 text-center text-[11px] font-semibold leading-5 tabular-nums",
                        active ? "bg-[var(--q-surface)] text-[var(--q-accent-strong)] shadow-[0_0_0_1.5px_var(--q-accent)]" : "bg-[var(--q-ink)] text-[var(--q-surface)]",
                      )}
                    >
                      {counts[link.key as keyof SalesCounts]}
                    </span>
                  )}
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
