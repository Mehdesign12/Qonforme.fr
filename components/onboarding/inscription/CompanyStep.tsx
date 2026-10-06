"use client"

/**
 * Étape 1 de la fenêtre « Bienvenue » : l'entreprise, retrouvée dans le
 * répertoire Sirene par son nom, son SIREN ou son SIRET (GET /api/sirene/search,
 * 300 ms après la dernière frappe, dès 3 caractères), ou saisie à la main
 * (entreprise introuvable, ou pas encore de SIREN). Planches « Bienvenue-1 »,
 * « Bienvenue-1b » et « Mobile-Bienvenue-1 ».
 *
 * Liste au clavier (motif « combobox » : flèches, Entrée) ; entreprises fermées
 * grisées et jamais choisies ; état de la recherche annoncé (aria-live).
 * Démo : résultats fictifs de la maquette, sans réseau (./demo.ts).
 */
import { useEffect, useId, useRef, useState } from "react"
import { Check, CircleCheck, Loader2, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { AUTH_INPUT, Field } from "@/components/auth/fields"
import { validateCompanyInput, type CompanyInput } from "@/lib/onboarding/inscription"
import type { SireneCandidate } from "@/lib/utils/sirene"
import { demoSearch } from "@/components/onboarding/inscription/demo"
import {
  COMPANY_MAX_LENGTH, SEARCH_DEBOUNCE_MS, SEARCH_MIN, SEARCH_UNAVAILABLE,
  candidateToInput, companyAsCandidate, companyErrorField, fullAddressOf, groupSiren, placeOf, sirenFromQuery,
  type CompanyField, type InscriptionCompany,
} from "@/components/onboarding/inscription/model"
import {
  STEP_PAD, Serif, StepError, StepFooter, StepHeader, StepLead, StepTitle, useInitialFocus,
} from "@/components/onboarding/inscription/ui"

type SearchStatus = "idle" | "loading" | "ok" | "empty" | "error"

type ManualForm = Record<CompanyField, string>

const EMPTY_FORM: ManualForm = { name: "", address: "", zip_code: "", city: "", siren: "" }

export interface CompanyStepProps {
  mode: "app" | "demo"
  titleId: string
  progress: { number: number; total: number }
  /** « Compte créé » au-dessus du titre (ouverture juste après l'inscription). */
  justCreated: boolean
  /** Entreprise déjà enregistrée (retour à cette étape, ou reprise). */
  saved: InscriptionCompany | null
  /** Dernière entreprise choisie dans la liste pendant cette ouverture. */
  picked: SireneCandidate | null
  onPick: (c: SireneCandidate | null) => void
  busy: boolean
  onSkip: () => void
  /** Enregistre l'entreprise ; renvoie un message d'erreur, ou null si c'est fait. */
  onSubmit: (input: CompanyInput, candidate: SireneCandidate | null) => Promise<string | null>
  /** L'entreprise enregistrée est gardée telle quelle : étape suivante. */
  onKeep: () => void
}

export function CompanyStep(props: CompanyStepProps) {
  const [sub, setSub] = useState<"search" | "manual">("search")
  const [form, setForm] = useState<ManualForm>(EMPTY_FORM)
  const [notFound, setNotFound] = useState<string | null>(null)

  const openManual = (prefill: Partial<ManualForm>, query: string | null) => {
    setForm({ ...EMPTY_FORM, ...prefill })
    setNotFound(query)
    setSub("manual")
  }

  if (sub === "manual") {
    return (
      <ManualCompany
        {...props}
        form={form}
        setForm={setForm}
        notFound={notFound}
        onBackToSearch={() => setSub("search")}
      />
    )
  }
  return <SearchCompany {...props} onManual={openManual} />
}

/* ------------------------------------------------------------------ */
/* Recherche                                                           */
/* ------------------------------------------------------------------ */

function SearchCompany({
  mode, titleId, progress, justCreated, saved, picked, onPick, busy, onSkip, onSubmit, onKeep, onManual,
}: CompanyStepProps & { onManual: (prefill: Partial<ManualForm>, query: string | null) => void }) {
  const uid = useId()
  const rootRef = useInitialFocus<HTMLFormElement>()
  const inputId = `${uid}-search`
  const listId = `${uid}-results`
  const inputRef = useRef<HTMLInputElement>(null)

  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<SearchStatus>("idle")
  const [results, setResults] = useState<SireneCandidate[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)
  const [active, setActive] = useState(-1)
  const [error, setError] = useState<string | null>(null)

  const trimmed = query.trim()

  // Recherche différée ; la précédente est annulée à chaque frappe
  useEffect(() => {
    if (trimmed.length < SEARCH_MIN) {
      setStatus("idle")
      setResults([])
      setSearchError(null)
      setActive(-1)
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setStatus("loading")
      setSearchError(null)
      if (mode === "demo") {
        const list = demoSearch(trimmed)
        setResults(list)
        setActive(-1)
        setStatus(list.length ? "ok" : "empty")
        return
      }
      try {
        const res = await fetch(`/api/sirene/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        const json = await res.json().catch(() => ({}))
        if (controller.signal.aborted) return
        if (!res.ok) {
          setResults([])
          setActive(-1)
          setSearchError(
            typeof json.error === "string" && json.error
              ? json.error
              : res.status === 503 ? SEARCH_UNAVAILABLE : "La recherche n'a pas abouti. Réessayez.",
          )
          setStatus("error")
          return
        }
        const list: SireneCandidate[] = Array.isArray(json.results) ? json.results : []
        setResults(list)
        setActive(-1)
        setStatus(list.length ? "ok" : "empty")
      } catch {
        if (controller.signal.aborted) return
        setResults([])
        setSearchError(SEARCH_UNAVAILABLE)
        setStatus("error")
      }
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [trimmed, mode])

  // Sans recherche en cours : l'entreprise déjà choisie ou enregistrée reste affichée, cochée
  const current = picked ?? (saved ? companyAsCandidate(saved) : null)
  const searching = trimmed.length >= SEARCH_MIN && (status === "ok" || (status === "loading" && results.length > 0))
  const rows: SireneCandidate[] = searching ? results : current ? [current] : []

  const isSelected = (c: SireneCandidate) =>
    !!current && !c.closed && c.siren === current.siren && c.name === current.name

  const enabledIndexes = rows.map((c, i) => (c.closed ? -1 : i)).filter((i) => i >= 0)

  const pick = (c: SireneCandidate) => {
    if (c.closed) return
    setError(null)
    onPick(c)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !(active >= 0 && rows[active]) && (searching || !current)) {
      // Touche « Rechercher » du clavier du téléphone : rien de choisi dans la liste,
      // l'étape n'est pas validée et le clavier se range pour laisser voir les résultats
      e.preventDefault()
      e.currentTarget.blur()
      return
    }
    if (!rows.length) return
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      if (!enabledIndexes.length) return
      const pos = enabledIndexes.indexOf(active)
      const next = e.key === "ArrowDown"
        ? enabledIndexes[pos < 0 ? 0 : Math.min(pos + 1, enabledIndexes.length - 1)]
        : enabledIndexes[pos <= 0 ? 0 : pos - 1]
      setActive(next)
      document.getElementById(`${listId}-${next}`)?.scrollIntoView({ block: "nearest" })
    } else if (e.key === "Enter" && active >= 0 && rows[active]) {
      // Entrée sur une ligne : la choisir (sans valider l'étape)
      e.preventDefault()
      pick(rows[active])
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!current) {
      setError("Choisissez votre entreprise dans la liste, ou saisissez-la à la main.")
      inputRef.current?.focus()
      return
    }
    // Entreprise enregistrée, inchangée : étape suivante sans rien réécrire
    if (!picked && saved) {
      onKeep()
      return
    }
    const input = candidateToInput(current)
    // Démo : SIREN fictifs (clé de contrôle fausse), contrôlés sans eux
    const check = mode === "demo"
      ? demoChecked(input)
      : validateCompanyInput(input)
    if (!check.ok) {
      // Fiche incomplète au répertoire (adresse absente…) : à compléter à la main
      onManual(
        { name: input.name, address: input.address, zip_code: input.zip_code, city: input.city, siren: input.siren ?? "" },
        null,
      )
      return
    }
    const message = await onSubmit(check.value, current)
    if (message) setError(message)
  }

  const plural = results.length > 1 ? "s" : ""
  const liveText =
    status === "loading" ? "Recherche en cours…"
      : status === "ok" ? `${results.length}\u00a0entreprise${plural} trouvée${plural}.`
        : status === "empty" ? `Aucune entreprise trouvée pour «\u00a0${trimmed}\u00a0».`
          : ""

  return (
    <form ref={rootRef} onSubmit={submit} noValidate className="flex flex-[1_0_auto] flex-col">
      <StepHeader number={progress.number} total={progress.total} onSkip={onSkip} />

      <div className={cn("flex flex-[1_0_auto] flex-col pt-2.5 sm:pt-[22px]", STEP_PAD)}>
        {justCreated && (
          <span className="mb-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--q-ok)] sm:mb-2.5">
            <CircleCheck className="size-4" strokeWidth={2} aria-hidden />
            Compte créé
          </span>
        )}
        <StepTitle id={titleId}>Retrouvons votre <Serif>entreprise</Serif></StepTitle>
        <StepLead>Son nom, son SIREN ou son SIRET suffit&nbsp;: nous retrouvons son adresse.</StepLead>

        <label htmlFor={inputId} className="q-label mt-[18px] sm:mt-[22px]">Nom, SIREN ou SIRET de votre entreprise</label>
        <div className="relative mt-[7px]">
          <Search className="pointer-events-none absolute left-3.5 top-[15px] size-[18px] text-[var(--q-text-4)]" strokeWidth={1.75} aria-hidden />
          <input
            ref={inputRef}
            id={inputId}
            type="search"
            role="combobox"
            aria-expanded={rows.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 && rows[active] ? `${listId}-${active}` : undefined}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            maxLength={80}
            data-autofocus
            className={cn(AUTH_INPUT, "!pl-[42px] !pr-10 [&::-webkit-search-cancel-button]:hidden")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
          {status === "loading" && (
            <Loader2 className="absolute right-3.5 top-[15px] size-[18px] animate-spin text-[var(--q-accent)]" aria-hidden />
          )}
        </div>

        {/* État de la recherche, lu par les lecteurs d'écran */}
        <p className="sr-only" role="status" aria-live="polite">{liveText}</p>

        {rows.length > 0 && (
          <div className="mt-2.5 overflow-hidden rounded-[14px] border border-[var(--q-line)]">
            <ul id={listId} role="listbox" aria-label="Entreprises trouvées" className="m-0 list-none p-0">
              {rows.map((c, i) => (
                <CandidateOption
                  key={`${c.siren}-${i}`}
                  id={`${listId}-${i}`}
                  candidate={c}
                  selected={isSelected(c)}
                  active={i === active}
                  onPick={() => pick(c)}
                  onHover={() => !c.closed && setActive(i)}
                />
              ))}
            </ul>
            <p className="m-0 border-t border-[var(--q-line-soft)] bg-[var(--q-surface-2)] px-4 py-[9px] text-xs text-[var(--q-text-4)]">
              Répertoire Sirene de l&rsquo;INSEE
            </p>
          </div>
        )}

        {status === "empty" && (
          <p className="m-0 mt-3 text-[14px] leading-normal text-[var(--q-text-2)]">
            Aucune entreprise trouvée pour «&nbsp;{trimmed}&nbsp;».
          </p>
        )}
        {status === "error" && searchError && (
          <p role="alert" className="q-field-error m-0 mt-3 !text-[14px] leading-normal">{searchError}</p>
        )}

        <button
          type="button"
          onClick={() => onManual({ siren: sirenFromQuery(trimmed), ...(saved && !picked ? savedAsForm(saved) : {}) }, status === "empty" ? trimmed : null)}
          className="q-link mt-3 inline-flex min-h-11 items-center self-start text-left text-[14px] touch-manipulation sm:mt-3.5 sm:min-h-0"
        >
          Je ne la trouve pas, ou je n&rsquo;ai pas encore de SIREN
        </button>

        <StepError message={error} />
      </div>

      <StepFooter submitLabel="Continuer" busy={busy} />
    </form>
  )
}

/** Contrôles de la route, SIREN et SIRET fictifs de la démo mis de côté puis rendus. */
function demoChecked(input: CompanyInput): ReturnType<typeof validateCompanyInput> {
  const check = validateCompanyInput({ ...input, siren: null, siret: null })
  return check.ok ? { ok: true, value: { ...check.value, siren: input.siren ?? null, siret: input.siret ?? null } } : check
}

function savedAsForm(saved: InscriptionCompany): Partial<ManualForm> {
  return { name: saved.name, address: saved.address, zip_code: saved.zip_code, city: saved.city, siren: saved.siren ?? "" }
}

function CandidateOption({
  id, candidate: c, selected, active, onPick, onHover,
}: {
  id: string
  candidate: SireneCandidate
  selected: boolean
  active: boolean
  onPick: () => void
  onHover: () => void
}) {
  const form = c.legal_form_label?.trim()
  const place = placeOf(c)
  return (
    <li
      id={id}
      role="option"
      aria-selected={selected}
      aria-disabled={c.closed || undefined}
      onClick={onPick}
      onMouseMove={onHover}
      className={cn(
        "flex gap-3 border-b border-[var(--q-line-soft)] px-3.5 py-3 last:border-b-0 sm:px-4 sm:py-[13px]",
        selected ? "items-start" : "items-center",
        c.closed
          ? "cursor-default bg-[var(--q-surface-2)]"
          : cn(
            "cursor-pointer touch-manipulation",
            selected ? "bg-[var(--q-wash)]" : active ? "bg-[var(--q-row-hover)]" : "bg-[var(--q-surface)] hover:bg-[var(--q-row-hover)]",
          ),
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("text-[14px] font-semibold", c.closed ? "text-[var(--q-text-4)]" : "text-[var(--q-ink-strong)]")}>
          {c.name}
        </span>
        <span className={cn("text-[13px]", c.closed ? "text-[var(--q-text-4)]" : "text-[var(--q-text-3)]")}>
          {form ? `${form} · ` : ""}SIREN <span className="tabular-nums">{groupSiren(c.siren)}</span>
          {!selected && place ? ` · ${place}` : ""}
        </span>
        {selected && fullAddressOf(c) && (
          <span className="text-[13px] text-[var(--q-text-2)]">{fullAddressOf(c)}</span>
        )}
      </span>
      {c.closed ? (
        <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-[var(--q-sunken)] px-[9px] text-xs font-semibold text-[var(--q-text-3)]">
          Fermée
        </span>
      ) : selected ? (
        <span className="mt-px grid size-[22px] shrink-0 place-items-center rounded-full bg-[var(--q-accent)] text-white" aria-hidden>
          <Check className="size-3.5" strokeWidth={2.5} />
        </span>
      ) : (
        <span className="size-5 shrink-0 rounded-full border-[1.5px] border-[var(--q-field)]" aria-hidden />
      )}
    </li>
  )
}

/* ------------------------------------------------------------------ */
/* Saisie à la main                                                    */
/* ------------------------------------------------------------------ */

function ManualCompany({
  titleId, progress, busy, onSkip, onSubmit, form, setForm, notFound, onBackToSearch,
}: CompanyStepProps & {
  form: ManualForm
  setForm: React.Dispatch<React.SetStateAction<ManualForm>>
  notFound: string | null
  onBackToSearch: () => void
}) {
  const uid = useId()
  const rootRef = useInitialFocus<HTMLFormElement>()
  const [fieldError, setFieldError] = useState<{ field: CompanyField | null; message: string } | null>(null)

  const set = (field: CompanyField) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setForm((f) => ({ ...f, [field]: value }))
    if (fieldError?.field === field) setFieldError(null)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFieldError(null)
    const check = validateCompanyInput({
      name: form.name, address: form.address, zip_code: form.zip_code, city: form.city, siren: form.siren,
    })
    if (!check.ok) {
      const field = companyErrorField(check.error)
      setFieldError({ field, message: check.error })
      if (field) document.getElementById(`${uid}-${field}`)?.focus()
      return
    }
    const message = await onSubmit(check.value, null)
    if (message) setFieldError({ field: companyErrorField(message), message })
  }

  const errorOf = (field: CompanyField) => (fieldError?.field === field ? fieldError.message : undefined)
  const inputProps = (field: CompanyField) => ({
    id: `${uid}-${field}`,
    value: form[field],
    onChange: set(field),
    maxLength: COMPANY_MAX_LENGTH[field],
    "aria-invalid": errorOf(field) ? true : undefined,
    "aria-describedby": errorOf(field) ? `${uid}-${field}-error` : undefined,
  })

  return (
    <form ref={rootRef} onSubmit={submit} noValidate className="flex flex-[1_0_auto] flex-col">
      <StepHeader number={progress.number} total={progress.total} onSkip={onSkip} />

      <div className={cn("flex flex-[1_0_auto] flex-col pt-2.5 sm:pt-[22px]", STEP_PAD)}>
        <StepTitle id={titleId}>Votre <Serif>entreprise</Serif>, à la main</StepTitle>
        <StepLead>Telle qu&rsquo;elle doit figurer sur vos devis.</StepLead>

        {notFound && (
          <p role="status" className="m-0 mt-4 text-[14px] leading-normal text-[var(--q-text-2)]">
            Aucune entreprise trouvée pour «&nbsp;{notFound}&nbsp;».{" "}
            <button type="button" onClick={onBackToSearch} className="q-link touch-manipulation">Chercher à nouveau</button>
          </p>
        )}

        <div className="mt-[18px] flex flex-col gap-3.5">
          <Field id={`${uid}-name`} label="Nom de l’entreprise" error={errorOf("name")}>
            <input
              {...inputProps("name")}
              type="text"
              autoComplete="organization"
              placeholder="Garnier Plâtrerie, ou vos prénom et nom"
              className={AUTH_INPUT}
              data-autofocus
            />
          </Field>
          <Field id={`${uid}-address`} label="Adresse" error={errorOf("address")}>
            <input {...inputProps("address")} type="text" autoComplete="street-address" placeholder="14 rue des Lices" className={AUTH_INPUT} />
          </Field>
          <div className="grid grid-cols-[2fr_3fr] gap-3">
            <Field id={`${uid}-zip_code`} label="Code postal" error={errorOf("zip_code")}>
              <input {...inputProps("zip_code")} type="text" inputMode="numeric" autoComplete="postal-code" placeholder="49100" className={AUTH_INPUT} />
            </Field>
            <Field id={`${uid}-city`} label="Ville" error={errorOf("city")}>
              <input {...inputProps("city")} type="text" autoComplete="address-level2" placeholder="Angers" className={AUTH_INPUT} />
            </Field>
          </div>
          <Field
            id={`${uid}-siren`}
            label={<>SIREN <span className="font-normal text-[var(--q-text-4)]">(facultatif pour l&rsquo;instant)</span></>}
            error={errorOf("siren")}
            hint={<>Obligatoire sur vos devis et vos factures&nbsp;: il vous sera demandé avant le premier envoi.</>}
          >
            <input
              {...inputProps("siren")}
              aria-describedby={errorOf("siren") ? `${uid}-siren-error` : `${uid}-siren-hint`}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="9 chiffres"
              className={cn(AUTH_INPUT, "font-mono tracking-[0.04em]")}
            />
          </Field>
        </div>

        {fieldError && !fieldError.field && <StepError message={fieldError.message} />}
      </div>

      <StepFooter onBack={onBackToSearch} submitLabel="Continuer" busy={busy} />
    </form>
  )
}
