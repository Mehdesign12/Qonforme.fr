'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
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
  RotateCcw,
  Archive,
  Plus,
  Minus,
  Menu,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

interface SubItem {
  href:  string
  label: string
  icon?: React.ElementType
}

interface NavItem {
  href:    string
  label:   string
  icon:    React.ElementType
  exact?:  boolean
  sub?:    SubItem[]
}

/* ------------------------------------------------------------------ */
/* Navigation                                                           */
/* ------------------------------------------------------------------ */

const DEMO_NAV: NavItem[] = [
  { href: "/demo",               label: "Tableau de bord",    icon: LayoutDashboard, exact: true },
  { href: "/demo/clients",       label: "Clients",            icon: Users },
  {
    href:  "/demo/quotes",
    label: "Devis",
    icon:  FileCheck2,
    sub:   [{ href: "/demo/quotes", label: "Nouveau devis", icon: Plus }],
  },
  {
    href:  "/demo/purchase-orders",
    label: "Bons de commande",
    icon:  ShoppingCart,
    sub:   [{ href: "/demo/purchase-orders", label: "Nouveau BdC", icon: Plus }],
  },
  {
    href:  "/demo/invoices",
    label: "Factures",
    icon:  FileText,
    sub:   [
      { href: "/demo/invoices/new", label: "Nouvelle facture", icon: Plus      },
      { href: "/demo/credit-notes", label: "Avoirs",           icon: RotateCcw },
      { href: "/demo/invoices",     label: "Archives",         icon: Archive   },
    ],
  },
  { href: "/demo/products", label: "Catalogue produits", icon: Package },
]

/* ------------------------------------------------------------------ */
/* Classes utilitaires partagées (dark-mode aware)                     */
/* ------------------------------------------------------------------ */

const NAV_ITEM_BASE = "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-100"
const NAV_ACTIVE    = "bg-[#EFF6FF] dark:bg-[#162032] text-[#2563EB] dark:text-[#60A5FA]"
const NAV_INACTIVE  = "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#162032] hover:text-[#0F172A] dark:hover:text-[#E2E8F0]"

const ICON_ACTIVE   = "text-[#2563EB] dark:text-[#60A5FA]"
const ICON_INACTIVE = "text-slate-400 dark:text-slate-500"

const SUB_ITEM_BASE = "flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors duration-100"
const SUB_ACTIVE    = "bg-[#EFF6FF] dark:bg-[#162032] text-[#2563EB] dark:text-[#60A5FA]"
const SUB_INACTIVE  = "text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-[#162032] hover:text-[#0F172A] dark:hover:text-[#E2E8F0]"

/* ------------------------------------------------------------------ */
/* NavGroup — parent + sous-items                                       */
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
  const isParentActive = item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(item.href)

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
        className={cn(NAV_ITEM_BASE, isActive ? NAV_ACTIVE : NAV_INACTIVE)}
      >
        <item.icon className={cn("w-4 h-4 shrink-0", isActive ? ICON_ACTIVE : ICON_INACTIVE)} />
        <span className="flex-1 truncate">{item.label}</span>
        {hasChildren && (
          <Minus className={cn(
            "w-3 h-3 shrink-0 transition-colors",
            isActive ? "text-[#BFDBFE] dark:text-[#1E3A5F]" : "text-slate-300 dark:text-slate-600"
          )} />
        )}
      </Link>

      {/* Sous-items */}
      {hasChildren && isActive && (
        <div className="relative mt-0.5 mb-1 ml-[22px]">
          <span className="absolute left-0 top-1 bottom-1 w-px bg-[#BFDBFE] dark:bg-[#1E3A5F]" />
          <div className="space-y-0.5 pl-4">
            {item.sub!.map((s) => {
              const sActive = pathname === s.href || pathname.startsWith(s.href.split("?")[0])
              return (
                <Link
                  key={s.href + s.label}
                  href={s.href}
                  onClick={onNavigate}
                  className={cn(SUB_ITEM_BASE, sActive ? SUB_ACTIVE : SUB_INACTIVE)}
                >
                  {s.icon && (
                    <s.icon className={cn(
                      "w-3.5 h-3.5 shrink-0",
                      sActive ? "text-[#2563EB] dark:text-[#60A5FA]" : "text-slate-300 dark:text-slate-600"
                    )} />
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
/* SidebarContent partagé desktop + drawer                             */
/* ------------------------------------------------------------------ */

function SidebarContent({
  pathname,
  onNavigate,
}: {
  pathname:    string
  onNavigate?: () => void
}) {
  return (
    <>
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto scrollbar-none">
        {DEMO_NAV.map((item) => (
          <NavGroup key={item.href + item.label} item={item} pathname={pathname} onNavigate={onNavigate} />
        ))}

        {/* Paramètres */}
        <div className="pt-2">
          <Link
            href="/demo/settings"
            onClick={onNavigate}
            className={cn(
              NAV_ITEM_BASE,
              pathname.startsWith("/demo/settings") ? NAV_ACTIVE : NAV_INACTIVE
            )}
          >
            <Settings className={cn(
              "w-4 h-4 shrink-0",
              pathname.startsWith("/demo/settings") ? ICON_ACTIVE : ICON_INACTIVE
            )} />
            <span className="flex-1 truncate">Paramètres</span>
            {pathname.startsWith("/demo/settings") && (
              <ChevronRight className="w-3 h-3 text-[#2563EB] dark:text-[#60A5FA]" />
            )}
          </Link>
        </div>
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-slate-200 dark:border-[#1E3A5F] space-y-2">
        {/* Badge démo */}
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40">
          <FlaskConical className="w-4 h-4 text-amber-600 dark:text-amber-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Mode démo</p>
            <p className="text-[10px] text-amber-600 dark:text-amber-500 truncate">Données fictives</p>
          </div>
        </div>

        {/* CTA inscription */}
        <Link
          href="/signup"
          onClick={onNavigate}
          className="flex items-center justify-center gap-1.5 w-full px-3 py-2.5 rounded-lg text-white text-xs font-semibold transition-colors touch-manipulation"
          style={{
            background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
            boxShadow:  "0 2px 8px rgba(37,99,235,0.25)",
          }}
        >
          Créer mon compte →
        </Link>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* DemoSidebar — desktop uniquement (hidden md:flex)                   */
/* ------------------------------------------------------------------ */

export function DemoSidebar() {
  const pathname = usePathname()

  return (
    <aside
      className="hidden md:flex w-64 flex-col shrink-0 border-r border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#0F1E35]"
    >
      {/* Logo + badge démo */}
      <div
        className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-200 dark:border-[#1E3A5F]"
      >
        <div className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center shrink-0 shadow-sm">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <span className="text-lg font-bold text-[#0F172A] dark:text-[#E2E8F0]">Qonforme</span>
        <span className="ml-auto text-[10px] font-bold bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700/50 px-1.5 py-0.5 rounded-full">
          DÉMO
        </span>
      </div>

      <SidebarContent pathname={pathname} />
    </aside>
  )
}

/* ------------------------------------------------------------------ */
/* DemoMobileSidebar — drawer mobile                                   */
/* ------------------------------------------------------------------ */

export function DemoMobileSidebar({
  open,
  onClose,
}: {
  open:    boolean
  onClose: () => void
}) {
  const pathname = usePathname()

  // Verrouille le scroll quand le drawer est ouvert
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity duration-250 md:hidden",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#0F1E35] shadow-[4px_0_32px_rgba(15,23,42,0.15)] transition-[transform] duration-300 ease-out md:hidden overflow-hidden",
          "w-[min(80vw,300px)]",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header drawer */}
        <div
          className="flex items-center justify-between px-5 border-b border-slate-200 dark:border-[#1E3A5F] shrink-0"
          style={{
            paddingTop:    'max(18px, env(safe-area-inset-top, 18px))',
            paddingBottom: '18px',
          }}
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#2563EB] flex items-center justify-center shrink-0 shadow-sm">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-base font-bold text-[#0F172A] dark:text-[#E2E8F0]">Qonforme</span>
            <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700/50 px-1.5 py-0.5 rounded-full">
              DÉMO
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl transition-colors touch-manipulation text-slate-400 dark:text-slate-500"
            aria-label="Fermer le menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col flex-1 min-h-0">
          <SidebarContent pathname={pathname} onNavigate={onClose} />
        </div>
      </aside>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* DemoMobileBottomNav — barre fixe en bas (mobile only)              */
/* ------------------------------------------------------------------ */

export function DemoMobileBottomNav() {
  const pathname    = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const primaryTabs = [
    { href: "/demo",          label: "Accueil",  icon: LayoutDashboard, exact: true },
    { href: "/demo/invoices", label: "Factures", icon: FileText },
    { href: "/demo/quotes",   label: "Devis",    icon: FileCheck2 },
    { href: "/demo/clients",  label: "Clients",  icon: Users },
  ]

  return (
    <>
      <nav
        className="md:hidden flex shrink-0 border-t border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#0F1E35]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {primaryTabs.map((tab) => {
          const isActive = tab.exact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center py-2.5 gap-[3px] touch-manipulation relative",
                isActive
                  ? "text-[#2563EB] dark:text-[#60A5FA]"
                  : "text-slate-400 dark:text-slate-500"
              )}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[2px] rounded-b-full bg-[#2563EB] dark:bg-[#60A5FA]" />
              )}
              <tab.icon className="w-[22px] h-[22px]" />
              <span className="text-[10px] font-semibold tracking-tight">{tab.label}</span>
            </Link>
          )
        })}

        {/* Bouton Menu — ouvre le drawer */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex flex-1 flex-col items-center justify-center py-2.5 gap-[3px] touch-manipulation text-slate-400 dark:text-slate-500"
          aria-label="Ouvrir le menu complet"
        >
          <Menu className="w-[22px] h-[22px]" />
          <span className="text-[10px] font-semibold tracking-tight">Menu</span>
        </button>
      </nav>

      <DemoMobileSidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  )
}
