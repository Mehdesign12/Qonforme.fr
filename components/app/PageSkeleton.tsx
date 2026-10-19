/**
 * Squelette d'une page de l'application pendant son chargement
 * (`app/(app)/loading.tsx`) : titre, barre d'outils et lignes, aux formes d'une
 * liste. La coque (barre latérale, barre supérieure) reste affichée ; ce bloc
 * montre tout de suite que le toucher a été pris en compte. Blocs fixes, sans
 * pulsation (pas d'animation infinie, ni `will-change`).
 */
const BLOCK = "rounded-2xl bg-[var(--q-sunken)]"

export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4 md:gap-5" aria-busy="true" aria-label="Chargement de la page">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="h-9 w-56 rounded-lg bg-[var(--q-sunken)] md:w-72" />
          <div className="h-4 w-40 rounded-md bg-[var(--q-sunken)] md:w-56" />
        </div>
        <div className="hidden h-10 w-36 rounded-[10px] bg-[var(--q-sunken)] md:block" />
      </div>

      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-9 w-24 shrink-0 rounded-full bg-[var(--q-sunken)]" />)}
      </div>

      <div className="flex flex-col gap-2.5">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className={`${BLOCK} h-[68px] md:h-[60px]`} />)}
      </div>
    </div>
  )
}
