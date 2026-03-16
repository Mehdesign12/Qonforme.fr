'use client'

import {
  Bell, Plus, FileText, FileCheck2, ShoppingCart,
  Building2, CreditCard, Sun, Moon, UserPlus,
} from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { useState, useEffect } from "react"
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

/* ------------------------------------------------------------------ */
/* Titres de pages                                                      */
/* ------------------------------------------------------------------ */

const PAGE_TITLES: Record<string, string> = {
  "/demo":                  "Tableau de bord",
  "/demo/invoices":         "Factures",
  "/demo/invoices/new":     "Nouvelle facture",
  "/demo/quotes":           "Devis",
  "/demo/clients":          "Clients",
  "/demo/products":         "Catalogue produits",
  "/demo/purchase-orders":  "Bons de commande",
  "/demo/credit-notes":     "Avoirs",
  "/demo/settings":         "Paramètres",
  "/demo/settings/ppf":     "Connexion PPF",
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
  "/demo/quotes":          { href: "/demo/quotes",          label: "Nouveau devis",    icon: FileCheck2   },
  "/demo/clients":         { href: "/demo/clients",         label: "Nouveau client",   icon: Plus         },
  "/demo/purchase-orders": { href: "/demo/purchase-orders", label: "Nouveau BdC",      icon: ShoppingCart },
  "/demo/products":        { href: "/demo/products",        label: "Nouveau produit",  icon: Plus         },
}

/* ------------------------------------------------------------------ */
/* Dropdown profil partagé mobile + desktop                            */
/* ------------------------------------------------------------------ */

function ProfileDropdownContent({
  isDark,
  setTheme,
  router,
}: {
  isDark:   boolean
  setTheme: (t: string) => void
  router:   ReturnType<typeof useRouter>
}) {
  return (
    <DropdownMenuContent align="end" sideOffset={8} style={{ minWidth: "220px" }}>
      {/* En-tête identité */}
      <div className="px-3 py-2.5 flex items-center gap-2.5">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0"
          style={{
            background: "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)",
            color:      "#2563EB",
            border:     "1.5px solid rgba(37,99,235,0.20)",
          }}
        >
          JD
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-foreground truncate leading-tight">
            Jean Dupont
          </p>
          <p className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
            jean@dupont.fr
          </p>
          <div className="mt-1">
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

      <DropdownMenuSeparator />

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

      <DropdownMenuSeparator />

      <DropdownMenuItem onClick={() => setTheme(isDark ? "light" : "dark")}>
        {isDark
          ? <Sun  className="w-4 h-4 shrink-0" />
          : <Moon className="w-4 h-4 shrink-0" />
        }
        {isDark ? "Mode clair" : "Mode sombre"}
      </DropdownMenuItem>

      <DropdownMenuSeparator />

      <DropdownMenuItem onClick={() => router.push("/signup")}>
        <UserPlus className="w-4 h-4 shrink-0" />
        Créer mon compte
      </DropdownMenuItem>
    </DropdownMenuContent>
  )
}

/* ------------------------------------------------------------------ */
/* Composant                                                            */
/* ------------------------------------------------------------------ */

export function DemoHeader() {
  const pathname = usePathname()
  const router   = useRouter()
  const title    = PAGE_TITLES[pathname] ?? "Qonforme"
  const cta      = PAGE_CTA[pathname]

  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isDark = mounted && theme === "dark"

  /* ── Avatar trigger — partagé ── */
  const avatarTriggerStyle = {
    background: "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)",
    color:      "#2563EB",
    border:     "1.5px solid rgba(37,99,235,0.20)",
  } as React.CSSProperties

  return (
    <>
      {/* ════════════════════════════════════════════════════════════════
          MOBILE header (< md)
          Fond solide calqué sur la sidebar, safe-area top, tap targets ≥ 44 px
          ════════════════════════════════════════════════════════════════ */}
      <header
        className="md:hidden flex items-center gap-2 px-3 shrink-0 border-b border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#0F1E35]"
        style={{
          paddingTop:    'max(12px, env(safe-area-inset-top, 12px))',
          paddingBottom: '10px',
          minHeight:     '54px',
        }}
      >
        {/* Titre + badge DÉMO */}
        <div className="flex-1 flex items-center gap-2 min-w-0 pl-1">
          <h1
            className="text-[15px] font-semibold truncate text-[#0F172A] dark:text-[#E2E8F0]"
          >
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

        {/* Actions droite */}
        <div className="flex items-center shrink-0">
          {/* CTA contextuel — icône seule sur mobile */}
          {cta && (
            <button
              onClick={() => router.push(cta.href)}
              className="w-10 h-10 flex items-center justify-center rounded-xl touch-manipulation"
              style={{ color: '#2563EB' }}
              aria-label={cta.label}
            >
              <Plus className="w-5 h-5" />
            </button>
          )}

          {/* Thème */}
          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="w-10 h-10 flex items-center justify-center rounded-xl touch-manipulation text-slate-400 dark:text-slate-500"
            aria-label={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
          >
            {isDark
              ? <Sun  className="w-[18px] h-[18px]" />
              : <Moon className="w-[18px] h-[18px]" />
            }
          </button>

          {/* Avatar + menu profil */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="w-10 h-10 flex items-center justify-center rounded-xl cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] touch-manipulation"
              title="Jean Dupont"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold"
                style={avatarTriggerStyle}
              >
                JD
              </div>
            </DropdownMenuTrigger>
            <ProfileDropdownContent isDark={isDark} setTheme={setTheme} router={router} />
          </DropdownMenu>
        </div>
      </header>

      {/* ════════════════════════════════════════════════════════════════
          DESKTOP header (≥ md)
          Pilules glass flottant sur le dégradé — identique au vrai header
          ════════════════════════════════════════════════════════════════ */}
      <header className="hidden md:flex h-[60px] px-5 items-center justify-between shrink-0 gap-3 relative z-20">

        {/* ── Gauche : pilule titre + badge démo ── */}
        <div
          className="header-pill-glass flex items-center gap-2 rounded-full px-4 py-2"
          style={{ background: PILL_BG, border: PILL_BORDER, boxShadow: PILL_SHADOW }}
        >
          <h1 className="text-[14px] font-semibold text-[#0F172A] dark:text-[#E2E8F0] truncate max-w-xs">
            {title}
          </h1>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700/50 px-2 py-0.5 rounded-full whitespace-nowrap">
            ✦ Démo
          </span>
        </div>

        {/* ── Droite : CTA + pilule [thème + cloche + avatar] ── */}
        <div className="flex items-center gap-2 shrink-0">

          {/* CTA contextuel */}
          {cta && (
            <button
              className="inline-flex items-center gap-1.5 rounded-full text-white text-[13px] font-bold px-3.5 py-2 whitespace-nowrap touch-manipulation"
              style={{
                background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
                boxShadow:  "0 2px 10px rgba(37,99,235,0.30)",
                transition: "transform 0.1s ease, box-shadow 0.1s ease",
              }}
              onClick={() => router.push(cta.href)}
              onTouchStart={e => { e.currentTarget.style.transform = "scale(0.97)" }}
              onTouchEnd={e   => { e.currentTarget.style.transform = "" }}
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              {cta.label}
            </button>
          )}

          {/* Pilule [thème + cloche + séparateur + avatar] */}
          <div
            className="header-pill-glass flex items-center gap-0.5 rounded-full px-1.5 py-1"
            style={{ background: PILL_BG, border: PILL_BORDER, boxShadow: PILL_SHADOW }}
          >
            {/* Thème */}
            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className="flex items-center justify-center w-8 h-8 rounded-full text-slate-400 dark:text-slate-500 touch-manipulation"
              style={{ transition: "color 0.15s ease" }}
              onMouseEnter={e => { e.currentTarget.style.color = "#475569" }}
              onMouseLeave={e => { e.currentTarget.style.color = "" }}
              aria-label={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
            >
              {isDark
                ? <Sun  className="w-[17px] h-[17px]" />
                : <Moon className="w-[17px] h-[17px]" />
              }
            </button>

            {/* Cloche */}
            <button
              className="flex items-center justify-center w-8 h-8 rounded-full text-slate-400 dark:text-slate-500 touch-manipulation"
              style={{ transition: "color 0.15s ease" }}
              onMouseEnter={e => { e.currentTarget.style.color = "#475569" }}
              onMouseLeave={e => { e.currentTarget.style.color = "" }}
              aria-label="Notifications"
            >
              <Bell className="w-[17px] h-[17px]" />
            </button>

            {/* Séparateur */}
            <div className="w-px h-4 bg-slate-200/80 dark:bg-slate-700/50 mx-0.5" />

            {/* Avatar */}
            <DropdownMenu>
              <DropdownMenuTrigger
                className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
                style={{
                  ...avatarTriggerStyle,
                  transition: "transform 0.15s ease",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1.05)" }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "" }}
                title="Jean Dupont"
              >
                JD
              </DropdownMenuTrigger>
              <ProfileDropdownContent isDark={isDark} setTheme={setTheme} router={router} />
            </DropdownMenu>
          </div>
        </div>
      </header>
    </>
  )
}
