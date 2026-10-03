'use client'

/**
 * Paramètres › Entreprise : profil légal qui alimente les mentions imprimées
 * d'office sur les devis, factures, bons de commande et avoirs
 * (lib/legal/profile.ts, lib/legal/mentions.ts).
 *
 * - « Activité et statut » : métier principal, forme juridique (micro-entreprise,
 *   entrepreneur individuel, société avec forme, capital et ville du greffe RCS) ;
 * - régime de TVA, dans la carte « TVA » ;
 * - « Assurance professionnelle » : décennale et, si l'entreprise en a une,
 *   responsabilité civile professionnelle ;
 * - « Mentions sur vos documents » : ce qui sera imprimé, en direct.
 *
 * Affiché seulement quand la colonne `legal_profile` existe (migration
 * 20261003_legal_profile_btp.sql) ; même composant pour la démo.
 */
import Link from "next/link"
import { Info, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ShellMode } from "@/components/layout/nav"
import { settingsHref } from "@/components/settings/sections"
import { Field, FieldGrid, SettingsCard } from "@/components/settings/ui"
import {
  COMPANY_TYPES, LEGAL_FORMS, LIMITS, TRADES, VAT_REGIMES,
  isIndividual, isTradeId, parseCapital, parseLegalProfile,
  type InsurancePolicy, type LegalForm, type LegalProfile, type LegalProfileField, type TradeId, type VatRegime,
} from "@/lib/legal/profile"
import { composeMentions, formatCapital } from "@/lib/legal/mentions"

/* ------------------------------------------------------------------ */
/* Formulaire                                                          */
/* ------------------------------------------------------------------ */

type PolicyForm = Record<keyof InsurancePolicy, string>

export interface LegalProfileForm {
  trade: TradeId | ""
  vat_regime: VatRegime | ""
  legal_form: LegalForm | ""
  /** Forme de société proposée, « autre » pour une saisie libre. */
  company_type: string
  company_type_other: string
  share_capital: string
  rcs_city: string
  decennale: PolicyForm
  has_rc_pro: boolean
  rc_pro: PolicyForm
}

const EMPTY_POLICY: PolicyForm = { insurer: "", address: "", policy_number: "", coverage: "" }

export const EMPTY_PROFILE_FORM: LegalProfileForm = {
  trade: "", vat_regime: "", legal_form: "", company_type: "", company_type_other: "",
  share_capital: "", rcs_city: "", decennale: EMPTY_POLICY, has_rc_pro: false, rc_pro: EMPTY_POLICY,
}

const OTHER = "autre"

export function formFromProfile(p: LegalProfile | null | undefined): LegalProfileForm {
  if (!p) return EMPTY_PROFILE_FORM
  const known = !!p.company_type && (COMPANY_TYPES as readonly string[]).includes(p.company_type)
  return {
    trade: p.trade ?? "",
    vat_regime: p.vat_regime ?? "",
    legal_form: p.legal_form ?? "",
    company_type: p.company_type ? (known ? p.company_type : OTHER) : "",
    company_type_other: p.company_type && !known ? p.company_type : "",
    share_capital: p.share_capital != null ? formatCapital(p.share_capital).replace(/ /g, " ") : "",
    rcs_city: p.rcs_city ?? "",
    decennale: { ...EMPTY_POLICY, ...(p.decennale ?? {}) },
    has_rc_pro: !!p.rc_pro,
    rc_pro: { ...EMPTY_POLICY, ...(p.rc_pro ?? {}) },
  }
}

/** Formulaire → profil enregistré (nettoyé et borné, null si tout est vide). */
export function profileFromForm(f: LegalProfileForm): LegalProfile | null {
  const societe = f.legal_form === "societe"
  return parseLegalProfile({
    trade: f.trade || null,
    vat_regime: f.vat_regime || null,
    legal_form: f.legal_form || null,
    company_type: societe ? (f.company_type === OTHER ? f.company_type_other : f.company_type) : null,
    share_capital: societe ? parseCapital(f.share_capital) : null,
    rcs_city: f.rcs_city,
    decennale: f.decennale,
    rc_pro: f.has_rc_pro ? f.rc_pro : null,
  })
}

/** Erreurs propres au formulaire (capital illisible), en plus de legalProfileErrors. */
export function formErrors(f: LegalProfileForm): Partial<Record<LegalProfileField, string>> {
  const e: Partial<Record<LegalProfileField, string>> = {}
  if (f.legal_form === "societe" && f.share_capital.trim() && parseCapital(f.share_capital) == null) {
    e.share_capital = "Montant invalide : chiffres seulement, par exemple 5 000."
  }
  if (f.legal_form === "societe" && f.company_type === OTHER && !f.company_type_other.trim()) {
    e.company_type = "Indiquez la forme de la société."
  }
  return e
}

type Errors = Partial<Record<LegalProfileField, string>>
type OnChange = (patch: Partial<LegalProfileForm>) => void

/* ------------------------------------------------------------------ */
/* Choix sous forme de cartes (boutons radio)                          */
/* ------------------------------------------------------------------ */

function ChoiceCards<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string
  options: { id: T; label: string; hint?: string }[]
  value: T | ""
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("grid gap-2", className)}>
      {options.map((o) => {
        const on = value === o.id
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.id)}
            className={cn(
              "flex min-w-0 items-start gap-2.5 rounded-xl border bg-[var(--q-surface)] px-3.5 py-3 text-left transition-[border-color,background-color]",
              on ? "border-[var(--q-accent)] bg-[var(--q-wash)]" : "border-[var(--q-field)] hover:border-[var(--q-text-4)]",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full border-2",
                on ? "border-[var(--q-accent)]" : "border-[var(--q-field)]",
              )}
            >
              {on && <span className="size-2 rounded-full bg-[var(--q-accent)]" />}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[15px] font-semibold leading-tight text-[var(--q-ink)]">{o.label}</span>
              {o.hint && <span className="text-[13px] leading-snug text-[var(--q-text-4)]">{o.hint}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Activité et statut                                                  */
/* ------------------------------------------------------------------ */

export function ActivityCard({
  value,
  onChange,
  errors,
  companyName,
}: {
  value: LegalProfileForm
  onChange: OnChange
  errors: Errors
  companyName: string
}) {
  const societe = value.legal_form === "societe"
  const individual = isIndividual(value.legal_form || null)
  const nameHasEi = /\bEI\b|entrepreneur individuel/i.test(companyName)

  return (
    <SettingsCard
      id="activite"
      title="Activité et statut"
      description="Votre métier prépare votre catalogue ; votre statut fixe les mentions légales de vos documents."
    >
      <Field
        label="Métier principal"
        htmlFor="trade"
        hint="Le catalogue vous propose les prestations courantes de ce métier, à importer et à chiffrer."
        className="sm:max-w-[calc(50%-6px)]"
      >
        <select
          id="trade"
          className="q-input pr-2"
          value={value.trade}
          onChange={(e) => onChange({ trade: isTradeId(e.target.value) ? e.target.value : "" })}
        >
          <option value="">Choisir un métier</option>
          {TRADES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </Field>

      <div className="flex flex-col gap-1.5">
        <span className="q-label" id="legal-form-label">Forme juridique</span>
        <ChoiceCards
          label="Forme juridique"
          options={LEGAL_FORMS.map((f) => ({
            id: f.id,
            label: f.label,
            hint: f.id === "micro" ? "Entrepreneur individuel au régime micro" : f.id === "ei" ? "Au régime réel" : "EURL, SARL, SAS…",
          }))}
          value={value.legal_form}
          onChange={(legal_form) => onChange({ legal_form })}
          className="sm:grid-cols-3"
        />
        {individual && (
          <p className="q-field-hint leading-relaxed">
            {nameHasEi
              ? "Votre raison sociale porte déjà la mention « EI » demandée par la loi."
              : "La loi demande que votre nom soit suivi de « entrepreneur individuel » ou « EI » sur vos documents (code de commerce, art. R526-27) : Qonforme l'ajoute en pied de page."}
          </p>
        )}
      </div>

      {societe && (
        <FieldGrid>
          <Field label="Forme de la société" htmlFor="company_type" error={errors.company_type}>
            <select
              id="company_type"
              className="q-input pr-2"
              value={value.company_type}
              onChange={(e) => onChange({ company_type: e.target.value })}
              aria-invalid={!!errors.company_type}
            >
              <option value="">Choisir</option>
              {COMPANY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              <option value={OTHER}>Autre forme</option>
            </select>
          </Field>
          {value.company_type === OTHER && (
            <Field label="Forme (en toutes lettres)" htmlFor="company_type_other">
              <input
                id="company_type_other"
                className="q-input"
                maxLength={LIMITS.company_type}
                placeholder="SCOP SARL"
                value={value.company_type_other}
                onChange={(e) => onChange({ company_type_other: e.target.value })}
              />
            </Field>
          )}
          <Field label="Capital social" htmlFor="share_capital" error={errors.share_capital} hint="Imprimé avec la forme de la société (code de commerce, art. R123-238).">
            <div className={cn(
              "q-fw flex h-[42px] items-center gap-2 rounded-[10px] border bg-[var(--q-surface)] px-3",
              errors.share_capital ? "border-[var(--q-danger)]" : "border-[var(--q-field)]",
            )}>
              <input
                id="share_capital"
                inputMode="decimal"
                autoComplete="off"
                placeholder="5 000"
                value={value.share_capital}
                onChange={(e) => onChange({ share_capital: e.target.value })}
                aria-invalid={!!errors.share_capital}
                className="h-full w-full min-w-0 bg-transparent text-base tabular-nums text-[var(--q-ink)] outline-none placeholder:text-[var(--q-placeholder)] md:text-[15px]"
              />
              <span className="text-[13px] text-[var(--q-text-4)]" aria-hidden>€</span>
            </div>
          </Field>
        </FieldGrid>
      )}

      {value.legal_form && (
        <Field
          label="Ville du greffe (RCS)"
          htmlFor="rcs_city"
          hint={societe
            ? "Une société commerciale est immatriculée au RCS : « RCS » et la ville du greffe figurent sur vos documents (code de commerce, art. R123-237)."
            : "Seulement si vous êtes immatriculé au registre du commerce et des sociétés (activité commerciale). Sinon, laissez vide."}
          className="sm:max-w-[calc(50%-6px)]"
        >
          <input
            id="rcs_city"
            className="q-input"
            maxLength={LIMITS.rcs_city}
            placeholder="Angers"
            value={value.rcs_city}
            onChange={(e) => onChange({ rcs_city: e.target.value })}
          />
        </Field>
      )}
    </SettingsCard>
  )
}

/* ------------------------------------------------------------------ */
/* Régime de TVA (dans la carte « TVA »)                               */
/* ------------------------------------------------------------------ */

export function VatRegimeField({ value, onChange }: { value: LegalProfileForm["vat_regime"]; onChange: OnChange }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="q-label">Régime de TVA</span>
      <ChoiceCards
        label="Régime de TVA"
        options={VAT_REGIMES}
        value={value}
        onChange={(vat_regime) => onChange({ vat_regime })}
        className="sm:grid-cols-2"
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Assurance professionnelle                                           */
/* ------------------------------------------------------------------ */

function PolicyFields({
  prefix,
  value,
  onChange,
  errors,
}: {
  prefix: "decennale" | "rc_pro"
  value: PolicyForm
  onChange: (patch: Partial<PolicyForm>) => void
  errors: Errors
}) {
  const id = (k: keyof PolicyForm) => `${prefix}-${k}`
  const err = (k: keyof PolicyForm) => errors[`${prefix}.${k}` as LegalProfileField]
  return (
    <FieldGrid>
      <Field label="Assureur" htmlFor={id("insurer")} error={err("insurer")}>
        <input id={id("insurer")} className="q-input" maxLength={LIMITS.insurer} autoComplete="off"
          placeholder="Nom de l'assureur" value={value.insurer} aria-invalid={!!err("insurer")}
          onChange={(e) => onChange({ insurer: e.target.value })} />
      </Field>
      <Field label="Coordonnées de l'assureur" htmlFor={id("address")} error={err("address")} hint="Adresse, telle qu'elle figure sur votre attestation.">
        <input id={id("address")} className="q-input" maxLength={LIMITS.address} autoComplete="off"
          placeholder="Adresse de l'assureur" value={value.address} aria-invalid={!!err("address")}
          onChange={(e) => onChange({ address: e.target.value })} />
      </Field>
      <Field label="N° de contrat" htmlFor={id("policy_number")} error={err("policy_number")}>
        <input id={id("policy_number")} className="q-input font-mono" maxLength={LIMITS.policy_number} autoComplete="off"
          placeholder="Sur votre attestation" value={value.policy_number} aria-invalid={!!err("policy_number")}
          onChange={(e) => onChange({ policy_number: e.target.value })} />
      </Field>
      <Field label="Couverture géographique" htmlFor={id("coverage")} error={err("coverage")}>
        <input id={id("coverage")} className="q-input" maxLength={LIMITS.coverage} autoComplete="off"
          placeholder="France métropolitaine" value={value.coverage} aria-invalid={!!err("coverage")}
          onChange={(e) => onChange({ coverage: e.target.value })} />
      </Field>
    </FieldGrid>
  )
}

export function InsuranceCard({ value, onChange, errors }: { value: LegalProfileForm; onChange: OnChange; errors: Errors }) {
  return (
    <SettingsCard
      id="assurance"
      title="Assurance professionnelle"
      description="Imprimée sur vos devis, factures, bons de commande et avoirs : l'assurance souscrite, les coordonnées de l'assureur, le contrat et sa couverture géographique (code de l'artisanat, art. L132-1)."
    >
      <div className="flex flex-col gap-3">
        <span className="flex items-center gap-2 text-[15px] font-semibold text-[var(--q-ink)]">
          <ShieldCheck className="size-4 text-[var(--q-accent-strong)]" aria-hidden />
          Assurance décennale
        </span>
        <PolicyFields
          prefix="decennale"
          value={value.decennale}
          onChange={(patch) => onChange({ decennale: { ...value.decennale, ...patch } })}
          errors={errors}
        />
        <div className="q-inset flex gap-2.5 p-3.5 text-[13px] leading-relaxed text-[var(--q-text-3)]">
          <Info className="mt-0.5 size-4 shrink-0 text-[var(--q-accent-strong)]" aria-hidden />
          <p>
            Pour les travaux soumis à la garantie décennale, la loi demande aussi de joindre votre attestation
            d&apos;assurance à vos devis et factures (code des assurances, art. L243-2). Qonforme ne la joint pas :
            envoyez-la avec vos documents.
          </p>
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-2.5 border-t border-[var(--q-line-soft)] pt-3.5">
        <input
          type="checkbox"
          className="mt-0.5 size-[18px] shrink-0 accent-[var(--q-accent)]"
          checked={value.has_rc_pro}
          onChange={(e) => onChange({ has_rc_pro: e.target.checked })}
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-[15px] font-semibold text-[var(--q-ink)]">Responsabilité civile professionnelle</span>
          <span className="text-[13px] text-[var(--q-text-4)]">Si vous en avez une : elle est imprimée de la même façon.</span>
        </span>
      </label>
      {value.has_rc_pro && (
        <PolicyFields
          prefix="rc_pro"
          value={value.rc_pro}
          onChange={(patch) => onChange({ rc_pro: { ...value.rc_pro, ...patch } })}
          errors={errors}
        />
      )}
    </SettingsCard>
  )
}

/* ------------------------------------------------------------------ */
/* Aperçu des mentions                                                 */
/* ------------------------------------------------------------------ */

export function MentionsPreviewCard({
  value,
  companyName,
  legalNotice,
  mode,
}: {
  value: LegalProfileForm
  companyName: string
  /** Mentions libres enregistrées (Paramètres › Modèles). */
  legalNotice: string
  mode: ShellMode
}) {
  const composed = composeMentions(profileFromForm(value), legalNotice, companyName)
  return (
    <SettingsCard
      id="mentions"
      title="Mentions sur vos documents"
      description="Imprimées en bas de chaque devis, facture, bon de commande et avoir, d'après les informations ci-dessus. Un document déjà émis garde les mentions de son émission."
    >
      {composed.generated.length > 0 ? (
        <ul className="q-inset flex flex-col gap-1.5 p-3.5 text-[13px] leading-relaxed text-[var(--q-text-2)]">
          {composed.generated.map((g) => <li key={g.key}>{g.text}</li>)}
        </ul>
      ) : (
        <p className="text-[13px] text-[var(--q-text-4)]">
          Aucune mention automatique pour l&apos;instant : indiquez votre statut, votre régime de TVA ou votre assurance.
        </p>
      )}
      <p className="text-[13px] leading-relaxed text-[var(--q-text-4)]">
        {composed.kept.length > 0
          ? `Suivies de vos mentions libres (${composed.kept.length} ligne${composed.kept.length > 1 ? "s" : ""}), `
          : "Vos mentions libres s'ajoutent à la suite, "}
        à régler dans{" "}
        <Link href={`${settingsHref("/settings/invoices", mode)}#mentions`} className="q-link">Modèles de documents</Link>.
        {composed.superseded.length > 0 && (
          <> {composed.superseded.length > 1 ? `${composed.superseded.length} lignes` : "Une ligne"} de ces mentions libres
            {composed.superseded.length > 1 ? " sont remplacées" : " est remplacée"} par les réglages ci-dessus, sans doublon.</>
        )}
      </p>
    </SettingsCard>
  )
}
