"use client"

/**
 * Avancement d'une rédaction : passes (Plan, Rédaction, Contrôle, Correction,
 * Image, Enregistrement), passe en cours annoncée aux lecteurs d'écran,
 * replis et erreurs affichés, lien « Relire l'article » à la fin.
 */
import { Check, CircleAlert, Info, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { RunnerState, RunnerStep } from "@/components/admin/seo/articles/job-runner"

const LABELS: Record<Exclude<RunnerStep, "done">, string> = {
  plan: "Plan",
  write: "Rédaction",
  check: "Contrôle",
  fix: "Correction",
  cover: "Image",
  save: "Enregistrement",
}

const RUNNING: Record<RunnerStep, string> = {
  plan: "Plan…",
  write: "Rédaction…",
  check: "Contrôle…",
  fix: "Correction…",
  cover: "Image…",
  save: "Enregistrement…",
  done: "Article prêt",
}

export function JobProgress({ state, withCover }: { state: RunnerState; withCover: boolean }) {
  const steps: Exclude<RunnerStep, "done">[] = ["plan", "write", "check"]
  if (state.done.includes("fix") || state.step === "fix") steps.push("fix")
  if (withCover || state.done.includes("cover") || state.step === "cover") steps.push("cover")
  steps.push("save")
  const finished = state.status === "done"

  return (
    <div className="flex flex-col gap-4">
      <p aria-live="polite" className="flex items-center gap-2 text-[15px] font-semibold text-[var(--q-ink)]">
        {state.status === "running" && <Loader2 className="size-4 animate-spin text-[var(--q-accent)] motion-reduce:animate-none" aria-hidden />}
        {finished && <Check className="size-4 text-[var(--q-ok)]" strokeWidth={2.75} aria-hidden />}
        {state.status === "failed"
          ? "La rédaction a échoué"
          : state.status === "stopped"
            ? "Rédaction en pause"
            : RUNNING[state.step]}
      </p>

      <ol className="flex flex-col gap-2" aria-label="Passes de la rédaction">
        {steps.map((s) => {
          const passed = finished || (state.done.includes(s) && state.step !== s)
          const current = !finished && state.step === s && state.status === "running"
          return (
            <li key={s} className="flex items-center gap-3 text-sm">
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full border",
                  passed ? "border-transparent bg-[var(--q-ok-bg)] text-[var(--q-ok)]" : current ? "border-[var(--q-accent)] text-[var(--q-accent)]" : "border-[var(--q-line)] text-[var(--q-text-4)]",
                )}
                aria-hidden
              >
                {passed ? <Check className="size-3.5" strokeWidth={2.75} /> : current ? <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" /> : null}
              </span>
              <span className={cn(passed || current ? "text-[var(--q-ink)]" : "text-[var(--q-text-4)]", current && "font-semibold")}>
                {LABELS[s]}
                <span className="sr-only">{passed ? " : terminé" : current ? " : en cours" : " : à venir"}</span>
              </span>
            </li>
          )
        })}
      </ol>

      {state.notices.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {state.notices.map((n) => (
            <li key={n} className="flex items-start gap-2 text-[13px] text-[var(--q-text-3)]">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{n}</span>
            </li>
          ))}
        </ul>
      )}

      {state.error && (
        <p role="alert" className={cn("flex items-start gap-2 text-[13px]", state.status === "running" ? "text-[var(--q-warn)]" : "text-[var(--q-danger)]")}>
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {state.error}
            {state.status === "running" ? " Nouvel essai en cours." : ""}
          </span>
        </p>
      )}

      {finished && state.postId && (
        <p className="text-[13px] text-[var(--q-text-3)]">L&apos;article est enregistré : ouvrez-le pour le relire.</p>
      )}
      {!finished && state.status !== "failed" && (
        <p className="text-[13px] text-[var(--q-text-4)]">Vous pouvez fermer cette fenêtre : la rédaction se poursuit et l&apos;article arrivera dans Articles.</p>
      )}
    </div>
  )
}
