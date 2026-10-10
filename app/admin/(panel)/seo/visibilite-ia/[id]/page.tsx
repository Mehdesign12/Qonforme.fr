/**
 * Visibilité IA › détail d'une question (planche Visibilite-question) : réponses de
 * chaque moteur, exécution par exécution (`?releve=&moteur=&execution=`), sources
 * citées, concurrents repérés (usage interne) et piste d'action.
 */
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { SetCrumb } from "@/components/layout/crumb"
import { SeoHeader, SegmentedLinks } from "@/components/admin/seo/SeoHeader"
import { FailureState, InfoLine } from "@/components/admin/seo/SeoStates"
import { AnswerCard, EngineSummaryCards, SourcesCard, WhatToDoCard } from "@/components/admin/seo/geo/QuestionDetail"
import { RunSelect } from "@/components/admin/seo/geo/RunSelect"
import { load, seoDb } from "@/lib/seo/db"
import { getAllSettings } from "@/lib/seo/settings"
import { GEO_ENGINES, type GeoEngine } from "@/lib/seo/types"
import { readQuestionAnswers, readQuestionRunIds, readQuestions, readRuns, readTargetKeywords, readTopicForQuestion } from "@/lib/seo/geo/data"
import { brandTermsOf } from "@/lib/seo/geo/detect"
import { isGeoEngine } from "@/lib/seo/geo/engines"
import { isUuid } from "@/lib/seo/geo/questions"
import { matchQuestionKeyword, questionRunCandidates, selectRun } from "@/lib/seo/geo/question-view"
import { executionsLabel, RUN_KIND_LABELS, runDate, runTitle, shortQuestion } from "@/lib/seo/geo/labels"
import type { GeoRunRow } from "@/lib/seo/geo/types"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"
export const metadata = { title: "Admin — Visibilité IA" }

const BASE = "/admin/seo/visibilite-ia"

type SearchParams = { releve?: string; moteur?: string; execution?: string }

function runOptionLabel(run: GeoRunRow): string {
  const state = run.status === "queued" || run.status === "running" ? " (en cours)" : run.status === "failed" ? " (en échec)" : ""
  return `${runDate(run)} · ${RUN_KIND_LABELS[run.kind]}${state}`
}

export default async function QuestionDetailPage({ params, searchParams }: { params: { id: string }; searchParams: SearchParams }) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login")
  const id = params.id
  if (!isUuid(id)) notFound()
  const db = seoDb()

  const loaded = await load(async () => {
    const [questions, runs, settings] = await Promise.all([readQuestions(db), readRuns(db), getAllSettings(db)])
    const question = questions.find((q) => q.id === id)
    if (!question) return null
    // Relevés lus (36 au plus) qui ont interrogé la question ; l'import seulement s'il l'a couverte
    const runIds = await readQuestionRunIds(db, id, runs.filter((r) => r.kind !== "import").map((r) => r.id))
    const candidates = questionRunCandidates(runs, runIds, question)
    const selected = selectRun(candidates, searchParams?.releve)
    const [answers, topic, keywords] = await Promise.all([
      selected && selected.kind !== "import" ? readQuestionAnswers(db, selected.id, id) : Promise.resolve([]),
      readTopicForQuestion(db, id),
      readTargetKeywords(db),
    ])
    const keyword = matchQuestionKeyword(question.question, keywords)
    return { question, questions, candidates, selected, answers, topic, keyword, settings }
  })

  if (!loaded.ok) {
    return (
      <div className="flex flex-col gap-5">
        <SeoHeader section="visibility" title="Visibilité IA" backHref={BASE} backLabel="Visibilité IA" />
        <FailureState failure={loaded.failure} what="les réponses de cette question" retryHref={`${BASE}/${id}`} />
      </div>
    )
  }
  if (!loaded.data) notFound()

  const { question, questions, candidates, selected, answers, topic, keyword, settings } = loaded.data
  const imported = selected?.kind === "import"
  const runEngines = selected?.engines ?? []

  // Navigation entre les questions (ordre de suivi)
  const index = questions.findIndex((q) => q.id === id)
  const prev = index > 0 ? questions[index - 1] : null
  const next = index >= 0 && index < questions.length - 1 ? questions[index + 1] : null

  // Moteur et exécution affichés
  const askedEngines = GEO_ENGINES.filter((e) => runEngines.includes(e.key)).map((e) => e.key)
  const engine: GeoEngine =
    searchParams?.moteur && isGeoEngine(searchParams.moteur) ? searchParams.moteur : askedEngines[0] ?? GEO_ENGINES[0].key
  const engineAnswers = answers.filter((a) => a.engine === engine)
  const executions = Array.from(new Set(engineAnswers.map((a) => a.repetition))).sort((a, b) => a - b)
  const requested = Number(searchParams?.execution)
  const execution = executions.includes(requested) ? requested : executions[0] ?? 1
  const shown = engineAnswers.find((a) => a.repetition === execution) ?? null

  const baseParams: Record<string, string | undefined> = { releve: selected?.id, moteur: engine, execution: String(execution) }
  const hrefWith = (patch: Record<string, string | undefined>) => {
    const qs = new URLSearchParams()
    Object.entries({ ...baseParams, ...patch }).forEach(([k, v]) => {
      if (v) qs.set(k, v)
    })
    return `${BASE}/${id}?${qs}`
  }

  const subtitle = !selected
    ? "Pas encore relevée : lancez une analyse immédiate."
    : imported
      ? runTitle(selected)
      : `Relevé du ${runDate(selected)} · ${executionsLabel(selected.repetitions)}`
  const brandTerms = brandTermsOf(settings.targeting.value.brandTerms)

  return (
    <div className="flex flex-col gap-5">
      <SetCrumb label={shortQuestion(question.question)} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={BASE} className="q-link inline-flex min-h-11 items-center gap-1.5 text-[15px]">
          <ArrowLeft className="size-4" aria-hidden />
          Visibilité IA
        </Link>
        {index >= 0 && questions.length > 1 && (
          <div role="group" aria-label="Navigation entre les questions" className="flex items-center gap-1">
            <span className="mr-1 text-[13px] text-[var(--q-text-4)]">
              Question {index + 1} sur {questions.length}
            </span>
            {prev ? (
              <Link href={`${BASE}/${prev.id}`} aria-label="Question précédente" className="q-btn q-btn-secondary q-btn-icon size-11 md:size-[34px]">
                <ChevronLeft aria-hidden />
              </Link>
            ) : (
              <span aria-hidden className="q-btn q-btn-secondary q-btn-icon size-11 opacity-40 md:size-[34px]"><ChevronLeft /></span>
            )}
            {next ? (
              <Link href={`${BASE}/${next.id}`} aria-label="Question suivante" className="q-btn q-btn-secondary q-btn-icon size-11 md:size-[34px]">
                <ChevronRight aria-hidden />
              </Link>
            ) : (
              <span aria-hidden className="q-btn q-btn-secondary q-btn-icon size-11 opacity-40 md:size-[34px]"><ChevronRight /></span>
            )}
          </div>
        )}
      </div>

      <SeoHeader section="visibility" title={question.question} subtitle={subtitle} />

      {!question.active && <InfoLine>Cette question n&apos;est plus suivie : elle n&apos;est pas posée aux prochains relevés.</InfoLine>}

      {candidates.length > 1 && selected && (
        <RunSelect basePath={`${BASE}/${id}`} current={selected.id} options={candidates.map((r) => ({ value: r.id, label: runOptionLabel(r) }))} />
      )}

      {selected && (
        <>
          <EngineSummaryCards answers={answers} runEngines={runEngines} imported={imported} />
          {imported && (
            <p className="text-[13px] text-[var(--q-text-4)]">
              « — » : non mesuré pour cette question. Le relevé importé ne donne que des taux sur l&apos;ensemble des questions.
            </p>
          )}
        </>
      )}

      {selected && !imported && (
        <div className="flex flex-col gap-3">
          <nav aria-label="Moteur IA affiché" className="q-tabs">
            {GEO_ENGINES.map((e) => (
              <Link
                key={e.key}
                href={hrefWith({ moteur: e.key, execution: undefined })}
                scroll={false}
                aria-current={e.key === engine ? "page" : undefined}
                className={cn("!h-11 md:!h-10", !runEngines.includes(e.key) && "opacity-60")}
              >
                {e.label}
              </Link>
            ))}
          </nav>
          {executions.length > 1 && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[13px] text-[var(--q-text-4)]">
                Exécution {execution} sur {executions.length}
              </span>
              {/* Cibles de 44 px sur téléphone */}
              <div className="max-md:[&_a]:!h-11 max-md:[&_a]:!min-w-11">
                <SegmentedLinks
                  label="Exécution affichée"
                  param="execution"
                  basePath={`${BASE}/${id}`}
                  params={baseParams}
                  current={String(execution)}
                  options={executions.map((n) => ({ value: String(n), label: String(n) }))}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {selected && !imported && (
        <>
          <AnswerCard engine={engine} answer={shown} brandTerms={brandTerms} asked={runEngines.includes(engine)} />
          <SourcesCard answer={shown} competitors={settings.targeting.value.competitors} />
        </>
      )}

      <WhatToDoCard
        questionId={id}
        answers={answers}
        imported={imported}
        importSummary={imported ? selected?.summary ?? null : null}
        topic={topic}
        keyword={keyword}
      />
    </div>
  )
}
