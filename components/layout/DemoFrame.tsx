"use client"

import { usePathname } from "next/navigation"
import { AppShellFrame } from "@/components/layout/AppShell"
import { DEMO_IDENTITY, DEMO_NEW_IDENTITY } from "@/components/layout/shell"
import type { SalesCounts } from "@/components/layout/SalesRail"
import { DEMO_QUOTES, DEMO_PURCHASE_ORDERS, DEMO_INVOICES, DEMO_CREDIT_NOTES } from "@/lib/demo/data"

/** Totaux des pastilles du rail des ventes : les mêmes données que les listes de la démo. */
const DEMO_SALES_COUNTS: SalesCounts = {
  quotes: DEMO_QUOTES.length,
  "purchase-orders": DEMO_PURCHASE_ORDERS.length,
  invoices: DEMO_INVOICES.length,
  "credit-notes": DEMO_CREDIT_NOTES.length,
}

/**
 * Coque de la démo. La page de règlement (/demo/regler/…) est celle que voit le
 * client de l'artisan : comme la vraie (/regler/…), elle s'affiche seule, sans
 * barre latérale ni navigation de l'application. De même pour l'espace du
 * comptable invité (/demo/comptable…), qui a sa propre coque, et pour l'écran
 * de démarrage (/demo/demarrer), comme le vrai (/demarrer), étape de l'inscription.
 * Le tableau de bord d'un compte neuf (/demo/bienvenue) garde la coque, avec
 * l'identité d'un artisan qui vient de s'inscrire (ni entreprise ni formule).
 */
export function DemoFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (pathname?.startsWith("/demo/regler/") || pathname === "/demo/demarrer") return <>{children}</>
  if (pathname === "/demo/comptable" || pathname?.startsWith("/demo/comptable/")) return <>{children}</>
  return <AppShellFrame salesCounts={DEMO_SALES_COUNTS} identity={pathname === "/demo/bienvenue" ? DEMO_NEW_IDENTITY : DEMO_IDENTITY}>{children}</AppShellFrame>
}
