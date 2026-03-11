interface Step {
  label: string
}

interface StepIndicatorProps {
  steps: Step[]
  /** Index de l'étape active (0-based) */
  current: number
}

export default function StepIndicator({ steps, current }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-0 mb-7">
      {steps.map((step, i) => {
        const isDone   = i < current
        const isActive = i === current

        return (
          <div key={i} className="flex items-center">
            {/* Cercle + label */}
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                  isDone
                    ? "bg-[#10B981] text-white"
                    : isActive
                      ? "bg-[#2563EB] text-white ring-4 ring-[#DBEAFE]"
                      : "bg-[#F1F5F9] text-slate-400"
                }`}
              >
                {isDone ? (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
                    <path d="M2.5 7L5.5 10L11.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`text-sm font-medium whitespace-nowrap transition-colors ${
                  isDone
                    ? "text-slate-400 line-through"
                    : isActive
                      ? "text-[#0F172A]"
                      : "text-slate-400"
                }`}
              >
                {step.label}
              </span>
            </div>

            {/* Connecteur */}
            {i < steps.length - 1 && (
              <div
                className={`w-8 h-px mx-3 shrink-0 transition-colors ${
                  isDone ? "bg-[#10B981]" : "bg-[#E2E8F0]"
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
