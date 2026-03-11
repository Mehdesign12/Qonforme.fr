'use client'

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard, Users, FileText, FileCheck2,
  Settings, Zap, LogOut, Minus,
  Plus, Archive, RotateCcw, Package, ShoppingCart, X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

const PICTO_Q = "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20bleu%20Qonforme%20PNG.webp"

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

interface SubItem {
  href:   string
  label:  string
  icon?:  React.ElementType
}

interface NavItem {
  href:   string
  label:  string
  icon:   React.ElementType
  sub?:   SubItem[]
}

/* ------------------------------------------------------------------ */
/* Structure navigation                                                 */
/* ------------------------------------------------------------------ */

const NAV: NavItem[] = [
  { href: "/dashboard",      label: "Tableau de bord",   icon: LayoutDashboard },
  { href: "/clients",        label: "Clients",            icon: Users },
  {
    href: "/quotes",
    label: "Devis",
    icon: FileCheck2,
    sub: [{ href: "/quotes/new", label: "Créer un devis", icon: Plus }],
  },
  {
    href: "/purchase-orders",
    label: "Bons de commande",
    icon: ShoppingCart,
    sub: [{ href: "/purchase-orders/new", label: "Nouveau BdC", icon: Plus }],
  },
  {
    href: "/invoices",
    label: "Factures",
    icon: FileText,
    sub: [
      { href: "/credit-notes",            label: "Avoirs",   icon: RotateCcw },
      { href: "/invoices?archived=true",  label: "Archives", icon: Archive  },
    ],
  },
  { href: "/products", label: "Catalogue produits", icon: Package },
]

const TREE_INDENT = "ml-[20px]"
const BRANCH_W   = "w-[16px]"

/* ------------------------------------------------------------------ */
/* NavGroup                                                             */
/* ------------------------------------------------------------------ */

function NavGroup({
  item,
  pathname,
  onNavigate,
}: {
  item:        NavItem
  pathname:    string
  onNavigate?: () => void
}) {
  const isParentActive =
    pathname === item.href ||
    (item.href !== "/dashboard" && pathname.startsWith(item.href))

  const isSubActive = item.sub?.some(
    (s) => pathname === s.href || pathname.startsWith(s.href.split("?")[0])
  )

  const hasChildren = !!item.sub?.length
  const isActive    = isParentActive || !!isSubActive

  return (
    <div>
      <Link
        href={item.href}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
          isActive
            ? "bg-[#EFF6FF] text-[#2563EB]"
            : "text-slate-600 hover:bg-slate-50 hover:text-[#0F172A]"
        )}
      >
        <item.icon className="w-4 h-4 shrink-0" />
        <span className="flex-1 truncate">{item.label}</span>
        {hasChildren && (
          <Minus className={cn(
            "w-3.5 h-3.5 shrink-0",
            isActive ? "text-[#2563EB]" : "text-slate-400"
          )} />
        )}
      </Link>

      {hasChildren && (
        <div className={cn("relative mt-0.5 mb-1", TREE_INDENT)}>
          <span className="absolute left-0 top-0 bottom-0 w-px bg-[#BFDBFE]" />
          <div className="space-y-0.5">
            {item.sub!.map((s) => {
              const sHrefBase = s.href.split("?")[0]
              const sHasQuery = s.href.includes("?")
              const sActive   = !sHasQuery && (
                pathname === s.href ||
                (pathname.startsWith(sHrefBase) && sHrefBase !== item.href)
              )
              return (
                <div key={s.href} className="relative flex items-center">
                  <span className={cn("shrink-0 h-px bg-[#BFDBFE]", BRANCH_W)} />
                  <Link
                    href={s.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex-1 flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                      sActive
                        ? "bg-[#EFF6FF] text-[#2563EB]"
                        : "text-slate-500 hover:bg-slate-50 hover:text-[#0F172A]"
                    )}
                  >
                    {s.icon && <s.icon className="w-4 h-4 shrink-0" />}
                    {s.label}
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Contenu interne de la sidebar (partagé desktop + mobile)            */
/* ------------------------------------------------------------------ */

function SidebarContent({
  pathname,
  onNavigate,
  onLogout,
}: {
  pathname:    string
  onNavigate?: () => void
  onLogout:    () => void
}) {
  return (
    <>
      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map((item) => (
          <NavGroup key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
        ))}
      </nav>

      {/* Bas */}
      <div className="px-2 py-4 border-t border-[#E2E8F0] space-y-0.5">
        <Link
          href="/settings"
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
            pathname.startsWith("/settings")
              ? "bg-[#EFF6FF] text-[#2563EB]"
              : "text-slate-600 hover:bg-slate-50 hover:text-[#0F172A]"
          )}
        >
          <Settings className="w-4 h-4 shrink-0" />
          Paramètres
        </Link>
        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all duration-150 w-full"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Se déconnecter
        </button>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Sidebar — version desktop (fixe à gauche)                           */
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
    <aside className="hidden md:flex w-60 flex-col border-r border-[#E2E8F0] bg-white shrink-0 relative overflow-hidden">
      {/* Q filigrane en bas de la sidebar */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-8 -left-6 select-none"
        style={{ opacity: 0.06, zIndex: 0 }}
      >
        <Image src={PICTO_Q} alt="" width={160} height={160} className="w-[140px]" unoptimized />
      </div>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-[#E2E8F0]">
        <div className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center shrink-0">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <span className="text-lg font-bold text-[#0F172A]">Qonforme</span>
      </div>
      <SidebarContent pathname={pathname} onLogout={handleLogout} />
    </aside>
  )
}

/* ------------------------------------------------------------------ */
/* MobileSidebar — drawer depuis la gauche                             */
/* ------------------------------------------------------------------ */

export function MobileSidebar({
  open,
  onClose,
}: {
  open:    boolean
  onClose: () => void
}) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    onClose()
    toast.success("À bientôt !")
    router.push("/login")
    router.refresh()
  }

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 md:hidden",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 flex flex-col bg-white border-r border-[#E2E8F0] shadow-2xl transition-transform duration-300 ease-in-out md:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header drawer : logo + fermer */}
        <div className="flex items-center justify-between px-4 py-5 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-[#0F172A]">Qonforme</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[#F1F5F9] transition-colors"
            aria-label="Fermer le menu"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <SidebarContent pathname={pathname} onNavigate={onClose} onLogout={handleLogout} />
      </aside>
    </>
  )
}
