/**
 * Cartes de Performance › Audit du site (planche Performance-audit) :
 * synthèse de l'exploration, contrôles, historique des actions faites.
 * Composants serveur (liens seulement).
 */
import Link from "next/link"
import { ArrowRight, CalendarDays, Check, CircleCheck, CircleHelp, Info, TriangleAlert } from "lucide-react"
import { StatusPill, type Tone } from "@/components/app/kit"
import { fmtDate } from "@/components/admin/ui"
import { cn } from "@/lib/utils"
import { fmtCount } from "@/lib/seo/format"
import type { ControlResult, ControlState } from "@/lib/seo/audit/checks"
import { RULES, isFindingRule } from "@/lib/seo/actions/rules"
import { actionsHref } from "@/components/admin/seo/actions/url"

/* ------------------------------------------------------------------ */
/* Synthèse                                                            */
/* ------------------------------------------------------------------ */

function Figure({ label, value, sub, className }: { label: string; value: string; sub: string; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5 py-3 sm:py-1", className)}>
      <span className="q-kpi-label">{label}</span>
      <span className="q-kpi-value font-display">{value}</span>
      <span className="q-kpi-sub">{sub}</span>
    </div>
  )
}

export function AuditSynthesis({
  pagesExplored,
  openCrawl,
  doneCount,
  lastDoneAt,
  running,
}: {
  pagesExplored: number | null
  openCrawl: number
  doneCount: number
  lastDoneAt: string | null
  running: { pagesDone: number; pagesTotal: number } | null
}) {
  return (
    <section aria-labelledby="audit-synthese" className="q-card overflow-hidden">
      <div className="px-5 pb-2 pt-4">
        <h2 id="audit-synthese" className="q-h2">Synthèse de l&apos;exploration</h2>
      </div>
      <div className="grid grid-cols-1 divide-y divide-[var(--q-line-soft)] px-5 pb-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:pb-5 sm:pt-2">
        <Figure label="Pages explorées" value={pagesExplored === null ? "—" : fmtCount(pagesExplored)} sub="Pages du plan du site" className="sm:pr-6" />
        <Figure
          label="Constats ouverts"
          value={fmtCount(openCrawl)}
          sub={openCrawl === 0 ? "Aucun dans l'exploration technique" : "Dans l'exploration technique"}
          className="sm:px-6"
        />
        <Figure label="Actions faites" value={fmtCount(doneCount)} sub="Depuis le début" className="sm:pl-6" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-[var(--q-line-soft)] bg-[var(--q-surface-2)] px-5 py-3 text-[13px] text-[var(--q-text-3)]">
        <span className="inline-flex flex-wrap items-center gap-2">
          <CalendarDays className="size-4 shrink-0 text-[var(--q-text-4)]" aria-hidden />
          {lastDoneAt ? (
            <span>
              Dernière exploration&nbsp;: <span className="font-semibold text-[var(--q-ink)]">{fmtDate(lastDoneAt)}</span>
            </span>
          ) : (
            <span>Aucune exploration terminée</span>
          )}
          {running && (
            <span className="font-semibold text-[var(--q-accent-strong)]">
              · Analyse en cours&nbsp;: {fmtCount(running.pagesDone)} / {fmtCount(running.pagesTotal)} pages
            </span>
          )}
        </span>
        <span className="text-[var(--q-text-4)]">Source&nbsp;: plan du site de qonforme.fr</span>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Contrôles                                                           */
/* ------------------------------------------------------------------ */

const STATE: Record<ControlState, { label: string; tone: Tone; icon: React.ReactNode; color: string }> = {
  ok: { label: "Réussi", tone: "ok", icon: <CircleCheck className="size-[18px]" strokeWidth={1.75} aria-hidden />, color: "text-[var(--q-ok)]" },
  alert: { label: "Alerte", tone: "warn", icon: <TriangleAlert className="size-[18px]" strokeWidth={1.75} aria-hidden />, color: "text-[var(--q-warn)]" },
  info: { label: "Information", tone: "info", icon: <Info className="size-[18px]" strokeWidth={1.75} aria-hidden />, color: "text-[var(--q-info)]" },
  unknown: { label: "Non vérifié", tone: "neutral", icon: <CircleHelp className="size-[18px]" strokeWidth={1.75} aria-hidden />, color: "text-[var(--q-text-4)]" },
}

const PILL_ICON: Record<ControlState, React.ReactNode> = {
  ok: <Check strokeWidth={2.75} aria-hidden />,
  alert: <TriangleAlert strokeWidth={2.25} aria-hidden />,
  info: <Info strokeWidth={2.25} aria-hidden />,
  unknown: <CircleHelp strokeWidth={2.25} aria-hidden />,
}

/** Lien « Voir l'action » : le constat ouvert de la règle, ou la liste filtrée s'il y en a plusieurs. */
function actionLink(rule: string | null, openByRule: Record<string, string[]>): { href: string; label: string } | null {
  if (!rule || !isFindingRule(rule)) return null
  const ids = openByRule[rule] ?? []
  if (ids.length === 0) return null
  if (ids.length === 1) return { href: actionsHref({}, { constat: ids[0] }), label: "Voir l'action" }
  return { href: actionsHref({ source: "crawl", regle: rule }), label: `Voir les actions (${fmtCount(ids.length)})` }
}

export function ControlsCard({ controls, tally, openByRule }: { controls: ControlResult[]; tally: string; openByRule: Record<string, string[]> }) {
  return (
    <section aria-labelledby="audit-controles" className="q-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-5 pb-2 pt-4">
        <h2 id="audit-controles" className="q-h2">Contrôles</h2>
        <span className="text-[13px] text-[var(--q-text-4)]">{tally}</span>
      </div>
      <ul className="m-0 list-none p-0">
        {controls.map((c) => {
          const s = STATE[c.state]
          const link = c.state === "alert" ? actionLink(c.rule, openByRule) : null
          return (
            <li
              key={c.key}
              className="grid grid-cols-[20px_minmax(0,1fr)] items-start gap-x-3 gap-y-1.5 border-t border-[var(--q-line-soft)] px-5 py-3.5 md:grid-cols-[20px_minmax(0,280px)_minmax(0,1fr)_auto] md:gap-x-4"
            >
              <span className={cn("grid h-5 place-items-center", s.color)}>{s.icon}</span>
              <span className="text-sm font-semibold leading-5 text-[var(--q-ink)]">{c.name}</span>
              <span className="col-start-2 flex min-w-0 flex-col gap-1 md:col-start-3">
                <span className={cn("text-sm leading-5", c.state === "ok" ? "text-[var(--q-text-3)]" : "text-[var(--q-text-2)]")}>{c.result}</span>
                {c.details.map((d) => (
                  <span key={d} className="break-words text-[13px] leading-[19px] text-[var(--q-text-3)]">
                    {d}
                  </span>
                ))}
                {link && (
                  <Link href={link.href} className="q-link inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold md:min-h-0">
                    {link.label}
                    <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                )}
              </span>
              <span className="col-start-2 flex h-5 items-center md:col-start-4 md:justify-end">
                <StatusPill tone={s.tone} icon={PILL_ICON[c.state]}>
                  {s.label}
                </StatusPill>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Historique des actions faites                                       */
/* ------------------------------------------------------------------ */

export function HistoryCard({ history, total }: { history: { id: string; title: string; path: string; done_at: string | null }[]; total: number }) {
  return (
    <section aria-labelledby="audit-historique" className="q-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-5 pb-2 pt-4">
        <h2 id="audit-historique" className="q-h2">Historique des actions faites</h2>
        {total > 0 && (
          <span className="text-[13px] text-[var(--q-text-4)]">
            {fmtCount(history.length)} affichée{history.length > 1 ? "s" : ""} sur {fmtCount(total)}
          </span>
        )}
      </div>
      {history.length === 0 ? (
        <p className="border-t border-[var(--q-line-soft)] px-5 py-6 text-sm text-[var(--q-text-4)]">
          Aucune action faite pour l&apos;instant. Marquez un constat comme fait dans les Actions SEO pour suivre son effet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="q-table" aria-labelledby="audit-historique">
            <thead>
              <tr>
                <th scope="col" className="w-[84px]">Date</th>
                <th scope="col">Action</th>
                <th scope="col" className="w-[104px]">Statut</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td>
                    <time dateTime={h.done_at ?? undefined} className="font-mono text-[13px] text-[var(--q-text-3)]">
                      {h.done_at ? fmtDate(h.done_at, { day: "2-digit", month: "2-digit" }) : "—"}
                    </time>
                  </td>
                  <td>
                    <span className="flex flex-col gap-0.5">
                      <Link
                        href={actionsHref({ etat: "faites" }, { constat: h.id })}
                        className="underline decoration-[color:var(--q-line)] underline-offset-[3px] hover:decoration-current"
                      >
                        {h.title}
                      </Link>
                      <span className="break-all font-mono text-[13px] text-[var(--q-text-4)]">{h.path}</span>
                    </span>
                  </td>
                  <td>
                    <StatusPill tone="ok" icon={<Check strokeWidth={2.75} aria-hidden />}>
                      Fait
                    </StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {total > 0 && (
        <div className="border-t border-[var(--q-line-soft)] px-5 py-3">
          <Link href={actionsHref({ etat: "faites" })} className="q-link inline-flex min-h-11 items-center gap-1 text-sm font-semibold md:min-h-0">
            Toutes les actions faites ({fmtCount(total)})
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      )}
    </section>
  )
}

/** Libellé d'une règle (pour un filtre affiché). */
export function ruleLabel(rule: string): string {
  return isFindingRule(rule) ? RULES[rule].label : rule
}
