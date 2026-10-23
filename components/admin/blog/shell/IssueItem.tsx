"use client"

/**
 * Un passage refusé par le contrôle de publication (bannière rouge de
 * l'éditeur), avec deux gestes :
 *
 * - « Aller au passage » : l'éditeur sélectionne le passage et le montre à
 *   l'écran (ou met le champ concerné en évidence : titre, description…) ;
 * - « Corriger avec l'IA » : le modèle réécrit ce seul passage pour faire
 *   disparaître le problème ; la proposition s'affiche à côté de l'extrait
 *   refusé, et rien n'est remplacé sans « Remplacer dans le texte »
 *   (une seule étape d'annulation, Ctrl+Z).
 *
 * Un passage qui n'est plus dans le texte (corrigé à la main) est marqué
 * « Corrigé » : il reste à enregistrer et à publier de nouveau. Le composant
 * ne sait rien de l'éditeur : tout passe par `actions`.
 */
import { useId, useState } from "react"
import { Check, CircleCheck, Crosshair, Loader2, RefreshCw, Sparkles, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import { markdownPlainText } from "@/lib/seo/articles/onpage"
import type { BlockingIssue } from "@/components/admin/blog/shell/model"

export type IssueFixResult = { ok: true; text: string; warnings: string[] } | { ok: false; error: string }

export interface IssueActions {
  /** Montre le passage dans l'éditeur ; faux s'il n'y est plus. */
  reveal: (issue: BlockingIssue) => boolean
  /** Remplace le passage par le texte proposé ; faux s'il est introuvable ou ne se remplace pas. */
  apply: (issue: BlockingIssue, text: string) => boolean
  /** Demande la correction au modèle. */
  fix: (issue: BlockingIssue) => Promise<IssueFixResult>
}

type Phase =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "proposal"; text: string; warnings: string[] }
  | { kind: "applied" }
  | { kind: "error"; message: string }

const BTN = "q-btn q-btn-secondary q-btn-sm max-md:!h-11"

export function IssueItem({ issue, corrected, actions }: { issue: BlockingIssue; corrected: boolean; actions?: IssueActions }) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" })
  const [revealError, setRevealError] = useState(false)
  const statusId = useId()
  const canAct = Boolean(actions && issue.excerpt)

  async function runFix() {
    if (!actions || phase.kind === "loading") return
    setPhase({ kind: "loading" })
    setRevealError(false)
    const res = await actions.fix(issue)
    setPhase(res.ok ? { kind: "proposal", text: res.text, warnings: res.warnings } : { kind: "error", message: res.error })
  }

  function apply() {
    if (!actions || phase.kind !== "proposal") return
    if (actions.apply(issue, phase.text)) setPhase({ kind: "applied" })
    else setPhase({ kind: "error", message: "Le passage n'a pas pu être remplacé : il a changé depuis. Cliquez sur « Aller au passage », puis relancez la correction." })
  }

  function reveal() {
    if (!actions) return
    setRevealError(!actions.reveal(issue))
  }

  const done = corrected || phase.kind === "applied"

  return (
    <li className={cn("rounded-xl border bg-[var(--q-surface)] px-3 py-2.5", done ? "border-[var(--q-ok-line,var(--q-line))]" : "border-[var(--q-danger-line)]")}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <p className="m-0 min-w-0 flex-1 text-[13px] font-semibold text-[var(--q-ink)]">{issue.label}</p>
        {done && (
          <span className="inline-flex h-[20px] shrink-0 items-center gap-1 rounded-full bg-[var(--q-ok-bg)] px-2 text-[11.5px] font-semibold leading-none text-[var(--q-ok)]">
            <CircleCheck className="size-3.5" aria-hidden />
            Corrigé
          </span>
        )}
      </div>
      {issue.excerpt && (
        <p
          className={cn(
            "m-0 mt-1 border-l-2 pl-2.5 text-[13px] italic leading-snug [overflow-wrap:anywhere]",
            done ? "border-[var(--q-line)] text-[var(--q-text-4)] line-through decoration-[var(--q-text-4)]/50" : "border-[var(--q-danger-line)] text-[var(--q-text-2)]",
          )}
        >
          « {issue.excerpt} »
        </p>
      )}
      {issue.detail && <p className="m-0 mt-1 text-[12.5px] leading-snug text-[var(--q-text-3)]">{issue.detail}</p>}

      {canAct && !done && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <button type="button" onClick={reveal} className={BTN} aria-label={`Aller au passage : ${issue.label}`}>
            <Crosshair aria-hidden />
            Aller au passage
          </button>
          <button type="button" onClick={() => void runFix()} disabled={phase.kind === "loading"} className={BTN} aria-label={`Corriger avec l'IA : ${issue.label}`}>
            {phase.kind === "loading" ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Sparkles aria-hidden />}
            {phase.kind === "loading" ? "Correction en cours…" : phase.kind === "proposal" || phase.kind === "error" ? "Autre correction" : "Corriger avec l'IA"}
          </button>
        </div>
      )}

      <div id={statusId} aria-live="polite" className="empty:hidden">
        {revealError && !done && (
          <p className="m-0 mt-2 flex items-start gap-1.5 text-[12.5px] leading-snug text-[var(--q-warn)]">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Ce passage n&apos;est plus dans le texte : il a sans doute déjà été modifié.
          </p>
        )}
        {phase.kind === "error" && (
          <p role="alert" className="m-0 mt-2 flex items-start gap-1.5 text-[12.5px] leading-snug text-[var(--q-danger)]">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {phase.message}
          </p>
        )}
        {phase.kind === "applied" && (
          <p className="m-0 mt-2 text-[12.5px] leading-snug text-[var(--q-text-3)]">
            Passage remplacé dans le texte (Ctrl+Z pour annuler). Enregistrez, puis publiez à nouveau.
          </p>
        )}
        {corrected && phase.kind !== "applied" && (
          <p className="m-0 mt-2 text-[12.5px] leading-snug text-[var(--q-text-3)]">Ce passage n&apos;est plus dans le texte. Enregistrez, puis publiez à nouveau.</p>
        )}
      </div>

      {phase.kind === "proposal" && !done && (
        <div className="mt-3 rounded-lg border border-[var(--q-line)] bg-[var(--q-surface-2)] p-3">
          <p className="m-0 flex items-center gap-1.5 text-[12px] font-semibold text-[var(--q-accent-strong)]">
            <Sparkles className="size-3.5" aria-hidden />
            Proposition de l&apos;IA
          </p>
          <p className="m-0 mt-1.5 whitespace-pre-wrap text-[13px] leading-snug text-[var(--q-ink)] [overflow-wrap:anywhere]">{markdownPlainText(phase.text)}</p>
          {phase.warnings.length > 0 && (
            <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0">
              {phase.warnings.map((w) => (
                <li key={w} className="flex items-start gap-1.5 text-[12px] leading-snug text-[var(--q-warn)]">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  {w}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={apply} className="q-btn q-btn-primary q-btn-sm max-md:!h-11" data-primary="">
              <Check aria-hidden />
              Remplacer dans le texte
            </button>
            <button type="button" onClick={() => void runFix()} className="q-btn q-btn-ghost q-btn-sm max-md:!h-11">
              <RefreshCw aria-hidden />
              Une autre proposition
            </button>
            <button type="button" onClick={() => setPhase({ kind: "idle" })} className="q-btn q-btn-ghost q-btn-sm max-md:!h-11">
              Ignorer
            </button>
          </div>
        </div>
      )}
    </li>
  )
}
