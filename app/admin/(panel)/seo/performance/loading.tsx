"use client"

/**
 * Chargement de la rubrique Performance (Recherche Google, PageSpeed Insights ;
 * l'Audit du site a son propre squelette) : en-tête et sous-onglets à leur
 * place, squelettes des indicateurs et d'un tableau, sans animation lourde.
 */
import { usePathname } from "next/navigation"
import { SeoHeader, SeoTabs } from "@/components/admin/seo/SeoHeader"
import { PERFORMANCE_SUBTITLE, PERFORMANCE_TABS, PERFORMANCE_TITLE } from "@/components/admin/seo/performance/tabs"

function Bar({ className }: { className: string }) {
  return <span className={`block rounded-md bg-[var(--q-sunken)] ${className}`} />
}

export default function Loading() {
  const pathname = usePathname()
  const current = PERFORMANCE_TABS.find((t) => t.href === pathname)?.href ?? PERFORMANCE_TABS[0].href
  return (
    <>
      <SeoHeader section="performance" title={PERFORMANCE_TITLE} subtitle={PERFORMANCE_SUBTITLE} />
      <SeoTabs tabs={PERFORMANCE_TABS} current={current} label="Sous-onglets de Performance" />
      <div aria-busy="true" aria-live="polite" className="flex flex-col gap-5">
        <span className="sr-only">Chargement…</span>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-hidden>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="q-kpi rounded-2xl border border-[var(--q-line)] bg-[var(--q-surface)]">
              <Bar className="h-3.5 w-24" />
              <Bar className="h-7 w-16" />
              <Bar className="h-3 w-32" />
            </div>
          ))}
        </div>
        <div className="q-card overflow-hidden" aria-hidden>
          <div className="flex flex-col gap-3 p-5">
            <Bar className="h-4 w-40" />
            <Bar className="h-[170px] w-full md:h-[230px]" />
          </div>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 border-t border-[var(--q-line-soft)] px-5 py-4">
              <Bar className="h-3.5 w-48" />
              <Bar className="ml-auto h-3.5 w-16" />
              <Bar className="h-3.5 w-12" />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
