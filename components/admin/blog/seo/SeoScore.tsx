"use client"

/**
 * Score de référencement d'un article (panneau Référencement de l'éditeur) :
 * anneau de 64 px (vert à partir de 80, ambre à partir de 50, rouge en
 * dessous : scoreTone), appréciation, puis la liste de contrôle
 * (analyzeOnPage, lib/seo/articles/onpage.ts) en trois groupes :
 * « À corriger », « À améliorer », et les points validés repliés.
 *
 * Chaque ligne est un bouton : `onFocusTarget(target)` envoie l'admin au
 * champ concerné (mot-clé, titre Google, description, adresse, chapeau,
 * texte, couverture). Un passage qui bloque la publication (valeur périmée,
 * affirmation interdite, concurrent nommé) porte l'étiquette « Bloque la
 * publication » et passe en tête.
 */
import { useId, useState } from "react"
import { ChevronDown, ChevronRight, CircleCheck, CircleX, ShieldAlert, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import { scoreTone, sortChecks, type OnPageCheck, type OnPageResult, type OnPageTarget } from "@/lib/seo/articles/onpage"

/** Appréciation d'un score (même seuils que la couleur). */
export function scoreLabel(score: number): string {
  const tone = scoreTone(score)
  return tone === "ok" ? "Bon" : tone === "warn" ? "À améliorer" : "Insuffisant"
}

const STROKE: Record<"ok" | "warn" | "danger", string> = {
  ok: "var(--q-ok)",
  warn: "var(--q-warn)",
  danger: "var(--q-danger)",
}

/** Anneau du score (SVG), chiffre au centre. */
export function ScoreRing({ score, size = 64, className }: { score: number; size?: number; className?: string }) {
  const tone = scoreTone(score)
  const stroke = size >= 48 ? 6 : 4
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const value = Math.max(0, Math.min(100, Math.round(score)))
  return (
    <span className={cn("relative inline-grid shrink-0 place-items-center", className)} style={{ width: size, height: size }} role="img" aria-label={`Score de référencement : ${value} sur 100, ${scoreLabel(value).toLowerCase()}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--q-line-soft)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={STROKE[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
          className="transition-[stroke-dashoffset,stroke] duration-150 motion-reduce:transition-none"
        />
      </svg>
      <span className={cn("q-num absolute font-semibold tabular-nums text-[var(--q-ink)]", size >= 56 ? "text-[19px]" : "text-[12px]")} aria-hidden>
        {value}
      </span>
    </span>
  )
}

function CheckIcon({ check }: { check: OnPageCheck }) {
  if (check.status === "ok") return <CircleCheck className="mt-px size-4 shrink-0 text-[var(--q-ok)]" aria-hidden />
  if (check.blocking) return <ShieldAlert className="mt-px size-4 shrink-0 text-[var(--q-danger)]" aria-hidden />
  if (check.status === "error") return <CircleX className="mt-px size-4 shrink-0 text-[var(--q-danger)]" aria-hidden />
  return <TriangleAlert className="mt-px size-4 shrink-0 text-[var(--q-warn)]" aria-hidden />
}

const STATUS_WORD: Record<OnPageCheck["status"], string> = { ok: "Validé", warn: "À améliorer", error: "À corriger" }

function CheckRow({ check, onFocusTarget }: { check: OnPageCheck; onFocusTarget: (target: OnPageTarget) => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onFocusTarget(check.target)}
        className="group flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left transition-colors duration-100 hover:bg-[var(--q-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--q-focus)] motion-reduce:transition-none max-md:min-h-11"
      >
        <CheckIcon check={check} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[13px] font-medium leading-snug text-[var(--q-ink)]">
              <span className="sr-only">{STATUS_WORD[check.status]} : </span>
              {check.label}
            </span>
            {check.blocking && (
              <span className="inline-flex h-[18px] items-center rounded-full bg-[var(--q-danger-bg)] px-1.5 text-[10.5px] font-semibold leading-none text-[var(--q-danger)]">
                Bloque la publication
              </span>
            )}
          </span>
          {check.detail && <span className="text-[12px] leading-snug text-[var(--q-text-3)] [overflow-wrap:anywhere]">{check.detail}</span>}
        </span>
        <ChevronRight
          className="mt-0.5 size-4 shrink-0 text-[var(--q-text-4)] opacity-0 transition-opacity duration-100 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none [@media(hover:none)]:opacity-60"
          aria-hidden
        />
      </button>
    </li>
  )
}

function Group({ title, tone, checks, onFocusTarget }: { title: string; tone: "danger" | "warn"; checks: OnPageCheck[]; onFocusTarget: (target: OnPageTarget) => void }) {
  const id = useId()
  if (checks.length === 0) return null
  return (
    <section aria-labelledby={id} className="flex flex-col gap-0.5">
      <h4 id={id} className="m-0 flex items-center gap-2 px-2 pb-0.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--q-text-4)]">
        <span className={cn("size-1.5 rounded-full", tone === "danger" ? "bg-[var(--q-danger)]" : "bg-[var(--q-warn)]")} aria-hidden />
        {title}
        <span className="q-count">{checks.length}</span>
      </h4>
      <ul className="m-0 flex list-none flex-col p-0">
        {checks.map((c) => (
          <CheckRow key={c.id} check={c} onFocusTarget={onFocusTarget} />
        ))}
      </ul>
    </section>
  )
}

export function SeoScore({
  result,
  onFocusTarget,
  className,
}: {
  result: OnPageResult
  /** Clic sur une ligne : le champ concerné reçoit le focus. */
  onFocusTarget: (target: OnPageTarget) => void
  className?: string
}) {
  const [showOk, setShowOk] = useState(false)
  const okListId = useId()
  const sorted = sortChecks(result.checks)
  const errors = sorted.filter((c) => c.status === "error")
  const warns = sorted.filter((c) => c.status === "warn")
  const oks = sorted.filter((c) => c.status === "ok")
  const blocking = errors.some((c) => c.blocking)
  const tone = scoreTone(result.score)

  const summary =
    errors.length + warns.length === 0
      ? "Tous les points sont validés."
      : [errors.length > 0 ? `${errors.length} à corriger` : null, warns.length > 0 ? `${warns.length} à améliorer` : null].filter(Boolean).join(" · ")

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-center gap-4">
        <ScoreRing score={result.score} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className={cn("m-0 text-[16px] font-semibold leading-tight", tone === "ok" ? "text-[var(--q-ok)]" : tone === "warn" ? "text-[var(--q-warn)]" : "text-[var(--q-danger)]")}>
            {scoreLabel(result.score)}
          </p>
          <p className="m-0 text-[12.5px] leading-snug text-[var(--q-text-3)]">{summary}</p>
          {blocking && (
            <p className="m-0 mt-0.5 flex items-center gap-1 text-[12px] font-medium text-[var(--q-danger)]">
              <ShieldAlert className="size-3.5 shrink-0" aria-hidden />
              Un passage bloque la publication
            </p>
          )}
        </div>
      </div>

      <div className="-mx-2 flex flex-col gap-3">
        <Group title="À corriger" tone="danger" checks={errors} onFocusTarget={onFocusTarget} />
        <Group title="À améliorer" tone="warn" checks={warns} onFocusTarget={onFocusTarget} />

        {oks.length > 0 && (
          <div className="flex flex-col">
            <button
              type="button"
              onClick={() => setShowOk((v) => !v)}
              aria-expanded={showOk}
              aria-controls={okListId}
              className="flex min-h-9 items-center gap-2 rounded-lg px-2 text-[12.5px] font-semibold text-[var(--q-text-3)] transition-colors duration-100 hover:bg-[var(--q-hover)] hover:text-[var(--q-ink)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--q-focus)] motion-reduce:transition-none max-md:min-h-11"
            >
              <CircleCheck className="size-4 shrink-0 text-[var(--q-ok)]" aria-hidden />
              {oks.length} point{oks.length > 1 ? "s" : ""} validé{oks.length > 1 ? "s" : ""}
              <ChevronDown className={cn("ml-auto size-4 text-[var(--q-text-4)] transition-transform duration-150 motion-reduce:transition-none", showOk && "rotate-180")} aria-hidden />
            </button>
            {showOk && (
              <ul id={okListId} className="m-0 flex list-none flex-col p-0">
                {oks.map((c) => (
                  <CheckRow key={c.id} check={c} onFocusTarget={onFocusTarget} />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
