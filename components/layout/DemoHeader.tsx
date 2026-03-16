'use client'

import { Bell, Plus, FileText, FileCheck2, ShoppingCart } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

/* ------------------------------------------------------------------ */
/* Styles pilules — identiques au vrai Header                          */
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
  "/demo/invoices":        { href: "/demo/invoices/new",       label: "Nouvelle facture", icon: FileText     },
  "/demo/quotes":          { href: "/demo/quotes",             label: "Nouveau devis",    icon: FileCheck2   },
  "/demo/clients":         { href: "/demo/clients",            label: "Nouveau client",   icon: Plus         },
  "/demo/purchase-orders": { href: "/demo/purchase-orders",    label: "Nouveau BdC",      icon: ShoppingCart },
  "/demo/products":        { href: "/demo/products",           label: "Nouveau produit",  icon: Plus         },
}

/* ------------------------------------------------------------------ */
/* Composant                                                            */
/* ------------------------------------------------------------------ */

export function DemoHeader() {
  const pathname = usePathname()
  const title    = PAGE_TITLES[pathname] ?? "Qonforme"
  const cta      = PAGE_CTA[pathname]

  return (
    <header className="h-14 md:h-[60px] px-3 md:px-5 flex items-center justify-between shrink-0 gap-3 relative z-20">

      {/* ── Gauche : pilule titre + badge démo ── */}
      <div className="flex items-center gap-2 min-w-0">

        {/* Pilule titre — identique au vrai header */}
        <div
          className="header-pill-glass flex items-center gap-2 rounded-full px-4 py-2 min-w-0"
          style={{
            background: PILL_BG,
            border:     PILL_BORDER,
            boxShadow:  PILL_SHADOW,
          }}
        >
          <h1 className="text-[13px] md:text-[14px] font-semibold text-[#0F172A] truncate max-w-[140px] sm:max-w-xs">
            {title}
          </h1>
          {/* Badge démo discret dans la pilule */}
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full whitespace-nowrap">
            ✦ Démo
          </span>
        </div>
      </div>

      {/* ── Droite : CTA + pilule [cloche + avatar] ── */}
      <div className="flex items-center gap-2 shrink-0">

        {/* CTA contextuel — gradient identique au vrai header */}
        {cta && (
          <button
            className="inline-flex items-center gap-1.5 rounded-full text-white text-[13px] font-bold px-3.5 py-2 whitespace-nowrap touch-manipulation"
            style={{
              background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
              boxShadow:  "0 2px 10px rgba(37,99,235,0.30)",
              transition: "transform 0.1s ease, box-shadow 0.1s ease",
            }}
            onTouchStart={e => { e.currentTarget.style.transform = "scale(0.97)" }}
            onTouchEnd={e   => { e.currentTarget.style.transform = "" }}
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden xs:inline">{cta.label}</span>
          </button>
        )}

        {/* Pilule droite [cloche + séparateur + avatar] — identique au vrai header */}
        <div
          className="header-pill-glass flex items-center gap-0.5 rounded-full px-1.5 py-1"
          style={{
            background: PILL_BG,
            border:     PILL_BORDER,
            boxShadow:  PILL_SHADOW,
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

          {/* Avatar JD — gradient identique au vrai header */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold cursor-pointer select-none"
            style={{
              background: "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)",
              color:      "#2563EB",
              border:     "1.5px solid rgba(37,99,235,0.20)",
              transition: "transform 0.15s ease",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1.05)" }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "" }}
            title="Jean Dupont"
          >
            JD
          </div>
        </div>
      </div>
    </header>
  )
}
