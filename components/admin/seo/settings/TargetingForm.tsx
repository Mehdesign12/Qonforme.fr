"use client"

/**
 * Paramètres › Ciblage (planche Parametres-ciblage.dc.html) : carte « Marchés
 * et audience » (Enregistrer primaire) et carte « Requêtes de marque et
 * concurrents » (Enregistrer secondaire). Chaque carte n'enregistre que ses
 * champs, sans emporter les modifications en cours de l'autre.
 *
 * Les concurrents servent au suivi interne seulement (visibilité IA) : ils ne
 * vont jamais au générateur d'articles ni dans un contenu public (CLAUDE.md).
 */
import { useRef, useState } from "react"
import { Info, Plus, ShieldCheck, X } from "lucide-react"
import type { TargetingSettings } from "@/lib/seo/settings"
import { cn } from "@/lib/utils"
import { CardFooter, Counter, Field, SaveButton, SelectBox, SettingsCard, UsedBy, describedBy } from "./ui"
import { useSettingsSave, useUnsavedGuard } from "./useSettingsSave"
import { useFocusAfterRender } from "./useFocusAfterRender"
import {
  competitorError,
  countryName,
  errorFor,
  linesError,
  linesToList,
  listToLines,
  normalizeDomain,
  pick,
  resolveCountry,
  sameValue,
  withoutErrors,
} from "./validation"

const MARKET_FIELDS = ["scope", "audience", "countries", "localZone"] as const
const BRAND_FIELDS = ["brandTerms", "competitors", "includeBrandQueries"] as const

const SCOPES: { value: TargetingSettings["scope"]; label: string }[] = [
  { value: "local", label: "Locale" },
  { value: "regional", label: "Régionale" },
  { value: "france", label: "France" },
  { value: "international", label: "International" },
]

const AUDIENCES: { value: TargetingSettings["audience"]; label: string }[] = [
  { value: "b2b", label: "Entreprises" },
  { value: "b2c", label: "Particuliers" },
  { value: "both", label: "Entreprises et particuliers" },
]

type Draft = Omit<TargetingSettings, "brandTerms"> & { brandTermsText: string }

function draftOf(v: TargetingSettings): Draft {
  const { brandTerms, ...rest } = v
  return { ...rest, brandTermsText: listToLines(brandTerms) }
}

function valueOf(d: Draft): TargetingSettings {
  const { brandTermsText, ...rest } = d
  return { ...rest, localZone: rest.localZone.trim(), brandTerms: linesToList(brandTermsText) }
}

const chip =
  "inline-flex h-11 items-center gap-0.5 rounded-full border border-[var(--q-line)] bg-[var(--q-sunken)] pl-3 pr-1 text-[var(--q-ink)] md:h-8"

/** Croix d'une puce : 36 px visibles, zone de toucher de 44 px (pseudo-élément) sur téléphone. */
const chipRemove =
  "relative grid size-9 place-items-center rounded-full text-[var(--q-text-3)] before:absolute before:-inset-1 before:content-[''] hover:bg-[var(--q-hover)] disabled:cursor-not-allowed disabled:opacity-40 md:size-6 md:before:content-none"

export function TargetingForm({
  initial,
  updatedAt,
  maxCountries,
  maxCompetitors,
}: {
  initial: TargetingSettings
  updatedAt: string | null
  maxCountries: number
  maxCompetitors: number
}) {
  const { baseline, errors, setErrors, savingCard, busy, save } = useSettingsSave("targeting", initial, updatedAt)
  const focusAfterRender = useFocusAfterRender()
  const countryButtons = useRef<Record<string, HTMLButtonElement | null>>({})
  const competitorButtons = useRef<Record<string, HTMLButtonElement | null>>({})
  const [draft, setDraft] = useState<Draft>(() => draftOf(initial))
  const [countryInput, setCountryInput] = useState("")
  const [countryError, setCountryError] = useState<string | null>(null)
  const [competitorInput, setCompetitorInput] = useState("")
  const [competitorInputError, setCompetitorInputError] = useState<string | null>(null)

  const current = valueOf(draft)
  const marketDirty = !sameValue(pick(current, MARKET_FIELDS), pick(baseline, MARKET_FIELDS))
  const brandDirty = !sameValue(pick(current, BRAND_FIELDS), pick(baseline, BRAND_FIELDS))
  useUnsavedGuard(marketDirty || brandDirty || Boolean(competitorInput.trim()) || Boolean(countryInput.trim()))

  function update(patch: Partial<Draft>, fields: string[]) {
    setDraft((d) => ({ ...d, ...patch }))
    setErrors(withoutErrors(errors, fields))
  }

  /* ---------------- Pays ---------------- */

  function addCountry() {
    if (!countryInput.trim()) return
    const code = resolveCountry(countryInput)
    if (!code) {
      setCountryError(`Pays inconnu : « ${countryInput.trim()} ». Tapez son nom en français (Allemagne, Suisse…) ou son code à deux lettres (DE, CH…).`)
      return
    }
    if (draft.countries.includes(code)) {
      setCountryError(`${countryName(code)} est déjà dans la liste`)
      return
    }
    if (draft.countries.length >= maxCountries) {
      setCountryError(`${maxCountries} pays au maximum`)
      return
    }
    update({ countries: draft.countries.concat(code) }, ["countries"])
    setCountryInput("")
    setCountryError(null)
  }

  /** Retire un pays : focus à la croix du pays suivant (ou précédent), sinon au champ d'ajout. */
  function removeCountry(code: string) {
    if (draft.countries.length <= 1) return
    const list = draft.countries
    const at = list.indexOf(code)
    const neighbour = list[at + 1] ?? list[at - 1]
    // Un seul pays restant : sa croix est désactivée, le focus va au champ d'ajout
    focusAfterRender(() =>
      list.length - 1 > 1 && neighbour ? countryButtons.current[neighbour] : document.getElementById("pays-ajout"),
    )
    update({ countries: list.filter((c) => c !== code) }, ["countries"])
  }

  /* ---------------- Concurrents ---------------- */

  function addCompetitor() {
    const err = competitorError(competitorInput, draft.competitors, maxCompetitors)
    if (err) {
      setCompetitorInputError(err)
      return
    }
    update({ competitors: draft.competitors.concat(normalizeDomain(competitorInput)) }, ["competitors"])
    setCompetitorInput("")
    setCompetitorInputError(null)
  }

  /** Retire un concurrent : focus à la croix du suivant (ou du précédent), sinon au champ d'ajout. */
  function removeCompetitor(domain: string) {
    const list = draft.competitors
    const at = list.indexOf(domain)
    const neighbour = list[at + 1] ?? list[at - 1]
    focusAfterRender(() => (neighbour ? competitorButtons.current[neighbour] : document.getElementById("concurrent-ajout")))
    update({ competitors: list.filter((d) => d !== domain) }, ["competitors"])
  }

  /* ---------------- Enregistrement ---------------- */

  async function saveCard(card: "market" | "brand") {
    if (card === "brand") {
      const terms = linesError(linesToList(draft.brandTermsText), { max: 20, maxLength: 80, noun: "termes" })
      if (terms) {
        setErrors({ ...errors, brandTerms: terms })
        return
      }
    }
    const fields = card === "market" ? MARKET_FIELDS : BRAND_FIELDS
    const value = { ...baseline, ...pick(current, fields as readonly (keyof TargetingSettings)[]) } as TargetingSettings
    const next = await save(card, value, card === "market" ? "Marchés et audience enregistrés." : "Requêtes de marque et concurrents enregistrés.")
    if (!next) return
    // Seuls les champs de la carte reprennent la valeur enregistrée
    const saved = draftOf(next)
    setDraft((d) =>
      card === "market"
        ? { ...d, scope: saved.scope, audience: saved.audience, countries: saved.countries, localZone: saved.localZone }
        : { ...d, brandTermsText: saved.brandTermsText, competitors: saved.competitors, includeBrandQueries: saved.includeBrandQueries },
    )
  }

  const termCount = linesToList(draft.brandTermsText).length
  const countriesError = countryError ?? errorFor(errors, "countries", "Pays")
  const termsError = errorFor(errors, "brandTerms", "Ligne")
  const competitorsError = competitorInputError ?? errorFor(errors, "competitors", "Concurrent")
  const countriesFull = draft.countries.length >= maxCountries
  const competitorsFull = draft.competitors.length >= maxCompetitors

  return (
    <>
      <SettingsCard
        id="t-marches"
        title="Marchés et audience"
        bodyClassName="gap-5 pt-3"
        footer={
          <CardFooter>
            <UsedBy
              items={[
                { label: "génération d'articles", href: "/admin/seo/articles/liste?generer=1" },
                { label: "suivi de la visibilité IA", href: "/admin/seo/visibilite-ia" },
              ]}
            />
            <SaveButton
              primary
              dirty={marketDirty}
              saving={savingCard === "market"}
              busy={busy}
              onClick={() => saveCard("market")}
              ariaLabel="Enregistrer les marchés et l'audience"
            />
          </CardFooter>
        }
      >
        <div className="grid items-start gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
          <Field id="portee" label="Portée géographique" error={errorFor(errors, "scope")}>
            <SelectBox id="portee" value={draft.scope} onChange={(e) => update({ scope: e.target.value as Draft["scope"] }, ["scope"])}>
              {SCOPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </SelectBox>
          </Field>
          <Field id="audience" label="Audience" error={errorFor(errors, "audience")}>
            <SelectBox
              id="audience"
              value={draft.audience}
              onChange={(e) => update({ audience: e.target.value as Draft["audience"] }, ["audience"])}
            >
              {AUDIENCES.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </SelectBox>
          </Field>

          <Field
            id="pays-ajout"
            label="Pays ciblés"
            aside={
              <Counter>
                {draft.countries.length}&nbsp;/&nbsp;{maxCountries}
              </Counter>
            }
            hint={countriesFull ? `${maxCountries} pays au maximum.` : "Tapez un pays, puis Entrée pour l'ajouter."}
            error={countriesError}
          >
            <div className="q-fw flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-[10px] border border-[var(--q-field)] bg-[var(--q-surface)] p-1.5">
              {draft.countries.map((code) => (
                <span key={code} className={cn(chip, "text-sm font-semibold")}>
                  <span suppressHydrationWarning>{countryName(code)}</span>
                  <button
                    ref={(el) => {
                      countryButtons.current[code] = el
                    }}
                    type="button"
                    onClick={() => removeCountry(code)}
                    disabled={draft.countries.length <= 1}
                    aria-label={`Retirer ${countryName(code)}`}
                    title={draft.countries.length <= 1 ? "Gardez au moins un pays" : undefined}
                    className={chipRemove}
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </span>
              ))}
              <input
                id="pays-ajout"
                type="text"
                autoComplete="off"
                autoCapitalize="words"
                maxLength={60}
                disabled={countriesFull}
                value={countryInput}
                placeholder="Ajouter un pays"
                aria-invalid={Boolean(countriesError) || undefined}
                aria-describedby={describedBy("pays-ajout", "aide", countriesError)}
                onChange={(e) => {
                  setCountryInput(e.target.value)
                  setCountryError(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addCountry()
                  }
                }}
                className="h-11 min-w-[140px] flex-1 bg-transparent px-1.5 text-base text-[var(--q-ink)] outline-none placeholder:text-[var(--q-placeholder)] md:h-8 md:text-sm"
              />
            </div>
          </Field>

          <Field
            id="zone-locale"
            label="Zone locale prioritaire"
            hint="Pays, région, département ou ville à privilégier."
            error={errorFor(errors, "localZone")}
          >
            <input
              id="zone-locale"
              type="text"
              className="q-input"
              value={draft.localZone}
              maxLength={120}
              aria-invalid={Boolean(errorFor(errors, "localZone")) || undefined}
              aria-describedby={describedBy("zone-locale", "aide", errorFor(errors, "localZone"))}
              onChange={(e) => update({ localZone: e.target.value }, ["localZone"])}
            />
          </Field>
        </div>
      </SettingsCard>

      <SettingsCard
        id="t-marque-concurrents"
        title="Requêtes de marque et concurrents"
        bodyClassName="gap-5 pt-3"
        footer={
          <CardFooter>
            <UsedBy items={[{ label: "suivi de la visibilité IA", href: "/admin/seo/visibilite-ia" }, { label: "stratégie de contenu" }]} />
            <SaveButton
              dirty={brandDirty}
              saving={savingCard === "brand"}
              busy={busy}
              onClick={() => saveCard("brand")}
              ariaLabel="Enregistrer les requêtes de marque et les concurrents"
            />
          </CardFooter>
        }
      >
        <div role="status" className="q-banner">
          <Info className="mt-0.5 size-[18px] shrink-0" aria-hidden />
          <span>Usage interne&nbsp;: les concurrents ne sont jamais transmis au générateur d&apos;articles ni cités dans un contenu public.</span>
        </div>

        <Field
          id="termes-marque"
          label="Termes de marque"
          aside={<Counter>{termCount > 1 ? `${termCount} termes` : `${termCount} terme`}</Counter>}
          hint="Une ligne par terme. Les requêtes qui les contiennent comptent comme requêtes de marque."
          error={termsError}
        >
          <textarea
            id="termes-marque"
            rows={3}
            className="q-input"
            value={draft.brandTermsText}
            aria-invalid={Boolean(termsError) || undefined}
            aria-describedby={describedBy("termes-marque", "aide", termsError)}
            onChange={(e) => update({ brandTermsText: e.target.value }, ["brandTerms"])}
          />
        </Field>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <span id="lbl-concurrents" className="q-label">
              Concurrents
            </span>
            <span className="q-tag h-auto min-h-[22px] gap-1.5">
              <ShieldCheck className="size-3 shrink-0" aria-hidden />
              Usage interne&nbsp;: jamais cité dans un contenu public
            </span>
          </div>
          {draft.competitors.length > 0 ? (
            <ul aria-labelledby="lbl-concurrents" className="flex flex-wrap gap-2">
              {draft.competitors.map((domain) => (
                <li key={domain} className={cn(chip, "font-mono text-[13px]")}>
                  {domain}
                  <button
                    ref={(el) => {
                      competitorButtons.current[domain] = el
                    }}
                    type="button"
                    onClick={() => removeCompetitor(domain)}
                    aria-label={`Retirer ${domain}`}
                    className={chipRemove}
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--q-text-4)]">Aucun concurrent suivi.</p>
          )}
        </div>

        <Field
          id="concurrent-ajout"
          label="Ajouter un concurrent"
          hint={competitorsFull ? `${maxCompetitors} concurrents au maximum.` : undefined}
          error={competitorsError}
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="concurrent-ajout"
              type="text"
              inputMode="url"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className="q-input font-mono"
              value={competitorInput}
              maxLength={253}
              disabled={competitorsFull}
              placeholder="Domaine du site, sans https://"
              aria-invalid={Boolean(competitorsError) || undefined}
              aria-describedby={describedBy("concurrent-ajout", competitorsFull ? "aide" : undefined, competitorsError)}
              onChange={(e) => {
                setCompetitorInput(e.target.value)
                setCompetitorInputError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  addCompetitor()
                }
              }}
            />
            <button
              type="button"
              onClick={addCompetitor}
              disabled={competitorsFull || !competitorInput.trim()}
              className="q-btn q-btn-secondary h-12 shrink-0 rounded-[14px] text-[15px] sm:h-[42px] sm:rounded-[10px] sm:text-sm"
            >
              <Plus aria-hidden />
              Ajouter
            </button>
          </div>
        </Field>

        <div className="flex items-start justify-between gap-4 rounded-xl border border-[var(--q-line)] bg-[var(--q-surface-2)] px-4 py-3.5">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span id="sw-marque-label" className="text-sm font-semibold text-[var(--q-ink)]">
              Inclure mes requêtes de marque dans la stratégie de contenu
            </span>
            <span id="sw-marque-desc" className="text-[13px] text-[var(--q-text-4)]">
              Désactivé par défaut pour les requêtes de marque déjà positionnées, afin de concentrer la production sur
              l&apos;acquisition hors marque. Activez-le si votre marque n&apos;est pas encore installée.
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2.5 pt-0.5">
            <span className="hidden text-[13px] text-[var(--q-text-4)] sm:inline" aria-hidden>
              {draft.includeBrandQueries ? "Activé" : "Désactivé"}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={draft.includeBrandQueries}
              aria-labelledby="sw-marque-label"
              aria-describedby="sw-marque-desc"
              onClick={() => update({ includeBrandQueries: !draft.includeBrandQueries }, ["includeBrandQueries"])}
              className="q-switch before:absolute before:-inset-2.5 before:content-['']"
            />
          </div>
        </div>
      </SettingsCard>
    </>
  )
}
