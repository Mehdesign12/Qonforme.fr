/**
 * Chargement de Performance › Audit du site (planche « États des écrans »,
 * état 2) : squelettes de la synthèse (4 indicateurs) et des lignes des
 * contrôles, sans animation lourde.
 */
import { SeoHeader, SeoTabs } from "@/components/admin/seo/SeoHeader"
import { PERFORMANCE_SUBTITLE, PERFORMANCE_TABS, PERFORMANCE_TITLE } from "@/components/admin/seo/performance/tabs"

function Bar({ className }: { className: string }) {
  return <span className={`block rounded-md bg-[var(--q-sunken)] ${className}`} />
}

export default function Loading() {
  return (
    <>
      <SeoHeader section="performance" title={PERFORMANCE_TITLE} subtitle={PERFORMANCE_SUBTITLE} />
      <SeoTabs tabs={PERFORMANCE_TABS} current="/admin/seo/performance/audit" label="Sous-onglets de Performance" className="max-md:[&>a]:h-11" />
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
            <Bar className="h-4 w-32" />
          </div>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 border-t border-[var(--q-line-soft)] px-5 py-4">
              <Bar className="h-3.5 w-48" />
              <Bar className="ml-auto h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
