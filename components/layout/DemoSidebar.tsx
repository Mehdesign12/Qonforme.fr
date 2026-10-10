'use client'

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import {
  LayoutDashboard,
  FileText,
  FileCheck2,
  Users,
  Settings,
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
  PanelLeftClose,
  PanelLeftOpen,
  Home,
  Wallet,
  BellRing,
  HardHat,
} from "lucide-react"
import { FEATURES } from "@/lib/features"
import { cn } from "@/lib/utils"

/* ------------------------------------------------------------------ */
/* Logos                                                                 */
/* ------------------------------------------------------------------ */

const LOGO_URL =
  "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20long%20bleu.webp"
const LOGO_URL_DARK =
  "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20long%20simple.png"
const PICTO_Q =
  "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20bleu%20Qonforme%20PNG.webp"
const LOGO_Q_ICON =
  "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20bleu%20Qonforme%20PNG.webp"

const STORAGE_KEY = "qonforme_demo_sidebar_collapsed"

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
  sub?:    SubItem[]
}

/* ------------------------------------------------------------------ */
/* Navigation                                                           */
/* ------------------------------------------------------------------ */

const DEMO_NAV: NavItem[] = [
  { href: "/demo",               label: "Tableau de bord",    icon: LayoutDashboard },
  { href: "/demo/clients",       label: "Clients",            icon: Users },
  ...(FEATURES.chantiers ? [{ href: "/demo/chantiers", label: "Chantiers", icon: HardHat }] : []),
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
  { href: "/demo/tresorerie", label: "Trésorerie", icon: Wallet },
  { href: "/demo/relances",   label: "Relances",   icon: BellRing },
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
    (item.href !== "/demo" && pathname.startsWith(item.href))

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
            ? "bg-[#EFF6FF] dark:bg-[#1E3A5F] text-[#2563EB] dark:text-[#60A5FA]"
            : "text-slate-500 dark:text-slate-400 hover:bg-[#F8FAFC] dark:hover:bg-[#162032] hover:text-[#0F172A] dark:hover:text-[#E2E8F0]"
        )}
      >
        <item.icon className={cn("w-4 h-4 shrink-0", isActive ? "text-[#2563EB] dark:text-[#60A5FA]" : "text-slate-400 dark:text-slate-500")} />
        {!collapsed && (
          <>
            <span className="flex-1 truncate">{item.label}</span>
            {hasChildren && (
              <Minus className={cn(
                "w-3 h-3 shrink-0 transition-colors",
                isActive ? "text-[#BFDBFE] dark:text-[#1E3A5F]" : "text-slate-300 dark:text-slate-600"
              )} />
            )}
          </>
        )}
      </Link>

      {/* Sous-items — uniquement si expanded */}
      {!collapsed && hasChildren && isActive && (
        <div className="relative mt-0.5 mb-1 ml-[22px]">
          <span className="absolute left-0 top-1 bottom-1 w-px bg-[#BFDBFE] dark:bg-[#1E3A5F]" />
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
                  key={s.href + s.label}
                  href={s.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors duration-100",
                    sActive
                      ? "bg-[#EFF6FF] dark:bg-[#1E3A5F] text-[#2563EB] dark:text-[#60A5FA]"
                      : "text-slate-400 dark:text-slate-500 hover:bg-[#F8FAFC] dark:hover:bg-[#162032] hover:text-[#0F172A] dark:hover:text-[#E2E8F0]"
                  )}
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
  collapsed,
  onNavigate,
}: {
  pathname:    string
  collapsed:   boolean
  onNavigate?: () => void
}) {
  return (
    <>
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto scrollbar-none">
        {DEMO_NAV.map((item) => (
          <NavGroup key={item.href + item.label} item={item} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
        ))}

        {/* Paramètres */}
        <div className="pt-2">
          <Link
            href="/demo/settings"
            onClick={onNavigate}
            title={collapsed ? "Paramètres" : undefined}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-100",
              collapsed ? "justify-center px-2" : "",
              pathname.startsWith("/demo/settings")
                ? "bg-[#EFF6FF] dark:bg-[#1E3A5F] text-[#2563EB] dark:text-[#60A5FA]"
                : "text-slate-500 dark:text-slate-400 hover:bg-[#F8FAFC] dark:hover:bg-[#162032] hover:text-[#0F172A] dark:hover:text-[#E2E8F0]"
            )}
          >
            <Settings className={cn(
              "w-4 h-4 shrink-0",
              pathname.startsWith("/demo/settings") ? "text-[#2563EB] dark:text-[#60A5FA]" : "text-slate-400 dark:text-slate-500"
            )} />
            {!collapsed && <span>Paramètres</span>}
            {!collapsed && pathname.startsWith("/demo/settings") && (
              <ChevronRight className="w-3 h-3 text-[#2563EB] dark:text-[#60A5FA] ml-auto" />
            )}
          </Link>
        </div>
      </nav>

      {/* Footer */}
      <div className={cn(
        "px-2 py-4 border-t border-[#F1F5F9] dark:border-[#162032] space-y-2",
        collapsed ? "px-2" : "px-4"
      )}>
        {/* Badge démo */}
        {!collapsed && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40">
            <FlaskConical className="w-4 h-4 text-amber-600 dark:text-amber-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Mode démo</p>
              <p className="text-[10px] text-amber-600 dark:text-amber-500 truncate">Données fictives</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="flex items-center justify-center" title="Mode démo">
            <FlaskConical className="w-4 h-4 text-amber-600 dark:text-amber-500" />
          </div>
        )}

        {/* Retour à l'accueil */}
        <Link
          href="/"
          onClick={onNavigate}
          title={collapsed ? "Retour à l'accueil" : undefined}
          className={cn(
            "flex items-center gap-2 w-full rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-[#F8FAFC] dark:hover:bg-[#162032] hover:text-[#0F172A] dark:hover:text-[#E2E8F0] transition-colors touch-manipulation",
            collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"
          )}
        >
          <Home className="w-4 h-4 shrink-0" />
          {!collapsed && "Retour à l'accueil"}
        </Link>

        {/* CTA inscription */}
        <Link
          href="/signup"
          onClick={onNavigate}
          title={collapsed ? "Créer mon compte" : undefined}
          className={cn(
            "flex items-center justify-center gap-1.5 w-full rounded-lg text-white text-xs font-semibold transition-colors touch-manipulation",
            collapsed ? "px-2 py-2.5" : "px-3 py-2.5"
          )}
          style={{
            background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
            boxShadow:  "0 2px 8px rgba(37,99,235,0.25)",
          }}
        >
          {collapsed ? <Plus className="w-4 h-4" /> : "Créer mon compte →"}
        </Link>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* DemoSidebar — desktop (hidden md:flex)                              */
/* ------------------------------------------------------------------ */

export function DemoSidebar() {
  return <Sidebar identity={DEMO_IDENTITY} />
}

export function DemoMobileBottomNav() {
  return <MobileBottomNav identity={DEMO_IDENTITY} />
}
