/**
 * Chargement de l'écran Actions SEO (planche « États des écrans », état 2) :
 * squelettes des 4 statistiques et des lignes « Pages à améliorer », sans
 * animation lourde.
 */
import { SeoHeader } from "@/components/admin/seo/SeoHeader"

function Bar({ className }: { className: string }) {
  return <span className={`block rounded-md bg-[var(--q-sunken)] ${className}`} />
}

export default function Loading() {
  return (
    <>
      <SeoHeader section="actions" title="Actions SEO" subtitle="Choisissez une page, corrigez un problème et vérifiez le résultat." />
      <div aria-busy="true" aria-live="polite" className="flex flex-col gap-5">
        <span className="sr-only">Chargement…</span>
        <div className="q-card overflow-hidden" aria-hidden>
          <div className="px-5 pb-2 pt-4">
            <Bar className="h-4 w-36" />
          </div>
          <div className="grid grid-cols-2 gap-3 px-5 pb-5 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="q-inset flex flex-col gap-2 p-4">
                <Bar className="h-3.5 w-24" />
                <Bar className="h-7 w-16" />
                <Bar className="h-3 w-32" />
              </div>
            ))}
          </div>
        </div>
        <div className="q-card overflow-hidden" aria-hidden>
          <div className="flex flex-col gap-3 p-5">
            <Bar className="h-4 w-44" />
            <Bar className="h-10 w-full max-w-[380px]" />
          </div>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 border-t border-[var(--q-line-soft)] px-5 py-4">
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Bar className="h-3.5 w-40" />
                <Bar className="h-3.5 w-56 max-w-full" />
              </div>
              <Bar className="h-6 w-20 rounded-full" />
              <Bar className="hidden h-3.5 w-16 md:block" />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
