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
  LogOut,
  ChevronRight,
  RotateCcw,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

const navItems = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/invoices", label: "Factures", icon: FileText },
  { href: "/quotes", label: "Devis", icon: FileCheck2 },
  { href: "/credit-notes", label: "Avoirs", icon: RotateCcw },
  { href: "/clients", label: "Clients", icon: Users },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    toast.success("À bientôt !")
    router.push("/login")
    router.refresh()
  }

  return (
    <aside className="w-64 flex flex-col border-r border-[#E2E8F0] bg-white shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-[#E2E8F0]">
        <div className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center shrink-0">
          <Zap className="w-4.5 h-4.5 text-white" />
        </div>
        <span className="text-lg font-bold text-[#0F172A]">Qonforme</span>
      </div>

      {/* Navigation principale */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href))
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

      {/* Bas sidebar */}
      <div className="px-3 py-4 border-t border-[#E2E8F0] space-y-1">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
            pathname.startsWith("/settings")
              ? "bg-[#EFF6FF] text-[#2563EB]"
              : "text-slate-600 hover:bg-slate-50 hover:text-[#0F172A]"
          )}
        >
          <Settings className="w-4 h-4" />
          Paramètres
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all duration-150 w-full"
        >
          <LogOut className="w-4 h-4" />
          Se déconnecter
        </button>
      </div>
    </aside>
  )
}
