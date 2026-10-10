/**
 * Performance › PageSpeed Insights (planche « Performance-pagespeed ») :
 * tableau des pages suivies (LCP, mesure précédente, verdict, dernière mesure,
 * « Mesurer ») et carte de détail de la page choisie (LCP en grand, barre de
 * seuils, CLS, TBT, score, données terrain s'il y en a, JavaScript inutilisé).
 *
 * Composants serveur ; les boutons « Mesurer » sont des composants client.
 */
import Link from "next/link"
import { ArrowRight, Check, CircleAlert, Clock, Gauge } from "lucide-react"
import { EmptyState, StatusPill } from "@/components/app/kit"
import { fmtDate } from "@/components/admin/ui"
import { MeasureButton } from "@/components/admin/seo/performance/MeasureButton"
import { Val } from "@/components/admin/seo/performance/Value"
import { InfoLine } from "@/components/admin/seo/SeoStates"
import { cn } from "@/lib/utils"
import { fmtKilobytes, fmtSeconds } from "@/lib/seo/format"
import {
  fieldVerdict,
  fmtCls,
  fmtMs,
  lcpScalePercent,
  lcpVerdict,
  LCP_GOOD_MS,
  LCP_POOR_MS,
  LCP_SCALE_MS,
  STRATEGY_LABELS,
  VERDICTS,
  type FieldMetric,
  type PageSpeedStrategy,
  type Verdict,
} from "@/lib/seo/pagespeed/parse"
import type { PageHistory, PageSpeedRow } from "@/lib/seo/pagespeed/read"

export interface TrackedPage {
  path: string
  label: string
}

const VERDICT_ICON: Record<Verdict, React.ReactNode> = {
  good: <Check strokeWidth={2.75} aria-hidden />,
  improve: <Clock strokeWidth={2.25} aria-hidden />,
  poor: <CircleAlert strokeWidth={2.25} aria-hidden />,
}

export function VerdictPill({ verdict, className }: { verdict: Verdict | null; className?: string }) {
  if (!verdict)
    return (
      <span className="text-[var(--q-text-4)]">
        <Val text="—" missing="pas de verdict" />
      </span>
    )
  const def = VERDICTS[verdict]
  return (
    <StatusPill tone={def.tone} icon={VERDICT_ICON[verdict]} className={className}>
      {def.label}
    </StatusPill>
  )
}

/** « 4 oct. 2026 · build local » (mesure importée du journal du dépôt). */
function measuredLabel(row: PageSpeedRow): string {
  return `${fmtDate(row.measured_at)}${row.source === "import" ? " · build local" : ""}`
}

/** Dernier essai en échec plus récent que la dernière mesure réussie. */
function failedAttempt(h: PageHistory | undefined): PageSpeedRow | null {
  const last = h?.lastAttempt
  if (!last?.error) return null
  if (h?.current && Date.parse(h.current.measured_at) >= Date.parse(last.measured_at)) return null
  return last
}

function pageHref(basePath: string, path: string, strategy: PageSpeedStrategy): string {
  return `${basePath}?${new URLSearchParams({ chemin: path, appareil: strategy })}`
}

function PageName({ page, selected, href }: { page: TrackedPage; selected: boolean; href: string }) {
  const showPath = page.label !== page.path
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <Link
        href={href}
        scroll={false}
        aria-current={selected ? "true" : undefined}
        className={cn(
          // Cible de 44 px sur téléphone
          "inline-flex min-h-11 items-center font-medium md:min-h-0",
          selected ? "text-[var(--q-ink)]" : "text-[var(--q-accent-strong)] hover:text-[var(--q-accent-ink)]",
        )}
      >
        {page.label}
      </Link>
      {showPath && <span className="min-w-0 truncate font-mono text-[13px] text-[var(--q-text-4)]">{page.path}</span>}
      {selected && <span className="q-tag whitespace-nowrap">Détail affiché</span>}
    </span>
  )
}

function LastMeasure({ history }: { history: PageHistory | undefined }) {
  const failed = failedAttempt(history)
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="whitespace-nowrap">{history?.current ? measuredLabel(history.current) : "Jamais mesurée"}</span>
      {failed && (
        // Motif en texte (tronqué à une ligne ; complet dans le détail de la page)
        <span className="block max-w-[280px] truncate whitespace-nowrap text-xs font-medium text-[var(--q-danger)]">
          Dernier essai en échec ({fmtDate(failed.measured_at, { day: "numeric", month: "short" })}){failed.error ? ` : ${failed.error}` : ""}
        </span>
      )}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Pages suivies                                                       */
/* ------------------------------------------------------------------ */

export function TrackedPagesCard({
  pages,
  histories,
  strategy,
  selected,
  basePath,
  weekly,
}: {
  pages: TrackedPage[]
  histories: Record<string, PageHistory>
  strategy: PageSpeedStrategy
  selected: string | null
  basePath: string
  weekly: boolean
}) {
  const device = STRATEGY_LABELS[strategy].toLowerCase()
  return (
    <section aria-labelledby="pages-suivies" className="q-card overflow-hidden">
      <div className="flex flex-col gap-0.5 px-4 pb-2 pt-4 md:px-5">
        <h2 id="pages-suivies" className="q-h2">Pages suivies</h2>
        <p className="text-[13px] text-[var(--q-text-4)]">
          Verdict d&apos;après le LCP {device} : bon ≤&nbsp;2,5&nbsp;s, à améliorer ≤&nbsp;4&nbsp;s, mauvais &gt;&nbsp;4&nbsp;s.
          {weekly ? " Mesure automatique chaque lundi." : ""}
        </p>
      </div>

      {pages.length === 0 ? (
        <EmptyState
          className="py-10"
          icon={<Gauge className="size-5" aria-hidden />}
          title="Aucune page suivie"
          text="Aucune page n'est suivie pour le moment."
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="q-table min-w-[860px]">
              <thead>
                <tr>
                  <th scope="col">Page</th>
                  <th scope="col" className="text-right">LCP {device}</th>
                  <th scope="col" className="text-right">Avant</th>
                  <th scope="col" className="!pl-7">Verdict</th>
                  <th scope="col">Dernière mesure</th>
                  <th scope="col" className="text-right">
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pages.map((page) => {
                  const h = histories[page.path]
                  const isSelected = page.path === selected
                  return (
                    <tr key={page.path} className={cn(isSelected && "!bg-[var(--q-wash)]")}>
                      <td>
                        <PageName page={page} selected={isSelected} href={pageHref(basePath, page.path, strategy)} />
                      </td>
                      <td className="q-num whitespace-nowrap font-semibold">
                        <Val text={fmtSeconds(h?.current?.lcp_ms)} missing="non mesuré" />
                      </td>
                      <td className="q-num whitespace-nowrap text-[var(--q-text-3)]">
                        <Val text={fmtSeconds(h?.previous?.lcp_ms)} missing="aucune mesure précédente" />
                      </td>
                      <td className="!pl-7">
                        <VerdictPill verdict={lcpVerdict(h?.current?.lcp_ms)} />
                      </td>
                      <td className="text-[13px] text-[var(--q-text-3)]">
                        <LastMeasure history={h} />
                      </td>
                      <td className="text-right">
                        <MeasureButton path={page.path} strategy={strategy} ariaLabel={`Mesurer ${page.label} (${page.path})`} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <ul className="q-list border-t border-[var(--q-line-soft)] md:hidden" aria-label="Pages suivies">
            {pages.map((page) => {
              const h = histories[page.path]
              const isSelected = page.path === selected
              return (
                <li key={page.path} className={cn("flex flex-col gap-2 px-4 py-3", isSelected && "bg-[var(--q-wash)]")}>
                  <PageName page={page} selected={isSelected} href={pageHref(basePath, page.path, strategy)} />
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-[var(--q-text-3)]">
                    <span className="tabular-nums">
                      LCP{" "}
                      <span className="font-semibold text-[var(--q-ink)]">
                        <Val text={fmtSeconds(h?.current?.lcp_ms)} missing="non mesuré" />
                      </span>
                    </span>
                    <span className="tabular-nums">
                      Avant <Val text={fmtSeconds(h?.previous?.lcp_ms)} missing="aucune mesure précédente" />
                    </span>
                    <VerdictPill verdict={lcpVerdict(h?.current?.lcp_ms)} />
                  </div>
                  <div className="flex items-center justify-between gap-3 text-[13px] text-[var(--q-text-4)]">
                    <LastMeasure history={h} />
                    <MeasureButton path={page.path} strategy={strategy} ariaLabel={`Mesurer ${page.label} (${page.path})`} className="h-11 shrink-0" />
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Détail d'une page                                                   */
/* ------------------------------------------------------------------ */

function Marker({ label, ms, strong, top, line }: { label: string; ms: number; strong?: boolean; top: number; line: number }) {
  const left = Math.max(5, Math.min(95, lcpScalePercent(ms)))
  return (
    <div className="absolute flex -translate-x-1/2 flex-col items-center" style={{ left: `${left}%`, top }}>
      <span
        className={cn(
          "inline-flex h-[22px] items-center whitespace-nowrap rounded-md px-2 text-xs font-semibold tabular-nums",
          strong ? "bg-[var(--q-ink-strong)] text-white" : "border border-[var(--q-field)] bg-[var(--q-surface)] text-[var(--q-text-2)]",
        )}
      >
        {label} {fmtSeconds(ms)}
      </span>
      <span
        className={cn("block w-0.5", strong ? "bg-[var(--q-ink-strong)]" : "bg-[var(--q-text-4)]")}
        style={{ height: line, boxShadow: "0 0 0 1.5px var(--q-surface)" }}
      />
    </div>
  )
}

/** Barre de seuils en trois segments étiquetés, repères « Maintenant » et « Avant ». */
function ThresholdBar({ now, before }: { now: number; before: number | null }) {
  const close = before !== null && Math.abs(lcpScalePercent(now) - lcpScalePercent(before)) < 18
  const good = LCP_GOOD_MS / LCP_SCALE_MS
  const improve = (LCP_POOR_MS - LCP_GOOD_MS) / LCP_SCALE_MS
  const poor = 1 - good - improve
  return (
    <div className="relative mt-6" style={{ paddingTop: close ? 64 : 36 }}>
      <Marker label="Maintenant" ms={now} strong top={0} line={close ? 58 : 30} />
      {before !== null && <Marker label="Avant" ms={before} top={close ? 30 : 0} line={close ? 28 : 30} />}
      <div aria-hidden className="flex h-3 gap-0.5 overflow-hidden rounded-full">
        <span className="block bg-[var(--q-ok)]" style={{ flex: `${good} 1 0` }} />
        <span className="block bg-[var(--q-warn)]" style={{ flex: `${improve} 1 0` }} />
        <span className="block bg-[var(--q-danger)]" style={{ flex: `${poor} 1 0` }} />
      </div>
      <div className="mt-2 flex gap-0.5 text-xs leading-snug text-[var(--q-text-3)]">
        <span className="min-w-0" style={{ flex: `${good} 1 0` }}>
          <span className="font-semibold text-[var(--q-ink)]">Bon</span>&nbsp;≤&nbsp;2,5&nbsp;s
        </span>
        <span className="min-w-0" style={{ flex: `${improve} 1 0` }}>
          <span className="font-semibold text-[var(--q-ink)]">À améliorer</span>&nbsp;≤&nbsp;4&nbsp;s
        </span>
        <span className="min-w-0" style={{ flex: `${poor} 1 0` }}>
          <span className="font-semibold text-[var(--q-ink)]">Mauvais</span>&nbsp;&gt;&nbsp;4&nbsp;s
        </span>
      </div>
    </div>
  )
}

function SmallMeasure({ name, value, caption }: { name: string; value: string; caption: string }) {
  const missing = value === "—"
  return (
    <div className="q-inset flex flex-col gap-1 p-3.5">
      <span className="text-[13px] font-semibold text-[var(--q-ink)]">{name}</span>
      <span className={cn("q-display text-[24px] leading-[1.1] tabular-nums md:text-[28px]", missing ? "text-[var(--q-text-4)]" : "text-[var(--q-ink)]")}>
        <span aria-hidden={missing || undefined}>{value}</span>
        {missing && <span className="sr-only">Non mesuré</span>}
      </span>
      <span className="text-xs text-[var(--q-text-4)]">{caption}</span>
    </div>
  )
}

function FieldItem({ name, metric, format }: { name: string; metric: FieldMetric | undefined; format: (n: number) => string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold text-[var(--q-ink)]">{name}</span>
      {metric ? (
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-base font-semibold tabular-nums text-[var(--q-ink)]">{format(metric.p75)}</span>
          <VerdictPill verdict={fieldVerdict(metric.category)} />
        </span>
      ) : (
        <span className="text-[var(--q-text-4)]">
          <span aria-hidden>—</span>
          <span className="sr-only">Non disponible</span>
        </span>
      )}
    </div>
  )
}

export function PageDetailCard({ page, history, strategy }: { page: TrackedPage; history: PageHistory | undefined; strategy: PageSpeedStrategy }) {
  const current = history?.current ?? null
  const previous = history?.previous ?? null
  const device = STRATEGY_LABELS[strategy].toLowerCase()
  const lab = strategy === "mobile" ? "Lighthouse mobile simulé" : "Lighthouse ordinateur"
  const others = current ? [current.cls, current.tbt_ms, current.performance_score] : []
  const failed = failedAttempt(history)

  return (
    <section aria-labelledby="detail-page" className="q-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 pb-2 pt-4 md:px-5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id="detail-page" className="q-h2">
            Détail de <span className="font-mono text-[15px] font-medium">{page.path}</span>
          </h2>
          <p className="text-[13px] text-[var(--q-text-4)]">Cliquez sur une page du tableau pour voir son détail.</p>
        </div>
        {current && (
          <span className="text-[13px] text-[var(--q-text-4)]">
            Mesure de laboratoire · {lab} · {measuredLabel(current)}
          </span>
        )}
      </div>

      {failed && (
        <InfoLine tone="warn" className="px-4 pb-2 text-[13px] md:px-5">
          Dernier essai en échec le {fmtDate(failed.measured_at, { day: "numeric", month: "short" })}
          {failed.error ? ` : ${failed.error}` : "."}
        </InfoLine>
      )}

      {!current ? (
        <EmptyState
          className="py-10"
          icon={<Gauge className="size-5" aria-hidden />}
          title="Pas encore de mesure"
          text={`Lancez « Mesurer la page » pour obtenir le LCP, le CLS et le score de cette page sur ${device}.`}
        />
      ) : (
        <div className="flex flex-col gap-5 px-4 pb-5 pt-2 md:px-5">
          <div className="flex flex-wrap items-start gap-x-12 gap-y-6">
            <div className="min-w-0 flex-[1.5_1_440px]">
              <p className="text-[13px] text-[var(--q-text-3)]">LCP {device} · temps d&apos;affichage du plus grand élément</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-3">
                <span className="q-display text-[48px] leading-none tabular-nums text-[var(--q-ink)] md:text-[56px]">
                  {current.lcp_ms !== null ? (
                    <>
                      {(current.lcp_ms / 1000).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                      <span className="text-[28px] tracking-[-0.02em] text-[var(--q-text-3)]">&nbsp;s</span>
                    </>
                  ) : (
                    <Val text="—" missing="non mesuré" />
                  )}
                </span>
                <VerdictPill verdict={lcpVerdict(current.lcp_ms)} />
              </div>
              {current.lcp_ms !== null && <ThresholdBar now={current.lcp_ms} before={previous?.lcp_ms ?? null} />}
              {previous?.lcp_ms !== null && previous?.lcp_ms !== undefined && current.lcp_ms !== null && (
                <p className="mt-5 flex flex-wrap items-center gap-2 text-sm tabular-nums text-[var(--q-text-3)]">
                  <span>
                    Avant : <span className="font-semibold text-[var(--q-ink)]">{fmtSeconds(previous.lcp_ms)}</span>
                  </span>
                  <ArrowRight className="size-4" aria-hidden />
                  <span className="sr-only">puis</span>
                  <span>
                    maintenant <span className="font-semibold text-[var(--q-ink)]">{fmtSeconds(current.lcp_ms)}</span>
                  </span>
                </p>
              )}
            </div>

            <div className="min-w-0 flex-[1_1_300px]">
              <h3 className="mb-3 text-sm font-semibold text-[var(--q-ink)]">Autres mesures</h3>
              <div className="grid grid-cols-3 gap-3">
                <SmallMeasure name="CLS" value={fmtCls(current.cls)} caption="Stabilité" />
                <SmallMeasure name="TBT" value={fmtMs(current.tbt_ms)} caption="Blocage" />
                <SmallMeasure name="Score" value={current.performance_score === null ? "—" : String(current.performance_score)} caption="Performance" />
              </div>
              {others.some((v) => v === null) && (
                <p className="mt-2.5 flex items-center gap-1.5 text-xs text-[var(--q-text-4)]">
                  <Clock className="size-3.5" aria-hidden />
                  Mesurées au prochain relevé
                </p>
              )}
            </div>
          </div>

          {current.field && (
            <div className="flex flex-col gap-3 border-t border-[var(--q-line-soft)] pt-4">
              <div>
                <h3 className="text-sm font-semibold text-[var(--q-ink)]">Données terrain</h3>
                <p className="text-[13px] text-[var(--q-text-4)]">
                  Rapport d&apos;expérience utilisateur Chrome, 75ᵉ centile des 28 derniers jours
                  {current.field.scope === "origin" ? ", pour l'ensemble de qonforme.fr (pas assez de visites sur cette page)" : ""}.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <FieldItem name="LCP" metric={current.field.lcp} format={fmtSeconds} />
                <FieldItem name="INP" metric={current.field.inp} format={fmtMs} />
                <FieldItem name="CLS" metric={current.field.cls} format={fmtCls} />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--q-line-soft)] pt-4">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-[var(--q-ink)]">JavaScript inutilisé</h3>
              <p className="text-[13px] text-[var(--q-text-4)]">Code téléchargé mais non utilisé au chargement de la page.</p>
            </div>
            <span className="flex items-center gap-2 text-sm tabular-nums">
              {previous?.unused_js_bytes !== null && previous?.unused_js_bytes !== undefined && (
                <>
                  <span className="text-[var(--q-text-3)]">{fmtKilobytes(previous.unused_js_bytes)}</span>
                  <ArrowRight className="size-4 text-[var(--q-text-4)]" aria-hidden />
                  <span className="sr-only">puis</span>
                </>
              )}
              <span className="font-semibold text-[var(--q-ink)]">
                <Val text={fmtKilobytes(current.unused_js_bytes)} missing="non mesuré" />
              </span>
            </span>
          </div>
        </div>
      )}
    </section>
  )
}
