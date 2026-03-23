'use client'

import {
  Bell, Plus, FileText, FileCheck2, ShoppingCart,
  Building2, CreditCard, Sun, Moon, UserPlus,
} from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { useState, useEffect } from "react"
import { ThemeToggle } from "@/components/layout/ThemeToggle"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

/* ------------------------------------------------------------------ */
/* Constantes design                                                    */
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
/* Titres de pages                                                      */
/* ------------------------------------------------------------------ */

const PAGE_TITLES: Record<string, string> = {
  "/demo":                  "Tableau de bord",
  "/demo/invoices":         "Factures",
  "/demo/invoices/new":     "Nouvelle facture",
  "/demo/quotes":           "Devis",
  "/demo/quotes/new":       "Nouveau devis",
  "/demo/clients":          "Clients",
  "/demo/products":         "Catalogue produits",
  "/demo/purchase-orders":  "Bons de commande",
  "/demo/credit-notes":     "Avoirs",
  "/demo/settings":         "Paramètres",
  "/demo/settings/ppf":     "Connexion PPF",
}

const PREFIX_TITLES: { prefix: string; title: string }[] = [
  { prefix: "/demo/purchase-orders/", title: "Bons de commande" },
  { prefix: "/demo/invoices/",        title: "Factures"         },
  { prefix: "/demo/quotes/",          title: "Devis"            },
  { prefix: "/demo/clients/",         title: "Clients"          },
  { prefix: "/demo/credit-notes/",    title: "Avoirs"           },
]

function getTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  for (const { prefix, title } of PREFIX_TITLES) {
    if (pathname.startsWith(prefix)) return title
  }
  return "Qonforme"
}

/* ------------------------------------------------------------------ */
/* CTA contextuels                                                      */
/* ------------------------------------------------------------------ */

interface CtaConfig {
  href:  string
  label: string
  icon:  React.ElementType
}

const PAGE_CTA: Record<string, CtaConfig> = {
  "/demo/invoices":        { href: "/demo/invoices/new",    label: "Nouvelle facture", icon: FileText     },
  "/demo/quotes":          { href: "/demo/quotes/new",      label: "Nouveau devis",    icon: FileCheck2   },
  "/demo/clients":         { href: "/demo/clients",         label: "Nouveau client",   icon: Plus         },
  "/demo/purchase-orders": { href: "/demo/purchase-orders", label: "Nouveau BdC",      icon: ShoppingCart },
  "/demo/products":        { href: "/demo/products",        label: "Nouveau produit",  icon: Plus         },
}

/* ------------------------------------------------------------------ */
/* Composant                                                            */
/* ------------------------------------------------------------------ */

export function DemoHeader() {
  const pathname = usePathname()
  const router   = useRouter()
  const title    = getTitle(pathname)
  const cta      = PAGE_CTA[pathname]

  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isDark = mounted && theme === "dark"

  /* ── Dropdown styling (aligned with real Header) ── */
  const dropdownBg     = isDark ? "#0F1E35" : "#ffffff"
  const dropdownBorder = isDark ? "#1E3A5F" : "#E8EEF8"
  const dropdownShadow = isDark
    ? "0 8px 32px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.25)"
    : "0 8px 32px rgba(15,23,42,0.12), 0 2px 8px rgba(15,23,42,0.06)"

  const avatarStyle: React.CSSProperties = {
    background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
    color:      "#ffffff",
    boxShadow:  "0 2px 8px rgba(37,99,235,0.35)",
  }

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
              style={avatarStyle}
            >
              JD
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="text-[13px] font-bold truncate leading-tight"
                style={{ color: isDark ? "#E2E8F0" : "#0F172A" }}
              >
                Jean Dupont
              </p>
              <p
                className="text-[11px] truncate leading-tight mt-0.5"
                style={{ color: isDark ? "#94A3B8" : "#64748B" }}
              >
                jean@dupont.fr
              </p>
              <div className="mt-1.5">
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
              </div>
            </div>
          </div>
        </div>

        {/* Section paramètres */}
        <div style={{ padding: "2px 0" }}>
          <DropdownMenuItem onClick={() => router.push("/demo/settings")}>
            <Building2 className="w-4 h-4 shrink-0" />
            Mon entreprise
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/demo/settings")}>
            <FileText className="w-4 h-4 shrink-0" />
            Préférences factures
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/demo/settings")}>
            <CreditCard className="w-4 h-4 shrink-0" />
            Mon abonnement
          </DropdownMenuItem>
        </div>

        {withThemeToggle && (
          <>
            <DropdownMenuSeparator style={{ background: dropdownBorder, margin: "4px 0" }} />
            <DropdownMenuItem onClick={() => setTheme(isDark ? "light" : "dark")}>
              {isDark
                ? <Sun  className="w-4 h-4 shrink-0" />
                : <Moon className="w-4 h-4 shrink-0" />
              }
              {isDark ? "Mode clair" : "Mode sombre"}
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator style={{ background: dropdownBorder, margin: "4px 0" }} />

        <DropdownMenuItem onClick={() => router.push("/signup")}>
          <UserPlus className="w-4 h-4 shrink-0" />
          Créer mon compte
        </DropdownMenuItem>
      </DropdownMenuContent>
    )
  }

  return (
    <>
      {/* ════════════════════════════════════════════════════════════════
          MOBILE header (< lg) — pilules solides, pas de toggle thème
          (crash GPU iOS Safari — cf. CLAUDE.md)
          ════════════════════════════════════════════════════════════════ */}
      <header
        className="lg:hidden flex items-center justify-between gap-2 px-3 shrink-0 z-20"
        style={{
          paddingTop:    'max(12px, env(safe-area-inset-top, 12px))',
          paddingBottom: '10px',
          minHeight:     '54px',
        }}
      >
        {/* Gauche : pilule titre + badge DÉMO */}
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="flex items-center gap-2 rounded-full px-3.5 py-1.5 min-w-0"
            style={MOBILE_PILL}
          >
            <h1 className="text-[15px] font-semibold truncate text-[#0F172A] dark:text-[#E2E8F0]">
              {title}
            </h1>
            <span
              className="shrink-0 inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-amber-300 dark:border-amber-700/60"
              style={{
                color:      '#92400e',
                background: isDark ? 'rgba(120,53,15,0.20)' : '#fffbeb',
              }}
            >
              DÉMO
            </span>
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
                title="Jean Dupont"
              >
                JD
              </DropdownMenuTrigger>
              {renderDropdown(false)}
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* ════════════════════════════════════════════════════════════════
          DESKTOP header (≥ lg)
          Pilules glass flottant sur le dégradé — identique au vrai header
          ════════════════════════════════════════════════════════════════ */}
      <header className="hidden lg:flex h-[60px] px-5 items-center justify-between shrink-0 gap-3 relative z-20">

        {/* ── Gauche : pilule titre + badge démo ── */}
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="header-pill-glass flex items-center gap-2 rounded-full px-4 py-2 min-w-0"
            style={{ background: PILL_BG, border: PILL_BORDER, boxShadow: PILL_SHADOW }}
          >
            <h1 className="text-[14px] font-semibold text-[#0F172A] dark:text-[#E2E8F0] truncate max-w-xs">
              {title}
            </h1>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700/50 px-2 py-0.5 rounded-full whitespace-nowrap">
              ✦ Démo
            </span>
          </div>
        </div>

        {/* ── Droite : CTA + pilule [thème + cloche + séparateur + avatar] ── */}
        <div className="flex items-center gap-2 shrink-0">

          {/* CTA contextuel */}
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

          {/* Pilule [thème + cloche + séparateur + avatar] */}
          <div
            className="header-pill-glass flex items-center gap-0.5 rounded-full px-1.5 py-1"
            style={{ background: PILL_BG, border: PILL_BORDER, boxShadow: PILL_SHADOW }}
          >
            {/* Thème — utilise le composant ThemeToggle comme le vrai header */}
            <ThemeToggle />

            <div className="w-px h-4 bg-slate-200/80 dark:bg-slate-700/80 mx-0.5" />

            {/* Cloche */}
            <button
              className="flex items-center justify-center w-8 h-8 rounded-full text-slate-400 dark:text-slate-500"
              aria-label="Notifications"
            >
              <Bell className="w-[17px] h-[17px]" />
            </button>

            <div className="w-px h-4 bg-slate-200/80 dark:bg-slate-700/80 mx-0.5" />

            {/* Avatar */}
            <DropdownMenu>
              <DropdownMenuTrigger
                className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
                style={avatarStyle}
                title="Jean Dupont"
              >
                JD
              </DropdownMenuTrigger>
              {renderDropdown(true)}
            </DropdownMenu>
          </div>
        </div>
      </header>
    </>
  )
}
