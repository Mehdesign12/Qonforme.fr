/**
 * Navigation de l'espace admin, partagée par la barre latérale (ordinateur),
 * la barre du bas et la feuille « Plus » (mobile) et le fil d'Ariane de la
 * barre supérieure.
 */
import {
  LayoutDashboard, Users, CreditCard, MessageSquare, TriangleAlert, Activity,
  ChartColumn, FileText, Bot, ShieldAlert, Palette, UserSearch, Megaphone,
  type LucideIcon,
} from "lucide-react"

export type AdminBadge = "support" | "errors"

export interface AdminNavLink {
  key: string
  label: string
  href: string
  icon: LucideIcon
  /** Courte description (feuille « Plus » sur mobile). */
  hint?: string
  /** Compteur affiché à droite de l'entrée. */
  badge?: AdminBadge
}

export interface AdminNavGroup {
  key: string
  /** Titre du groupe (absent : premier groupe, sans titre). */
  label?: string
  /** Mention à côté du titre (« Désactivée » pour la prospection). */
  tag?: string
  links: AdminNavLink[]
}

export const ADMIN_HOME: AdminNavLink = {
  key: "overview", label: "Vue d'ensemble", href: "/admin", icon: LayoutDashboard, hint: "Comptes, abonnements, revenus",
}

export const ADMIN_NAV: AdminNavGroup[] = [
  { key: "home", links: [ADMIN_HOME] },
  {
    key: "accounts",
    label: "Comptes",
    links: [
      { key: "users", label: "Utilisateurs", href: "/admin/users", icon: Users, hint: "Entreprises inscrites" },
      { key: "subscriptions", label: "Abonnements", href: "/admin/subscriptions", icon: CreditCard, hint: "Formules et renouvellements" },
    ],
  },
  {
    key: "follow",
    label: "Suivi",
    links: [
      { key: "support", label: "Support", href: "/admin/support", icon: MessageSquare, hint: "Signalements et messages", badge: "support" },
      { key: "errors", label: "Erreurs", href: "/admin/errors", icon: TriangleAlert, hint: "Erreurs enregistrées par l'application", badge: "errors" },
      { key: "health", label: "Santé du système", href: "/admin/health", icon: Activity, hint: "Services et tâches planifiées" },
      { key: "analytics", label: "Audience", href: "/admin/analytics", icon: ChartColumn, hint: "Visites et inscriptions (PostHog)" },
    ],
  },
  {
    key: "content",
    label: "Contenu",
    links: [
      { key: "blog", label: "Blog", href: "/admin/blog", icon: FileText, hint: "Articles publiés et brouillons" },
      { key: "blog-ai", label: "Génération IA", href: "/admin/blog/ai", icon: Bot, hint: "Articles générés par Gemini" },
      { key: "blog-check", label: "Vérification du blog", href: "/admin/blog/verification", icon: ShieldAlert, hint: "Passages obsolètes ou interdits" },
      { key: "brand", label: "Brand Studio", href: "/admin/brand-studio", icon: Palette, hint: "Images aux couleurs de Qonforme" },
    ],
  },
  {
    key: "prospecting",
    label: "Prospection",
    tag: "Désactivée",
    links: [
      { key: "prospects", label: "Prospects", href: "/admin/prospects", icon: UserSearch, hint: "Base Sirene, consultation seule" },
      { key: "outreach", label: "Campagnes", href: "/admin/outreach", icon: Megaphone, hint: "Démarchage désactivé par décision" },
    ],
  },
]

const ALL_LINKS: AdminNavLink[] = ADMIN_NAV.flatMap((g) => g.links)

/** Vrai si `pathname` relève de l'entrée `href` (la vue d'ensemble et le blog n'englobent pas leurs voisins). */
export function isAdminActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin"
  if (href === "/admin/blog") {
    return (pathname === href || pathname.startsWith(href + "/"))
      && !pathname.startsWith("/admin/blog/ai")
      && !pathname.startsWith("/admin/blog/verification")
  }
  return pathname === href || pathname.startsWith(href + "/")
}

/** Entrée de navigation de la page courante. */
export function adminLinkFor(pathname: string): AdminNavLink | undefined {
  return ALL_LINKS.find((l) => isAdminActive(pathname, l.href))
}

export interface AdminCrumbs {
  parent?: { label: string; href: string }
  /** Libellé courant ; `null` quand la page le fournit (nom de l'entreprise). */
  current: string | null
}

/** Fil d'Ariane de la barre supérieure, déduit du chemin. */
export function adminCrumbsFor(pathname: string): AdminCrumbs {
  const link = adminLinkFor(pathname)
  if (!link) return { current: "Admin" }
  if (pathname === link.href) return { current: link.label }
  const parent = { label: link.label, href: link.href }
  if (pathname === "/admin/blog/new") return { parent, current: "Nouvel article" }
  if (pathname.startsWith("/admin/blog/")) return { parent, current: "Modifier l'article" }
  return { parent, current: null }
}
