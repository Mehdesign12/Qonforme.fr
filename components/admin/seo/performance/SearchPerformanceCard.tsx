/**
 * Carte « Performances » de la Vue d'ensemble et « Performance de recherche »
 * de Performance › Recherche Google : quatre indicateurs façon onglets
 * (`?metrique=`, trait bleu sous l'actif, évolution par rapport à la période
 * précédente), graphique, source et décalage de Search Console.
 *
 * Composant serveur (le graphique SeoChart reçoit des fonctions de format).
 * États : Search Console non connectée, aucune donnée encore (jamais
 * synchronisée, synchronisation en cours, ou synchronisée sans données),
 * synchronisation en échec, historique en cours de reprise, jours pas encore
 * disponibles, lecture impossible (SearchPerformanceFailure, planche « États »).
 */
import Link from "next/link"
import { ArrowDown, ArrowUp, Clock, Loader2, SearchX } from "lucide-react"
import { EmptyState } from "@/components/app/kit"
import { fmtDateTime } from "@/components/admin/ui"
import { SeoChart } from "@/components/admin/seo/SeoChart"
import { FailureState, InfoLine, NotConnected, SeoBanner } from "@/components/admin/seo/SeoStates"
import { Val } from "@/components/admin/seo/performance/Value"
import { MOBILE_SEG_CLASS } from "@/components/admin/seo/performance/tabs"
import type { SeoReadFailure } from "@/lib/seo/db"
import { cn } from "@/lib/utils"
import {
  deltaCount,
  deltaPosition,
  deltaRate,
  fmtCount,
  fmtDay,
  fmtPosition,
  fmtRange,
  fmtRate,
  type Delta,
} from "@/lib/seo/format"
import { gscProperty } from "@/lib/seo/google"
import type { GscTotals } from "@/lib/seo/types"
import { METRICS, type MetricKey } from "@/lib/seo/search-console/filters"
import { missingDaysNotice, type SearchPerformance } from "@/lib/seo/search-console/read"
import { mobileCompareText, noDataReason } from "@/lib/seo/search-console/messages"
import { chartSeriesFor } from "@/lib/seo/search-console/chart"


function valueOf(metric: MetricKey, t: GscTotals): string {
  switch (metric) {
    case "clics":
      return fmtCount(t.clicks)
    case "impressions":
      return fmtCount(t.impressions)
    case "ctr":
      return fmtRate(t.ctr)
    case "position":
      return fmtPosition(t.position)
  }
}

function deltaOf(metric: MetricKey, current: GscTotals, previous: GscTotals | null): Delta {
  if (!previous) return { text: "—", trend: "none" }
  switch (metric) {
    case "clics":
      return deltaCount(current.clicks, previous.clicks)
    case "impressions":
      return deltaCount(current.impressions, previous.impressions)
    case "ctr":
      return deltaRate(current.ctr, previous.ctr)
    case "position":
      return deltaPosition(current.position, previous.position)
  }
}

function hrefWith(basePath: string, params: Record<string, string | undefined>, key: string, value: string): string {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v && k !== key) qs.set(k, v)
  })
  qs.set(key, value)
  return `${basePath}?${qs}`
}

/** Évolution : flèche et couleur, texte pour les lecteurs d'écran (jamais la couleur seule). */
function DeltaText({ delta }: { delta: Delta }) {
  if (delta.trend === "none" || delta.trend === "flat") {
    return (
      <span className="font-semibold">
        <span aria-hidden>—</span>
        <span className="sr-only">{delta.trend === "flat" ? "Stable" : "Pas de comparaison"}</span>
      </span>
    )
  }
  const up = delta.trend === "up"
  const Icon = up ? ArrowUp : ArrowDown
  return (
    <span className={cn("inline-flex items-center gap-[3px] font-semibold", up ? "text-[var(--q-ok)]" : "text-[var(--q-danger)]")}>
      <Icon className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
      <span className="sr-only">{up ? "En progrès : " : "En recul : "}</span>
      {delta.text}
    </span>
  )
}

function MetricTabs({
  data,
  metric,
  basePath,
  params,
  compareLabel,
  mobileText,
}: {
  data: SearchPerformance
  metric: MetricKey
  basePath: string
  params: Record<string, string | undefined>
  compareLabel: string
  /** Ligne des évolutions sur téléphone (phrase complète). */
  mobileText: string
}) {
  return (
    <div>
      <nav aria-label="Indicateur affiché sur le graphique" className="grid grid-cols-2 border-y border-[var(--q-line-soft)] md:grid-cols-4">
        {METRICS.map((m, i) => {
          const active = m.key === metric
          return (
            <Link
              key={m.key}
              href={hrefWith(basePath, params, "metrique", m.key)}
              scroll={false}
              aria-current={active ? "true" : undefined}
              className={cn(
                "relative flex min-h-11 min-w-0 flex-col items-start gap-1.5 border-[var(--q-line-soft)] px-4 pb-4 pt-3.5 transition-colors md:px-5 md:pb-[18px] md:pt-4",
                active ? "bg-[var(--q-surface)]" : "bg-[var(--q-surface-2)] hover:bg-[var(--q-hover)]",
                i % 2 === 1 && "border-l",
                i >= 2 && "border-t md:border-t-0",
                i === 2 && "md:border-l",
              )}
            >
              <span className={cn("text-[13px]", active ? "font-semibold text-[var(--q-ink)]" : "font-medium text-[var(--q-text-3)]")}>{m.label}</span>
              <span className="q-display text-[24px] leading-[1.1] tabular-nums text-[var(--q-ink)] md:text-[28px]"><Val text={valueOf(m.key, data.totals)} /></span>
              <span className="flex flex-col gap-px text-[13px] text-[var(--q-text-4)]">
                <DeltaText delta={deltaOf(m.key, data.totals, data.previous)} />
                <span className="hidden text-xs md:block">{compareLabel}</span>
              </span>
              {active && <span aria-hidden className="absolute inset-x-0 -bottom-px h-0.5 bg-[var(--q-accent)]" />}
            </Link>
          )
        })}
      </nav>
      <p className="px-4 pt-3 text-xs text-[var(--q-text-4)] md:hidden">{mobileText}</p>
    </div>
  )
}

export function SearchPerformanceCard({
  title,
  subtitle,
  controls,
  data,
  configured,
  metric,
  basePath,
  params,
  scopeLabel,
  headingId,
}: {
  title: string
  subtitle?: string
  /** Contrôle segmenté de période, menus Appareil et Pays. */
  controls?: React.ReactNode
  data: SearchPerformance
  configured: boolean
  metric: MetricKey
  basePath: string
  /** Paramètres de l'adresse à conserver dans les liens des indicateurs. */
  params: Record<string, string | undefined>
  /** Filtres actifs pour la ligne de source (« France », « France · Mobile »). */
  scopeLabel: string
  headingId: string
}) {
  const { period, bounds, sync } = data
  const hasData = bounds.last !== null
  const compareLabel = data.previous ? period.compareLabel : "historique en cours de reprise"
  const mobileText = mobileCompareText(data.previous ? period.compareLabel : null)
  const reason = noDataReason(sync)
  const missing = missingDaysNotice(data.missingDays)
  const chartTitle = metric === "ctr" ? "Taux de clic" : metric === "position" ? "Position moyenne" : "Clics et impressions"

  return (
    <section aria-labelledby={headingId} className="q-card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pb-4 pt-4 md:px-5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id={headingId} className="q-h2">{title}</h2>
          {subtitle && <p className="text-sm text-[var(--q-text-4)]">{subtitle}</p>}
        </div>
        {/* Contrôles seulement s'il y a des données à filtrer (planche « États », Search Console non connectée) */}
        {controls && hasData && <div className={cn("flex flex-wrap items-center gap-2", MOBILE_SEG_CLASS)}>{controls}</div>}
      </div>

      {!configured && !hasData ? (
        <NotConnected
          bare
          className="border-t border-[var(--q-line-soft)]"
          title="Connectez Search Console pour voir vos clics et vos positions."
          text={`Propriété attendue : ${gscProperty()}`}
        />
      ) : (
        <>
          {!configured && (
            <SeoBanner tone="warn" className="mx-4 mb-4 md:mx-5" title="Search Console n'est plus connectée">
              Les données s&apos;arrêtent au {fmtDay(bounds.last ?? "", true)}. Vérifiez la connexion dans Paramètres › Connexions.
            </SeoBanner>
          )}
          {sync?.status === "error" && sync.error && (
            <SeoBanner
              tone="danger"
              className="mx-4 mb-4 md:mx-5"
              title="La dernière synchronisation a échoué"
              action={<Link href="/admin/seo/parametres/connexions" className="q-btn q-btn-secondary q-btn-sm">Connexions</Link>}
            >
              {fmtDateTime(sync.finishedAt)} · {sync.error}
            </SeoBanner>
          )}

          {!hasData ? (
            <div className="border-t border-[var(--q-line-soft)]">
              {reason === "running" ? (
                <EmptyState
                  className="py-10"
                  icon={<Loader2 className="size-5 animate-spin" aria-hidden />}
                  title="Synchronisation en cours"
                  text="Search Console est en cours de lecture. Les données s'afficheront ici à la fin de ce passage."
                />
              ) : reason === "synced_empty" ? (
                <EmptyState
                  className="py-10"
                  icon={<SearchX className="size-5" aria-hidden />}
                  title="Aucune donnée reçue"
                  text={`Search Console n'a renvoyé aucune donnée pour ${gscProperty()} (dernière synchronisation le ${fmtDateTime(sync?.lastOkAt)}). Vérifiez la propriété dans Paramètres › Connexions.`}
                />
              ) : (
                <EmptyState
                  className="py-10"
                  icon={<Clock className="size-5" aria-hidden />}
                  title="Pas encore de données"
                  text="La première synchronisation n'a pas encore eu lieu. Elle reprend jusqu'à 16 mois d'historique, puis se met à jour chaque matin. « Lancer l'analyse », sur la Vue d'ensemble, la déclenche sans attendre."
                />
              )}
            </div>
          ) : (
            <>
              <MetricTabs data={data} metric={metric} basePath={basePath} params={params} compareLabel={compareLabel} mobileText={mobileText} />
              <div className="flex flex-col gap-3 px-4 pb-4 pt-5 md:px-5">
                <SeoChart
                  days={data.series.map((d) => d.date)}
                  series={chartSeriesFor(metric, data.series)}
                  caption={`${chartTitle} par jour, du ${fmtDay(period.current.from, true)} au ${fmtDay(period.current.to, true)}`}
                  mobileHeight={170}
                  source={`Google Search Console · ${scopeLabel} · ${fmtRange(period.current.from, period.current.to)}`}
                  note={
                    missing ? undefined : (
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="size-3.5" aria-hidden />2 à 3 jours de décalage
                      </span>
                    )
                  }
                  className="[&_figcaption]:border-t [&_figcaption]:border-[var(--q-line-soft)] [&_figcaption]:pt-3"
                />
                {missing && (
                  <InfoLine tone={missing.late ? "warn" : "info"} className="text-[13px]">
                    {missing.text}
                  </InfoLine>
                )}
                {sync && !sync.backfillDone && bounds.first && (
                  <InfoLine className="text-[13px]">
                    Reprise de l&apos;historique en cours : données enregistrées depuis le {fmtDay(bounds.first, true)}. Elle continue à
                    chaque passage, jusqu&apos;à 16 mois en arrière.
                  </InfoLine>
                )}
              </div>
            </>
          )}
        </>
      )}
    </section>
  )
}

/**
 * Lecture impossible (planche « États », état 3) : la carte garde son titre,
 * l'échec s'affiche à l'intérieur, les indicateurs restent vides (« — »).
 */
export function SearchPerformanceFailure({
  title,
  subtitle,
  headingId,
  failure,
  retryHref,
}: {
  title: string
  subtitle?: string
  headingId: string
  failure: SeoReadFailure
  retryHref: string
}) {
  return (
    <section aria-labelledby={headingId} className="q-card overflow-hidden">
      <div className="flex min-w-0 flex-col gap-0.5 px-4 pb-4 pt-4 md:px-5">
        <h2 id={headingId} className="q-h2">{title}</h2>
        {subtitle && <p className="text-sm text-[var(--q-text-4)]">{subtitle}</p>}
      </div>
      <FailureState bare failure={failure} what="les données de Search Console" retryHref={retryHref} className="border-t border-[var(--q-line-soft)]" />
      {failure === "read_failed" && (
        <dl className="grid grid-cols-2 border-t border-[var(--q-line-soft)] md:grid-cols-4">
          {METRICS.map((m, i) => (
            <div
              key={m.key}
              className={cn(
                "flex flex-col gap-1.5 border-[var(--q-line-soft)] px-4 pb-4 pt-3.5 md:px-5",
                i % 2 === 1 && "border-l",
                i >= 2 && "border-t md:border-t-0",
                i === 2 && "md:border-l",
              )}
            >
              <dt className="text-[13px] font-medium text-[var(--q-text-3)]">{m.label}</dt>
              <dd className="q-display text-[24px] leading-[1.1] text-[var(--q-text-4)] md:text-[28px]">
                <Val text="—" />
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}
