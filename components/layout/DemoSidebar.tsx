'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  FileText,
  FileCheck2,
  Users,
  Settings,
  Zap,
  ChevronRight,
  FlaskConical,
  Package,
  ShoppingCart,
  ReceiptText,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/demo",                  label: "Tableau de bord",  icon: LayoutDashboard, exact: true },
  { href: "/demo/invoices",         label: "Factures",         icon: FileText },
  { href: "/demo/quotes",           label: "Devis",            icon: FileCheck2 },
  { href: "/demo/clients",          label: "Clients",          icon: Users },
  { href: "/demo/products",         label: "Produits",         icon: Package },
  { href: "/demo/purchase-orders",  label: "Bons de commande", icon: ShoppingCart },
  { href: "/demo/credit-notes",     label: "Avoirs",           icon: ReceiptText },
  { href: "/demo/settings",         label: "Paramètres",       icon: Settings },
]

export function DemoSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 flex flex-col border-r border-[#E2E8F0] bg-white shrink-0">
      {/* Logo + badge démo */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-[#E2E8F0]">
        <div className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center shrink-0">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <span className="text-lg font-bold text-[#0F172A]">Qonforme</span>
        <span className="ml-auto text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full">
          DÉMO
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-[#EFF6FF] text-[#2563EB]"
                  : "text-slate-600 hover:bg-slate-50 hover:text-[#0F172A]"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {isActive && <ChevronRight className="w-3 h-3" />}
            </Link>
          )
        })}
      </nav>

      {/* Footer sidebar */}
      <div className="px-4 py-4 border-t border-[#E2E8F0]">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200">
          <FlaskConical className="w-4 h-4 text-amber-600 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-amber-700">Mode démo</p>
            <p className="text-[10px] text-amber-600 truncate">Données fictives</p>
          </div>
        </div>
        <Link
          href="/signup"
          className="mt-2 flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-lg bg-[#2563EB] text-white text-xs font-semibold hover:bg-[#1D4ED8] transition-colors"
        >
          Créer mon compte →
        </Link>
      </div>
    </aside>
  )
}
