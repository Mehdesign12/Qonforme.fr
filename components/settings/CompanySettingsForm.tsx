'use client'

/**
 * Paramètres › Entreprise (planche « Paramètres — Entreprise ») : logo avec
 * aperçu, identité, TVA, coordonnées bancaires (IBAN contrôlé par sa clé ISO
 * 13616 ; titulaire et BIC pour la page de règlement, lib/payment-link, dès que
 * la migration 20261003_payment_links.sql a ajouté leurs colonnes).
 *
 * Seuls les champs qui existent en base sont proposés : pas de forme
 * juridique, de téléphone, d'assurance décennale, de régime de TVA ni
 * d'autoliquidation (non livrés, DECISIONS § 10). La numérotation et les
 * conditions de paiement se règlent dans Paramètres › Modèles de documents.
 *
 * Même composant pour la démo (`mode="demo"`) : rien n'est lu ni enregistré.
 */
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Loader2, Search, CheckCircle2, Wand2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { isValidSiren, sirenToVAT } from "@/lib/utils/invoice"
import { bicError, formatIbanGroups, ibanError, normalizeBic, normalizeIban } from "@/lib/payment-link/iban"
import { PageHeader } from "@/components/app/kit"
import type { ShellMode } from "@/components/layout/nav"
import { settingsHref } from "@/components/settings/sections"
import { DirtyHint, Field, FieldGrid, MobileSaveBar, SaveButton, SettingsCard } from "@/components/settings/ui"
import { LogoDocPreview, LogoDropzone, useCompanyLogo } from "@/components/settings/LogoField"

export interface CompanyFields {
  name: string
  siren: string
  siret: string
  vat_number: string
  address: string
  zip_code: string
  city: string
  country: string
  iban: string
  /** Titulaire du compte (page de règlement) ; colonne `bank_account_holder`. */
  account_holder: string
  bic: string
  email: string
}

const DEFAULT_PAYMENT_TERMS =
  "Paiement par virement bancaire sous 30 jours.\nPénalités de retard : 3 fois le taux d'intérêt légal en vigueur."

const EMPTY: CompanyFields = {
  name: "", siren: "", siret: "", vat_number: "",
  address: "", zip_code: "", city: "", country: "FR",
  iban: "", account_holder: "", bic: "", email: "",
}

const FORM_ID = "company-form"

const demoToast = () =>
  toast("Créez un compte pour enregistrer vos informations", {
    action: { label: "S'inscrire", onClick: () => { window.location.href = "/signup" } },
  })

export function CompanySettingsForm({
  mode = "app",
  initial,
}: {
  mode?: ShellMode
  /** Démo : valeurs affichées (aucune lecture en base). */
  initial?: Partial<CompanyFields> & { logo_url?: string | null }
}) {
  const demo = mode === "demo"
  const start: CompanyFields = { ...EMPTY, ...(initial ?? {}) }

  const [loading, setLoading]       = useState(!demo)
  const [saving, setSaving]         = useState(false)
  const [companyId, setCompanyId]   = useState<string | null>(demo ? "demo" : null)
  const [fields, setFields]         = useState<CompanyFields>(start)
  const [saved, setSaved]           = useState<CompanyFields>(start)   // copie au dernier enregistrement / chargement
  const [errors, setErrors]         = useState<Partial<Record<keyof CompanyFields, string>>>({})
  const [loadedLogo, setLoadedLogo] = useState<string | null>(initial?.logo_url ?? null)
  // Titulaire et BIC : colonnes ajoutées par la migration du lien de paiement. Tant
  // qu'elles n'existent pas, les champs sont masqués et jamais envoyés.
  const [bankExtras, setBankExtras] = useState(demo)

  const [sirenSearch, setSirenSearch]   = useState("")
  const [sirenLoading, setSirenLoading] = useState(false)
  const [sirenFound, setSirenFound]     = useState(false)

  const logo = useCompanyLogo({ mode, initialUrl: loadedLogo })

  const isDirty = JSON.stringify(fields) !== JSON.stringify(saved)

  /* ───────────────────────────── Chargement ───────────────────── */
  useEffect(() => {
    if (demo) return
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return }

      const { data: company, error } = await supabase
        .from("companies")
        .select("*")
        .eq("user_id", user.id)
        .single()

      if (error && error.code !== "PGRST116") {
        toast.error("Impossible de charger les informations de l'entreprise")
        setLoading(false)
        return
      }

      if (company) {
        const loaded: CompanyFields = {
          name:       company.name       ?? "",
          siren:      company.siren      ?? "",
          siret:      company.siret      ?? "",
          vat_number: company.vat_number ?? "",
          address:    company.address    ?? "",
          zip_code:   company.zip_code   ?? "",
          city:       company.city       ?? "",
          country:    company.country    ?? "FR",
          iban:       company.iban ? formatIbanGroups(company.iban) : "",
          account_holder: company.bank_account_holder ?? "",
          bic:        company.bic        ?? "",
          // Si pas d'email entreprise enregistré, pré-remplir avec l'email de connexion
          email:      company.email      ?? user.email ?? "",
        }
        setFields(loaded)
        setSaved(loaded)
        setCompanyId(company.id)
        setLoadedLogo(company.logo_url ?? null)
        setBankExtras("bic" in company && "bank_account_holder" in company)
      }
      setLoading(false)
    })
  }, [demo])

  /* ──────────────────── Helpers champs contrôlés ─────────────── */
  const set = (key: keyof CompanyFields) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFields(prev => ({ ...prev, [key]: e.target.value }))
    // effacer l'erreur dès que l'utilisateur modifie le champ
    if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n })
  }

  /* ─────────────────── Recherche SIREN (INSEE) ─────────────────── */
  const lookupSiren = async () => {
    if (sirenSearch.length !== 9) { toast.error("Le SIREN doit faire 9 chiffres"); return }
    if (demo) { demoToast(); return }
    setSirenLoading(true); setSirenFound(false)
    try {
      const res  = await fetch(`/api/sirene?siren=${sirenSearch}`)
      const json = await res.json().catch(() => null)
      // La route renvoie directement le résultat (name, siren, address…)
      const r = res.ok ? (json?.result ?? json) : null
      if (r?.name || r?.siren) {
        setFields(prev => ({
          ...prev,
          // `||` : une valeur vide renvoyée par l'INSEE n'efface pas ce qui est déjà saisi
          name:       r.name       || prev.name,
          siren:      r.siren      || prev.siren,
          siret:      r.siret      || prev.siret,
          address:    r.address    || prev.address,
          zip_code:   r.zip_code   || prev.zip_code,
          city:       r.city       || prev.city,
          vat_number: r.vat_number || prev.vat_number || sirenToVAT(sirenSearch),
        }))
        setErrors({})
        setSirenFound(true)
        if (r.closed) toast.warning(`${r.name || "Cette entreprise"} est indiquée comme fermée au répertoire Sirene. Vérifiez le numéro.`)
        else toast.success(`${r.name || "Entreprise"} trouvée`)
      } else if (res.status === 503) {
        toast.error("Le répertoire Sirene ne répond pas. Réessayez dans un instant.")
      } else {
        toast.error("SIREN introuvable au répertoire Sirene")
      }
    } catch { toast.error("Erreur lors de la recherche") }
    finally { setSirenLoading(false) }
  }

  /* ────────────────────────── Validation ──────────────────────── */
  function validate(f: CompanyFields): Partial<Record<keyof CompanyFields, string>> {
    const e: Partial<Record<keyof CompanyFields, string>> = {}
    const siren = f.siren.trim()
    if (!f.name.trim())                 e.name     = "Requis"
    if (!siren)                         e.siren    = "Requis"
    else if (!/^\d{9}$/.test(siren))    e.siren    = "9 chiffres exactement"
    else if (!isValidSiren(siren))      e.siren    = "SIREN invalide : vérifiez les 9 chiffres (clé de contrôle)"
    if (!f.address.trim())              e.address  = "Requis"
    if (!f.zip_code.trim())             e.zip_code = "Requis"
    if (!f.city.trim())                 e.city     = "Requis"
    const ibanErr = ibanError(f.iban)
    if (ibanErr)                        e.iban     = ibanErr
    const bicErr = bankExtras ? bicError(f.bic) : null
    if (bicErr)                         e.bic      = bicErr
    return e
  }

  /* ─────────────────────────── Enregistrement ─────────────────── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (demo) { demoToast(); return }
    const errs = validate(fields)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      toast.error("Certains champs sont à compléter")
      return
    }

    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error("Session expirée, veuillez vous reconnecter"); return }

      const payload = {
        user_id:    user.id,
        name:       fields.name.trim(),
        siren:      fields.siren.trim(),
        siret:      fields.siret.trim()      || null,
        vat_number: fields.vat_number.trim() || null,
        address:    fields.address.trim(),
        zip_code:   fields.zip_code.trim(),
        city:       fields.city.trim(),
        country:    fields.country           || "FR",
        iban:       normalizeIban(fields.iban) || null,
        email:      fields.email.trim()      || null,
        ...(bankExtras ? {
          bank_account_holder: fields.account_holder.trim() || null,
          bic:                 normalizeBic(fields.bic)     || null,
        } : {}),
      }

      let dbError
      if (companyId) {
        // Préfixe et conditions de paiement : réglés dans les modèles, laissés tels quels ici
        const { error } = await supabase
          .from("companies")
          .update(payload)
          .eq("id", companyId)
        dbError = error
      } else {
        const { data, error } = await supabase
          .from("companies")
          .upsert(
            { ...payload, invoice_prefix: "F", payment_terms: DEFAULT_PAYMENT_TERMS, invoice_sequence: 1 },
            { onConflict: "user_id" },
          )
          .select("id")
          .single()
        dbError = error
        if (!error && data) setCompanyId(data.id)
      }

      if (dbError) {
        console.error("Erreur sauvegarde:", dbError)
        toast.error(dbError.message || "Erreur lors de l'enregistrement")
        return
      }

      setSaved({ ...fields })
      toast.success("Informations enregistrées")
    } catch (err) {
      console.error(err)
      toast.error("Erreur réseau")
    } finally {
      setSaving(false)
    }
  }

  /* ───────────────────────────── UI ───────────────────────────── */
  const year = new Date().getFullYear()
  const sirenTrim = fields.siren.trim()
  const sirenOk = !demo && !errors.siren && /^\d{9}$/.test(sirenTrim) && isValidSiren(sirenTrim)
  const suggestedVat = /^\d{9}$/.test(sirenTrim) ? sirenToVAT(sirenTrim) : null

  return (
    <>
      <PageHeader
        title="Entreprise"
        subtitle="Identité, TVA et coordonnées bancaires"
        backHref={settingsHref("/settings", mode)}
        backLabel="Paramètres"
        actions={
          <>
            {isDirty && <DirtyHint className="hidden lg:inline-flex" />}
            <SaveButton form={FORM_ID} saving={saving} disabled={loading || !isDirty} />
          </>
        }
      />

      {loading ? (
        <div className="q-card flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-[var(--q-accent)]" aria-label="Chargement" />
        </div>
      ) : (
        <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          {logo.input}

          {/* ── Logo ── */}
          <SettingsCard
            id="logo"
            title="Logo"
            description="Affiché en haut de vos devis, factures, avoirs et bons de commande."
          >
            <div className="grid items-stretch gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr))]">
              <LogoDropzone
                logo={logo}
                disabled={!companyId}
                disabledReason="Enregistrez d'abord votre entreprise, puis ajoutez votre logo."
              />
              <LogoDocPreview logo={logo.preview} companyName={fields.name} number={`D-${year}-001`} />
            </div>
          </SettingsCard>

          {/* ── Identité ── */}
          <SettingsCard id="identite" title="Identité" description="Ces informations figurent sur chaque document.">
            {/* Pré-remplissage depuis la base Sirene */}
            <div className="q-inset flex flex-col gap-3 p-3.5 md:flex-row md:items-center">
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <label htmlFor="siren-search" className="q-label">Remplir depuis le SIREN</label>
                <span className="q-field-hint">Base Sirene de l&apos;INSEE : raison sociale et n° de TVA complétés pour vous.</span>
              </span>
              <span className="flex gap-2">
                <input
                  id="siren-search"
                  className="q-input min-w-0 flex-1 font-mono md:w-[150px] md:flex-none"
                  inputMode="numeric"
                  placeholder="123456789"
                  value={sirenSearch}
                  onChange={e => setSirenSearch(e.target.value.replace(/\D/g, "").slice(0, 9))}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void lookupSiren() } }}
                  maxLength={9}
                />
                <button
                  type="button"
                  className="q-btn q-btn-secondary !h-[42px]"
                  onClick={() => void lookupSiren()}
                  disabled={sirenLoading || sirenSearch.length !== 9}
                >
                  {sirenLoading
                    ? <Loader2 className="animate-spin" aria-hidden />
                    : sirenFound
                      ? <CheckCircle2 className="text-[var(--q-ok)]" aria-hidden />
                      : <Search aria-hidden />}
                  Rechercher
                </button>
              </span>
            </div>

            <FieldGrid>
              <Field label="Raison sociale" htmlFor="name" error={errors.name}>
                <input id="name" className="q-input" placeholder="Mon Entreprise SARL" autoComplete="organization"
                  value={fields.name} onChange={set("name")} aria-invalid={!!errors.name} />
              </Field>
              <Field label="SIREN" htmlFor="siren" error={errors.siren} ok={sirenOk ? "Numéro valide" : undefined}>
                <input id="siren" className="q-input font-mono" placeholder="123456789" inputMode="numeric" maxLength={9}
                  value={fields.siren} onChange={set("siren")} aria-invalid={!!errors.siren} />
              </Field>
              <Field label="SIRET" htmlFor="siret" hint="Facultatif : 14 chiffres.">
                <input id="siret" className="q-input font-mono" placeholder="12345678900001" inputMode="numeric" maxLength={14}
                  value={fields.siret} onChange={set("siret")} />
              </Field>
            </FieldGrid>

            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.4fr)]">
              <Field label="Adresse" htmlFor="address" error={errors.address} className="col-span-2 sm:col-span-1">
                <input id="address" className="q-input" placeholder="10 rue de la Paix" autoComplete="street-address"
                  value={fields.address} onChange={set("address")} aria-invalid={!!errors.address} />
              </Field>
              <Field label="Code postal" htmlFor="zip_code" error={errors.zip_code}>
                <input id="zip_code" className="q-input" placeholder="75001" inputMode="numeric" autoComplete="postal-code"
                  value={fields.zip_code} onChange={set("zip_code")} aria-invalid={!!errors.zip_code} />
              </Field>
              <Field label="Ville" htmlFor="city" error={errors.city}>
                <input id="city" className="q-input" placeholder="Paris" autoComplete="address-level2"
                  value={fields.city} onChange={set("city")} aria-invalid={!!errors.city} />
              </Field>
            </div>

            <Field
              label="E-mail de l'entreprise"
              htmlFor="email"
              hint="Vos clients vous répondent à cette adresse, en copie de chaque envoi. Vide : l'adresse de votre compte est utilisée."
              className="sm:max-w-[calc(50%-6px)]"
            >
              <input id="email" type="email" className="q-input" placeholder="contact@monentreprise.fr" autoComplete="email"
                value={fields.email} onChange={set("email")} />
            </Field>
          </SettingsCard>

          {/* ── TVA ── */}
          <SettingsCard id="tva" title="TVA">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <Field
                label="N° de TVA intracommunautaire"
                htmlFor="vat_number"
                hint="Mentionné sur toutes vos factures. En franchise en base, laissez vide et ajoutez la mention de l'article 293 B du CGI dans vos modèles."
                className="flex-1 sm:max-w-[calc(50%-6px)]"
              >
                <input id="vat_number" className="q-input font-mono" placeholder="FR12123456789"
                  value={fields.vat_number} onChange={set("vat_number")} />
              </Field>
              {suggestedVat && !fields.vat_number.trim() && (
                <button
                  type="button"
                  className="q-btn q-btn-ghost sm:mt-[25px]"
                  onClick={() => setFields(prev => ({ ...prev, vat_number: suggestedVat }))}
                >
                  <Wand2 aria-hidden />
                  Calculer depuis le SIREN
                </button>
              )}
            </div>
          </SettingsCard>

          {/* ── Coordonnées bancaires ── */}
          <SettingsCard
            id="banque"
            title="Coordonnées bancaires"
            description={bankExtras
              ? "Sur vos factures et sur la page de règlement : vos clients vous paient par virement, sur votre compte."
              : undefined}
          >
            <Field
              label="IBAN"
              htmlFor="iban"
              error={errors.iban}
              hint="Affiché sous le total de vos factures : vos clients vous règlent par virement."
              className="sm:max-w-[calc(50%-6px)]"
            >
              <input id="iban" className="q-input font-mono" placeholder="FR76 3000 6000 0112 3456 7890 189" autoComplete="off"
                value={fields.iban} onChange={set("iban")} aria-invalid={!!errors.iban}
                onBlur={() => { if (fields.iban.trim() && !ibanError(fields.iban)) setFields(prev => ({ ...prev, iban: formatIbanGroups(prev.iban) })) }} />
            </Field>
            {bankExtras && (
              <FieldGrid>
                <Field
                  label="Titulaire du compte"
                  htmlFor="account_holder"
                  hint="Tel qu'il figure sur votre RIB. Vide : la raison sociale est utilisée."
                >
                  <input id="account_holder" className="q-input" placeholder={fields.name || "Mon Entreprise SARL"} autoComplete="off"
                    value={fields.account_holder} onChange={set("account_holder")} maxLength={70} />
                </Field>
                <Field label="BIC" htmlFor="bic" error={errors.bic} hint="Facultatif : 8 ou 11 caractères, sur votre RIB.">
                  <input id="bic" className="q-input font-mono" placeholder="BNPAFRPPXXX" autoComplete="off" maxLength={14}
                    value={fields.bic} onChange={set("bic")} aria-invalid={!!errors.bic} />
                </Field>
              </FieldGrid>
            )}
          </SettingsCard>

          <MobileSaveBar show={isDirty} form={FORM_ID} saving={saving} />
        </form>
      )}
    </>
  )
}
