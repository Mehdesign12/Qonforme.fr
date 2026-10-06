"use client"

/**
 * Fin de la fenêtre « Bienvenue » : « Votre espace est prêt », récapitulatif
 * de ce qui vient d'être renseigné, puis les choix de départ de l'écran
 * « Par quoi voulez-vous commencer ? » (components/onboarding/StartScreen.tsx) :
 * en cartes sur ordinateur (planche « Bienvenue-4 »), en liste sur téléphone
 * (« Mobile-Bienvenue-4 »). Le devis d'essai et le rappel passent par
 * /demarrer, seulement une fois leur migration appliquée (`startAvailable`).
 */
import Image from "next/image"
import Link from "next/link"
import { AlarmClock, ArrowRight, ChevronRight, CircleCheck, FileCheck2, FileText, Send, type LucideIcon } from "lucide-react"
import { LOGO_Q } from "@/lib/brand"
import { cn } from "@/lib/utils"
import { startHref } from "@/lib/onboarding/links"
import { CARD, CardBody } from "@/components/onboarding/StartScreen"
import { Serif, StepTitle, useInitialFocus } from "@/components/onboarding/inscription/ui"

interface Choice {
  key: string
  path: string
  Icon: LucideIcon
  title: string
  /** Texte de la carte (ordinateur). */
  text: string
  /** Texte court de la ligne (téléphone). */
  short: string
}

const CHOICES: (Choice & { needsStart?: boolean })[] = [
  {
    key: "quote",
    path: "/quotes/new",
    Icon: FileCheck2,
    title: "Faire un vrai devis",
    text: "Pour un client, avec vos prestations. Gratuit, sans limite de nombre.",
    short: "Gratuit, sans limite de nombre.",
  },
  {
    key: "trial",
    path: "/demarrer?choix=essai",
    Icon: Send,
    title: "M’envoyer un devis d’essai",
    text: "Un exemple à votre nom, envoyé à votre adresse. Sans numéro, hors de vos chiffres.",
    short: "Sans numéro, hors de vos chiffres.",
    needsStart: true,
  },
  {
    key: "invoice",
    path: "/invoices/new",
    Icon: FileText,
    title: "Facturer un chantier terminé",
    text: "La préparation est gratuite. La formule se choisit au moment d’envoyer.",
    short: "La formule se choisit à l’envoi.",
  },
  {
    key: "later",
    path: "/demarrer?choix=plus-tard",
    Icon: AlarmClock,
    title: "Je le ferai plus tard",
    text: "Un rappel par email au moment de votre choix\u00a0: ce soir, demain matin, samedi…",
    short: "Un rappel par email à l’heure choisie.",
    needsStart: true,
  },
]

export interface DoneStepProps {
  mode: "app" | "demo"
  titleId: string
  firstName: string
  /** Récapitulatif : entreprise · métier · TVA (parties connues seulement). */
  summary: string[]
  startAvailable: boolean
  onExplore: () => void
}

export function DoneStep({ mode, titleId, firstName, summary, startAvailable, onExplore }: DoneStepProps) {
  const rootRef = useInitialFocus<HTMLDivElement>()
  const name = firstName.trim()
  const choices = CHOICES.filter((c) => startAvailable || !c.needsStart)

  return (
    <div ref={rootRef} className="flex flex-[1_0_auto] flex-col px-5 pb-[max(26px,env(safe-area-inset-bottom))] sm:px-8 sm:pb-[22px] sm:pt-[30px]">
      <Image src={LOGO_Q} alt="" width={32} height={32} className="mt-3.5 size-7 sm:mt-0 sm:size-8" sizes="32px" />
      <StepTitle id={titleId} className="mt-3 sm:mt-4">
        Votre espace est <Serif>prêt</Serif>{name ? `, ${name}.` : "."}
      </StepTitle>
      <p className="m-0 mt-1.5 text-[15px] leading-normal text-[var(--q-text-3)] sm:mt-2">
        Par quoi voulez-vous commencer&nbsp;? Rien ne part sans vous.
      </p>

      {summary.length > 0 && (
        <p className="m-0 mt-4 flex items-start gap-2 text-[13px] leading-normal text-[var(--q-text-3)]">
          <CircleCheck className="mt-px size-4 shrink-0 text-[var(--q-ok)]" strokeWidth={2} aria-hidden />
          <span>{summary.join(" · ")}</span>
        </p>
      )}

      {/* Ordinateur : cartes */}
      <ul className="m-0 mt-5 hidden list-none grid-cols-2 gap-2.5 p-0 sm:grid" aria-label="Choix de départ">
        {choices.map(({ key, path, Icon, title, text }) => (
          <li key={key}>
            <Link href={startHref(mode, path)} className={CARD}>
              <CardBody Icon={Icon} title={title} text={text} />
            </Link>
          </li>
        ))}
      </ul>

      {/* Téléphone : liste */}
      <ul
        className="m-0 mt-4 list-none overflow-hidden rounded-2xl border border-[var(--q-line)] p-0 sm:hidden"
        aria-label="Choix de départ"
      >
        {choices.map(({ key, path, Icon, title, short }) => (
          <li key={key} className="border-b border-[var(--q-line-soft)] last:border-b-0">
            <Link
              href={startHref(mode, path)}
              className="flex min-h-16 items-center gap-3.5 px-3.5 py-3 text-[var(--q-ink)] touch-manipulation active:bg-[var(--q-row-hover)]"
            >
              <Icon className="size-6 shrink-0 text-[var(--q-accent-strong)]" strokeWidth={1.25} aria-hidden />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-semibold">{title}</span>
                <span className="text-[13px] text-[var(--q-text-3)]">{short}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-[var(--q-placeholder)]" strokeWidth={1.75} aria-hidden />
            </Link>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onExplore}
        className={cn(
          "q-btn mt-6 h-[52px] w-full rounded-2xl border-[var(--q-field)] bg-[var(--q-surface)] text-base text-[var(--q-ink)] touch-manipulation hover:bg-[var(--q-hover)]",
          "sm:mt-3.5 sm:h-11 sm:w-auto sm:self-center sm:rounded-xl sm:border-transparent sm:bg-transparent sm:px-4 sm:text-[15px] sm:text-[var(--q-text-2)]",
        )}
      >
        Explorer le tableau de bord
        <ArrowRight className="hidden !size-[17px] sm:block" aria-hidden />
      </button>
    </div>
  )
}
