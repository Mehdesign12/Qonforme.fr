"use client"

/**
 * Étape 3 de la fenêtre « Bienvenue » : le prénom, pour l'accueil du tableau
 * de bord et les emails (planche « Bienvenue-3 »). Prérempli par le prénom
 * d'un entrepreneur individuel trouvé au répertoire Sirene.
 */
import { useEffect, useId, useState } from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { AUTH_INPUT, Field } from "@/components/auth/fields"
import { INSCRIPTION_LIMITS, validateFirstName } from "@/lib/onboarding/inscription"
import type { SnapshotRef } from "@/components/onboarding/inscription/model"
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
  /** Prénom déjà enregistré dans le compte ('' s'il n'y en a pas). */
  savedName: string
  /** Ce qu'il faut enregistrer si la fenêtre se ferme sans validation (voir StepSnapshot). */
  snapshotRef: SnapshotRef
  /** Échec d'un enregistrement en arrière-plan : message affiché à l'ouverture de l'étape. */
  initialError: string | null
}

export function NameStep({ titleId, progress, initialValue, busy, onSkip, onBack, onSubmit, savedName, snapshotRef, initialError }: NameStepProps) {
  const uid = useId()
  const rootRef = useInitialFocus<HTMLFormElement>()
  const id = `${uid}-first-name`
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState<string | null>(initialError)

  // Fermeture sans « Terminer » : un prénom saisi s'enregistre ; un prénom seulement proposé (répertoire Sirene) n'est pas écrit
  useEffect(() => {
    snapshotRef.current = () => {
      const check = validateFirstName(value)
      if (check.ok && check.value !== savedName && value !== initialValue) {
        return { save: { step: "name", first_name: check.value }, draft: { first_name: null }, ifSaveFails: { first_name: check.value } }
      }
      return { draft: {} }
    }
    return () => { snapshotRef.current = null }
  })

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
