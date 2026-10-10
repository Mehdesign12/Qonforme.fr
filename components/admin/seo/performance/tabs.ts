/**
 * Sous-onglets de la rubrique Performance (Recherche Google · PageSpeed
 * Insights · Audit du site), à passer à SeoTabs. L'onglet « Audit du site »
 * appartient au module d'audit ; il peut importer cette liste.
 */
import type { SeoTab } from "@/components/admin/seo/SeoHeader"

export const PERFORMANCE_TABS: SeoTab[] = [
  { href: "/admin/seo/performance", label: "Recherche Google" },
  { href: "/admin/seo/performance/pagespeed", label: "PageSpeed Insights" },
  { href: "/admin/seo/performance/audit", label: "Audit du site" },
]

export const PERFORMANCE_TITLE = "Performance"
export const PERFORMANCE_SUBTITLE = "Comprenez votre trafic de recherche et améliorez l'expérience de vos pages."

/**
 * À poser sur le conteneur d'un SegmentedLinks : sur téléphone, contrôle
 * segmenté pleine largeur à cibles de 44 px (planche « Mobile-vue-ensemble »).
 */
export const MOBILE_SEG_CLASS =
  "max-md:w-full max-md:[&_.q-seg]:flex max-md:[&_.q-seg]:w-full max-md:[&_.q-seg>a]:h-11 max-md:[&_.q-seg>a]:flex-1 max-md:[&_.q-seg>a]:text-sm"
