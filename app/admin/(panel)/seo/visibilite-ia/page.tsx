/**
 * Visibilité IA (planches Visibilite-ia, Visibilite-suivi, Mobile-visibilite-ia) :
 * présence de Qonforme dans les réponses des assistants IA, relevé par relevé.
 * `?suivi=1` ouvre le panneau « Gérer le suivi ».
 */
import Link from "next/link"
import { redirect } from "next/navigation"
import { Info, SlidersHorizontal } from "lucide-react"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { SeoHeader } from "@/components/admin/seo/SeoHeader"
import { FailureState, InfoLine, SeoBanner } from "@/components/admin/seo/SeoStates"
import { GeoEvolutionChart, type EvolutionPoint } from "@/components/admin/seo/geo/GeoEvolutionChart"
import { CompetitorsCard, EngineVisibilityCard, QuestionsCard, QuestionsLegend } from "@/components/admin/seo/geo/Overview"
import { ImmediateAnalysisButton, RunProgressBanner } from "@/components/admin/seo/geo/RunControls"
import { SuiviPanel } from "@/components/admin/seo/geo/SuiviPanel"
import { load, seoDb } from "@/lib/seo/db"
import { getAllSettings } from "@/lib/seo/settings"
import { SITE_ORIGIN } from "@/lib/seo/site"
import { fmtRate } from "@/lib/seo/format"
import { todayInParis } from "@/lib/utils/paris-date"
import { readAskedQuestionIds, readQuestions, readRunCells, readRuns } from "@/lib/seo/geo/data"
import { engineStatuses } from "@/lib/seo/geo/engine-status"
import { runProgress } from "@/lib/seo/geo/runner"
import { importCovers, notYetQuestionIds } from "@/lib/seo/geo/question-view"
import { rateOf } from "@/lib/seo/geo/summary"
import { executionsLabel, RUN_KIND_LABELS, runDate, runDay, runTitle } from "@/lib/seo/geo/labels"
import type { GeoRunRow } from "@/lib/seo/geo/types"

export const dynamic = "force-dynamic"
export const metadata = { title: "Admin — Visibilité IA" }

const BASE = "/admin/seo/visibilite-ia"

const isActive = (r: GeoRunRow) => r.status === "queued" || r.status === "running"

/** Libellé d'un relevé terminé : « Relevé du 9 oct. 2026 · analyse immédiate · 3 exécutions par moteur ». */
function runLabelOf(run: GeoRunRow | null): string | null {
  if (!run) return null
  return run.kind === "import" ? runTitle(run) : `${runTitle(run)} · ${executionsLabel(run.repetitions)}`
}

export default async function VisibiliteIaPage({ searchParams }: { searchParams: { suivi?: string } }) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login")
  const db = seoDb()
  const showPanel = searchParams?.suivi === "1"

  const loaded = await load(async () => {
    const [settings, runs, questions] = await Promise.all([getAllSettings(db), readRuns(db), readQuestions(db)])
    const latest = runs.find((r) => r.status === "done") ?? null
    const active = runs.find(isActive) ?? null
    const [cells, progress] = await Promise.all([
      latest && latest.kind !== "import" ? readRunCells(db, latest.id) : Promise.resolve([]),
      active ? runProgress(db, active.id) : Promise.resolve(null),
    ])
    // « Pas encore relevée » : questions que le dernier relevé n'a pas posées et qu'aucun
    // relevé antérieur n'a posées non plus (ni couvertes par l'import)
    const missing = notYetQuestionIds(latest, questions, cells).filter((qid) => {
      const q = questions.find((x) => x.id === qid)
      return !q || !runs.some((r) => importCovers(r, q.position))
    })
    const earlierRunIds = runs.filter((r) => r.kind !== "import" && r.id !== latest?.id).map((r) => r.id)
    const askedBefore = await readAskedQuestionIds(db, missing, earlierRunIds)
    const notYetIds = missing.filter((qid) => !askedBefore.includes(qid))
    return { settings, runs, questions, latest, active, cells, progress, notYetIds }
  })

  const header = (
    <SeoHeader
      section="visibility"
      title="Visibilité IA"
      subtitle="Votre présence dans les réponses des assistants IA."
      actions={
        <div className="hidden items-center gap-2 md:flex">
          <Link href={`${BASE}?suivi=1`} scroll={false} className="q-btn q-btn-secondary">
            <SlidersHorizontal aria-hidden />
            Gérer le suivi
          </Link>
          <ImmediateAnalysisButton running={loaded.ok && Boolean(loaded.data.active)} />
        </div>
      }
    />
  )

  if (!loaded.ok) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <FailureState failure={loaded.failure} what="les relevés de visibilité IA" retryHref={BASE} />
      </div>
    )
  }

  const { settings, runs, questions, latest, active, cells, progress, notYetIds } = loaded.data
  const engines = engineStatuses(settings.geo.value)
  const competitors = settings.targeting.value.competitors
  const runLabel = runLabelOf(latest)
  const imported = latest?.kind === "import"
  const activeQuestions = questions.filter((q) => q.active)

  // Courbe : un point par relevé terminé (le plus récent d'un même jour), du plus ancien au plus récent
  const byDay = new Map<string, EvolutionPoint>()
  runs
    .filter((r) => r.status === "done" && r.summary)
    .slice()
    .reverse()
    .forEach((r) => {
      const day = runDay(r)
      byDay.set(day, { day, mention: rateOf(r.summary?.overall, "mention"), citation: rateOf(r.summary?.overall, "citation") })
    })
  const points = Array.from(byDay.values())
  const today = todayInParis()

  // Dernier relevé clos en échec (plus récent que le dernier relevé réussi)
  const lastClosed = runs.find((r) => r.status === "done" || r.status === "failed") ?? null
  const failedRun = lastClosed?.status === "failed" ? lastClosed : null
  const failedAnswers = cells.filter((c) => c.status === "failed")

  return (
    <div className="flex flex-col gap-5">
      {header}

      {/* Téléphone : actions pleine largeur, primaire en premier */}
      <div className="flex flex-col gap-2 md:hidden">
        <ImmediateAnalysisButton running={Boolean(active)} className="h-12 w-full" />
        <Link href={`${BASE}?suivi=1`} scroll={false} className="q-btn q-btn-secondary h-12 w-full">
          <SlidersHorizontal aria-hidden />
          Gérer le suivi
        </Link>
      </div>

      {active && progress && <RunProgressBanner key={active.id} runId={active.id} done={progress.done} total={progress.total} />}

      {failedRun && (
        <SeoBanner tone="danger" title={`Le relevé du ${runDate(failedRun)} (${RUN_KIND_LABELS[failedRun.kind]}) n'a pas abouti`}>
          {failedRun.note ?? "Aucune réponse obtenue."} Vérifiez les clés dans{" "}
          <Link href="/admin/seo/parametres/connexions" className="q-link">Paramètres › Connexions</Link>, puis relancez une analyse.
        </SeoBanner>
      )}

      <section aria-labelledby="t-evolution" className="q-card flex flex-col gap-4 px-4 py-4 md:px-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <h2 id="t-evolution" className="q-h2">Évolution</h2>
            <p className="text-[13px] text-[var(--q-text-4)]">Un point par relevé, tous moteurs confondus.</p>
          </div>
          {latest && (
            <p className="text-[13px] text-[var(--q-text-4)]">
              Dernier relevé : mention {fmtRate(rateOf(latest.summary?.overall, "mention"))} · citation{" "}
              {fmtRate(rateOf(latest.summary?.overall, "citation"))}
            </p>
          )}
        </div>
        {points.length > 0 ? (
          <GeoEvolutionChart points={points} today={today} />
        ) : (
          <p className="text-sm text-[var(--q-text-4)]">Aucun relevé terminé pour l&apos;instant.</p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--q-text-4)]">
          <span>
            {points.length} relevé{points.length > 1 ? "s" : ""}
            {runLabel ? ` · dernier : ${runLabel.replace(/^Relevé du /, "")}` : ""}
          </span>
        </div>
        {points.length < 2 && (
          <div className="q-inset flex items-start gap-2 p-3 text-sm text-[var(--q-text-2)]">
            <Info className="mt-0.5 size-4 shrink-0 text-[var(--q-text-4)]" aria-hidden />
            <span>
              L&apos;historique se construit à chaque relevé, une fois par mois. Il faut deux relevés pour dessiner une courbe — ou une analyse
              immédiate pour ne pas attendre.
            </span>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <EngineVisibilityCard engines={engines} summary={latest?.summary ?? null} runLabel={runLabel} />
        <CompetitorsCard summary={latest?.summary ?? null} competitors={competitors} runLabel={runLabel} imported={imported} />
      </div>

      <div className="flex flex-col gap-3">
        <QuestionsCard
          questions={activeQuestions}
          cells={cells}
          runEngines={latest?.engines ?? []}
          runLabel={runLabel}
          imported={imported}
          notYetIds={notYetIds}
        />
        {latest?.note && !imported && <InfoLine>{latest.note}</InfoLine>}
        {failedAnswers.length > 0 && (
          <InfoLine tone="warn">
            {failedAnswers.length} réponse{failedAnswers.length > 1 ? "s n'ont" : " n'a"} pas pu être obtenue{failedAnswers.length > 1 ? "s" : ""} lors
            du dernier relevé{failedAnswers[0]?.error ? ` (${failedAnswers[0].error})` : ""} : elles ne comptent ni comme présence ni comme absence.
          </InfoLine>
        )}
        <QuestionsLegend />
      </div>

      {showPanel && (
        <SuiviPanel
          closeHref={BASE}
          brandName={settings.brand.value.name}
          siteUrl={SITE_ORIGIN}
          geo={settings.geo.value}
          targeting={settings.targeting.value}
          engines={engines}
          questions={questions}
          notYetIds={notYetIds}
          lastRunLabel={latest ? runTitle(latest).replace(/^Relevé du /, "") : null}
        />
      )}
    </div>
  )
}
