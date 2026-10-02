/**
 * Squelette du tableau de bord pendant le chargement (Suspense), aux formes de
 * la nouvelle mise en page. Blocs fixes, sans pulsation (pas d'animation infinie).
 */
const BLOCK = "rounded-2xl bg-[var(--q-sunken)]"

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4 md:gap-5" aria-busy="true" aria-label="Chargement du tableau de bord">
      {/* En-têtes */}
      <div className="flex items-center gap-2.5 md:hidden">
        <div className="size-7 rounded-lg bg-[var(--q-sunken)]" />
        <div className="h-9 w-52 rounded-lg bg-[var(--q-sunken)]" />
      </div>
      <div className="hidden flex-col gap-2 md:flex">
        <div className="h-4 w-44 rounded-md bg-[var(--q-sunken)]" />
        <div className="h-9 w-80 rounded-lg bg-[var(--q-sunken)]" />
      </div>

      {/* Indicateurs */}
      <div className="hidden gap-3 md:grid md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className={`${BLOCK} h-[118px]`} />)}
      </div>
      <div className={`${BLOCK} h-[190px] rounded-[22px] md:hidden`} />
      <div className="grid grid-cols-4 gap-2 md:hidden">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className={`${BLOCK} h-[70px]`} />)}
      </div>

      {/* Colonnes */}
      <div className="flex flex-col gap-4 md:gap-5 min-[1100px]:grid min-[1100px]:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <div className="flex flex-col gap-5">
          <div className={`${BLOCK} h-[316px]`} />
          <div className={`${BLOCK} h-[360px]`} />
        </div>
        <div className="flex flex-col gap-5">
          <div className={`${BLOCK} h-[280px]`} />
          <div className={`${BLOCK} h-[240px]`} />
        </div>
      </div>
    </div>
  )
}
