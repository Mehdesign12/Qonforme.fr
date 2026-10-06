"use client"

/**
 * Étape 2 de la fenêtre « Bienvenue » : métier principal et régime de TVA,
 * puis, au choix, les prestations courantes du métier dans le catalogue (prix
 * à compléter) au taux du chantier type. Planches « Bienvenue-2 » et
 * « Mobile-Bienvenue-2 ».
 *
 * Métier présélectionné d'après le code APE de l'entreprise choisie
 * (lib/legal/from-sirene.ts) ; sur téléphone, une ligne « métier · Modifier »
 * remplace les 12 puces tant qu'il n'y a rien à changer. Boutons radio natifs
 * (flèches du clavier comprises), puces et cartes dessinées autour.
 */
import { useId, useState } from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { TRADES, tradeLabel, type TradeId, type VatRegime } from "@/lib/legal/profile"
import { VAT_CONTEXTS, type VatContext } from "@/lib/catalogue/trades"
import { tradeFromApe } from "@/lib/legal/from-sirene"
import type { TradeInput } from "@/lib/onboarding/inscription"
import { vatNumberPreview } from "@/components/onboarding/inscription/model"
import {
  STEP_PAD, Serif, StepError, StepFooter, StepHeader, StepLead, StepTitle, useInitialFocus,
} from "@/components/onboarding/inscription/ui"

const VAT_CHOICES: { id: VatRegime; title: string; text: React.ReactNode }[] = [
  {
    id: "assujetti",
    title: "Je facture la TVA",
    text: <>Le taux se choisit ligne par ligne&nbsp;: 20&nbsp;%, 10&nbsp;% ou 5,5&nbsp;%.</>,
  },
  {
    id: "franchise",
    title: "Je ne facture pas la TVA",
    text: <>Franchise en base&nbsp;: «&nbsp;TVA non applicable, art.&nbsp;293&nbsp;B du CGI&nbsp;» ajoutée d&rsquo;office.</>,
  },
]

/** Chantiers types proposés quand la TVA est facturée (la franchise importe toujours à 0 %). */
const SITES = VAT_CONTEXTS.filter((c) => c.id !== "franchise")

export interface TradeStepProps {
  mode: "app" | "demo"
  titleId: string
  progress: { number: number; total: number }
  /** Métier et régime déjà enregistrés (reprise, ou retour à cette étape). */
  trade: TradeId | null
  vatRegime: VatRegime | null
  /** SIREN de l'entreprise : n° de TVA proposé. */
  siren: string | null
  /** Code APE de l'entreprise choisie dans le répertoire (présélection du métier). */
  activityCode: string | null
  /** Forme juridique de l'entreprise choisie : une société facture la TVA par défaut. */
  legalForm: "ei" | "societe" | null
  busy: boolean
  onSkip: () => void
  onBack: () => void
  onSubmit: (input: TradeInput) => Promise<string | null>
}

/** Puce ou carte autour d'un bouton radio natif, masqué mais atteignable au clavier. */
function Chip({ name, checked, onSelect, children, size = "md", autofocus = false }: {
  name: string
  checked: boolean
  onSelect: () => void
  children: React.ReactNode
  size?: "md" | "sm"
  /** Premier champ de l'étape : reçoit le focus à l'ouverture sur ordinateur. */
  autofocus?: boolean
}) {
  return (
    <label className="relative inline-flex">
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        className="peer sr-only"
        data-autofocus={autofocus || undefined}
      />
      <span
        className={cn(
          "inline-flex cursor-pointer items-center gap-1.5 rounded-full border transition-colors touch-manipulation",
          "peer-focus-visible:shadow-[0_0_0_4px_var(--q-focus)]",
          size === "md" ? "h-10 px-3.5 text-[14px] sm:h-[38px]" : "h-10 px-[13px] text-[13px] sm:h-9",
          checked
            ? "border-[var(--q-accent)] bg-[var(--q-wash)] pl-2.5 font-semibold text-[var(--q-accent-strong)] sm:pl-[11px]"
            : "border-[var(--q-field)] bg-[var(--q-surface)] font-medium text-[var(--q-text-2)] hover:border-[var(--q-placeholder)]",
        )}
      >
        {checked && <Check className={size === "md" ? "size-[15px]" : "size-3.5"} strokeWidth={2.25} aria-hidden />}
        {children}
      </span>
    </label>
  )
}

export function TradeStep({
  mode, titleId, progress, trade: savedTrade, vatRegime: savedVat, siren, activityCode, legalForm,
  busy, onSkip, onBack, onSubmit,
}: TradeStepProps) {
  const uid = useId()
  const rootRef = useInitialFocus<HTMLFormElement>()
  const apeTrade = tradeFromApe(activityCode)
  const [trade, setTrade] = useState<TradeId | null>(savedTrade ?? apeTrade)
  const [expanded, setExpanded] = useState(false)
  const [vat, setVat] = useState<VatRegime | null>(savedVat ?? (legalForm === "societe" ? "assujetti" : null))
  const [catalogue, setCatalogue] = useState(true)
  const [site, setSite] = useState<VatContext>("renovation")
  const [error, setError] = useState<string | null>(null)

  // Mention « présélectionné » : seulement tant que le métier vient du code APE
  const fromApe = !savedTrade && !!apeTrade && trade === apeTrade && !!activityCode
  const vatNumber = vat === "assujetti" ? vatNumberPreview(siren, mode === "demo") : null
  const label = tradeLabel(trade)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!trade) { setError("Choisissez votre métier."); return }
    if (!vat) { setError("Indiquez si vous facturez la TVA."); return }
    const message = await onSubmit({
      trade,
      vat_regime: vat,
      catalogue: catalogue ? { context: vat === "franchise" ? "franchise" : site } : null,
    })
    if (message) setError(message)
  }

  return (
    <form ref={rootRef} onSubmit={submit} noValidate className="flex flex-[1_0_auto] flex-col">
      <StepHeader number={progress.number} total={progress.total} onSkip={onSkip} />

      <div className={cn("flex flex-[1_0_auto] flex-col pt-2 sm:pt-[22px]", STEP_PAD)}>
        <StepTitle id={titleId}>Votre <Serif>métier</Serif></StepTitle>
        <StepLead>Pour préparer votre catalogue et la TVA de vos devis.</StepLead>

        {/* Métier principal */}
        <fieldset className="m-0 mt-[18px] min-w-0 border-0 p-0 sm:mt-[22px]">
          <legend className="q-label p-0">Métier principal</legend>
          {fromApe && (
            <p className="m-0 mt-1 hidden text-xs text-[var(--q-text-4)] sm:block">
              Présélectionné d&rsquo;après le code d&rsquo;activité de votre entreprise (APE&nbsp;{activityCode}).
            </p>
          )}

          {/* Téléphone : le métier retenu, modifiable */}
          {trade && !expanded && (
            <div className="mt-[7px] flex min-h-[52px] items-center gap-2.5 rounded-xl border border-[var(--q-field)] py-1.5 pl-3.5 pr-1.5 sm:hidden">
              <Check className="size-[18px] shrink-0 text-[var(--q-accent-strong)]" strokeWidth={2} aria-hidden />
              <span className="flex-1 text-base font-semibold text-[var(--q-ink-strong)]">{label}</span>
              <button
                type="button"
                onClick={() => setExpanded(true)}
                aria-label={`Modifier le métier (${label})`}
                className="h-10 shrink-0 rounded-[9px] bg-[var(--q-sunken)] px-3 text-[14px] font-semibold text-[var(--q-text-2)] touch-manipulation"
              >
                Modifier
              </button>
            </div>
          )}
          {fromApe && !expanded && (
            <p className="m-0 mt-[7px] text-xs text-[var(--q-text-4)] sm:hidden">
              D&rsquo;après le code d&rsquo;activité de votre entreprise (APE&nbsp;{activityCode}).
            </p>
          )}

          <div className={cn("mt-2.5 flex flex-wrap gap-2", trade && !expanded && "max-sm:hidden")}>
            {TRADES.map((t, i) => (
              <Chip
                key={t.id}
                name={`${uid}-trade`}
                autofocus={trade ? trade === t.id : i === 0}
                checked={trade === t.id}
                onSelect={() => { setTrade(t.id); setError(null) }}
              >
                {t.label}
              </Chip>
            ))}
          </div>
        </fieldset>

        {/* Régime de TVA */}
        <fieldset className="m-0 mt-[18px] min-w-0 border-0 p-0 sm:mt-[22px]">
          <legend className="q-label p-0">Régime de TVA</legend>
          <div className="mt-2 grid gap-2 sm:mt-[9px] sm:grid-cols-2 sm:gap-2.5">
            {VAT_CHOICES.map((v) => {
              const on = vat === v.id
              return (
                <label
                  key={v.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded-[14px] border bg-[var(--q-surface)] px-3.5 py-3 transition-[border-color,box-shadow] touch-manipulation sm:p-3.5",
                    "has-[:focus-visible]:shadow-[0_0_0_4px_var(--q-focus)]",
                    on ? "border-[var(--q-accent)] shadow-[0_0_0_3px_var(--q-focus)]" : "border-[var(--q-field)] hover:border-[var(--q-placeholder)]",
                  )}
                >
                  <input
                    type="radio"
                    name={`${uid}-vat`}
                    checked={on}
                    onChange={() => { setVat(v.id); setError(null) }}
                    className="mt-px size-[18px] shrink-0 accent-[var(--q-accent)] focus-visible:outline-none"
                  />
                  <span className="flex flex-col gap-0.5 sm:gap-[3px]">
                    <span className="text-[14px] font-semibold text-[var(--q-ink-strong)]">{v.title}</span>
                    <span className="text-[13px] leading-[1.45] text-[var(--q-text-3)]">{v.text}</span>
                  </span>
                </label>
              )
            })}
          </div>
          {vatNumber && (
            <p className="m-0 mt-2.5 text-[13px] text-[var(--q-text-2)]">
              N° de TVA&nbsp;: <span className="tabular-nums">{vatNumber}</span>{" "}
              <span className="text-[var(--q-text-4)]">· calculé depuis votre SIREN, à vérifier</span>
            </p>
          )}
          <p className="m-0 mt-1.5 text-xs text-[var(--q-text-4)]">Modifiable à tout moment dans Paramètres › Entreprise.</p>
        </fieldset>

        {/* Catalogue */}
        <div className="mt-3.5 flex flex-col gap-3 rounded-xl border border-[var(--q-line-soft)] bg-[var(--q-surface-2)] px-3.5 py-3 sm:mt-[18px]">
          <label className="flex cursor-pointer items-start gap-2.5 touch-manipulation">
            <input
              type="checkbox"
              checked={catalogue}
              onChange={(e) => setCatalogue(e.target.checked)}
              className="m-0 mt-px size-5 shrink-0 accent-[var(--q-accent)] sm:size-[18px]"
            />
            <span className="text-[14px] leading-[1.45] text-[var(--q-text-2)]">
              Ajouter à mon catalogue les prestations courantes de mon métier,{" "}
              <span className="text-[var(--q-text-4)]">prix à compléter</span>
            </span>
          </label>
          {catalogue && vat === "assujetti" && (
            <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0 pl-[30px] sm:pl-7">
              <legend className="mb-2 p-0 text-[13px] font-semibold text-[var(--q-ink)]">Vos chantiers, le plus souvent</legend>
              <div className="flex flex-wrap gap-2">
                {SITES.map((c) => (
                  <Chip key={c.id} name={`${uid}-site`} size="sm" checked={site === c.id} onSelect={() => setSite(c.id)}>
                    {c.label}
                  </Chip>
                ))}
              </div>
            </fieldset>
          )}
        </div>

        <StepError message={error} />
      </div>

      <StepFooter onBack={onBack} submitLabel="Continuer" busy={busy} />
    </form>
  )
}
