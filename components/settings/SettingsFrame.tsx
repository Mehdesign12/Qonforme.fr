"use client"

/**
 * Cadre des pages Paramètres (planches « Paramètres — … ») : colonne
 * « PARAMÈTRES » à gauche sur grand écran, onglets soulignés entre 1024 et
 * 1280 px, rien sur mobile (la page d'accueil des paramètres sert de liste et
 * chaque page porte un lien « ‹ Paramètres »).
 *
 * Partagé par l'application (app/settings/layout.tsx) et la démo (chaque page
 * de app/demo/settings l'enveloppe elle-même). Les exports comptables vivent
 * sous /settings mais appartiennent au pilotage : ils s'affichent sans ce cadre.
 *
 * Rubriques : components/settings/sections.ts.
 */
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import type { ShellMode } from "@/components/layout/nav"
import { SETTINGS_SECTIONS, settingsHref } from "@/components/settings/sections"

export function SettingsFrame({ mode, children }: { mode: ShellMode; children: React.ReactNode }) {
  const pathname = usePathname() ?? ""
  const path = mode === "demo" ? pathname.replace(/^\/demo/, "") : pathname

  // Exports comptables : rubrique « Pilotage », sans la colonne des paramètres (planche « Exports »).
  if (path.startsWith("/settings/exports")) return <>{children}</>

  const isActive = (href: string) => path === href || path.startsWith(href + "/")

  return (
    <div className="xl:grid xl:grid-cols-[230px_minmax(0,1fr)] xl:items-start xl:gap-7">
      {/* Colonne de gauche (≥ 1280 px) */}
      <nav aria-label="Sections des paramètres" className="sticky top-[84px] hidden flex-col gap-0.5 xl:flex">
        <span className="px-2.5 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--q-text-4)]">
          Paramètres
        </span>
        {SETTINGS_SECTIONS.map(({ key, label, href, icon: Icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={key}
              href={settingsHref(href, mode)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-[38px] items-center gap-2.5 rounded-[9px] px-2.5 text-sm transition-colors",
                active
                  ? "bg-[var(--q-wash)] font-semibold text-[var(--q-accent-strong)] shadow-[inset_0_0_0_1px_var(--q-wash-line)]"
                  : "font-medium text-[var(--q-text-2)] hover:bg-[var(--q-hover)] hover:text-[var(--q-ink)]",
              )}
            >
              <Icon className="size-[17px] shrink-0" strokeWidth={1.75} aria-hidden />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="flex min-w-0 flex-col gap-5">
        {/* Onglets (1024–1279 px) : la barre latérale de l'application laisse trop peu de place pour une colonne */}
        <nav aria-label="Sections des paramètres" className="q-tabs -mt-1 hidden lg:flex xl:hidden">
          {SETTINGS_SECTIONS.map(({ key, label, href }) => (
            <Link key={key} href={settingsHref(href, mode)} aria-current={isActive(href) ? "page" : undefined}>
              {label}
            </Link>
          ))}
        </nav>
        {children}
      </div>
    </div>
  )
}
