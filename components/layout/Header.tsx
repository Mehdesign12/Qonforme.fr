'use client'

import {
  Bell, Plus, FileText, FileCheck2, ShoppingCart,
  Building2, CreditCard, Sun, Moon, LogOut,
} from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { useState, useEffect, useMemo } from "react"
import { ThemeToggle } from "@/components/layout/ThemeToggle"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import type { PlanId } from "@/lib/stripe/plans"

/* ------------------------------------------------------------------ */
/* Titres de pages                                                      */
/* ------------------------------------------------------------------ */

const PAGE_TITLES: Record<string, string> = {
  "/dashboard":              "Tableau de bord",
  "/invoices":               "Factures",
  "/invoices/new":           "Nouvelle facture",
  "/quotes":                 "Devis",
  "/quotes/new":             "Nouveau devis",
  "/clients":                "Clients",
  "/clients/new":            "Nouveau client",
  "/products":               "Catalogue produits",
  "/purchase-orders":        "Bons de commande",
  "/purchase-orders/new":    "Nouveau bon de commande",
  "/settings":               "Paramètres",
  "/settings/company":       "Mon entreprise",
  "/settings/billing":       "Abonnement",
  "/settings/ppf":           "Connexion PPF",
  "/settings/invoices":      "Préférences factures",
  "/settings/notifications": "Notifications",
  "/credit-notes":           "Avoirs",
}

const PREFIX_TITLES: { prefix: string; title: string }[] = [
  { prefix: "/purchase-orders/", title: "Bons de commande" },
  { prefix: "/invoices/",        title: "Factures"         },
  { prefix: "/quotes/",          title: "Devis"            },
  { prefix: "/clients/",         title: "Clients"          },
  { prefix: "/credit-notes/",    title: "Avoirs"           },
]

function getTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  for (const { prefix, title } of PREFIX_TITLES) {
    if (pathname.startsWith(prefix)) return title
  }
  return "Qonforme"
}

/* ------------------------------------------------------------------ */
/* CTA contextuels par route                                            */
/* ------------------------------------------------------------------ */

interface CtaConfig {
  href:  string
  label: string
  icon:  React.ElementType
}

const PAGE_CTA: Record<string, CtaConfig> = {
  "/invoices":        { href: "/invoices/new",        label: "Nouvelle facture", icon: FileText     },
  "/quotes":          { href: "/quotes/new",           label: "Nouveau devis",    icon: FileCheck2   },
  "/clients":         { href: "/clients/new",          label: "Nouveau client",   icon: Plus         },
  "/purchase-orders": { href: "/purchase-orders/new",  label: "Nouveau BdC",      icon: ShoppingCart },
  "/products":        { href: "/products",             label: "Nouveau produit",  icon: Plus         },
}

/* ------------------------------------------------------------------ */
/* Initiales                                                            */
/* ------------------------------------------------------------------ */

function getInitials(firstName: string, lastName: string): string {
  const f = firstName.trim()
  const l = lastName.trim()
  if (f && l) return (f[0] + l[0]).toUpperCase()
  if (f)      return f.slice(0, 2).toUpperCase()
  if (l)      return l.slice(0, 2).toUpperCase()
  return "?"
}

/* ------------------------------------------------------------------ */
/* Styles pilules                                                       */
/* ------------------------------------------------------------------ */

const PILL_BG     = "var(--glass-bg)"
const PILL_BORDER = "1px solid var(--glass-border-color)"
const PILL_SHADOW = "var(--glass-shadow)"

/* Mobile : fond solide (pas de backdrop-filter — CLAUDE.md) */
const MOBILE_PILL: React.CSSProperties = {
  background: "var(--glass-bg)",
  border:     "1px solid var(--glass-border-color)",
  boxShadow:  "0 1px 3px rgba(15,23,42,0.04)",
}

/* ------------------------------------------------------------------ */
/* Badge plan                                                           */
/* ------------------------------------------------------------------ */

function PlanBadge({ plan }: { plan: PlanId }) {
  if (plan === "pro") {
    return (
      <span
        className="inline-flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full"
        style={{
          background: "linear-gradient(135deg, #EFF6FF, #DBEAFE)",
          color: "#2563EB",
          border: "1px solid rgba(37,99,235,0.20)",
        }}
      >
        Pro ✦
      </span>
    )
  }
  return (
    <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600">
      Starter
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Props                                                                */
/* ------------------------------------------------------------------ */

interface HeaderProps {
  firstName?: string
  lastName?:  string
  email?:     string
  plan?:      PlanId | null
}

/* ------------------------------------------------------------------ */
/* Composant                                                            */
/* ------------------------------------------------------------------ */

export function Header({ firstName = "", lastName = "", email = "", plan = null }: HeaderProps) {
  const pathname = usePathname()
  const router   = useRouter()
  const title    = getTitle(pathname)
  const cta      = PAGE_CTA[pathname]
  const initials = getInitials(firstName, lastName)
  const supabase = useMemo(() => createClient(), [])

  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isDark = mounted && theme === "dark"

  const handleLogout = async () => {
    await supabase.auth.signOut()
    toast.success("À bientôt !")
    router.push("/login")
    router.refresh()
  }

  const fullName = [firstName, lastName].filter(Boolean).join(" ") || "Mon compte"

  const avatarStyle: React.CSSProperties = {
    background: "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)",
    color:      "#2563EB",
    border:     "1.5px solid rgba(37,99,235,0.20)",
  }

  /* ── Dropdown profil — avec ou sans toggle thème ── */
  const dropdownBg     = isDark ? "#0F1E35" : "#ffffff"
  const dropdownBorder = isDark ? "#1E3A5F" : "#E8EEF8"
  const dropdownShadow = isDark
    ? "0 8px 32px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.25)"
    : "0 8px 32px rgba(15,23,42,0.12), 0 2px 8px rgba(15,23,42,0.06)"

  function renderDropdown(withThemeToggle: boolean) {
    return (
      <DropdownMenuContent
        align="end"
        sideOffset={10}
        style={{
          minWidth: "260px",
          background: dropdownBg,
          border: `1px solid ${dropdownBorder}`,
          boxShadow: dropdownShadow,
          borderRadius: "14px",
          padding: "6px",
        }}
      >
        {/* En-tête profil */}
        <div
          style={{
            background: isDark
              ? "linear-gradient(135deg, #162032 0%, #1a2a45 100%)"
              : "linear-gradient(135deg, #EFF6FF 0%, #F0F9FF 100%)",
            border: `1px solid ${isDark ? "#1E3A5F" : "#DBEAFE"}`,
            borderRadius: "10px",
            padding: "12px",
            marginBottom: "4px",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0"
              style={{
                background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
                color: "#ffffff",
                boxShadow: "0 2px 8px rgba(37,99,235,0.35)",
              }}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="text-[13px] font-bold truncate leading-tight"
                style={{ color: isDark ? "#E2E8F0" : "#0F172A" }}
              >
                {fullName}
              </p>
              {email && (
                <p
                  className="text-[11px] truncate leading-tight mt-0.5"
                  style={{ color: isDark ? "#94A3B8" : "#64748B" }}
                >
                  {email}
                </p>
              )}
              {plan && <div className="mt-1.5"><PlanBadge plan={plan} /></div>}
            </div>
          </div>
        </div>

        {/* Section paramètres */}
        <div style={{ padding: "2px 0" }}>
          <DropdownMenuItem onClick={() => router.push("/settings/company")}>
            <Building2 className="w-4 h-4 shrink-0" />
            Mon entreprise
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/settings/invoices")}>
            <FileText className="w-4 h-4 shrink-0" />
            Préférences factures
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/settings/billing")}>
            <CreditCard className="w-4 h-4 shrink-0" />
            Mon abonnement
          </DropdownMenuItem>
        </div>

        {withThemeToggle && (
          <>
            <DropdownMenuSeparator style={{ background: dropdownBorder, margin: "4px 0" }} />
            <DropdownMenuItem onClick={() => setTheme(isDark ? "light" : "dark")}>
              {isDark
                ? <Sun className="w-4 h-4 shrink-0" />
                : <Moon className="w-4 h-4 shrink-0" />}
              {isDark ? "Mode clair" : "Mode sombre"}
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator style={{ background: dropdownBorder, margin: "4px 0" }} />

        {/* Déconnexion */}
        <DropdownMenuItem variant="destructive" onClick={handleLogout}>
          <LogOut className="w-4 h-4 shrink-0" />
          Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    )
  }

  return (
    <>
      {/* ════════════════════════════════════════════════════════════════
          MOBILE header (< lg) — pilules solides, pas de backdrop-filter,
          pas de toggle thème (crash GPU iOS Safari — cf. CLAUDE.md)
          ════════════════════════════════════════════════════════════════ */}
      <header
        className="lg:hidden flex items-center justify-between gap-2 px-3 shrink-0 bg-white dark:bg-[#0F1E35] z-20"
        style={{
          paddingTop:    'max(12px, env(safe-area-inset-top, 12px))',
          paddingBottom: '10px',
          minHeight:     '54px',
        }}
      >
        {/* Gauche : pilule titre */}
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="flex items-center rounded-full px-3.5 py-1.5 min-w-0"
            style={MOBILE_PILL}
          >
            <h1 className="text-[15px] font-semibold truncate text-[#0F172A] dark:text-[#E2E8F0]">
              {title}
            </h1>
          </div>
        </div>

        {/* Droite : CTA + pilule [cloche + avatar] */}
        <div className="flex items-center gap-1.5 shrink-0">
          {cta && (
            <Link href={cta.href}>
              <button
                className="w-9 h-9 flex items-center justify-center rounded-full touch-manipulation text-[#2563EB]"
                style={MOBILE_PILL}
                aria-label={cta.label}
              >
                <Plus className="w-[18px] h-[18px]" />
              </button>
            </Link>
          )}
          <div
            className="flex items-center gap-0.5 rounded-full px-1 py-0.5"
            style={MOBILE_PILL}
          >
            <button
              className="w-8 h-8 flex items-center justify-center rounded-full touch-manipulation text-slate-400 dark:text-slate-500"
              aria-label="Notifications"
            >
              <Bell className="w-[17px] h-[17px]" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-blue-500 touch-manipulation"
                style={avatarStyle}
                title={fullName}
              >
                {initials}
              </DropdownMenuTrigger>
              {renderDropdown(false)}
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* ════════════════════════════════════════════════════════════════
          DESKTOP header (≥ lg) — pilules flottent sur le gradient
          ════════════════════════════════════════════════════════════════ */}
      <header className="hidden lg:flex h-[60px] px-5 items-center justify-between shrink-0 gap-3 relative z-20">

        {/* Gauche : pilule titre */}
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="header-pill-glass flex items-center rounded-full px-4 py-2 min-w-0"
            style={{ background: PILL_BG, border: PILL_BORDER, boxShadow: PILL_SHADOW }}
          >
            <h1 className="text-[14px] font-semibold text-[#0F172A] dark:text-[#E2E8F0] truncate max-w-xs">
              {title}
            </h1>
          </div>
        </div>

        {/* Droite : CTA + pilule [toggle + cloche + avatar] */}
        <div className="flex items-center gap-2 shrink-0">
          {cta && (
            <Link href={cta.href}>
              <button
                className="inline-flex items-center gap-1.5 rounded-full text-white text-[13px] font-bold px-3.5 py-2 whitespace-nowrap"
                style={{
                  background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
                  boxShadow:  "0 2px 10px rgba(37,99,235,0.30)",
                }}
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                {cta.label}
              </button>
            </Link>
          )}

          <div
            className="header-pill-glass flex items-center gap-0.5 rounded-full px-1.5 py-1"
            style={{ background: PILL_BG, border: PILL_BORDER, boxShadow: PILL_SHADOW }}
          >
            <ThemeToggle />
            <div className="w-px h-4 bg-slate-200/80 dark:bg-slate-700/80 mx-0.5" />
            <button
              className="flex items-center justify-center w-8 h-8 rounded-full text-slate-400"
              aria-label="Notifications"
            >
              <Bell className="w-[17px] h-[17px]" />
            </button>
            <div className="w-px h-4 bg-slate-200/80 dark:bg-slate-700/80 mx-0.5" />
            <DropdownMenu>
              <DropdownMenuTrigger
                className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
                style={avatarStyle}
                title={fullName}
              >
                {initials}
              </DropdownMenuTrigger>
              {renderDropdown(true)}
            </DropdownMenu>
          </div>
        </div>
      </header>
    </>
  )
}
