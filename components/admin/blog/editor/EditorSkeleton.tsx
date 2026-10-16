/**
 * Squelette de l'éditeur d'articles, affiché pendant le chargement dynamique
 * de RichEditor (next/dynamic, ssr: false) : même carte, même barre d'outils,
 * même mesure de texte, pour que rien ne saute à l'arrivée de l'éditeur.
 */
import { cn } from "@/lib/utils"

const BAR = "animate-pulse rounded-lg bg-[var(--q-sunken)] motion-reduce:animate-none"

/** Groupes de boutons de la barre d'outils (nombre de boutons par groupe). */
const GROUPS = [2, 1, 3, 3, 4]

/** Lignes du texte : largeur relative, titre ou paragraphe. */
const LINES: { w: string; heading?: boolean; gap?: boolean }[] = [
  { w: "w-full" },
  { w: "w-[96%]" },
  { w: "w-[88%]" },
  { w: "w-[62%]", gap: true },
  { w: "w-[54%]", heading: true },
  { w: "w-full" },
  { w: "w-[93%]" },
  { w: "w-[97%]" },
  { w: "w-[41%]", gap: true },
  { w: "w-[90%]" },
  { w: "w-[84%]" },
  { w: "w-[70%]" },
]

export function EditorSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("q-card flex flex-col", className)} aria-busy="true">
      <span role="status" className="sr-only">
        Chargement de l&apos;éditeur…
      </span>
      {/* Barre d'outils */}
      <div className="flex h-[57px] items-center gap-2 overflow-hidden rounded-t-[15px] border-b border-[var(--q-line-soft)] px-3 md:h-[51px]">
        {GROUPS.map((count, g) => (
          <div key={g} className="flex shrink-0 items-center gap-1.5">
            {g > 0 && <span aria-hidden className="mx-1 h-5 w-px bg-[var(--q-line)]" />}
            {g === 1 ? (
              <span className={cn(BAR, "h-8 w-28")} />
            ) : (
              Array.from({ length: count }, (_, i) => <span key={i} className={cn(BAR, "size-8")} />)
            )}
          </div>
        ))}
        <span className="flex-1" />
        <span className={cn(BAR, "hidden h-[38px] w-[168px] rounded-[10px] sm:block")} />
      </div>
      {/* Zone d'écriture */}
      <div className="px-5 pb-10 pt-8 sm:px-10">
        <div className="mx-auto flex min-h-[420px] max-w-[68ch] flex-col">
          {LINES.map((line, i) =>
            line.heading ? (
              <span key={i} className={cn(BAR, "mb-5 mt-9 h-7", line.w)} />
            ) : (
              <span key={i} className={cn(BAR, "mb-3.5 h-4", line.w, line.gap && "mb-7")} />
            ),
          )}
        </div>
      </div>
      {/* Barre d'état */}
      <div className="flex items-center justify-between gap-3 border-t border-[var(--q-line-soft)] px-5 py-3">
        <span className={cn(BAR, "h-3.5 w-40")} />
        <span className={cn(BAR, "h-3.5 w-24")} />
      </div>
    </div>
  )
}
