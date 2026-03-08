'use client'

import { Bell, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import Link from "next/link"
import { usePathname } from "next/navigation"

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Tableau de bord",
  "/invoices": "Factures",
  "/invoices/new": "Nouvelle facture",
  "/quotes": "Devis",
  "/quotes/new": "Nouveau devis",
  "/clients": "Clients",
  "/settings": "Paramètres",
  "/settings/company": "Mon entreprise",
  "/settings/billing": "Abonnement",
  "/settings/ppf": "Connexion PPF",
}

export function Header() {
  const pathname = usePathname()
  const title = PAGE_TITLES[pathname] ?? "Qonforme"

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
