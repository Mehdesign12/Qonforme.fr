'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, Users, FileText, FileCheck2,
  Settings, Zap, LogOut, ChevronDown,
  Plus, Archive, RotateCcw,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useState, useEffect } from "react"

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

interface SubItem {
  href: string
  label: string
  icon?: React.ElementType
}

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  sub?: SubItem[]
}

/* ------------------------------------------------------------------ */
/* Structure navigation                                                 */
/* ------------------------------------------------------------------ */

const NAV: NavItem[] = [
  {
    href: "/dashboard",
    label: "Tableau de bord",
    icon: LayoutDashboard,
  },
  {
    href: "/clients",
    label: "Clients",
    icon: Users,
  },
  {
    href: "/quotes",
    label: "Devis",
    icon: FileCheck2,
    sub: [
      { href: "/quotes/new", label: "Créer un devis", icon: Plus },
    ],
  },
  {
    href: "/invoices",
    label: "Factures",
    icon: FileText,
    sub: [
      { href: "/credit-notes", label: "Avoirs",   icon: RotateCcw },
      { href: "/invoices?archived=true", label: "Archives", icon: Archive },
    ],
  },
]

/* ------------------------------------------------------------------ */
/* Composant NavGroup                                                   */
/* ------------------------------------------------------------------ */

function NavGroup({ item, pathname }: { item: NavItem; pathname: string }) {
  const isParentActive =
    pathname === item.href ||
    (item.href !== "/dashboard" && pathname.startsWith(item.href))

  const isSubActive = item.sub?.some(
    (s) => pathname === s.href || pathname.startsWith(s.href.split("?")[0])
  )

  const hasChildren = !!item.sub?.length
  const isActive    = isParentActive || !!isSubActive

  const [open, setOpen] = useState(isActive)

  useEffect(() => {
    if (isActive) setOpen(true)
  }, [isActive])

  return (
    <div>
      {/* ── Item principal — tout le bloc est cliquable ── */}
      <button
        onClick={() => {
          if (hasChildren) setOpen((o) => !o)
        }}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
          isActive
            ? "bg-[#EFF6FF] text-[#2563EB]"
            : "text-slate-600 hover:bg-slate-50 hover:text-[#0F172A]"
        )}
      >
        {/* Lien vers la page parent */}
        <Link
          href={item.href}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-3 flex-1 min-w-0"
        >
          <item.icon className="w-4 h-4 shrink-0" />
          <span className="flex-1 text-left truncate">{item.label}</span>
        </Link>

        {/* Chevron intégré — tourne vers le bas quand ouvert */}
        {hasChildren && (
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 shrink-0 transition-transform duration-200",
              open ? "rotate-0" : "-rotate-90"
            )}
          />
        )}
      </button>

      {/* ── Sous-menu avec ligne verticale solide ── */}
      {hasChildren && open && (
        <div className="relative ml-[22px] mt-0.5 mb-1">
          {/* Ligne verticale continue */}
          <span className="absolute left-0 top-0 bottom-0 w-px bg-[#BFDBFE]" />

          <div className="pl-4 space-y-0.5">
            {item.sub!.map((s) => {
              const sActive =
                pathname === s.href ||
                (pathname.startsWith(s.href.split("?")[0]) && s.href !== item.href)
              return (
                <Link
                  key={s.href}
                  href={s.href}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                    sActive
                      ? "bg-[#EFF6FF] text-[#2563EB]"
                      : "text-slate-500 hover:bg-slate-50 hover:text-[#0F172A]"
                  )}
                >
                  {s.icon && <s.icon className="w-4 h-4 shrink-0" />}
                  {s.label}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Sidebar principale                                                   */
/* ------------------------------------------------------------------ */

export function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    toast.success("À bientôt !")
    router.push("/login")
    router.refresh()
  }

  return (
    <aside className="w-60 flex flex-col border-r border-[#E2E8F0] bg-white shrink-0">

      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-[#E2E8F0]">
        <div className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center shrink-0">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <span className="text-lg font-bold text-[#0F172A]">Qonforme</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map((item) => (
          <NavGroup key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>

      {/* Bas sidebar */}
      <div className="px-2 py-4 border-t border-[#E2E8F0] space-y-0.5">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
            pathname.startsWith("/settings")
              ? "bg-[#EFF6FF] text-[#2563EB]"
              : "text-slate-600 hover:bg-slate-50 hover:text-[#0F172A]"
          )}
        >
          <Settings className="w-4 h-4 shrink-0" />
          Paramètres
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all duration-150 w-full"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Se déconnecter
        </button>
      </div>
    </aside>
  )
}
