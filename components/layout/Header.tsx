'use client'

import { useState } from "react"
import { Bell, Plus, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { MobileSidebar } from "@/components/layout/Sidebar"

/* ------------------------------------------------------------------ */
/* Titres de pages                                                      */
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

const PREFIX_TITLES: { prefix: string; title: string }[] = [
  { prefix: "/purchase-orders/", title: "Bons de commande" },
  { prefix: "/invoices/",        title: "Factures"          },
  { prefix: "/quotes/",          title: "Devis"             },
  { prefix: "/clients/",         title: "Clients"           },
  { prefix: "/credit-notes/",    title: "Avoirs"            },
]

function getTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  for (const { prefix, title } of PREFIX_TITLES) {
    if (pathname.startsWith(prefix)) return title
  }
  return "Qonforme"
}

/* ------------------------------------------------------------------ */
/* Composant                                                            */
/* ------------------------------------------------------------------ */

export function Header() {
  const pathname           = usePathname()
  const title              = getTitle(pathname)
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <>
      <header className="h-14 md:h-16 border-b border-[#E2E8F0] bg-white px-4 md:px-6 flex items-center justify-between shrink-0 gap-3">

        {/* Gauche : hamburger (mobile) + titre */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Bouton hamburger — visible uniquement mobile */}
          <button
            className="md:hidden p-2 -ml-1 rounded-lg hover:bg-[#F1F5F9] transition-colors shrink-0"
            onClick={() => setDrawerOpen(true)}
            aria-label="Ouvrir le menu"
          >
            <Menu className="w-5 h-5 text-slate-600" />
          </button>

          <h1 className="text-base md:text-lg font-semibold text-[#0F172A] truncate">
            {title}
          </h1>
        </div>

        {/* Droite : CTA contextuel + cloche + avatar */}
        <div className="flex items-center gap-2 shrink-0">
          {pathname === "/clients" && (
            <Link href="/clients/new">
              <Button size="sm" className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white gap-1.5 hidden sm:inline-flex">
                <Plus className="w-4 h-4" />
                Nouveau client
              </Button>
              {/* Version icône seule sur très petit écran */}
              <Button size="icon" className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white sm:hidden w-8 h-8">
                <Plus className="w-4 h-4" />
              </Button>
            </Link>
          )}

          <Button variant="ghost" size="icon" className="text-slate-500 w-8 h-8 md:w-9 md:h-9">
            <Bell className="w-4 h-4 md:w-5 md:h-5" />
          </Button>

          <Avatar className="w-7 h-7 md:w-8 md:h-8">
            <AvatarFallback className="bg-[#EFF6FF] text-[#2563EB] text-xs font-semibold">
              JD
            </AvatarFallback>
          </Avatar>
        </div>
      </header>

      {/* Drawer mobile */}
      <MobileSidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  )
}
