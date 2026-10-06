"use client"

/**
 * Étape 3 de la fenêtre « Bienvenue » : le prénom, pour l'accueil du tableau
 * de bord et les emails (planche « Bienvenue-3 »). Prérempli par le prénom
 * d'un entrepreneur individuel trouvé au répertoire Sirene.
 */
import { useId, useState } from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { AUTH_INPUT, Field } from "@/components/auth/fields"
import { INSCRIPTION_LIMITS, validateFirstName } from "@/lib/onboarding/inscription"
import {
  STEP_PAD, Serif, StepFooter, StepHeader, StepLead, StepTitle, useInitialFocus,
} from "@/components/onboarding/inscription/ui"

export interface NameStepProps {
  titleId: string
  progress: { number: number; total: number }
  initialValue: string
  busy: boolean
  onSkip: () => void
  onBack: (() => void) | undefined
  onSubmit: (firstName: string) => Promise<string | null>
}

export function NameStep({ titleId, progress, initialValue, busy, onSkip, onBack, onSubmit }: NameStepProps) {
  const uid = useId()
  const rootRef = useInitialFocus<HTMLFormElement>()
  const id = `${uid}-first-name`
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const check = validateFirstName(value)
    if (!check.ok) {
      setError(check.error)
      document.getElementById(id)?.focus()
      return
    }
    const message = await onSubmit(check.value)
    if (message) {
      setError(message)
      document.getElementById(id)?.focus()
    }
  }

  return (
    <form ref={rootRef} onSubmit={submit} noValidate className="flex flex-[1_0_auto] flex-col">
      <StepHeader number={progress.number} total={progress.total} onSkip={onSkip} />

      <div className={cn("flex flex-[1_0_auto] flex-col pt-2.5 sm:pt-[22px]", STEP_PAD)}>
        <StepTitle id={titleId}>Et votre <Serif>prénom</Serif>&nbsp;?</StepTitle>
        <StepLead>Pour vous accueillir, ici et dans nos emails.</StepLead>

        <div className="mt-[18px] sm:mt-[22px]">
          <Field id={id} label="Prénom" error={error ?? undefined}>
            <input
              id={id}
              type="text"
              autoComplete="given-name"
              autoCapitalize="words"
              maxLength={INSCRIPTION_LIMITS.first_name}
              className={AUTH_INPUT}
              value={value}
              onChange={(e) => { setValue(e.target.value); setError(null) }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
              data-autofocus
            />
          </Field>
        </div>
      </div>

      <StepFooter onBack={onBack} submitLabel="Terminer" SubmitIcon={Check} busy={busy} />
    </form>
  )
}
