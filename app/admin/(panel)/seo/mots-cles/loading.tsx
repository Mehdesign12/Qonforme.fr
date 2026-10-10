/**
 * Chargement de l'écran Mots-clés (planche « États des écrans », état 2) :
 * squelettes des 4 indicateurs et des lignes du tableau, sans animation lourde.
 */
import { SeoHeader } from "@/components/admin/seo/SeoHeader"

function Bar({ className }: { className: string }) {
  return <span className={`block rounded-md bg-[var(--q-sunken)] ${className}`} />
}

export default function Loading() {
  return (
    <>
      <SeoHeader section="keywords" title="Mots-clés" subtitle="Les requêtes sur lesquelles vous pouvez gagner du trafic, et quoi faire de chacune." />
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
            <Bar className="h-10 w-full max-w-[380px]" />
          </div>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 border-t border-[var(--q-line-soft)] px-5 py-4">
              <Bar className="h-3.5 w-48" />
              <Bar className="ml-auto h-3.5 w-16" />
              <Bar className="h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
