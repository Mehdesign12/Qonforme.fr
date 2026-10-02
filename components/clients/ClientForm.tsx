"use client"

/**
 * Formulaire client (planches « Nouveau-client », « Nouveau-client-neuf »,
 * « Mobile-client-nouveau ») : création et modification, application et démo.
 *
 * Recherche au répertoire Sirene en tête, puis identité, contact et adresse ;
 * vérifications à droite sur ordinateur, barre d'enregistrement collée en bas
 * sur mobile. La page fournit `onSubmit` (API réelle, ou invitation en démo).
 */
import { useState } from "react"
import Link from "next/link"
import { Check, CircleCheck, Info, Loader2, Search } from "lucide-react"
import { PageHeader } from "@/components/app/kit"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { isValidSiren } from "@/lib/utils/invoice"
import { cn } from "@/lib/utils"
import { formatSirenDisplay } from "./client-data"
import { lookupCompany, type CompanyLookup } from "./lookup"

export interface ClientFormValues {
  name: string
  siren: string
  vat_number: string
  email: string
  phone: string
  address: string
  zip_code: string
  city: string
}

/** Corps envoyé à POST /api/clients et PATCH /api/clients/[id]. */
export interface ClientPayload {
  name: string
  siren: string | null
  vat_number: string | null
  email: string | null
  phone: string | null
  address: string | null
  zip_code: string | null
  city: string | null
  country: string
}

type Kind = "pro" | "particulier"
type Errors = Partial<Record<keyof ClientFormValues, string>>
type LookupState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "found"; company: CompanyLookup }
  | { status: "message"; text: string }

const EMPTY: ClientFormValues = {
  name: "", siren: "", vat_number: "", email: "", phone: "", address: "", zip_code: "", city: "",
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const FIELD_ORDER: (keyof ClientFormValues)[] = ["name", "siren", "vat_number", "email", "phone", "address", "zip_code", "city"]

/** Champs plus hauts et plus ronds sur mobile (planche mobile : 48 px, rayon 14). */
const INPUT = "h-12 rounded-[14px] md:h-[42px] md:rounded-[10px]"

export function ClientFormPage({
  mode,
  initial,
  country = "FR",
  title,
  subtitle,
  backHref,
  backLabel,
  cancelHref,
  submitLabel,
  mobileSubmitLabel,
  onSubmit,
}: {
  mode: "create" | "edit"
  initial?: Partial<ClientFormValues>
  /** Pays de la fiche (conservé tel quel à la modification). */
  country?: string
  title: React.ReactNode
  subtitle?: React.ReactNode
  backHref: string
  backLabel: string
  cancelHref: string
  submitLabel: string
  mobileSubmitLabel?: string
  /** Enregistre (ou invite à créer un compte en démo) ; gère la suite (toast, navigation). */
  onSubmit: (payload: ClientPayload) => Promise<void> | void
}) {
  const start = { ...EMPTY, ...initial }
  const [kind, setKind] = useState<Kind>("pro")
  const [fields, setFields] = useState<ClientFormValues>(start)
  const [errors, setErrors] = useState<Errors>({})
  const [submitting, setSubmitting] = useState(false)
  const [lookupQuery, setLookupQuery] = useState("")
  const [lookup, setLookup] = useState<LookupState>({ status: "idle" })
  const isPro = kind === "pro"
  const formId = mode === "create" ? "client-create" : "client-edit"

  const clearError = (key: keyof ClientFormValues) =>
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })

  const set = (key: keyof ClientFormValues) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = key === "siren" ? e.target.value.replace(/\D/g, "").slice(0, 9) : e.target.value
    setFields((prev) => ({ ...prev, [key]: value }))
    clearError(key)
    if (key === "siren" && lookup.status === "found" && value !== lookup.company.siren) setLookup({ status: "idle" })
  }

  /* ── Recherche Sirene ─────────────────────────────────────────────── */
  const runLookup = async () => {
    setLookup({ status: "loading" })
    const out = await lookupCompany(lookupQuery)
    if (out.status === "found") {
      const c = out.company
      setFields((prev) => ({
        ...prev,
        name: c.name || prev.name,
        siren: c.siren,
        vat_number: c.vat_number,
        address: c.address || prev.address,
        zip_code: c.zip_code || prev.zip_code,
        city: c.city || prev.city,
      }))
      setErrors((prev) => {
        const next = { ...prev }
        delete next.name
        delete next.siren
        return next
      })
      setLookup({ status: "found", company: c })
    } else if (out.status === "invalid") {
      setLookup({ status: "message", text: out.message })
    } else if (out.status === "notfound") {
      setLookup({ status: "message", text: "Aucune entreprise trouvée pour ce numéro au répertoire Sirene. Vérifiez-le ou remplissez la fiche à la main." })
    } else {
      setLookup({ status: "message", text: "La recherche n'a pas abouti. Réessayez dans un instant ou remplissez la fiche à la main." })
    }
  }

  /* ── Validation et envoi ──────────────────────────────────────────── */
  const validate = (): Errors => {
    const errs: Errors = {}
    if (fields.name.trim().length < 2) {
      errs.name = isPro ? "Raison sociale requise (2 caractères min.)" : "Nom requis (2 caractères min.)"
    }
    const siren = fields.siren.trim()
    if (isPro && siren) {
      // Clé de contrôle exigée pour un SIREN saisi ou modifié ; un SIREN déjà
      // enregistré reste modifiable sans bloquer le reste de la fiche
      const unchanged = mode === "edit" && siren === (initial?.siren ?? "").trim()
      if (!/^\d{9}$/.test(siren)) errs.siren = "SIREN invalide (9 chiffres)"
      else if (!unchanged && !isValidSiren(siren)) errs.siren = "SIREN invalide (clé de contrôle)"
    }
    if (fields.email.trim() && !EMAIL_RE.test(fields.email.trim())) errs.email = "Adresse e-mail invalide"
    return errs
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      const first = FIELD_ORDER.find((k) => errs[k])
      if (first) document.getElementById(`client-${first}`)?.focus()
      return
    }
    const clean = (v: string) => v.trim() || null
    setSubmitting(true)
    try {
      await onSubmit({
        name: fields.name.trim(),
        siren: isPro ? clean(fields.siren) : null,
        vat_number: isPro ? clean(fields.vat_number) : null,
        email: clean(fields.email),
        phone: clean(fields.phone),
        address: clean(fields.address),
        zip_code: clean(fields.zip_code),
        city: clean(fields.city),
        country,
      })
    } finally {
      setSubmitting(false)
    }
  }

  /* ── Vérifications (colonne de droite) ────────────────────────────── */
  const sirenOk = isValidSiren(fields.siren.trim())
  const emailOk = EMAIL_RE.test(fields.email.trim())
  const addressOk = Boolean(fields.address.trim() && fields.zip_code.trim() && fields.city.trim())
  const checks = [
    isPro
      ? {
          ok: sirenOk,
          label: "SIREN valide",
          sub: lookup.status === "found" && sirenOk ? "Trouvé au répertoire Sirene"
            : sirenOk ? "Clé de contrôle vérifiée"
            : fields.siren ? "Clé de contrôle incorrecte"
            : "Obligatoire pour un client professionnel",
        }
      : { ok: true, label: "Particulier", sub: "Pas de SIREN à saisir" },
    { ok: emailOk, label: "E-mail", sub: emailOk ? "Prêt pour l'envoi des devis et factures" : "Nécessaire pour envoyer devis et factures" },
    { ok: addressOk, label: "Adresse de facturation", sub: "Mention obligatoire sur la facture" },
  ]
  const okCount = checks.filter((c) => c.ok).length

  /* ── Rendu ────────────────────────────────────────────────────────── */
  const field = (
    key: keyof ClientFormValues,
    label: string,
    props: React.ComponentProps<typeof Input> = {},
    className?: string,
  ) => (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label htmlFor={`client-${key}`}>{label}</Label>
      <Input
        id={`client-${key}`}
        value={fields[key]}
        onChange={set(key)}
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={errors[key] ? `client-${key}-err` : undefined}
        {...props}
        className={cn(INPUT, props.className)}
      />
      {errors[key] && <p id={`client-${key}-err`} className="q-field-error">{errors[key]}</p>}
    </div>
  )

  const kindButtons = (variant: "mobile" | "desktop") =>
    (["pro", "particulier"] as Kind[]).map((k) => (
      <button
        key={k}
        type="button"
        aria-pressed={kind === k}
        onClick={() => { setKind(k); if (k === "particulier") setLookup({ status: "idle" }) }}
        className={variant === "mobile"
          ? cn(
              "h-10 flex-1 rounded-[11px] text-[15px] transition-colors",
              kind === k
                ? "bg-[var(--q-surface)] font-semibold text-[var(--q-ink)] shadow-[0_1px_3px_rgba(10,17,34,.12)]"
                : "font-medium text-[var(--q-text-3)]",
            )
          : undefined}
      >
        {k === "pro" ? "Professionnel" : "Particulier"}
      </button>
    ))

  // Titres de section : cartes sur ordinateur, champs à plat sur mobile (planche mobile)
  const sectionTitle = (text: string) => <h2 className="q-h2 hidden md:block">{text}</h2>

  return (
    <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-[18px]">
      <PageHeader
        title={title}
        subtitle={subtitle}
        backHref={backHref}
        backLabel={backLabel}
        className="md:items-center"
        actions={
          <div className="hidden items-center gap-2 md:flex">
            <Link href={cancelHref} className="q-btn q-btn-ghost">Annuler</Link>
            <button type="submit" className="q-btn q-btn-primary" disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" aria-hidden /> : <Check strokeWidth={2.5} aria-hidden />}
              {submitLabel}
            </button>
          </div>
        }
      />

      {/* Type de client, en tête sur mobile */}
      <div role="group" aria-label="Type de client" className="flex gap-1 rounded-[14px] bg-[var(--q-sunken)] p-1 md:hidden">
        {kindButtons("mobile")}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-5">
        <div className="flex min-w-0 flex-col gap-4">
          {/* Recherche Sirene */}
          <section
            aria-label="Recherche par SIREN"
            className={cn(
              "q-card flex-col gap-3.5 !rounded-[22px] p-[18px] md:!rounded-2xl md:p-5",
              isPro ? "flex" : "hidden md:flex",
            )}
          >
            <div className="hidden flex-wrap items-center justify-between gap-3 md:flex">
              <h2 className="q-h2">Type de client</h2>
              <div role="group" aria-label="Type de client" className="q-seg">{kindButtons("desktop")}</div>
            </div>
            {isPro ? (
              <>
                <div className="flex items-end gap-2.5">
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Label htmlFor="client-lookup">SIREN ou SIRET</Label>
                    <Input
                      id="client-lookup"
                      value={lookupQuery}
                      onChange={(e) => {
                        setLookupQuery(e.target.value.replace(/[^\d\s]/g, "").slice(0, 20))
                        if (lookup.status === "message") setLookup({ status: "idle" })
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); runLookup() }
                      }}
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="9 ou 14 chiffres"
                      aria-describedby="client-lookup-status"
                      className={cn(INPUT, "font-mono placeholder:font-sans")}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={runLookup}
                    disabled={lookup.status === "loading" || lookupQuery.replace(/\D/g, "").length < 9}
                    className="q-btn q-btn-secondary !h-12 shrink-0 !rounded-[14px] !px-4 !text-[15px] md:!h-[42px] md:!rounded-[10px] md:!text-sm"
                  >
                    {lookup.status === "loading" ? <Loader2 className="animate-spin" aria-hidden /> : <Search aria-hidden />}
                    <span className="md:hidden">Chercher</span>
                    <span className="hidden md:inline">Rechercher</span>
                  </button>
                </div>
                <div id="client-lookup-status" aria-live="polite">
                  {lookup.status === "found" && (
                    <div className="q-banner q-banner-ok">
                      <CircleCheck className="mt-0.5 size-[18px] shrink-0" aria-hidden />
                      <span className="flex min-w-0 flex-col gap-0.5 leading-snug">
                        <strong className="font-semibold">{lookup.company.name}</strong>
                        <span>
                          SIREN <span className="font-mono">{formatSirenDisplay(lookup.company.siren)}</span>
                          {" · "}TVA <span className="font-mono">{lookup.company.vat_number}</span>
                          {lookup.company.city ? ` · ${[lookup.company.address, `${lookup.company.zip_code} ${lookup.company.city}`.trim()].filter(Boolean).join(", ")}` : ""}
                        </span>
                      </span>
                    </div>
                  )}
                  {lookup.status === "message" && <p className="q-field-error">{lookup.text}</p>}
                  {lookup.status === "idle" && (
                    <p className="q-field-hint">Raison sociale et TVA remplies depuis le répertoire Sirene ; l&apos;adresse aussi avec un SIRET.</p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm leading-relaxed text-[var(--q-text-3)]">
                Pas de SIREN à saisir : le nom, l&apos;e-mail et l&apos;adresse suffisent.
              </p>
            )}
          </section>

          {/* Identité */}
          <section aria-label="Identité" className="flex flex-col gap-3.5 md:q-card md:p-5">
            {sectionTitle("Identité")}
            {field("name", isPro ? "Nom ou raison sociale" : "Nom", {
              autoComplete: isPro ? "organization" : "name",
              placeholder: isPro ? "Raison sociale ou nom" : "Prénom et nom",
            })}
            {isPro && (
              <div className="grid gap-3.5 md:grid-cols-2 md:gap-3">
                {field("siren", "SIREN", { inputMode: "numeric", maxLength: 9, autoComplete: "off", placeholder: "9 chiffres", className: "font-mono placeholder:font-sans" })}
                {field("vat_number", "N° TVA intracommunautaire", { autoComplete: "off", placeholder: "FR00123456789", className: "font-mono placeholder:font-sans" })}
              </div>
            )}
          </section>

          {/* Contact */}
          <section aria-label="Contact" className="flex flex-col gap-3.5 md:q-card md:p-5">
            {sectionTitle("Contact")}
            <div className="grid gap-3.5 md:grid-cols-2 md:gap-3">
              {field("email", "E-mail", { type: "email", autoComplete: "email", inputMode: "email", placeholder: "nom@entreprise.fr" })}
              {field("phone", "Téléphone", { type: "tel", autoComplete: "tel", inputMode: "tel" })}
            </div>
          </section>

          {/* Adresse */}
          <section aria-label="Adresse de facturation" className="flex flex-col gap-3.5 md:q-card md:p-5">
            {sectionTitle("Adresse de facturation")}
            {field("address", "Adresse", { autoComplete: "street-address" })}
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3">
              {field("zip_code", "Code postal", { autoComplete: "postal-code", inputMode: "numeric", maxLength: 5 })}
              {field("city", "Ville", { autoComplete: "address-level2" })}
            </div>
          </section>
        </div>

        {/* Vérifications (ordinateur) */}
        <aside className="hidden min-w-0 flex-col gap-4 lg:flex">
          <section aria-label="Vérifications" className="q-card flex flex-col gap-3 p-[18px]">
            <div className="flex items-center justify-between gap-2">
              <h2 className="q-h2">Vérifications</h2>
              <span className="q-pill q-pill-info tabular-nums">{okCount} sur {checks.length}</span>
            </div>
            {checks.map((c) => (
              <div key={c.label} className="flex items-start gap-2.5 text-sm">
                {c.ok
                  ? <CircleCheck className="mt-px size-[18px] shrink-0 text-[var(--q-ok)]" aria-label="Fait" />
                  : <span className="mt-0.5 size-[17px] shrink-0 rounded-full border-2 border-dashed border-[var(--q-placeholder)]" aria-label="À faire" role="img" />}
                <span className="flex min-w-0 flex-col gap-px">
                  <span className="text-[var(--q-ink)]">{c.label}</span>
                  <span className="text-xs text-[var(--q-text-4)]">{c.sub}</span>
                </span>
              </div>
            ))}
          </section>
          <div className="q-banner !rounded-2xl !border-transparent !p-[18px] leading-relaxed">
            <Info className="mt-0.5 size-[18px] shrink-0" aria-hidden />
            <span>
              Avec le SIREN, Qonforme retrouve la raison sociale au répertoire Sirene et calcule le numéro de TVA intracommunautaire. Avec le SIRET, l&apos;adresse est remplie aussi.
            </span>
          </div>
        </aside>
      </div>

      {/* Barre d'enregistrement mobile, au-dessus de la barre de navigation */}
      <div aria-hidden className="h-[84px] md:hidden" />
      <div className="fixed inset-x-3 bottom-[calc(96px+env(safe-area-inset-bottom))] z-30 rounded-3xl border border-[var(--q-line)] bg-[var(--q-surface)] p-3 shadow-[var(--q-shadow-float)] md:hidden">
        <button type="submit" className="q-btn q-btn-primary q-btn-xl w-full" disabled={submitting}>
          {submitting ? <Loader2 className="animate-spin" aria-hidden /> : <Check strokeWidth={2.5} aria-hidden />}
          {mobileSubmitLabel ?? submitLabel}
        </button>
      </div>
    </form>
  )
}
