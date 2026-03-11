'use client'

import { useState } from "react"
import { Bell, Plus, Menu, FileText, FileCheck2, ShoppingCart } from "lucide-react"
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
  "/settings/invoices":   "Préférences factures",
  "/settings/notifications": "Notifications",
  "/credit-notes":        "Avoirs",
}

const PREFIX_TITLES: { prefix: string; title: string }[] = [
  { prefix: "/purchase-orders/", title: "Bons de commande" },
  { prefix: "/invoices/",        title: "Factures"         },
  { prefix: "/quotes/",          title: "Devis"            },
  { prefix: "/clients/",         title: "Clients"          },
  { prefix: "/credit-notes/",    title: "Avoirs"           },
]

function getTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  for (const { prefix, title } of PREFIX_TITLES) {
    if (pathname.startsWith(prefix)) return title
  }
  return "Qonforme"
}

/* ------------------------------------------------------------------ */
/* CTA contextuels par route                                            */
/* ------------------------------------------------------------------ */

interface CtaConfig {
  href:  string
  label: string
  icon:  React.ElementType
}

const PAGE_CTA: Record<string, CtaConfig> = {
  "/invoices":        { href: "/invoices/new",        label: "Nouvelle facture",  icon: FileText    },
  "/quotes":          { href: "/quotes/new",           label: "Nouveau devis",     icon: FileCheck2  },
  "/clients":         { href: "/clients/new",          label: "Nouveau client",    icon: Plus        },
  "/purchase-orders": { href: "/purchase-orders/new",  label: "Nouveau BdC",       icon: ShoppingCart },
  "/products":        { href: "/products",             label: "Nouveau produit",   icon: Plus        },
}

/* ------------------------------------------------------------------ */
/* Composant                                                            */
/* ------------------------------------------------------------------ */

export function Header() {
  const pathname           = usePathname()
  const title              = getTitle(pathname)
  const cta                = PAGE_CTA[pathname]
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <>
      <header className="h-14 md:h-[60px] border-b border-[#E2E8F0] bg-white px-4 md:px-6 flex items-center justify-between shrink-0 gap-3">

        {/* Gauche : hamburger (mobile) + titre */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Bouton hamburger — visible uniquement mobile */}
          <button
            className="md:hidden p-2 -ml-1 rounded-lg hover:bg-[#F1F5F9] transition-colors shrink-0 text-slate-400 hover:text-slate-600"
            onClick={() => setDrawerOpen(true)}
            aria-label="Ouvrir le menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <h1 className="text-[15px] md:text-base font-semibold text-[#0F172A] truncate">
            {title}
          </h1>
        </div>

        {/* Droite : CTA contextuel + cloche + avatar */}
        <div className="flex items-center gap-2 shrink-0">

          {/* CTA contextuel — texte complet sur sm+, icône seule sur xs */}
          {cta && (
            <Link href={cta.href}>
              <button className="hidden sm:inline-flex items-center gap-1.5 rounded-[8px] bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white text-[13px] font-semibold px-3.5 py-2 transition-colors">
                <Plus className="w-3.5 h-3.5" />
                {cta.label}
              </button>
              {/* Version icône seule sur très petit écran */}
              <button className="sm:hidden inline-flex items-center justify-center w-8 h-8 rounded-[8px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </Link>
          )}

          {/* Cloche */}
          <button className="flex items-center justify-center w-8 h-8 md:w-9 md:h-9 rounded-lg text-slate-400 hover:bg-[#F1F5F9] hover:text-slate-600 transition-colors relative">
            <Bell className="w-4 h-4 md:w-[18px] md:h-[18px]" />
          </button>

          {/* Avatar */}
          <Avatar className="w-8 h-8 cursor-pointer">
            <AvatarFallback className="bg-[#EFF6FF] text-[#2563EB] text-[11px] font-bold border border-[#BFDBFE]">
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
