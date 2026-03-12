'use client'

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import {
  LayoutDashboard, Users, FileText, FileCheck2,
  Settings, LogOut, Minus,
  Plus, Archive, RotateCcw, Package, ShoppingCart, X,
  PanelLeftClose, PanelLeftOpen,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

const LOGO_URL =
  "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20long%20bleu.webp"
const PICTO_Q =
  "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20bleu%20Qonforme%20PNG.webp"
const LOGO_Q_ICON =
  "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20bleu%20Qonforme%20PNG.webp"

const STORAGE_KEY = "qonforme_sidebar_collapsed"

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

interface SubItem {
  href:  string
  label: string
  icon?: React.ElementType
}

interface NavItem {
  href:  string
  label: string
  icon:  React.ElementType
  sub?:  SubItem[]
}

/* ------------------------------------------------------------------ */
/* Navigation                                                           */
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
      { href: "/invoices/new",           label: "Nouvelle facture", icon: Plus      },
      { href: "/credit-notes",           label: "Avoirs",           icon: RotateCcw },
      { href: "/invoices?archived=true", label: "Archives",         icon: Archive   },
    ],
  },
  { href: "/products", label: "Catalogue produits", icon: Package },
]

/* ------------------------------------------------------------------ */
/* NavGroup                                                             */
/* ------------------------------------------------------------------ */

function NavGroup({
  item,
  pathname,
  collapsed,
  onNavigate,
}: {
  item:        NavItem
  pathname:    string
  collapsed:   boolean
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
        title={collapsed ? item.label : undefined}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-100",
          collapsed ? "justify-center px-2" : "",
          isActive
            ? "bg-[#EFF6FF] text-[#2563EB]"
            : "text-slate-500 hover:bg-[#F8FAFC] hover:text-[#0F172A]"
        )}
      >
        <item.icon className={cn("w-4 h-4 shrink-0", isActive ? "text-[#2563EB]" : "text-slate-400")} />
        {!collapsed && (
          <>
            <span className="flex-1 truncate">{item.label}</span>
            {hasChildren && (
              <Minus className={cn(
                "w-3 h-3 shrink-0 transition-colors",
                isActive ? "text-[#BFDBFE]" : "text-slate-300"
              )} />
            )}
          </>
        )}
      </Link>

      {/* Sous-items — uniquement si expanded */}
      {!collapsed && hasChildren && isActive && (
        <div className="relative mt-0.5 mb-1 ml-[22px]">
          <span className="absolute left-0 top-1 bottom-1 w-px bg-[#BFDBFE]" />
          <div className="space-y-0.5 pl-4">
            {item.sub!.map((s) => {
              const sHrefBase = s.href.split("?")[0]
              const sHasQuery = s.href.includes("?")
              const sActive   = !sHasQuery && (
                pathname === s.href ||
                (pathname.startsWith(sHrefBase) && sHrefBase !== item.href)
              )
              return (
                <Link
                  key={s.href}
                  href={s.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors duration-100",
                    sActive
                      ? "bg-[#EFF6FF] text-[#2563EB]"
                      : "text-slate-400 hover:bg-[#F8FAFC] hover:text-[#0F172A]"
                  )}
                >
                  {s.icon && (
                    <s.icon className={cn("w-3.5 h-3.5 shrink-0", sActive ? "text-[#2563EB]" : "text-slate-300")} />
                  )}
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
/* SidebarContent                                                       */
/* ------------------------------------------------------------------ */

function SidebarContent({
  pathname,
  collapsed,
  onNavigate,
  onLogout,
}: {
  pathname:    string
  collapsed:   boolean
  onNavigate?: () => void
  onLogout:    () => void
}) {
  return (
    <>
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map((item) => (
          <NavGroup
            key={item.href}
            item={item}
            pathname={pathname}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <div className={cn(
        "px-2 py-4 border-t border-[#F1F5F9] space-y-0.5",
      )}>
        <Link
          href="/settings"
          onClick={onNavigate}
          title={collapsed ? "Paramètres" : undefined}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-100",
            collapsed ? "justify-center px-2" : "",
            pathname.startsWith("/settings")
              ? "bg-[#EFF6FF] text-[#2563EB]"
              : "text-slate-500 hover:bg-[#F8FAFC] hover:text-[#0F172A]"
          )}
        >
          <Settings className={cn(
            "w-4 h-4 shrink-0",
            pathname.startsWith("/settings") ? "text-[#2563EB]" : "text-slate-400"
          )} />
          {!collapsed && <span>Paramètres</span>}
        </Link>

        <button
          onClick={onLogout}
          title={collapsed ? "Se déconnecter" : undefined}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-500 hover:bg-red-50 hover:text-red-500 transition-colors duration-100 w-full group",
            collapsed ? "justify-center px-2" : ""
          )}
        >
          <LogOut className="w-4 h-4 shrink-0 text-slate-400 group-hover:text-red-400 transition-colors" />
          {!collapsed && <span>Se déconnecter</span>}
        </button>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Sidebar — desktop                                                    */
/* ------------------------------------------------------------------ */

export function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  // Hydration-safe : démarrer ouvert, lire localStorage après mount
  const [collapsed, setCollapsed] = useState(false)
  const [mounted,   setMounted]   = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === "true") setCollapsed(true)
    } catch { /* ignore */ }
  }, [])

  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem(STORAGE_KEY, String(next)) } catch { /* ignore */ }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    toast.success("À bientôt !")
    router.push("/login")
    router.refresh()
  }

  // Largeur : 240px ouvert, 64px fermé — transition CSS
  const sidebarWidth = (mounted && collapsed) ? "w-16" : "w-60"

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col border-r border-[#E2E8F0] shrink-0 relative overflow-hidden transition-[width] duration-250 ease-in-out",
        sidebarWidth
      )}
      style={{
        background: '#ffffff',
        willChange: 'width',
      }}
    >
      {/* Q filigrane bas-gauche */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-6 -left-4 select-none z-0"
        style={{ opacity: 0.06 }}
      >
        <Image src={PICTO_Q} alt="" width={160} height={160} className="w-[160px]" unoptimized />
      </div>

      {/* Header sidebar : logo + toggle */}
      <div className={cn(
        "relative z-10 flex items-center border-b border-[#F1F5F9] shrink-0",
        (mounted && collapsed) ? "justify-center px-2 py-[18px]" : "justify-between px-4 py-[18px]"
      )}>
        {/* Logo — long si ouvert, picto si fermé */}
        <Link href="/dashboard" className="flex items-center min-w-0">
          {(mounted && collapsed) ? (
            <Image
              src={LOGO_Q_ICON}
              alt="Q"
              width={28}
              height={28}
              className="w-7 h-7 object-contain"
            />
          ) : (
            <Image
              src={LOGO_URL}
              alt="Qonforme"
              width={120}
              height={28}
              className="h-7 w-auto object-contain"
              priority
            />
          )}
        </Link>

        {/* Bouton toggle — visible seulement si ouvert (collapsed = juste icône dans header) */}
        {!(mounted && collapsed) && (
          <button
            onClick={toggle}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-300 hover:text-slate-500 hover:bg-[#F1F5F9] transition-all shrink-0 ml-2"
            title="Réduire la sidebar"
            aria-label="Réduire la sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Bouton expand — visible uniquement quand sidebar fermée */}
      {(mounted && collapsed) && (
        <button
          onClick={toggle}
          className="mx-auto mt-3 flex items-center justify-center w-8 h-8 rounded-lg text-slate-300 hover:text-[#2563EB] hover:bg-[#EFF6FF] transition-all shrink-0"
          title="Ouvrir la sidebar"
          aria-label="Ouvrir la sidebar"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>
      )}

      <div className="relative z-10 flex flex-col flex-1 min-h-0">
        <SidebarContent
          pathname={pathname}
          collapsed={mounted && collapsed}
          onLogout={handleLogout}
        />
      </div>
    </aside>
  )
}

/* ------------------------------------------------------------------ */
/* MobileSidebar — drawer                                              */
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
          "fixed inset-0 z-40 bg-black/30 transition-opacity duration-250 md:hidden",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 flex flex-col bg-white border-r border-[#E2E8F0] shadow-[4px_0_24px_rgba(15,23,42,0.08)] transition-[transform] duration-250 ease-out md:hidden overflow-hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ willChange: "transform" }}
      >
        {/* Q filigrane */}
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-6 -left-4 select-none z-0"
          style={{ opacity: 0.06 }}
        >
          <Image src={PICTO_Q} alt="" width={160} height={160} className="w-[160px]" unoptimized />
        </div>

        {/* Header drawer */}
        <div className="relative z-10 flex items-center justify-between px-5 py-[18px] border-b border-[#F1F5F9] shrink-0">
          <Link href="/dashboard" onClick={onClose} className="flex items-center">
            <Image
              src={LOGO_URL}
              alt="Qonforme"
              width={130}
              height={30}
              className="h-7 w-auto object-contain"
            />
          </Link>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#F1F5F9] transition-colors text-slate-400 hover:text-slate-600"
            aria-label="Fermer le menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="relative z-10 flex flex-col flex-1 min-h-0">
          <SidebarContent
            pathname={pathname}
            collapsed={false}
            onNavigate={onClose}
            onLogout={handleLogout}
          />
        </div>
      </aside>
    </>
  )
}
