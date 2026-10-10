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
  "/demo/tresorerie":       "Trésorerie",
  "/demo/relances":         "Relances",
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
  "/demo/clients":         { href: "/demo/clients/new",     label: "Nouveau client",   icon: Plus         },
  "/demo/purchase-orders": { href: "/demo/purchase-orders", label: "Nouveau BdC",      icon: ShoppingCart },
  "/demo/products":        { href: "/demo/products",        label: "Nouveau produit",  icon: Plus         },
}

/* ------------------------------------------------------------------ */
/* Composant                                                            */
/* ------------------------------------------------------------------ */

export function DemoHeader() {
  return <Header identity={DEMO_IDENTITY} />
}
