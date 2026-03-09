'use client'

import { Bell, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import Link from "next/link"
import { usePathname } from "next/navigation"

/* ------------------------------------------------------------------ */
/* Titres de pages — correspondance exacte en priorité                 */
/* ------------------------------------------------------------------ */

const PAGE_TITLES: Record<string, string> = {
  "/dashboard":           "Tableau de bord",
  "/invoices":            "Factures",
  "/invoices/new":        "Nouvelle facture",
  "/quotes":              "Devis",
  "/quotes/new":          "Nouveau devis",
  "/clients":             "Clients",
  "/clients/new":         "Nouveau client",
  "/products":            "Catalogue produits",
  "/purchase-orders":     "Bons de commande",
  "/purchase-orders/new": "Nouveau bon de commande",
  "/settings":            "Paramètres",
  "/settings/company":    "Mon entreprise",
  "/settings/billing":    "Abonnement",
  "/settings/ppf":        "Connexion PPF",
  "/credit-notes":        "Avoirs",
}

/* Préfixes pour les routes dynamiques (/:id, /:id/edit, etc.) */
const PREFIX_TITLES: { prefix: string; title: string }[] = [
  { prefix: "/purchase-orders/", title: "Bons de commande" },
  { prefix: "/invoices/",        title: "Factures" },
  { prefix: "/quotes/",          title: "Devis" },
  { prefix: "/clients/",         title: "Clients" },
  { prefix: "/credit-notes/",    title: "Avoirs" },
]

function getTitle(pathname: string): string {
  // 1. Correspondance exacte
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  // 2. Correspondance par préfixe (pages dynamiques /[id], /[id]/edit…)
  for (const { prefix, title } of PREFIX_TITLES) {
    if (pathname.startsWith(prefix)) return title
  }
  return "Qonforme"
}

/* ------------------------------------------------------------------ */
/* Composant                                                            */
/* ------------------------------------------------------------------ */

export function Header() {
  const pathname = usePathname()
  const title    = getTitle(pathname)

  return (
    <header className="h-16 border-b border-[#E2E8F0] bg-white px-6 flex items-center justify-between shrink-0">
      <h1 className="text-lg font-semibold text-[#0F172A]">{title}</h1>

      <div className="flex items-center gap-3">
        {/* CTA contextuel — uniquement pour les pages sans bouton dans le contenu */}
        {pathname === "/clients" && (
          <Link href="/clients/new">
            <Button size="sm" className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white gap-1.5">
              <Plus className="w-4 h-4" />
              Nouveau client
            </Button>
          </Link>
        )}

        <Button variant="ghost" size="icon" className="text-slate-500">
          <Bell className="w-5 h-5" />
        </Button>

        <Avatar className="w-8 h-8">
          <AvatarFallback className="bg-[#EFF6FF] text-[#2563EB] text-xs font-semibold">
            JD
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}
