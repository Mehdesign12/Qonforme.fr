/**
 * En-tête commun des pages de l'onglet SEO : titre, sous-titre, actions, puis
 * sur téléphone le sélecteur des rubriques (la barre latérale n'y est pas) et,
 * pour les rubriques qui en ont, les sous-onglets.
 *
 * Composants serveur (liens seulement) : utilisables dans les pages serveur
 * comme dans les pages client.
 */
import Link from "next/link"
import { PageHeader } from "@/components/app/kit"
import { cn } from "@/lib/utils"
import { SEO_SECTIONS, type SeoSectionKey } from "@/lib/seo/types"

export function SeoHeader({
  section,
  title,
  subtitle,
  actions,
  backHref,
  backLabel,
}: {
  section: SeoSectionKey
  title: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  backHref?: string
  backLabel?: string
}) {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={title} subtitle={subtitle} actions={actions} backHref={backHref} backLabel={backLabel} />
      <SeoSectionsNav current={section} />
    </div>
  )
}

/** Rubriques de l'onglet SEO en puces défilantes, sur téléphone et tablette seulement. */
export function SeoSectionsNav({ current }: { current: SeoSectionKey }) {
  return (
    <nav aria-label="Rubriques SEO" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden">
      <ul className="flex w-max gap-2">
        {SEO_SECTIONS.map((s) => {
          const active = s.key === current
          return (
            <li key={s.key}>
              <Link
                href={s.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-11 items-center whitespace-nowrap rounded-full border px-4 text-[15px] font-semibold transition-colors",
                  active
                    ? "border-[var(--q-accent)] bg-[var(--q-wash)] text-[var(--q-accent-strong)]"
                    : "border-[var(--q-line)] bg-[var(--q-surface)] text-[var(--q-text-2)]",
                )}
              >
                {s.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export interface SeoTab {
  href: string
  label: string
  /** Compteur affiché après le libellé (onglets d'état). */
  count?: number | null
}

/** Sous-onglets d'une rubrique (Performance, Articles, Paramètres…), liens avec aria-current. */
export function SeoTabs({ tabs, current, label = "Sous-onglets", className }: { tabs: SeoTab[]; current: string; label?: string; className?: string }) {
  return (
    <nav aria-label={label} className={cn("q-tabs", className)}>
      {tabs.map((t) => {
        const active = t.href === current
        return (
          <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined}>
            {t.label}
            {t.count !== undefined && t.count !== null && <span className="q-count">{t.count.toLocaleString("fr-FR")}</span>}
          </Link>
        )
      })}
    </nav>
  )
}

/**
 * Contrôle segmenté en liens (période, appareil…) : garde les autres paramètres
 * de l'adresse. `param` est le nom du paramètre GET modifié.
 */
export function SegmentedLinks({
  options,
  current,
  param,
  basePath,
  params = {},
  label,
}: {
  options: { value: string; label: string }[]
  current: string
  param: string
  basePath: string
  params?: Record<string, string | undefined>
  label: string
}) {
  return (
    <div role="group" aria-label={label} className="q-seg">
      {options.map((o) => {
        const qs = new URLSearchParams()
        for (const [k, v] of Object.entries(params)) if (v && k !== param) qs.set(k, v)
        qs.set(param, o.value)
        return (
          <Link key={o.value} href={`${basePath}?${qs}`} aria-current={o.value === current ? "page" : undefined} scroll={false}>
            {o.label}
          </Link>
        )
      })}
    </div>
  )
}
