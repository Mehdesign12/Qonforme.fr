/**
 * Cartes de la page « Visibilité IA » (planches Visibilite-ia et Mobile-visibilite-ia) :
 * visibilité par moteur, comparaison aux concurrents (usage interne), questions suivies.
 * Composants serveur, sans hook. Sur téléphone, des listes au lieu des tableaux larges.
 */
import Link from "next/link"
import { ChevronRight, Link2, Lock, MessageSquareQuote, Minus } from "lucide-react"
import { StatusPill } from "@/components/app/kit"
import { cn } from "@/lib/utils"
import { fmtRate } from "@/lib/seo/format"
import { SITE_HOST } from "@/lib/seo/site"
import { enginePill, GEO_ENGINES, type GeoEngine, type GeoRateSummary, type GeoRunSummary } from "@/lib/seo/types"
import { ENGINE_SHORT_LABEL, type EngineStatus } from "@/lib/seo/geo/engine-status"
import { CELL_LABELS, cellState, rateOf, type CellState } from "@/lib/seo/geo/summary"
import type { GeoCell } from "@/lib/seo/geo/data"
import type { GeoQuestionRow } from "@/lib/seo/geo/types"

/* ------------------------------------------------------------------ */
/* Briques                                                             */
/* ------------------------------------------------------------------ */

function CardHead({ id, title, subtitle, aside }: { id: string; title: string; subtitle?: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 px-4 pb-3 pt-4 md:px-5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 id={id} className="q-h2">{title}</h2>
        {subtitle && <p className="text-[13px] text-[var(--q-text-4)]">{subtitle}</p>}
      </div>
      {aside}
    </div>
  )
}

/**
 * « Usage interne » (concurrents) : étiquette sur ordinateur ; ligne de texte qui passe à
 * la ligne sur téléphone (planche Mobile-visibilite-ia), où l'étiquette de 22 px déborderait.
 */
export function InternalUseTag({ className }: { className?: string }) {
  return (
    <span className={cn("block max-w-full md:inline-flex", className)}>
      <span className="flex items-start gap-1.5 text-[13px] leading-snug text-[var(--q-text-3)] md:hidden">
        <Lock className="mt-0.5 size-3 shrink-0" aria-hidden />
        <span>Usage interne : jamais cité dans un contenu public.</span>
      </span>
      <span className="q-tag hidden gap-1 whitespace-nowrap md:inline-flex">
        <Lock className="size-3" aria-hidden />
        Usage interne : jamais cité dans un contenu public
      </span>
    </span>
  )
}

/** Barre de taux (0 à 1). */
function RateBar({ rate, own, className }: { rate: number | null; own?: boolean; className?: string }) {
  const pct = rate === null ? 0 : Math.round(Math.max(0, Math.min(1, rate)) * 100)
  return (
    <span className={cn("block h-2 overflow-hidden rounded-full", own ? "bg-[var(--q-surface)] ring-1 ring-inset ring-[var(--q-line)]" : "bg-[var(--q-line-soft)]", className)} aria-hidden>
      <span className={cn("block h-full rounded-full", own ? "bg-[var(--q-accent)]" : "bg-[var(--q-text-4)]")} style={{ width: `${pct}%` }} />
    </span>
  )
}

/** Valeur ou « — » avec « Non mesuré » pour les lecteurs d'écran. */
function RateValue({ rate, className }: { rate: number | null; className?: string }) {
  if (rate === null) {
    return (
      <span className={className}>
        <span aria-hidden>—</span>
        <span className="sr-only">Non mesuré</span>
      </span>
    )
  }
  return <span className={cn("tabular-nums", className)}>{fmtRate(rate)}</span>
}

function counts(summary: GeoRateSummary | undefined, kind: "mention" | "citation"): string | null {
  if (!summary || typeof summary.answers !== "number") return null
  const n = kind === "mention" ? summary.mentions : summary.citations
  if (typeof n !== "number") return null
  const word = kind === "mention" ? "mention" : "citation"
  return `${n.toLocaleString("fr-FR")} / ${summary.answers.toLocaleString("fr-FR")} ${word}${summary.answers > 1 ? "s" : ""}`
}

/* ------------------------------------------------------------------ */
/* Visibilité par moteur                                               */
/* ------------------------------------------------------------------ */

export function EngineVisibilityCard({
  engines,
  summary,
  runLabel,
}: {
  engines: EngineStatus[]
  summary: GeoRunSummary | null
  runLabel: string | null
}) {
  return (
    <section aria-labelledby="t-moteurs" className="q-card flex min-w-0 flex-col overflow-hidden">
      <CardHead id="t-moteurs" title="Visibilité par moteur" subtitle={runLabel ?? "Aucun relevé terminé pour l'instant."} />
      <ul className="q-list border-t border-[var(--q-line-soft)]">
        {engines.map((e) => {
          const s = summary?.engines?.[e.key]
          const mention = rateOf(s, "mention")
          const state = enginePill(e, (s?.answers ?? 0) > 0)
          const mentionCount = counts(s, "mention")
          const citationCount = counts(s, "citation")
          return (
            <li key={e.key} className="flex flex-col gap-2 px-4 py-3.5 md:px-5">
              <div className="flex items-center gap-3">
                <span className="q-avatar" aria-hidden>{e.initials}</span>
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold text-[var(--q-ink)]">{e.label}</span>
                  <StatusPill tone={state.tone}>{state.label}</StatusPill>
                  {!e.enabled && <span className="text-xs text-[var(--q-text-4)]">Éteint</span>}
                </div>
                <span className="q-display text-[22px] leading-none text-[var(--q-ink)] md:text-[28px]">
                  <span className="sr-only">Taux de mention : </span>
                  <RateValue rate={mention} />
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 md:pl-11">
                <RateBar rate={mention} className="w-20" />
                {s && s.answers === 0 ? (
                  <span className="text-[13px] text-[var(--q-warn)]">Aucune réponse obtenue dans ce relevé</span>
                ) : s ? (
                  <>
                    <span className="text-[13px] text-[var(--q-text-3)]">{mentionCount ?? `Mentions : ${fmtRate(mention)}`}</span>
                    <span className="text-[13px] text-[var(--q-text-3)]">{citationCount ?? `Citations : ${fmtRate(rateOf(s, "citation"))}`}</span>
                  </>
                ) : (
                  <span className="text-[13px] text-[var(--q-text-4)]">Non mesuré dans ce relevé</span>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-[var(--q-line-soft)] px-4 py-3 text-[13px] md:px-5">
        <span className="text-[var(--q-text-4)]">Seuls les moteurs allumés et connectés sont interrogés au prochain relevé.</span>
        <Link href="/admin/seo/parametres/connexions" className="q-link inline-flex min-h-11 items-center gap-1">
          Paramètres › Connexions
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Comparé aux concurrents (usage interne)                             */
/* ------------------------------------------------------------------ */

export function CompetitorsCard({
  summary,
  competitors,
  runLabel,
  imported,
}: {
  summary: GeoRunSummary | null
  competitors: string[]
  runLabel: string | null
  imported: boolean
}) {
  const own = summary?.domains?.[SITE_HOST]
  const rows = competitors
    .map((domain) => ({ domain, s: summary?.domains?.[domain] }))
    .sort((a, b) => (rateOf(b.s, "citation") ?? -1) - (rateOf(a.s, "citation") ?? -1))
  const all = [{ domain: SITE_HOST, s: own, own: true }, ...rows.map((r) => ({ ...r, own: false }))]
  const anyUnmeasured = all.some((r) => rateOf(r.s, "mention") === null || rateOf(r.s, "citation") === null)

  return (
    <section aria-labelledby="t-concurrents" className="q-card flex min-w-0 flex-col overflow-hidden">
      <CardHead
        id="t-concurrents"
        title="Comparé aux concurrents"
        subtitle={runLabel ? "Part des réponses qui nomment ou citent chaque domaine." : "Aucun relevé terminé pour l'instant."}
        aside={<InternalUseTag />}
      />

      {/* Ordinateur : tableau */}
      <div className="hidden overflow-x-auto md:block">
        <table className="q-table">
          <thead>
            <tr>
              <th scope="col">Domaine</th>
              <th scope="col">Mentions</th>
              <th scope="col">Citations</th>
            </tr>
          </thead>
          <tbody>
            {all.map((r) => {
              const mention = rateOf(r.s, "mention")
              const citation = rateOf(r.s, "citation")
              return (
                <tr key={r.domain} className={r.own ? "bg-[var(--q-wash)]" : undefined}>
                  <th scope="row" className="!text-left !font-normal">
                    <span className="flex items-center gap-2">
                      <span className="q-mono text-[13px] text-[var(--q-ink)]">{r.domain}</span>
                      {r.own && <span className="q-tag">Votre site</span>}
                    </span>
                  </th>
                  <td>
                    <span className="flex items-center gap-2">
                      {mention !== null && <RateBar rate={mention} own={r.own} className="w-16" />}
                      <RateValue rate={mention} className="w-12 text-[var(--q-text-2)]" />
                    </span>
                  </td>
                  <td>
                    <span className="flex items-center gap-2">
                      {citation !== null && <RateBar rate={citation} own={r.own} className="w-16" />}
                      <RateValue rate={citation} className="w-12 text-[var(--q-text-2)]" />
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Téléphone : liste */}
      <ul className="q-list border-t border-[var(--q-line-soft)] md:hidden">
        {all.map((r) => {
          const mention = rateOf(r.s, "mention")
          const citation = rateOf(r.s, "citation")
          return (
            <li key={r.domain} className={cn("flex flex-col gap-2 px-4 py-3", r.own && "bg-[var(--q-wash)]")}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="q-mono truncate text-sm text-[var(--q-ink)]">{r.domain}</span>
                  {r.own && <span className="q-tag">Vous</span>}
                </span>
                <span className="q-display text-lg leading-none text-[var(--q-ink)]">
                  <span className="sr-only">Citations : </span>
                  <RateValue rate={citation} />
                </span>
              </div>
              <RateBar rate={citation} own={r.own} />
              <span className="text-xs text-[var(--q-text-4)]">
                Mentions : <RateValue rate={mention} /> · Citations : <RateValue rate={citation} />
              </span>
            </li>
          )
        })}
      </ul>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-[var(--q-line-soft)] px-4 py-3 text-[13px] md:px-5">
        <span className="text-[var(--q-text-4)]">
          {anyUnmeasured ? (imported ? "« — » : non mesuré dans le relevé importé de PushRank." : "« — » : non mesuré.") : runLabel}
        </span>
        <Link href="/admin/seo/parametres/ciblage" className="q-link inline-flex min-h-11 items-center gap-1">
          Concurrents suivis : Paramètres › Ciblage
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Questions suivies                                                   */
/* ------------------------------------------------------------------ */

const CELL_STYLE: Record<CellState, string> = {
  cited: "bg-[var(--q-ok-bg)] text-[var(--q-ok)]",
  mentioned: "bg-[var(--q-info-bg)] text-[var(--q-info)]",
  absent: "bg-[var(--q-neutral-bg)] text-[var(--q-neutral)]",
  unmeasured: "text-[var(--q-text-4)]",
}

/** Icône d'état d'une cellule ; libellé masqué pour les lecteurs d'écran (sauf `decorative`). */
export function CellMark({ state, decorative }: { state: CellState; decorative?: boolean }) {
  const Icon = state === "cited" ? Link2 : state === "mentioned" ? MessageSquareQuote : state === "absent" ? Minus : null
  return (
    <span
      title={decorative ? undefined : CELL_LABELS[state]}
      aria-hidden={decorative ? true : undefined}
      className={cn("inline-grid size-7 place-items-center rounded-lg", CELL_STYLE[state])}
    >
      {Icon ? <Icon className="size-4" strokeWidth={2.25} aria-hidden /> : <span aria-hidden>—</span>}
      {!decorative && <span className="sr-only">{CELL_LABELS[state]}</span>}
    </span>
  )
}

/** Étiquette d'une question que le relevé affiché n'a pas posée (ajoutée depuis). */
function NotYetTag() {
  return <span className="q-tag shrink-0 whitespace-nowrap">Pas encore relevée</span>
}

export function QuestionsCard({
  questions,
  cells,
  runEngines,
  runLabel,
  imported,
  notYetIds,
}: {
  questions: GeoQuestionRow[]
  cells: GeoCell[]
  /** Moteurs interrogés par le relevé affiché. */
  runEngines: string[]
  runLabel: string | null
  imported: boolean
  /** Questions que le relevé affiché n'a pas posées (lib/seo/geo/question-view : notYetQuestionIds). */
  notYetIds: string[]
}) {
  const stateOf = (questionId: string, engine: GeoEngine): CellState =>
    cellState(cells.filter((c) => c.question_id === questionId && c.engine === engine))
  const isNotYet = (id: string) => notYetIds.includes(id)
  const notYet = questions.filter((q) => isNotYet(q.id)).length
  const asked = GEO_ENGINES.filter((e) => runEngines.includes(e.key))

  const subtitle =
    questions.length === 0
      ? "Aucune question active : ajoutez-en dans « Gérer le suivi »."
      : `${questions.length} question${questions.length > 1 ? "s" : ""} suivie${questions.length > 1 ? "s" : ""}${
          notYet > 0 && runLabel ? `, dont ${notYet} pas encore relevée${notYet > 1 ? "s" : ""}` : ""
        }${imported ? " · relevé importé : résultats par question non conservés" : ""}.`

  return (
    <section aria-labelledby="t-questions" className="q-card overflow-hidden">
      <CardHead id="t-questions" title="Questions suivies" subtitle={subtitle} />

      {questions.length > 0 && (
        <>
          {/* Ordinateur : tableau */}
          <div className="hidden overflow-x-auto md:block">
            <table className="q-table min-w-[860px]">
              <thead>
                <tr>
                  <th scope="col">Question</th>
                  {GEO_ENGINES.map((e) => (
                    <th key={e.key} scope="col" className="w-[92px] !text-center">{ENGINE_SHORT_LABEL[e.key]}</th>
                  ))}
                  <th scope="col" className="w-[92px]"><span className="sr-only">Détail de la question</span></th>
                </tr>
              </thead>
              <tbody>
                {questions.map((q, i) => (
                  <tr key={q.id}>
                    <th scope="row" className="!whitespace-normal !text-left !text-sm !font-normal !text-[var(--q-ink)]">
                      <span className="flex items-center gap-2.5">
                        <span>{q.question}</span>
                        {isNotYet(q.id) && <NotYetTag />}
                      </span>
                    </th>
                    {GEO_ENGINES.map((e) => (
                      <td key={e.key} className="text-center">
                        <CellMark state={stateOf(q.id, e.key)} />
                      </td>
                    ))}
                    <td>
                      <Link href={`/admin/seo/visibilite-ia/${q.id}`} aria-label={`Détail de la question ${i + 1}`} className="q-link inline-flex min-h-11 items-center gap-1 text-sm">
                        Détail
                        <ChevronRight className="size-4" aria-hidden />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Téléphone : liste */}
          <ul className="q-list border-t border-[var(--q-line-soft)] md:hidden">
            {questions.map((q) => {
              const states = asked.map((e) => stateOf(q.id, e.key))
              const present = states.filter((s) => s === "cited" || s === "mentioned").length
              const measuredEngines = states.filter((s) => s !== "unmeasured").length
              return (
                <li key={q.id}>
                  <Link href={`/admin/seo/visibilite-ia/${q.id}`} className="q-list-row">
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-sm text-[var(--q-ink)]">{q.question}</span>
                      <span className="flex flex-wrap items-center gap-2 text-[13px] text-[var(--q-text-4)]">
                        {isNotYet(q.id) ? (
                          <NotYetTag />
                        ) : measuredEngines > 0 ? (
                          `${present} / ${measuredEngines} moteur${measuredEngines > 1 ? "s" : ""}`
                        ) : (
                          "Non mesurée"
                        )}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-[var(--q-text-4)]" aria-hidden />
                  </Link>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}

const LEGEND: Record<CellState, string> = {
  cited: "Cité : le site est parmi les sources",
  mentioned: "Mentionné : la marque est nommée",
  absent: "Absent : ni mention ni citation",
  unmeasured: "« — » : pas encore relevée ou non mesurée",
}

/** Légende sous la carte « Questions suivies ». */
export function QuestionsLegend() {
  return (
    <div className="flex flex-col gap-2 px-1 text-[13px] text-[var(--q-text-4)]">
      <p>Mention : la marque est nommée dans la réponse · Citation : le site est cité comme source</p>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {(["cited", "mentioned", "absent", "unmeasured"] as CellState[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <CellMark state={s} decorative />
            <span>{LEGEND[s]}</span>
          </span>
        ))}
      </p>
    </div>
  )
}
