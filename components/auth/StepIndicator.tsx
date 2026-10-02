import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface Step {
  label: string
}

interface StepIndicatorProps {
  steps:   Step[]
  /** Index de l'étape active (0-based) */
  current: number
}

/**
 * Étapes de l'inscription (canevas « Onb-2-Entreprise ») : faites en bleu avec
 * une coche, active en encre, à venir cerclées. Sur mobile, seul le libellé de
 * l'étape active reste affiché.
 */
export default function StepIndicator({ steps, current }: StepIndicatorProps) {
  return (
    <ol className="m-0 flex list-none items-center gap-2.5 p-0" aria-label="Étapes de l'inscription">
      {steps.map((step, i) => {
        const isDone   = i < current
        const isActive = i === current
        return (
          <li key={step.label} className="flex items-center gap-2.5" aria-current={isActive ? "step" : undefined}>
            {i > 0 && (
              <span
                aria-hidden
                className={cn("h-[1.5px] w-5 rounded-sm sm:w-7", i <= current ? "bg-q-accent" : "bg-q-field")}
              />
            )}
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-semibold",
                  isDone && "bg-q-accent text-white",
                  isActive && "bg-q-ink-strong text-q-surface shadow-[0_0_0_4px_var(--q-line-soft)]",
                  !isDone && !isActive && "border-[1.5px] border-q-field text-q-text-4",
                )}
              >
                {isDone ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden /> : i + 1}
              </span>
              <span
                className={cn(
                  "whitespace-nowrap text-[13px]",
                  isActive ? "font-semibold text-q-ink" : "hidden font-medium text-q-text-3 sm:inline",
                )}
              >
                {step.label}
                {isDone && <span className="sr-only"> (terminée)</span>}
              </span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
