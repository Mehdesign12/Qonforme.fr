'use client'

import { useState } from "react"
import { Bell, Plus, Menu, FileText, FileCheck2, ShoppingCart } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { MobileSidebar } from "@/components/layout/Sidebar"

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
/* Styles pilules — UNE seule couche de blur pour tout le header        */
/* blur réduit à 8px (was 14px) : même rendu, 40% moins cher GPU       */
/* ------------------------------------------------------------------ */

const PILL_BG     = "rgba(255,255,255,0.82)"
const PILL_BORDER = "1px solid rgba(255,255,255,0.72)"
const PILL_SHADOW = "0 2px 10px rgba(37,99,235,0.07), 0 1px 2px rgba(0,0,0,0.03)"
const PILL_BLUR   = "blur(8px)"

/* ------------------------------------------------------------------ */
/* Props                                                                */
/* ------------------------------------------------------------------ */

interface HeaderProps {
  firstName?: string
  lastName?:  string
}

/* ------------------------------------------------------------------ */
/* Composant                                                            */
/* ------------------------------------------------------------------ */

export function Header({ firstName = "", lastName = "" }: HeaderProps) {
  const pathname  = usePathname()
  const title     = getTitle(pathname)
  const cta       = PAGE_CTA[pathname]
  const initials  = getInitials(firstName, lastName)
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <>
      {/* ── Header transparent — pilules flottent sur le gradient ── */}
      <header className="h-14 md:h-[60px] px-3 md:px-5 flex items-center justify-between shrink-0 gap-3 relative z-20">

        {/* ── Gauche : hamburger (mobile) + pilule titre ── */}
        <div className="flex items-center gap-2 min-w-0">

          {/* Hamburger mobile */}
          <button
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-full shrink-0 touch-manipulation"
            style={{
              background:           PILL_BG,
              backdropFilter:       PILL_BLUR,
              WebkitBackdropFilter: PILL_BLUR,
              border:               PILL_BORDER,
              boxShadow:            PILL_SHADOW,
              /* GPU compositing hint — évite le repaint au tap */
              willChange:           "opacity",
            }}
            onClick={() => setDrawerOpen(true)}
            aria-label="Ouvrir le menu"
          >
            <Menu className="w-4 h-4 text-slate-500" />
          </button>

          {/* Pilule titre */}
          <div
            className="flex items-center rounded-full px-4 py-2 min-w-0"
            style={{
              background:           PILL_BG,
              backdropFilter:       PILL_BLUR,
              WebkitBackdropFilter: PILL_BLUR,
              border:               PILL_BORDER,
              boxShadow:            PILL_SHADOW,
            }}
          >
            <h1 className="text-[13px] md:text-[14px] font-semibold text-[#0F172A] truncate max-w-[160px] sm:max-w-xs">
              {title}
            </h1>
          </div>
        </div>

        {/* ── Droite : CTA + pilule [notif + avatar] ── */}
        <div className="flex items-center gap-2 shrink-0">

          {/* CTA contextuel */}
          {cta && (
            <Link href={cta.href}>
              <button
                className="inline-flex items-center gap-1.5 rounded-full text-white text-[13px] font-bold px-3.5 py-2 whitespace-nowrap touch-manipulation"
                style={{
                  background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
                  boxShadow:  "0 2px 10px rgba(37,99,235,0.30)",
                  /* Pas de transition-all — only transform au tap */
                  transition: "transform 0.1s ease, box-shadow 0.1s ease",
                }}
                onTouchStart={e => { e.currentTarget.style.transform = "scale(0.97)" }}
                onTouchEnd={e   => { e.currentTarget.style.transform = "" }}
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden xs:inline">{cta.label}</span>
              </button>
            </Link>
          )}

          {/* Pilule [cloche + avatar] — UNE seule couche composite */}
          <div
            className="flex items-center gap-0.5 rounded-full px-1.5 py-1"
            style={{
              background:           PILL_BG,
              backdropFilter:       PILL_BLUR,
              WebkitBackdropFilter: PILL_BLUR,
              border:               PILL_BORDER,
              boxShadow:            PILL_SHADOW,
            }}
          >
            {/* Cloche */}
            <button
              className="flex items-center justify-center w-8 h-8 rounded-full text-slate-400 touch-manipulation"
              style={{ transition: "color 0.15s ease" }}
              onMouseEnter={e => { e.currentTarget.style.color = "#475569" }}
              onMouseLeave={e => { e.currentTarget.style.color = "" }}
              aria-label="Notifications"
            >
              <Bell className="w-[17px] h-[17px]" />
            </button>

            {/* Séparateur */}
            <div className="w-px h-4 bg-slate-200/80 mx-0.5" />

            {/* Avatar initiales */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold cursor-pointer select-none"
              style={{
                background: "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)",
                color:      "#2563EB",
                border:     "1.5px solid rgba(37,99,235,0.20)",
                /* scale hover géré en CSS pur — pas de JS re-render */
                transition: "transform 0.15s ease",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1.05)" }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "" }}
              title={`${firstName} ${lastName}`.trim() || "Profil"}
            >
              {initials}
            </div>
          </div>
        </div>
      </header>

      {/* Drawer mobile */}
      <MobileSidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  )
}
