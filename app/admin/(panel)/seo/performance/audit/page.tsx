/**
 * Performance › Audit du site (planche Performance-audit) : synthèse de la
 * dernière exploration du plan du site, contrôles techniques, historique des
 * actions faites. « Ré-analyser le site » lance une exploration (lib/seo/audit/).
 */
import { redirect } from "next/navigation"
import { Radar } from "lucide-react"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { EmptyState } from "@/components/app/kit"
import { fmtDateTime } from "@/components/admin/ui"
import { SeoHeader, SeoTabs } from "@/components/admin/seo/SeoHeader"
import { PERFORMANCE_SUBTITLE, PERFORMANCE_TABS, PERFORMANCE_TITLE } from "@/components/admin/seo/performance/tabs"
import { FailureState, SeoBanner } from "@/components/admin/seo/SeoStates"
import { ReanalyzeButton } from "@/components/admin/seo/audit/ReanalyzeButton"
import { AuditSynthesis, ControlsCard, HistoryCard } from "@/components/admin/seo/audit/AuditCards"
import { load, seoDb } from "@/lib/seo/db"
import { latestDoneRun, listRuns } from "@/lib/seo/audit/crawler"
import { controlsOf, controlsTally, readSummary } from "@/lib/seo/audit/checks"
import { readAuditFindings } from "@/lib/seo/actions/data"

export const dynamic = "force-dynamic"
export const metadata = { title: "Admin — SEO, audit du site" }

export default async function SeoAuditPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login")

  const data = await load(async () => {
    const db = seoDb()
    const [runs, lastDone, findings] = await Promise.all([listRuns(db, 5), latestDoneRun(db), readAuditFindings(db)])
    return { runs, lastDone, ...findings }
  })

  const running = data.ok ? data.data.runs.find((r) => r.status === "running") ?? null : null
  const runningProgress = running ? { pagesDone: running.pages_done, pagesTotal: running.pages_total } : null

  const header = (
    <SeoHeader
      section="performance"
      title={PERFORMANCE_TITLE}
      subtitle={PERFORMANCE_SUBTITLE}
      actions={<ReanalyzeButton running={runningProgress} className="max-md:hidden" />}
    />
  )

  if (!data.ok) {
    return (
      <>
        {header}
        <SeoTabs tabs={PERFORMANCE_TABS} current="/admin/seo/performance/audit" label="Sous-onglets de Performance" className="max-md:[&>a]:h-11" />
        <FailureState failure={data.failure} what="l'audit du site" retryHref="/admin/seo/performance/audit" />
      </>
    )
  }

  const { runs, lastDone, openCrawl, doneCount, history } = data.data
  const latest = runs[0] ?? null
  const failed = latest && latest.status === "failed" ? latest : null
  const summary = readSummary(lastDone?.summary)
  const controls = summary ? controlsOf(summary) : []
  const openByRule: Record<string, string[]> = {}
  openCrawl.forEach((f) => {
    ;(openByRule[f.rule] ??= []).push(f.id)
  })

  return (
    <>
      {header}
      <ReanalyzeButton running={runningProgress} block className="md:hidden" />
      <SeoTabs tabs={PERFORMANCE_TABS} current="/admin/seo/performance/audit" label="Sous-onglets de Performance" className="max-md:[&>a]:h-11" />

      {failed && (
        <SeoBanner tone="danger" title="La dernière analyse du site n'a pas pu aboutir">
          {failed.error ?? "Raison inconnue."} ({fmtDateTime(failed.finished_at ?? failed.started_at)}){" "}
          {lastDone
            ? "Relancez l'analyse ; les résultats ci-dessous sont ceux de la dernière exploration terminée."
            : "Relancez l'analyse : aucune exploration n'a encore abouti."}
        </SeoBanner>
      )}

      {!lastDone && !running ? (
        <div className="q-card">
          <EmptyState
            className="py-12"
            icon={<Radar className="size-5" aria-hidden />}
            title="Lancez la première exploration"
            text="L'analyse lit le plan du site de qonforme.fr, vérifie chaque page (title, description, H1, balise canonique, liens internes) et range les problèmes dans les Actions SEO."
          />
        </div>
      ) : (
        <>
          <AuditSynthesis
            pagesExplored={summary ? summary.pagesExplored : null}
            openCrawl={openCrawl.length}
            doneCount={doneCount}
            lastDoneAt={lastDone?.finished_at ?? null}
            running={runningProgress}
          />
          {summary ? (
            <ControlsCard controls={controls} tally={controlsTally(controls)} openByRule={openByRule} />
          ) : (
            <div className="q-card">
              <EmptyState
                className="py-10"
                icon={<Radar className="size-5" aria-hidden />}
                title="Première exploration en cours"
                text="Les contrôles s'affichent dès que l'exploration est terminée. Gardez la page ouverte avec « Continuer l'analyse », ou laissez la tâche planifiée la finir."
              />
            </div>
          )}
        </>
      )}

      <HistoryCard history={history} total={doneCount} />
    </>
  )
}
