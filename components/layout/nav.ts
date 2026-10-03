/**
 * Navigation de l'application, partagée par la barre latérale, la barre du bas
 * mobile, la feuille « Plus », le menu « Nouveau » et la palette de recherche —
 * pour l'application réelle comme pour la démo (préfixe /demo).
 *
 * N'y figurent que des écrans qui existent : pas de chantiers ni de
 * trésorerie tant qu'ils ne sont pas livrés (DECISIONS § 10).
 */
import {
  LayoutDashboard, FileText, FileCheck2, Users, Package, ShoppingCart,
  ReceiptText, Download, SlidersHorizontal, UserPlus, Inbox,
  type LucideIcon,
} from "lucide-react"

export type ShellMode = "app" | "demo"

/** Événement qui ouvre la recherche ⌘K (émis par la feuille « Plus » sur mobile). */
export const OPEN_SEARCH_EVENT = "qonforme:open-search"

export interface NavLink {
  key: string
  label: string
  /** Chemin dans l'application réelle. */
  href: string
  /** Chemin dans la démo (absent : l'écran n'existe pas en démo, l'entrée reste mais renvoie vers l'inscription). */
  demoHref?: string
  icon: LucideIcon
  /** Courte description (feuille « Plus », palette de recherche). */
  hint?: string
}

export const NAV_MAIN: NavLink[] = [
  { key: "dashboard", label: "Tableau de bord", href: "/dashboard", demoHref: "/demo", icon: LayoutDashboard },
  { key: "invoices", label: "Factures", href: "/invoices", demoHref: "/demo/invoices", icon: FileText, hint: "Toutes vos factures" },
  { key: "quotes", label: "Devis", href: "/quotes", demoHref: "/demo/quotes", icon: FileCheck2, hint: "Gratuits et illimités" },
  { key: "purchase-orders", label: "Bons de commande", href: "/purchase-orders", demoHref: "/demo/purchase-orders", icon: ShoppingCart, hint: "Facultatifs" },
  { key: "credit-notes", label: "Avoirs", href: "/credit-notes", demoHref: "/demo/credit-notes", icon: ReceiptText, hint: "Corrections de factures" },
  { key: "received-invoices", label: "Factures reçues", href: "/received-invoices", demoHref: "/demo/received-invoices", icon: Inbox, hint: "Factures de vos fournisseurs" },
  { key: "clients", label: "Clients", href: "/clients", demoHref: "/demo/clients", icon: Users, hint: "Particuliers et professionnels" },
  { key: "products", label: "Catalogue", href: "/products", demoHref: "/demo/products", icon: Package, hint: "Vos prestations et fournitures" },
]

export const NAV_PILOTAGE: NavLink[] = [
  { key: "exports", label: "Exports comptables", href: "/settings/exports", demoHref: "/demo/settings/exports", icon: Download, hint: "Fichier des écritures comptables" },
]

export const NAV_SETTINGS: NavLink = {
  key: "settings", label: "Paramètres", href: "/settings", demoHref: "/demo/settings", icon: SlidersHorizontal,
}

/** Menu « Nouveau » (barre supérieure) et feuille de création mobile. */
export interface CreateLink {
  key: string
  label: string
  hint: string
  href: string
  demoHref?: string
  icon: LucideIcon
  /** Raccourci clavier, actif quand le menu est ouvert. */
  shortcut: string
}

export const CREATE_LINKS: CreateLink[] = [
  { key: "quote", label: "Nouveau devis", hint: "Client, prestations, envoi", href: "/quotes/new", demoHref: "/demo/quotes/new", icon: FileCheck2, shortcut: "D" },
  { key: "invoice", label: "Nouvelle facture", hint: "Directe, sans devis", href: "/invoices/new", demoHref: "/demo/invoices/new", icon: FileText, shortcut: "F" },
  { key: "client", label: "Nouveau client", hint: "Par SIREN ou à la main", href: "/clients/new", demoHref: "/demo/clients/new", icon: UserPlus, shortcut: "C" },
  { key: "purchase-order", label: "Nouveau bon de commande", hint: "Facultatif, pour un client qui en demande", href: "/purchase-orders/new", demoHref: "/demo/purchase-orders/new", icon: ShoppingCart, shortcut: "B" },
]

/** Chemin d'une entrée selon le mode. En démo, un écran absent renvoie vers l'inscription. */
export function hrefFor(link: { href: string; demoHref?: string }, mode: ShellMode): string {
  if (mode === "app") return link.href
  return link.demoHref ?? "/signup"
}

/** Vrai si `pathname` appartient à la section `href` (le tableau de bord n'englobe pas les autres). */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/dashboard" || href === "/demo") return pathname === href
  if (href === "/settings" || href === "/demo/settings") {
    return pathname.startsWith(href) && !pathname.startsWith(href + "/exports")
  }
  return pathname === href || pathname.startsWith(href + "/")
}

/** Titre et fil d'Ariane de la barre supérieure, déduits du chemin. */
const SECTION_TITLES: { prefix: string; title: string; href: string }[] = [
  { prefix: "/invoices", title: "Factures", href: "/invoices" },
  { prefix: "/quotes", title: "Devis", href: "/quotes" },
  { prefix: "/clients", title: "Clients", href: "/clients" },
  { prefix: "/products", title: "Catalogue", href: "/products" },
  { prefix: "/purchase-orders", title: "Bons de commande", href: "/purchase-orders" },
  { prefix: "/credit-notes", title: "Avoirs", href: "/credit-notes" },
  { prefix: "/received-invoices", title: "Factures reçues", href: "/received-invoices" },
  { prefix: "/settings/exports", title: "Exports comptables", href: "/settings/exports" },
  { prefix: "/settings", title: "Paramètres", href: "/settings" },
  { prefix: "/dashboard", title: "Tableau de bord", href: "/dashboard" },
]

const LEAF_TITLES: Record<string, string> = {
  "/invoices/new": "Nouvelle facture",
  "/quotes/new": "Nouveau devis",
  "/clients/new": "Nouveau client",
  "/purchase-orders/new": "Nouveau bon de commande",
  "/received-invoices/import": "Importer une facture",
  "/settings/company": "Entreprise",
  "/settings/invoices": "Modèles de documents",
  "/settings/notifications": "Notifications",
  "/settings/billing": "Abonnement",
  "/settings/ppf": "Facturation électronique",
}

export interface Crumbs {
  /** Section (lien) — absente sur la page racine d'une section. */
  parent?: { label: string; href: string }
  /** Libellé courant ; `null` quand la page le fournit elle-même (numéro de document). */
  current: string | null
}

/** Déduit le fil d'Ariane d'un chemin (réel ou démo). Le libellé d'un document est fourni par la page (SetCrumb). */
export function crumbsFor(rawPath: string): Crumbs {
  const isDemo = rawPath === "/demo" || rawPath.startsWith("/demo/")
  const path = isDemo ? (rawPath === "/demo" ? "/dashboard" : rawPath.slice("/demo".length)) : rawPath
  const prefix = (href: string) => (isDemo ? (href === "/dashboard" ? "/demo" : "/demo" + href) : href)

  const section = SECTION_TITLES.find((s) => path === s.prefix || path.startsWith(s.prefix + "/"))
  if (!section) return { current: "Qonforme" }
  if (path === section.prefix) return { current: section.title }

  const leaf = LEAF_TITLES[path]
  const parent = { label: section.title, href: prefix(section.href) }
  if (leaf) return { parent, current: leaf }
  if (path.endsWith("/edit")) return { parent, current: null }
  return { parent, current: null }
}
