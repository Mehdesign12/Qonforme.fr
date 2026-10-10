/**
 * Actions SEO (planches Actions-seo, Actions-detail, Mobile-actions) :
 * statistiques, pages à améliorer (constats de Search Console et de
 * l'exploration), détail d'un constat dans un panneau latéral (`?constat=`),
 * onglets À faire · Faites · Ignorées (`?etat=`).
 */
import Link from "next/link"
import { redirect } from "next/navigation"
import { CircleCheck, Radar, SearchX, ListChecks } from "lucide-react"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { EmptyState } from "@/components/app/kit"
import { fmtDate } from "@/components/admin/ui"
import { SeoHeader, SeoTabs } from "@/components/admin/seo/SeoHeader"
import { FailureState, SeoBanner } from "@/components/admin/seo/SeoStates"
import { SetCrumb } from "@/components/layout/crumb"
import { ReanalyzeButton } from "@/components/admin/seo/audit/ReanalyzeButton"
import { ruleLabel } from "@/components/admin/seo/audit/AuditCards"
import { DeltaText } from "@/components/admin/seo/actions/bits"
import { FindingsList, type FindingListItem } from "@/components/admin/seo/actions/FindingsList"
import { FindingsToolbar } from "@/components/admin/seo/actions/FindingsToolbar"
import { PeriodSelect } from "@/components/admin/seo/actions/PeriodSelect"
import { FindingPanel, type PanelHistoryItem } from "@/components/admin/seo/actions/FindingPanel"
import { ETATS, actionsHref, hasFilters, parseActionsQuery, type ActionsQuery } from "@/components/admin/seo/actions/url"
import { load, seoDb } from "@/lib/seo/db"
import { isConfigured } from "@/lib/seo/connections"
import { resolvePeriod } from "@/lib/seo/period"
import { deltaCount, deltaPosition, fmtCount, fmtPosition, fmtRange, type Delta } from "@/lib/seo/format"
import type { FindingStatus } from "@/lib/seo/types"
import { readSummary } from "@/lib/seo/audit/checks"
import { findRunningRun, latestDoneRun } from "@/lib/seo/audit/crawler"
import { getFinding, listFindings, type FindingRow } from "@/lib/seo/actions/data"
import { readGscBounds, readPageStats, readTotals } from "@/lib/seo/actions/gsc"
import { consigneOf, whyOf } from "@/lib/seo/actions/rules"
import { readVerification } from "@/lib/seo/actions/verdict"
import { historyLabel, readHistory } from "@/lib/seo/actions/history"
import { isSuggestible, parseStoredSuggestion } from "@/lib/seo/actions/suggest"

export const dynamic = "force-dynamic"
export const metadata = { title: "Admin — SEO, actions" }

type SearchParams = Record<string, string | string[] | undefined>

const SEVERITY_RANK = { high: 3, medium: 2, low: 1 } as const

function matches(f: FindingRow, q: ActionsQuery): boolean {
  if (q.type && f.page_type !== q.type) return false
  if (q.source && f.source !== q.source) return false
  if (q.suggestions && !f.suggestion) return false
  if (q.regle && f.rule !== q.regle) return false
  if (q.q) {
    const needle = q.q.toLowerCase()
    const hay = `${f.path} ${f.title} ${f.explanation ?? ""} ${f.recommendation ?? ""}`.toLowerCase()
    if (!hay.includes(needle)) return false
  }
  return true
}

function sortFor(status: FindingStatus) {
  return (a: FindingRow, b: FindingRow) => {
    if (status === "done") return Date.parse(b.done_at ?? "") - Date.parse(a.done_at ?? "") || 0
    if (status === "ignored") return Date.parse(b.ignored_at ?? "") - Date.parse(a.ignored_at ?? "") || 0
    const imp = (f: FindingRow) => (typeof f.metrics.impressions === "number" ? f.metrics.impressions : 0)
    return SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || imp(b) - imp(a) || Date.parse(b.detected_at) - Date.parse(a.detected_at)
  }
}

function StatTile({ label, value, sub }: { label: string; value: string; sub: React.ReactNode }) {
  return (
    <div className="q-inset flex flex-col gap-2 p-4">
      <span className="text-[13px] text-[var(--q-text-3)]">{label}</span>
      <span className="q-kpi-value">{value}</span>
      <span className="flex flex-wrap items-center gap-1.5 text-[13px] text-[var(--q-text-4)]">{sub}</span>
    </div>
  )
}

export default async function SeoActionsPage({ searchParams }: { searchParams: Promise<SearchParams> | SearchParams }) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login")
  const query = parseActionsQuery(await searchParams)
  const { constat, ...filters } = query

  const data = await load(async () => {
    const db = seoDb()
    const [findings, bounds, lastRun, running] = await Promise.all([listFindings(db), readGscBounds(db), latestDoneRun(db), findRunningRun(db)])

    let stats: { range: { from: string; to: string }; label: string; current: Awaited<ReturnType<typeof readTotals>>; previous: Awaited<ReturnType<typeof readTotals>> } | null = null
    if (bounds.last) {
      const p = resolvePeriod(filters.periode, bounds.last)
      const [current, previous] = await Promise.all([readTotals(db, p.current.from, p.current.to), readTotals(db, p.previous.from, p.previous.to)])
      stats = { range: p.current, label: p.label, current, previous }
    }

    let selected: FindingRow | null = null
    let selectedStats: { range: { from: string; to: string }; stat: { clicks: number; impressions: number; position: number | null } | null } | null = null
    if (constat) {
      selected = findings.find((f) => f.id === constat) ?? (await getFinding(db, constat))
      if (selected && bounds.last) {
        const p28 = resolvePeriod("28j", bounds.last)
        const pages = await readPageStats(db, p28.current.from, p28.current.to)
        selectedStats = { range: p28.current, stat: pages[selected.path] ?? null }
      }
    }
    return { findings, bounds, lastRun, running, stats, selected, selectedStats }
  })

  const runningProgress = data.ok && data.data.running ? { pagesDone: data.data.running.pages_done, pagesTotal: data.data.running.pages_total } : null
  const header = (
    <SeoHeader
      section="actions"
      title="Actions SEO"
      subtitle="Choisissez une page, corrigez un problème et vérifiez le résultat."
      actions={<ReanalyzeButton running={runningProgress} className="max-md:hidden" />}
    />
  )

  if (!data.ok) {
    return (
      <>
        {header}
        <FailureState failure={data.failure} what="les actions SEO" retryHref={actionsHref(filters)} />
      </>
    )
  }

  const { findings, bounds, lastRun, stats, selected, selectedStats } = data.data
  const summary = readSummary(lastRun?.summary)
  const gscConnected = isConfigured("search_console")

  // Statistiques
  const doneAll = findings.filter((f) => f.status === "done")
  const lastDoneAt = doneAll.reduce<string | null>((max, f) => (f.done_at && (!max || f.done_at > max) ? f.done_at : max), null)
  const openPaths = new Set(findings.filter((f) => f.status === "open").map((f) => f.path))
  const clicksDelta: Delta | null = stats ? deltaCount(stats.current.clicks, stats.previous.clicks) : null
  const positionDelta: Delta | null = stats ? deltaPosition(stats.current.position, stats.previous.position) : null
  const noGscText = gscConnected ? "Pas encore de données Search Console" : "Search Console non connectée"

  // Liste
  const etat = ETATS.find((e) => e.key === filters.etat) ?? ETATS[0]
  const filtered = findings.filter((f) => matches(f, filters))
  const counts: Record<string, number> = {}
  ETATS.forEach((e) => {
    counts[e.key] = filtered.filter((f) => f.status === e.status).length
  })
  const shown = filtered.filter((f) => f.status === etat.status).sort(sortFor(etat.status))
  const items: FindingListItem[] = shown.map((f) => ({
    id: f.id,
    href: actionsHref(filters, { constat: f.id }),
    path: f.path,
    pageType: f.page_type,
    title: f.title,
    explanation: f.explanation,
    severity: f.severity,
    source: f.source,
    effortMinutes: f.effort_minutes,
    status: f.status,
    doneAt: f.done_at,
    ignoredAt: f.ignored_at,
    verdict: readVerification(f.verification)?.verdict ?? null,
    hasSuggestion: Boolean(f.suggestion),
  }))
  const neverAnalysed = !lastRun && !bounds.last && findings.every((f) => f.source === "import")
  const filtersOn = hasFilters(filters)

  // Détail : panneau latéral (position fixe, rendu en fin de page), ou bandeau
  // « Constat introuvable » en haut de page pour un lien périmé.
  let panel: React.ReactNode = null
  let missingBanner: React.ReactNode = null
  if (constat) {
    const closeHref = actionsHref(filters)
    if (!selected) {
      missingBanner = (
        <SeoBanner
          tone="warn"
          title="Constat introuvable"
          action={
            <Link href={closeHref} className="q-btn q-btn-secondary q-btn-sm max-md:h-11 max-md:px-4">
              Fermer
            </Link>
          }
        >
          Ce constat n&apos;existe plus ou son adresse est incomplète.
        </SeoBanner>
      )
    } else {
      const m = selected.metrics
      const history: PanelHistoryItem[] = readHistory(selected.history).map((h) => ({ label: historyLabel(h.event), at: h.at, note: h.note }))
      if (!history.some((h) => h.label === historyLabel("detected")) && selected.source !== "import") {
        history.unshift({ label: historyLabel("detected"), at: selected.detected_at })
      }
      if (selected.status === "open" && !readHistory(selected.history).some((h) => h.event === "done")) {
        history.push({ label: "Aucune action faite", at: null, muted: true })
      }
      const stat = selectedStats?.stat ?? null
      panel = (
        <>
          <SetCrumb label={selected.title} />
          <FindingPanel
            finding={{
              id: selected.id,
              rule: selected.rule,
              path: selected.path,
              pageType: selected.page_type,
              title: selected.title,
              explanation: selected.explanation,
              recommendation: selected.recommendation,
              severity: selected.severity,
              source: selected.source,
              effortMinutes: selected.effort_minutes,
              status: selected.status,
              verifyAfter: selected.verify_after,
              resolvedAt: selected.resolved_at,
              currentTitle: typeof m.title === "string" ? m.title : null,
              currentDescription: typeof m.description === "string" ? m.description : null,
              showDescription: selected.rule === "crawl-description" || selected.rule === "gsc-no-click",
            }}
            closeHref={closeHref}
            measures={
              selectedStats
                ? {
                    clicks: stat?.clicks ?? 0,
                    impressions: stat?.impressions ?? 0,
                    ctr: stat && stat.impressions > 0 ? stat.clicks / stat.impressions : null,
                    position: stat?.position ?? null,
                  }
                : null
            }
            measuresCaption={
              selectedStats
                ? `Search Console · ${fmtRange(selectedStats.range.from, selectedStats.range.to)}${stat ? "" : " · aucune impression sur la période"}`
                : noGscText
            }
            why={whyOf(selected.rule, m, selected.title)}
            consigne={consigneOf({ path: selected.path, title: selected.title, explanation: selected.explanation, recommendation: selected.recommendation, metrics: m })}
            verification={readVerification(selected.verification)}
            history={history}
            suggestion={parseStoredSuggestion(selected.suggestion)}
            suggestible={isSuggestible(selected.rule)}
            geminiConfigured={Boolean(process.env.GEMINI_API_KEY?.trim())}
          />
        </>
      )
    }
  }

  const tabs = ETATS.map((e) => ({ href: actionsHref({ ...filters, etat: e.key }), label: e.label, count: counts[e.key] }))

  return (
    <>
      {header}
      <ReanalyzeButton running={runningProgress} block className="md:hidden" />
      {missingBanner}

      <section aria-labelledby="stats-titre" className="q-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-2 pt-4">
          <h2 id="stats-titre" className="q-h2">Vos statistiques</h2>
          <PeriodSelect query={filters} />
        </div>
        <div className="px-5 pb-5">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatTile
              label="Actions faites depuis le début"
              value={fmtCount(doneAll.length)}
              sub={lastDoneAt ? `Dernière action le ${fmtDate(lastDoneAt, { day: "numeric", month: "short" })}` : "Le compteur démarre à la première action"}
            />
            <StatTile
              label="Pages à améliorer"
              value={fmtCount(openPaths.size)}
              sub={summary ? `${fmtCount(summary.pagesExplored)} pages analysées` : "Aucune analyse du site terminée"}
            />
            <StatTile
              label="Clics"
              value={stats ? fmtCount(stats.current.clicks) : "—"}
              sub={clicksDelta && stats ? <DeltaText delta={clicksDelta} suffix={`vs ${stats.label} précédents`} /> : noGscText}
            />
            <StatTile
              label="Position moyenne"
              value={stats ? fmtPosition(stats.current.position) : "—"}
              sub={positionDelta && stats ? <DeltaText delta={positionDelta} /> : noGscText}
            />
          </div>
          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-xs text-[var(--q-text-4)]">
            {stats ? (
              <>
                <span>
                  Clics et position&nbsp;: Google Search Console · {fmtRange(stats.range.from, stats.range.to)} · comparés aux {stats.label} précédents
                </span>
                <span>2 à 3&nbsp;jours de décalage</span>
              </>
            ) : (
              <span>
                {noGscText}.{" "}
                {!gscConnected && (
                  <Link href="/admin/seo/parametres/connexions" className="q-link font-semibold">
                    Ouvrir Paramètres › Connexions
                  </Link>
                )}
              </span>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="pages-titre" className="q-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-5 pb-2 pt-4">
          <h2 id="pages-titre" className="q-h2">Pages à améliorer</h2>
          <span className="text-[13px] text-[var(--q-text-4)]">
            {lastRun?.finished_at ? <>Dernière exploration&nbsp;: {fmtDate(lastRun.finished_at)}</> : "Aucune exploration terminée"}
          </span>
        </div>
        <FindingsToolbar query={filters} ruleLabel={filters.regle ? ruleLabel(filters.regle) : null} />
        <SeoTabs tabs={tabs} current={actionsHref({ ...filters, etat: etat.key })} label="État des constats" className="px-5 max-md:[&>a]:h-11" />

        {items.length > 0 ? (
          <FindingsList items={items} label={`Constats : ${etat.label.toLowerCase()}`} />
        ) : filtersOn ? (
          <EmptyState
            className="py-12"
            icon={<SearchX className="size-5" aria-hidden />}
            title="Aucun constat ne correspond à ces filtres"
            text="Modifiez la recherche ou retirez des filtres pour voir les autres constats."
            action={
              <Link href={actionsHref({ etat: filters.etat, periode: filters.periode })} className="q-btn q-btn-secondary">
                Effacer les filtres
              </Link>
            }
          />
        ) : etat.status === "open" ? (
          neverAnalysed ? (
            <EmptyState
              className="py-12"
              icon={<Radar className="size-5" aria-hidden />}
              title="Lancez la première analyse"
              text="« Ré-analyser le site » explore les pages du plan du site ; avec Search Console, les pages bien classées sans clic ou en baisse s'ajoutent aussi ici."
            />
          ) : (
            <EmptyState
              className="py-12"
              icon={<CircleCheck className="size-5" aria-hidden />}
              title="Aucun constat à vérifier"
              text="La dernière analyse du site n'a trouvé aucun problème qui demande votre attention."
            />
          )
        ) : etat.status === "done" ? (
          <EmptyState
            className="py-12"
            icon={<ListChecks className="size-5" aria-hidden />}
            title="Aucune action faite"
            text="Marquez un constat comme fait : son effet sur la page sera mesuré 14 jours plus tard."
          />
        ) : (
          <EmptyState
            className="py-12"
            icon={<ListChecks className="size-5" aria-hidden />}
            title="Aucun constat ignoré"
            text="Un constat ignoré peut revenir au bout de 30 jours s'il se présente encore."
          />
        )}

        <p className="border-t border-[var(--q-line-soft)] px-5 py-3 text-xs text-[var(--q-text-4)]">Sources : Search Console et exploration du plan du site</p>
      </section>

      {panel}
    </>
  )
}
