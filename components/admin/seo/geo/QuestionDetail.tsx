/**
 * Détail d'une question (planche Visibilite-question) : résumé par moteur, réponse
 * conservée, sources citées, concurrents repérés (usage interne), « Que faire ».
 * Composants serveur, sans hook.
 */
import Link from "next/link"
import { ArrowRight, CircleAlert, ExternalLink, Lightbulb, SearchX } from "lucide-react"
import { StatusPill } from "@/components/app/kit"
import { cn } from "@/lib/utils"
import { GEO_ENGINES, KEYWORD_STATUS, TOPIC_STATUS, type GeoEngine, type GeoRunSummary, type TopicStatus } from "@/lib/seo/types"
import { pageLabel } from "@/lib/seo/keywords/page-label"
import { ENGINE_INITIALS } from "@/lib/seo/geo/engine-status"
import { domainOf, sourceKind } from "@/lib/seo/geo/detect"
import { plainAnswer } from "@/lib/seo/geo/labels"
import { shouldSuggestTopic, whatToDoOf, type GeoKeywordRef } from "@/lib/seo/geo/question-view"
import type { GeoAnswerRow, GeoSource } from "@/lib/seo/geo/types"
import type { GeoTopicRef } from "@/lib/seo/geo/data"
import { InternalUseTag } from "@/components/admin/seo/geo/Overview"
import { CreateTopicButton } from "@/components/admin/seo/geo/CreateTopicButton"
import { fmtDateTime } from "@/components/admin/ui"

const labelOf = (engine: string) => GEO_ENGINES.find((e) => e.key === engine)?.label ?? engine

function Dash() {
  return (
    <>
      <span aria-hidden>—</span>
      <span className="sr-only">Non mesuré</span>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Résumé par moteur                                                   */
/* ------------------------------------------------------------------ */

export function EngineSummaryCards({ answers, runEngines, imported }: { answers: GeoAnswerRow[]; runEngines: string[]; imported: boolean }) {
  return (
    <section aria-labelledby="titre-resume" className="flex flex-col gap-2">
      <h2 id="titre-resume" className="sr-only">Résumé par moteur</h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {GEO_ENGINES.map((e) => {
          const list = answers.filter((a) => a.engine === e.key)
          const done = list.filter((a) => a.status === "done")
          const failed = list.filter((a) => a.status === "failed").length
          const measured = !imported && runEngines.includes(e.key) && done.length > 0
          return (
            <li key={e.key} className="q-card flex flex-col gap-3 px-4 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="q-avatar" aria-hidden>{ENGINE_INITIALS[e.key]}</span>
                <h3 className="text-[15px] font-semibold text-[var(--q-ink)]">{e.label}</h3>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex flex-col gap-0.5">
                  <dt className="text-[13px] text-[var(--q-text-4)]">Mentions</dt>
                  <dd className="font-semibold tabular-nums text-[var(--q-ink)]">
                    {measured ? `${done.filter((a) => a.brand_mentioned).length} / ${done.length}` : <Dash />}
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-[13px] text-[var(--q-text-4)]">Citations</dt>
                  <dd className="font-semibold tabular-nums text-[var(--q-ink)]">
                    {measured ? `${done.filter((a) => a.site_cited).length} / ${done.length}` : <Dash />}
                  </dd>
                </div>
              </dl>
              {!imported && failed > 0 && (
                <p className="text-xs text-[var(--q-warn)]">
                  {failed} exécution{failed > 1 ? "s" : ""} en échec
                </p>
              )}
              {!imported && !runEngines.includes(e.key) && <p className="text-xs text-[var(--q-text-4)]">Pas interrogé dans ce relevé</p>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Réponse conservée                                                   */
/* ------------------------------------------------------------------ */

export function AnswerCard({
  engine,
  answer,
  brandTerms,
  asked,
}: {
  engine: GeoEngine
  answer: GeoAnswerRow | null
  brandTerms: string[]
  /** Le moteur a été interrogé dans ce relevé. */
  asked: boolean
}) {
  const label = labelOf(engine)
  let body: React.ReactNode
  if (!asked || !answer) {
    body = <p className="text-sm text-[var(--q-text-4)]">{label} n&apos;a pas été interrogé pour cette question lors de ce relevé.</p>
  } else if (answer.status === "pending" || answer.status === "running") {
    body = <p className="text-sm text-[var(--q-text-4)]">Réponse en attente : l&apos;analyse est en cours.</p>
  } else if (answer.status === "failed" || answer.status === "skipped") {
    body = (
      <p role="alert" className="flex items-start gap-2 text-sm text-[var(--q-danger)]">
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Pas de réponse{answer.error ? ` : ${answer.error}` : "."} Cette exécution ne compte ni comme présence ni comme absence.
        </span>
      </p>
    )
  } else if (!answer.answer) {
    body = (
      <p className="flex items-start gap-2 text-sm text-[var(--q-text-3)]">
        <SearchX className="mt-0.5 size-4 shrink-0" aria-hidden />
        {engine === "google_ai_overview"
          ? "Pas d'Aperçu IA pour cette requête : Google n'en affiche pas. Compté comme absent."
          : "Le moteur n'a rendu aucun texte. Compté comme absent."}
      </p>
    )
  } else {
    body = (
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="q-inset min-w-0 flex-1 p-4">
          <p className="whitespace-pre-line break-words text-[15px] leading-relaxed text-[var(--q-ink)]">{plainAnswer(answer.answer)}</p>
        </div>
        <aside aria-label="Marque repérée" className="flex shrink-0 flex-col gap-3 rounded-xl border border-[var(--q-line)] p-4 lg:w-[230px]">
          <p className="text-sm font-semibold text-[var(--q-ink)]">
            Marque repérée : {answer.brand_mentioned ? "oui" : "aucune"}
          </p>
          <dl className="flex flex-col gap-2 text-sm">
            <div>
              <dt className="text-xs text-[var(--q-text-4)]">Termes recherchés</dt>
              <dd className="q-mono break-words text-[13px] text-[var(--q-text-2)]">{brandTerms.join(" · ")}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--q-text-4)]">Mention dans la réponse</dt>
              <dd className="text-[var(--q-ink)]">{answer.brand_mentioned ? "Oui" : "Non"}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--q-text-4)]">Citation dans les sources</dt>
              <dd className="text-[var(--q-ink)]">{answer.site_cited ? "Oui" : "Non"}</dd>
            </div>
            {answer.model && (
              <div>
                <dt className="text-xs text-[var(--q-text-4)]">Modèle</dt>
                <dd className="q-mono break-all text-[13px] text-[var(--q-text-2)]">{answer.model}</dd>
              </div>
            )}
            {answer.done_at && (
              <div>
                <dt className="text-xs text-[var(--q-text-4)]">Relevée le</dt>
                <dd className="text-[var(--q-text-2)]">{fmtDateTime(answer.done_at)}</dd>
              </div>
            )}
          </dl>
        </aside>
      </div>
    )
  }

  return (
    <section aria-labelledby="titre-reponse" className="q-card flex flex-col gap-3 px-4 py-4 md:px-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="titre-reponse" className="q-h2">Réponse conservée</h2>
        <span className="text-[13px] text-[var(--q-text-4)]">{label}</span>
      </div>
      {body}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Sources citées et concurrents repérés                              */
/* ------------------------------------------------------------------ */

const KIND_PILL = {
  site: { label: "Qonforme", tone: "ok" as const },
  competitor: { label: "Concurrent", tone: "warn" as const },
  other: { label: "Autre", tone: "neutral" as const },
}

/** Lien externe seulement pour une URL http(s) (les sources viennent des fournisseurs). */
function safeHref(url: string): string | null {
  return /^https?:\/\//i.test(url) && domainOf(url) ? url : null
}

export function SourcesCard({ answer, competitors }: { answer: GeoAnswerRow | null; competitors: string[] }) {
  const sources: GeoSource[] = answer?.status === "done" ? answer.sources ?? [] : []
  const found = Array.from(new Set([...(answer?.competitors_mentioned ?? []), ...(answer?.competitors_cited ?? [])]))
  return (
    <section aria-labelledby="titre-sources" className="q-card flex flex-col overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pb-3 pt-4 md:px-5">
        <h2 id="titre-sources" className="q-h2">Sources citées</h2>
        <span className="text-[13px] text-[var(--q-text-4)]">
          {sources.length > 0 ? `${sources.length} source${sources.length > 1 ? "s" : ""}` : "Aucune source pour cette exécution"}
        </span>
      </div>
      {sources.length > 0 && (
        <ul className="q-list border-t border-[var(--q-line-soft)]">
          {sources.map((s, i) => {
            const kind = sourceKind(s, competitors)
            const pill = KIND_PILL[kind]
            const href = safeHref(s.url)
            const domain = s.domain || domainOf(s.url)
            const content = (
              <>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="q-mono truncate text-[13px] text-[var(--q-ink)]">{domain || "Source sans domaine connu"}</span>
                  {s.title && <span className="line-clamp-2 text-[13px] text-[var(--q-text-3)]">{s.title}</span>}
                </span>
                <StatusPill tone={pill.tone} className="shrink-0">{pill.label}</StatusPill>
                {href && <ExternalLink className="size-4 shrink-0 text-[var(--q-text-4)]" aria-hidden />}
              </>
            )
            return (
              <li key={`${s.url}-${i}`}>
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="q-list-row min-h-[56px]">
                    {content}
                    <span className="sr-only">(ouvre un nouvel onglet)</span>
                  </a>
                ) : (
                  <div className="q-list-row min-h-[56px]">{content}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <div className="flex flex-col gap-2 border-t border-[var(--q-line-soft)] bg-[var(--q-surface-2)] px-4 py-3 md:px-5">
        <p className="text-sm text-[var(--q-text-2)]">
          <span className="font-semibold text-[var(--q-ink)]">Concurrents repérés : </span>
          {found.length > 0 ? (
            found.map((d, i) => (
              <span key={d}>
                {i > 0 && ", "}
                <span className="q-mono text-[13px]">{d}</span>
              </span>
            ))
          ) : (
            "aucun"
          )}
        </p>
        <InternalUseTag className="self-start" />
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Que faire                                                           */
/* ------------------------------------------------------------------ */

export function WhatToDoCard({
  questionId,
  answers,
  imported,
  importSummary,
  topic,
  keyword,
}: {
  questionId: string
  answers: GeoAnswerRow[]
  imported: boolean
  importSummary: GeoRunSummary | null
  topic: GeoTopicRef | null
  /** Mot-clé suivi dont la page cible répond déjà à la question (lib/seo/geo/question-view). */
  keyword: GeoKeywordRef | null
}) {
  const what = whatToDoOf({ imported, importSummary, answers })
  const suggestTopic = shouldSuggestTopic(what, keyword)

  // Seulement ce qui a été mesuré : jamais « aucune page ne répond » (non mesuré)
  let text: React.ReactNode
  if (what.kind === "import") {
    text = what.notCited
      ? "Relevé importé de PushRank : réponses non conservées. Aucun moteur n'y citait qonforme.fr. Lancez une analyse immédiate pour voir les réponses et les sources de cette question."
      : "Relevé importé de PushRank : réponses non conservées. Lancez une analyse immédiate pour voir les réponses de cette question."
  } else if (what.kind === "none") {
    text = "Pas encore de réponse obtenue pour cette question : lancez une analyse immédiate depuis la page Visibilité IA."
  } else if (what.kind === "not_cited") {
    text =
      what.asked > 1
        ? `qonforme.fr n'est cité par aucun des ${what.asked} moteurs interrogés pour cette question.`
        : "qonforme.fr n'est pas cité par le moteur interrogé pour cette question."
  } else {
    text = (
      <>
        qonforme.fr est cité par {what.engines.map(labelOf).join(", ")} ({what.engines.length} / {what.asked} moteur
        {what.asked > 1 ? "s" : ""}).
        {what.paths.length > 0 && (
          <>
            {" "}Pages citées :{" "}
            {what.paths.map((p, i) => (
              <span key={p}>
                {i > 0 && ", "}
                <span className="q-mono text-[13px]">{p}</span>
              </span>
            ))}
            .
          </>
        )}
      </>
    )
  }

  const page = keyword ? pageLabel(keyword.target_path) : null
  const keywordStatus = keyword ? KEYWORD_STATUS[keyword.status] : null
  const topicStatus = topic ? TOPIC_STATUS[topic.status as TopicStatus] : null
  return (
    <section aria-labelledby="titre-que-faire" className="q-card flex flex-col gap-3 px-4 py-4 md:px-5">
      <h2 id="titre-que-faire" className="q-h2 flex items-center gap-2">
        <Lightbulb className="size-4 text-[var(--q-text-4)]" aria-hidden />
        Que faire
      </h2>
      <p className={cn("max-w-[720px] text-[15px] leading-relaxed text-[var(--q-text-2)]")}>{text}</p>

      {keyword && page ? (
        // Planche : la page qu'un mot-clé suivi cible déjà, avant tout nouveau sujet
        <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3">
          <p className="max-w-[720px] text-[15px] leading-relaxed text-[var(--q-text-2)]">
            Page ciblée : {page.label ? `${page.label} ` : ""}
            <span className="q-mono text-[13px]">{page.path}</span> (mot-clé « {keyword.keyword} »{keywordStatus ? `, ${keywordStatus.label}` : ""}).
          </p>
          <Link href={`/admin/seo/mots-cles?mot-cle=${encodeURIComponent(keyword.id)}`} className="q-link inline-flex min-h-11 items-center gap-1 text-sm">
            Voir dans Mots-clés
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      ) : (
        suggestTopic && (
          <p className="max-w-[720px] text-sm text-[var(--q-text-3)]">
            Avant de créer un sujet, vérifiez qu&apos;aucune page existante n&apos;y répond déjà :{" "}
            <Link href="/admin/seo/mots-cles" className="q-link inline-flex min-h-11 items-center">
              Voir dans Mots-clés
            </Link>
            .
          </p>
        )
      )}

      {topic ? (
        <p className="flex flex-wrap items-center gap-2 text-sm text-[var(--q-text-3)]">
          Un sujet existe déjà : « {topic.title} »
          {topicStatus && <StatusPill tone={topicStatus.tone}>{topicStatus.label}</StatusPill>}
          <Link href="/admin/seo/articles/sujets" className="q-link inline-flex min-h-11 items-center">
            Voir dans Articles › Sujets
          </Link>
        </p>
      ) : (
        suggestTopic && (
          <div>
            <CreateTopicButton questionId={questionId} />
          </div>
        )
      )}
    </section>
  )
}
