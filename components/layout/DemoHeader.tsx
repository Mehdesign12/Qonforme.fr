'use client'

import { Bell, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import Link from "next/link"
import { usePathname } from "next/navigation"

const PAGE_TITLES: Record<string, string> = {
  "/demo":                  "Tableau de bord",
  "/demo/invoices":         "Factures",
  "/demo/invoices/new":     "Nouvelle facture",
  "/demo/quotes":           "Devis",
  "/demo/clients":          "Clients",
  "/demo/products":         "Produits",
  "/demo/purchase-orders":  "Bons de commande",
  "/demo/credit-notes":     "Avoirs",
  "/demo/settings":         "Paramètres",
  "/demo/settings/ppf":     "Connexion PPF",
}

export function DemoHeader() {
  const pathname = usePathname()
  const title = PAGE_TITLES[pathname] ?? "Qonforme"

  return (
    <header
      className="h-14 md:h-[60px] border-b border-[#E2E8F0] bg-white px-4 md:px-6 flex items-center justify-between shrink-0"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {/* Titre page */}
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        <h1 className="text-base md:text-lg font-semibold text-[#0F172A] truncate">{title}</h1>
        <span className="hidden sm:inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full whitespace-nowrap">
          ✦ Données de démonstration
        </span>
      </div>

      {/* Actions droite */}
      <div className="flex items-center gap-2 md:gap-3 shrink-0">

        {/* CTA contextuel — texte masqué sur mobile, icône seule */}
        {pathname === "/demo/invoices" && (
          <Link href="/demo/invoices/new">
            <Button size="sm" className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white gap-1.5 touch-manipulation">
              <Plus className="w-4 h-4 shrink-0" />
              <span className="hidden xs:inline">Nouvelle facture</span>
            </Button>
          </Link>
        )}
        {pathname === "/demo/clients" && (
          <Button size="sm" className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white gap-1.5 touch-manipulation">
            <Plus className="w-4 h-4 shrink-0" />
            <span className="hidden xs:inline">Nouveau client</span>
          </Button>
        )}
        {pathname === "/demo/quotes" && (
          <Button size="sm" className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-1.5 touch-manipulation">
            <Plus className="w-4 h-4 shrink-0" />
            <span className="hidden xs:inline">Nouveau devis</span>
          </Button>
        )}
        {pathname === "/demo/purchase-orders" && (
          <Button size="sm" className="bg-[#4F46E5] hover:bg-[#4338CA] text-white gap-1.5 touch-manipulation">
            <Plus className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Nouveau BdC</span>
          </Button>
        )}

        <Button variant="ghost" size="icon" className="text-slate-500 touch-manipulation">
          <Bell className="w-5 h-5" />
        </Button>

        {/* Avatar utilisateur */}
        <div className="flex items-center gap-2">
          <Avatar className="w-8 h-8 shrink-0">
            <AvatarFallback className="bg-[#EFF6FF] text-[#2563EB] text-xs font-semibold">
              JD
            </AvatarFallback>
          </Avatar>
          <div className="hidden sm:block">
            <p className="text-xs font-medium text-[#0F172A] leading-none">Jean Dupont</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Plan Pro · Démo</p>
          </div>
        </div>
      </div>
    </header>
  )
}
