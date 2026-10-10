"use client"

/**
 * Carte de navigation des Paramètres de l'onglet SEO : 260 px à gauche sur
 * ordinateur, liste pleine largeur au-dessus du contenu sur téléphone.
 * L'écran actif est en --q-wash, comme dans la barre latérale.
 */
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Building2, Globe, Mail, Plug, Target, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export const SETTINGS_SCREENS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/admin/seo/parametres", label: "Contexte de marque", icon: Building2 },
  { href: "/admin/seo/parametres/strategie", label: "Stratégie SEO", icon: Target },
  { href: "/admin/seo/parametres/ciblage", label: "Ciblage", icon: Globe },
  { href: "/admin/seo/parametres/connexions", label: "Connexions", icon: Plug },
  { href: "/admin/seo/parametres/rapports", label: "Rapports", icon: Mail },
]

export function SettingsNav() {
  const pathname = usePathname()?.replace(/\/+$/, "") ?? ""
  return (
    <nav
      aria-label="Rubriques des paramètres"
      className="q-card flex w-full flex-col gap-0.5 rounded-2xl p-2 md:w-[260px] md:flex-none"
    >
      {SETTINGS_SCREENS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-12 items-center gap-2.5 rounded-[9px] px-3 text-[15px] leading-tight transition-colors md:h-10 md:text-sm",
              active
                ? "bg-[var(--q-wash)] font-semibold text-[var(--q-accent-strong)] shadow-[inset_0_0_0_1px_var(--q-wash-line)]"
                : "font-medium text-[var(--q-text-2)] hover:bg-[var(--q-hover)] hover:text-[var(--q-ink)]",
            )}
          >
            <Icon className="size-[17px] shrink-0" strokeWidth={1.75} aria-hidden />
            <span className="min-w-0 flex-1 truncate">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
