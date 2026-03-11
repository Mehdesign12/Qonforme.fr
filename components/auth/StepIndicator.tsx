interface Step {
  label: string
}

interface StepIndicatorProps {
  steps:   Step[]
  /** Index de l'étape active (0-based) */
  current: number
}

export default function StepIndicator({ steps, current }: StepIndicatorProps) {
  return (
    /*
     * overflow-hidden évite que le StepIndicator déborde sur les petits écrans.
     * w-full + max-w garantissent qu'il reste centré sans déborder.
     */
    <div className="w-full max-w-xs sm:max-w-sm mx-auto overflow-hidden mb-6 lg:mb-7">
      <div className="flex items-center justify-center">
        {steps.map((step, i) => {
          const isDone   = i < current
          const isActive = i === current

          return (
            <div key={i} className="flex items-center min-w-0">
              {/* Cercle + label */}
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                {/* Cercle */}
                <div
                  className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[11px] sm:text-xs font-bold shrink-0 transition-colors ${
                    isDone
                      ? 'bg-[#10B981] text-white'
                      : isActive
                        ? 'bg-[#2563EB] text-white ring-2 sm:ring-4 ring-[#DBEAFE]'
                        : 'bg-[#F1F5F9] text-slate-400'
                  }`}
                >
                  {isDone ? (
                    <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" viewBox="0 0 14 14" fill="none">
                      <path d="M2.5 7L5.5 10L11.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>

                {/* Label — masqué si ni actif ni terminé, pour gagner de la place */}
                <span
                  className={`text-[12px] sm:text-sm font-medium whitespace-nowrap transition-colors truncate max-w-[64px] sm:max-w-none ${
                    isDone
                      ? 'text-slate-400 line-through'
                      : isActive
                        ? 'text-[#0F172A]'
                        : 'text-slate-400 hidden sm:inline'
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {/* Connecteur */}
              {i < steps.length - 1 && (
                <div
                  className={`w-5 sm:w-8 h-px mx-2 sm:mx-3 shrink-0 transition-colors ${
                    isDone ? 'bg-[#10B981]' : 'bg-[#E2E8F0]'
                  }`}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
