/**
 * Graphique de l'onglet SEO (recette « Clics et impressions » du canevas) :
 * une série en barres et/ou une série en courbe, chacune sur son axe
 * (gauche, droite), jours en abscisse. Rendu côté serveur en SVG, sans
 * bibliothèque ; légende textuelle et tableau pour les lecteurs d'écran
 * (l'information ne passe jamais par la couleur seule).
 */
import { cn } from "@/lib/utils"
import { fmtDay } from "@/lib/seo/format"

export interface ChartSeries {
  label: string
  /** Une valeur par jour (null : pas de donnée ce jour-là). */
  values: (number | null)[]
  kind: "bars" | "line"
  /** Format des valeurs (axe, tableau accessible). */
  format: (n: number) => string
  /** Axe inversé (position : 1 en haut). */
  invert?: boolean
  /** Remplissage sous la courbe. */
  area?: boolean
}

/** Plafond « rond » de l'axe (204 → 250, 7 → 8, 1 → 1,5). */
export function niceTop(max: number): number {
  if (max <= 0) return 1
  const mag = 10 ** Math.floor(Math.log10(max))
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * mag >= max) return m * mag
  return 10 * mag
}

const W = 1000
const H = 200
const PAD_TOP = 8
const PAD_BOTTOM = 10

function scale(series: ChartSeries) {
  const finite = series.values.filter((v): v is number => v !== null && Number.isFinite(v))
  const max = Math.max(0, ...finite)
  if (series.invert) {
    const min = finite.length ? Math.max(1, Math.floor(Math.min(...finite))) : 1
    const top = Math.max(min + 1, Math.ceil(max))
    return { min, top, y: (v: number) => PAD_TOP + ((v - min) / (top - min)) * (H - PAD_TOP - PAD_BOTTOM), ticks: [min, (min + top) / 2, top] }
  }
  const top = niceTop(max)
  return { min: 0, top, y: (v: number) => H - PAD_BOTTOM - (v / top) * (H - PAD_TOP - PAD_BOTTOM), ticks: [top, top / 2, 0] }
}

export function SeoChart({
  days,
  series,
  caption,
  source,
  note,
  height = 230,
  mobileHeight,
  className,
}: {
  /** Jours AAAA-MM-JJ, dans l'ordre. */
  days: string[]
  /** Une ou deux séries ; la première sur l'axe de gauche, la seconde sur celui de droite. */
  series: ChartSeries[]
  /** Titre du tableau accessible. */
  caption: string
  /** Ligne de source sous le graphique (« Google Search Console · 7 sept. – 4 oct. 2026 »). */
  source?: React.ReactNode
  /** Mention à droite de la source (« 2 à 3 jours de décalage »). */
  note?: React.ReactNode
  height?: number
  /** Hauteur sous 768 px (planches téléphone : 170). */
  mobileHeight?: number
  className?: string
}) {
  const n = Math.max(days.length, 1)
  const step = W / n
  const xOf = (i: number) => step * i + step / 2
  const [left, right] = series
  const scales = series.map(scale)
  const empty = series.every((s) => s.values.every((v) => !v))

  const tickEvery = Math.max(1, Math.ceil(n / 8))
  const ticks = days.map((d, i) => ({ d, i })).filter(({ i }) => i % tickEvery === 0 || i === n - 1)

  return (
    <figure className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[var(--q-text-3)]" aria-hidden>
        {series.map((s, i) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            {s.kind === "bars" ? (
              <span className={cn("size-2.5 rounded-[3px]", i === 0 ? "bg-[var(--q-accent-strong)]" : "bg-[var(--q-text-4)]")} />
            ) : (
              <span className={cn("h-0.5 w-4 rounded-full", i === 0 ? "bg-[var(--q-accent-strong)]" : "bg-[var(--q-accent)]")} />
            )}
            {s.label}
            {s.invert ? " (plus bas = mieux)" : ""}
          </span>
        ))}
      </div>

      <div
        className="flex h-[var(--seo-chart-h-sm)] gap-2 md:h-[var(--seo-chart-h)]"
        style={{ "--seo-chart-h": `${height}px`, "--seo-chart-h-sm": `${mobileHeight ?? height}px` } as React.CSSProperties}
        aria-hidden
      >
        <Axis ticks={scales[0]?.ticks ?? []} format={left?.format} align="right" />
        <div className="relative min-w-0 flex-1">
          {[0, 0.5, 1].map((f) => (
            <div key={f} className="absolute inset-x-0 border-t border-dashed border-[var(--q-line-soft)]" style={{ top: `${(PAD_TOP / H + f * (1 - (PAD_TOP + PAD_BOTTOM) / H)) * 100}%` }} />
          ))}
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
            {series.map((s, si) => {
              const sc = scales[si]
              if (s.kind === "bars") {
                const bw = Math.max(2, Math.min(28, step * 0.5))
                return (
                  <g key={s.label} fill={si === 0 ? "var(--q-accent-strong)" : "var(--q-text-4)"}>
                    {s.values.map((v, i) =>
                      v ? <rect key={i} x={xOf(i) - bw / 2} y={sc.y(v)} width={bw} height={Math.max(1, H - PAD_BOTTOM - sc.y(v))} rx={3} /> : null,
                    )}
                  </g>
                )
              }
              const pts = s.values.map((v, i) => (v === null ? null : ([xOf(i), sc.y(v)] as const)))
              const segments: string[] = []
              let current = ""
              for (const p of pts) {
                if (!p) {
                  if (current) segments.push(current)
                  current = ""
                  continue
                }
                current += `${current ? " L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`
              }
              if (current) segments.push(current)
              const firstPt = pts.find(Boolean)
              const lastPt = [...pts].reverse().find(Boolean)
              const stroke = si === 0 ? "var(--q-accent-strong)" : "var(--q-accent)"
              return (
                <g key={s.label}>
                  {s.area && !s.invert && segments.length === 1 && firstPt && lastPt && (
                    <path d={`${segments[0]} L${lastPt[0].toFixed(1)} ${H - PAD_BOTTOM} L${firstPt[0].toFixed(1)} ${H - PAD_BOTTOM} Z`} fill="var(--q-accent)" opacity={0.08} />
                  )}
                  {segments.map((d, k) => (
                    <path key={k} d={d} fill="none" stroke={stroke} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
                  ))}
                  {/* Un point seul n'a pas de trait : on le marque */}
                  {pts.filter(Boolean).length === 1 && firstPt && (
                    <circle cx={firstPt[0]} cy={firstPt[1]} r={5} fill={stroke} vectorEffect="non-scaling-stroke" />
                  )}
                </g>
              )
            })}
          </svg>
          {empty && <p className="absolute inset-0 grid place-items-center text-sm text-[var(--q-text-4)]">Aucune donnée sur cette période.</p>}
        </div>
        {right ? <Axis ticks={scales[1].ticks} format={right.format} align="left" /> : null}
      </div>

      <div className={cn("relative h-4 text-xs text-[var(--q-text-4)]", right ? "mx-[52px]" : "ml-[52px]")} aria-hidden>
        {ticks.map(({ d, i }) => (
          <span key={d} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${(xOf(i) / W) * 100}%` }}>
            {fmtDay(d)}
          </span>
        ))}
      </div>

      {(source || note) && (
        <figcaption className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--q-text-4)]">
          <span>{source}</span>
          {note && <span>{note}</span>}
        </figcaption>
      )}

      <div className="sr-only">
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">Jour</th>
              {series.map((s) => (
                <th key={s.label} scope="col">{s.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((d, i) => (
              <tr key={d}>
                <th scope="row">{fmtDay(d, true)}</th>
                {series.map((s) => (
                  <td key={s.label}>{s.values[i] === null || s.values[i] === undefined ? "—" : s.format(s.values[i] as number)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}

function Axis({ ticks, format, align }: { ticks: number[]; format?: (n: number) => string; align: "left" | "right" }) {
  return (
    <div
      className={cn(
        "flex w-11 shrink-0 flex-col justify-between py-[3px] text-xs tabular-nums text-[var(--q-text-4)]",
        align === "right" ? "text-right" : "text-left",
      )}
    >
      {ticks.map((t, i) => (
        <span key={i} className="leading-none">{format ? format(t) : t}</span>
      ))}
    </div>
  )
}
