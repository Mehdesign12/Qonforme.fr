"use client"

import { usePathname } from "next/navigation"
import { AppShellFrame } from "@/components/layout/AppShell"
import { DEMO_IDENTITY } from "@/components/layout/shell"

/**
 * Coque de la démo. La page de règlement (/demo/regler/…) est celle que voit le
 * client de l'artisan : comme la vraie (/regler/…), elle s'affiche seule, sans
 * barre latérale ni navigation de l'application. De même pour l'espace du
 * comptable invité (/demo/comptable…), qui a sa propre coque, et pour l'écran
 * de démarrage (/demo/demarrer), comme le vrai (/demarrer), étape de l'inscription.
 */
export function DemoFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (pathname?.startsWith("/demo/regler/") || pathname === "/demo/demarrer") return <>{children}</>
  if (pathname === "/demo/comptable" || pathname?.startsWith("/demo/comptable/")) return <>{children}</>
  return <AppShellFrame identity={DEMO_IDENTITY}>{children}</AppShellFrame>
}
