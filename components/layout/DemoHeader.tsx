'use client'

import { Bell, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import Link from "next/link"
import { usePathname } from "next/navigation"

const PAGE_TITLES: Record<string, string> = {
  "/demo": "Tableau de bord",
  "/demo/invoices": "Factures",
  "/demo/invoices/new": "Nouvelle facture",
  "/demo/quotes": "Devis",
  "/demo/clients": "Clients",
  "/demo/settings": "Paramètres",
  "/demo/settings/ppf": "Connexion PPF",
}

export function DemoHeader() {
  const pathname = usePathname()
  const title = PAGE_TITLES[pathname] ?? "Qonforme"

  return (
    <header className="h-16 border-b border-[#E2E8F0] bg-white px-6 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-[#0F172A]">{title}</h1>
        {/* Bannière démo discrète */}
        <span className="hidden sm:inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
          ✦ Données de démonstration
        </span>
      </div>

      <div className="flex items-center gap-3">
        {pathname === "/demo/invoices" && (
          <Link href="/demo/invoices/new">
            <Button size="sm" className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white gap-1.5">
              <Plus className="w-4 h-4" />
              Nouvelle facture
            </Button>
          </Link>
        )}
        {pathname === "/demo/clients" && (
          <Button size="sm" className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white gap-1.5">
            <Plus className="w-4 h-4" />
            Nouveau client
          </Button>
        )}

        <Button variant="ghost" size="icon" className="text-slate-500">
          <Bell className="w-5 h-5" />
        </Button>

        <div className="flex items-center gap-2">
          <Avatar className="w-8 h-8">
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
