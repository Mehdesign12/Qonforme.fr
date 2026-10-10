/**
 * Carte « Évolution » de la visibilité IA : taux de mention et de citation, un point par
 * relevé, sur un axe de temps qui va du premier relevé à aujourd'hui (planche
 * Visibilite-ia). Axe fixe de 0 à 100 %.
 *
 * Graphique dédié plutôt que SeoChart (même avec `zeroIsData`) : SeoChart place un point
 * par jour à intervalles égaux et donne à chaque série son propre axe arrondi, alors
 * qu'ici les relevés sont espacés dans le temps (axe du premier relevé à aujourd'hui) et
 * que les deux taux se comparent sur un même axe fixe de 0 à 100 %. Légende textuelle,
 * traits plein et pointillé (jamais la couleur seule), valeur du dernier relevé écrite à
 * côté de son point et tableau pour les lecteurs d'écran. Rendu serveur, sans bibliothèque.
 */
import { fmtDay, fmtRate } from "@/lib/seo/format"
import { cn } from "@/lib/utils"

export interface EvolutionPoint {
  /** Jour du relevé (AAAA-MM-JJ, heure de Paris). */
  day: string
  mention: number | null
  citation: number | null
}

const W = 1000
const H = 200
const PAD = 10

const dayMs = (iso: string) => Date.parse(`${iso}T12:00:00Z`)

export function GeoEvolutionChart({ points, today, className }: { points: EvolutionPoint[]; today: string; className?: string }) {
  const first = points[0]?.day ?? today
  const start = dayMs(first)
  const end = Math.max(dayMs(today), start + 86_400_000)
  const xOf = (day: string) => ((dayMs(day) - start) / (end - start)) * 100
  const yOf = (v: number) => PAD + (1 - Math.max(0, Math.min(1, v))) * (H - 2 * PAD)

  const last = points[points.length - 1] ?? null
  const series = [
    { key: "mention" as const, label: "Taux de mention", dashed: false, color: "var(--q-accent-strong)" },
    { key: "citation" as const, label: "Taux de citation", dashed: true, color: "var(--q-text-3)" },
  ]

  return (
    <figure className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[var(--q-text-3)]" aria-hidden>
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <svg width="18" height="4" viewBox="0 0 18 4" aria-hidden>
              <line x1="0" y1="2" x2="18" y2="2" stroke={s.color} strokeWidth="2" strokeDasharray={s.dashed ? "4 3" : undefined} />
            </svg>
            {s.label}
          </span>
        ))}
      </div>

      <div className="flex gap-2" style={{ height: 190 }} aria-hidden>
        <div className="flex w-11 shrink-0 flex-col justify-between py-[3px] text-right text-xs tabular-nums text-[var(--q-text-4)]">
          <span className="leading-none">100 %</span>
          <span className="leading-none">50 %</span>
          <span className="leading-none">0 %</span>
        </div>
        <div className="relative min-w-0 flex-1">
          {[0, 0.5, 1].map((f) => (
            <div
              key={f}
              className="absolute inset-x-0 border-t border-dashed border-[var(--q-line-soft)]"
              style={{ top: `${((PAD + f * (H - 2 * PAD)) / H) * 100}%` }}
            />
          ))}
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
            {series.map((s) => {
              const pts = points.filter((p) => p[s.key] !== null).map((p) => `${((xOf(p.day) / 100) * W).toFixed(1)},${yOf(p[s.key] as number).toFixed(1)}`)
              if (pts.length < 2) return null
              return (
                <polyline
                  key={s.key}
                  points={pts.join(" ")}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeDasharray={s.dashed ? "6 5" : undefined}
                  vectorEffect="non-scaling-stroke"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )
            })}
          </svg>
          {/* Points en HTML : ronds quelle que soit la largeur. Citation d'abord, mention par-dessus
              (plus grand) : deux taux égaux laissent voir le point de la mention, trait plein de la légende. */}
          {points.flatMap((p) =>
            series
              .slice()
              .reverse()
              .map((s) => {
                const v = p[s.key]
                if (v === null) return null
                return (
                  <span
                    key={`${p.day}-${s.key}`}
                    className={cn(
                      "absolute -translate-x-1/2 -translate-y-1/2 rounded-full",
                      s.dashed
                        ? "size-2.5 border-2 border-[var(--q-surface)] bg-[var(--q-text-3)]"
                        : "size-3.5 border-[2.5px] border-[var(--q-accent-strong)] bg-[var(--q-surface)]",
                    )}
                    style={{ left: `${xOf(p.day)}%`, top: `${(yOf(v) / H) * 100}%` }}
                  />
                )
              }),
          )}
          {last && last.mention !== null && (
            // Valeur du dernier relevé à côté de son point (planche) ; à gauche s'il est près du bord droit
            <span
              className={cn(
                "absolute whitespace-nowrap rounded-lg border border-[var(--q-line)] bg-[var(--q-surface)] px-2 py-1 text-xs font-semibold text-[var(--q-ink)] shadow-[var(--q-shadow-card)]",
                xOf(last.day) > 60 ? "-translate-x-full" : "translate-x-2",
                last.mention > 0.75 ? "translate-y-2.5" : "-translate-y-[calc(100%+10px)]",
              )}
              style={{ left: `${xOf(last.day)}%`, top: `${(yOf(last.mention) / H) * 100}%` }}
            >
              {fmtDay(last.day, true)} : {fmtRate(last.mention)}
              {last.citation !== null && last.citation !== last.mention ? ` · citation ${fmtRate(last.citation)}` : ""}
            </span>
          )}
        </div>
      </div>

      <div className="ml-[52px] flex justify-between gap-2 text-xs text-[var(--q-text-4)]" aria-hidden>
        <span>{fmtDay(first)}</span>
        {today !== first && <span>{fmtDay(today)} (aujourd&apos;hui)</span>}
      </div>

      <div className="sr-only">
        <table>
          <caption>Taux de mention et de citation de qonforme.fr par relevé</caption>
          <thead>
            <tr>
              <th scope="col">Relevé</th>
              {series.map((s) => (
                <th key={s.key} scope="col">{s.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.day}>
                <th scope="row">{fmtDay(p.day, true)}</th>
                <td>{fmtRate(p.mention)}</td>
                <td>{fmtRate(p.citation)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}
