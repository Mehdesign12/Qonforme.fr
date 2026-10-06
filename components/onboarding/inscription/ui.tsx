"use client"

/**
 * Éléments communs des étapes de la fenêtre « Bienvenue » : en-tête (barre de
 * progression et « Passer au tableau de bord »), titre en deux voix, pied
 * (« Retour », « Continuer »). Planches « Bienvenue-1 » à « Bienvenue-3 » et
 * leurs versions téléphone : feuille du bas sous 640 px, carte au-delà.
 *
 * Couleurs par les jetons --q-* (thème sombre compris) ; aucun backdrop-filter.
 */
import { useEffect, useRef } from "react"
import { ArrowLeft, ArrowRight, Loader2, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/** Ordinateur avec souris : le premier champ prend le focus. Sur écran tactile, le clavier ne doit pas s'ouvrir seul. */
export const FIELD_FOCUS_QUERY = "(min-width: 640px) and (hover: hover) and (pointer: fine)"

/**
 * Focus à l'affichage d'un écran de la fenêtre : premier champ (`data-autofocus`)
 * sur ordinateur, titre ailleurs (lu par les lecteurs d'écran, sans ouvrir le
 * clavier du téléphone) ; la feuille revient en haut.
 */
export function useInitialFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const field = window.matchMedia(FIELD_FOCUS_QUERY).matches
      ? root.querySelector<HTMLElement>("[data-autofocus]")
      : null
    const target = field ?? root.querySelector<HTMLElement>("[data-dialog-title]")
    target?.focus({ preventScroll: true })
    root.closest("[data-dialog-scroll]")?.scrollTo({ top: 0 })
  }, [])
  return ref
}

/** Marges horizontales des étapes : 20 px sur téléphone, 32 px sur ordinateur. */
export const STEP_PAD = "px-5 sm:px-8"

/** En-tête d'une étape : progression, puis « Passer au tableau de bord ». */
export function StepHeader({
  number, total, onSkip, skipDisabled,
}: {
  number: number
  total: number
  onSkip: () => void
  skipDisabled?: boolean
}) {
  return (
    <div className="flex shrink-0 items-center gap-3 pb-0 pl-5 pr-2.5 pt-1.5 sm:gap-4 sm:pl-8 sm:pr-5 sm:pt-5">
      <div
        role="progressbar"
        aria-label="Inscription"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={number}
        aria-valuetext={`Étape ${number} sur ${total}`}
        className="flex flex-1 gap-1.5"
      >
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={cn("h-1 flex-1 rounded-full", i < number ? "bg-[var(--q-accent)]" : "bg-[var(--q-line)]")}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={onSkip}
        disabled={skipDisabled}
        className="q-btn q-btn-ghost h-11 shrink-0 px-2.5 text-[14px] text-[var(--q-text-3)] touch-manipulation sm:h-[34px] sm:rounded-[9px] sm:text-[13px]"
      >
        Passer au tableau de bord
      </button>
    </div>
  )
}

/** Titre de l'étape (le seul de la fenêtre : `id` référencé par aria-labelledby). */
export function StepTitle({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  return (
    <h2
      id={id}
      tabIndex={-1}
      data-dialog-title
      className={cn(
        "q-display m-0 text-[25px] leading-[1.1] tracking-[-0.03em] text-[var(--q-ink-strong)] outline-none [text-wrap:balance] sm:text-[28px]",
        className,
      )}
    >
      {children}
    </h2>
  )
}

/** Mot en seconde voix (Instrument Serif italique, bleu). */
export function Serif({ children }: { children: React.ReactNode }) {
  return <em className="q-serif">{children}</em>
}

export function StepLead({ children }: { children: React.ReactNode }) {
  return <p className="m-0 mt-1.5 text-[15px] leading-normal text-[var(--q-text-3)] sm:mt-2">{children}</p>
}

/** Message d'erreur d'une étape, annoncé dès qu'il apparaît. */
export function StepError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="q-field-error m-0 mt-4 !text-[14px] leading-normal">
      {message}
    </p>
  )
}

/**
 * Pied d'une étape, dans le flux de la feuille (jamais fixé au bas de l'écran,
 * que le clavier du téléphone recouvrirait) : « Retour » (icône seule sur
 * téléphone) et le bouton principal, qui valide le formulaire de l'étape.
 */
export function StepFooter({
  onBack, submitLabel, SubmitIcon = ArrowRight, busy,
}: {
  onBack?: () => void
  submitLabel: string
  SubmitIcon?: LucideIcon
  busy: boolean
}) {
  return (
    <div
      className={cn(
        // Collé en bas de la fenêtre : une étape plus haute que l'écran défile dessous
        "sticky bottom-0 z-10 bg-[var(--q-surface)]",
        "before:pointer-events-none before:absolute before:inset-x-0 before:-top-4 before:h-4 before:bg-gradient-to-t before:from-[var(--q-surface)] before:to-transparent",
        "flex shrink-0 items-center gap-2.5 px-5 pb-[max(30px,env(safe-area-inset-bottom))] pt-3",
        "sm:gap-4 sm:px-8 sm:pb-7 sm:pt-6",
        onBack ? "sm:justify-between" : "sm:justify-end",
      )}
    >
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className={cn(
            "q-btn h-[52px] w-[52px] shrink-0 rounded-2xl border-[var(--q-field)] px-0 text-[var(--q-text-2)] touch-manipulation hover:bg-[var(--q-hover)]",
            "sm:h-12 sm:w-auto sm:rounded-[14px] sm:border-transparent sm:px-3.5 sm:text-[15px]",
          )}
        >
          <ArrowLeft className="!size-[18px] sm:!size-[17px]" aria-hidden />
          <span className="max-sm:sr-only">Retour</span>
        </button>
      )}
      <button
        type="submit"
        disabled={busy}
        className="q-btn q-btn-primary h-[52px] flex-1 rounded-2xl text-base touch-manipulation sm:h-12 sm:flex-none sm:rounded-[14px] sm:px-[22px] sm:text-[15px]"
      >
        {submitLabel}
        {busy
          ? <Loader2 className="!size-[17px] animate-spin" aria-hidden />
          : <SubmitIcon className="!size-[18px] sm:!size-[17px]" aria-hidden />}
      </button>
    </div>
  )
}
