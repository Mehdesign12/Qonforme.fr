'use client'

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Check, Loader2, Search } from "lucide-react"
import { isValidSiren, sirenToVAT } from "@/lib/utils/invoice"
import { trackEvent } from "@/lib/meta-pixel"
import { AUTH_INPUT, AuthSubmit, Field } from "@/components/auth/fields"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { legalProfileAvailable } from "@/lib/legal/db"
import { TRADES, VAT_REGIMES, isTradeId, type TradeId, type VatRegime } from "@/lib/legal/profile"

/** Liste déroulante : la flèche native reste visible (pas d'appearance:none). */
const AUTH_SELECT = "q-input !h-12 !rounded-xl !px-3.5 !text-base"

/** Carte de section (canevas « Onb-2-Entreprise ») : rayon 18, ombre portée douce. */
const CARD = "q-card !rounded-[18px] p-5 sm:p-6 shadow-[0_1px_2px_rgba(10,17,34,.04),0_12px_32px_-24px_rgba(10,17,34,.18)]"

type Fields = {
  siren: string
  name: string
  address: string
  zip_code: string
  city: string
  vat_number: string
  iban: string
}

function validate(f: Fields): Record<string, string> {
  const errs: Record<string, string> = {}
  if (!f.siren || !/^\d{9}$/.test(f.siren))
    errs.siren = "SIREN invalide (9 chiffres exactement)"
  if (!f.name || f.name.trim().length < 2)
    errs.name = "Raison sociale requise (2 caractères min.)"
  if (!f.address || f.address.trim().length < 5)
    errs.address = "Adresse requise"
  if (!f.zip_code || !/^\d{5}$/.test(f.zip_code))
    errs.zip_code = "Code postal invalide (5 chiffres)"
  if (!f.city || f.city.trim().length < 2)
    errs.city = "Ville requise"
  return errs
}

export default function CompanyForm() {
  const router = useRouter()
  const [loading, setLoading]     = useState(false)
  const [sirenLoading, setSirenLoading] = useState(false)
  const [errors, setErrors]       = useState<Record<string, string>>({})

  const [fields, setFields] = useState<Fields>({
    siren: "",
    name: "",
    address: "",
    zip_code: "",
    city: "",
    vat_number: "",
    iban: "",
  })

  // Métier et régime de TVA (profil légal) : proposés seulement si la colonne
  // `legal_profile` existe (migration 20261003_legal_profile_btp.sql)
  const [profileOn, setProfileOn] = useState(false)
  const [trade, setTrade] = useState<TradeId | "">("")
  const [vatRegime, setVatRegime] = useState<VatRegime | "">("")
  useEffect(() => {
    legalProfileAvailable(createClient()).then(setProfileOn, () => setProfileOn(false))
  }, [])

  const set = (key: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFields(prev => ({ ...prev, [key]: e.target.value }))
    if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n })
  }

  const searchSiren = async () => {
    const siren = fields.siren.trim()
    if (!siren || siren.length !== 9) { toast.error("Saisissez un SIREN valide à 9 chiffres"); return }
    if (!isValidSiren(siren)) { toast.error("SIREN invalide (algorithme de Luhn)"); return }
    setSirenLoading(true)
    try {
      const res = await fetch(`/api/sirene?siren=${siren}`)
      if (res.status === 503) {
        toast.error("Le répertoire Sirene ne répond pas. Réessayez dans un instant ou remplissez les champs à la main.")
        return
      }
      if (!res.ok) throw new Error()
      const data = await res.json()
      setFields(prev => ({
        ...prev,
        name:       data.name       || prev.name,
        address:    data.address    || prev.address,
        zip_code:   data.zip_code   || prev.zip_code,
        city:       data.city       || prev.city,
        vat_number: sirenToVAT(siren),
      }))
      setErrors(prev => {
        const n = { ...prev }
        if (data.name)     delete n.name
        if (data.address)  delete n.address
        if (data.zip_code) delete n.zip_code
        if (data.city)     delete n.city
        return n
      })
      if (data.closed) toast.warning("Cette entreprise est indiquée comme fermée au répertoire Sirene. Vérifiez le numéro.")
      else toast.success("Entreprise trouvée : formulaire pré-rempli.")
    } catch {
      toast.error("Entreprise introuvable. Remplissez les champs à la main.")
    } finally {
      setSirenLoading(false)
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate(fields)
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setLoading(true)
    try {
      // Les cookies de session sont envoyés automatiquement par le browser
      // après signInWithPassword — pas besoin de passer un Bearer token manuellement
      const res = await fetch("/api/company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siren:      fields.siren.trim(),
          name:       fields.name.trim(),
          address:    fields.address.trim(),
          zip_code:   fields.zip_code.trim(),
          city:       fields.city.trim(),
          vat_number: fields.vat_number.trim() || null,
          iban:       fields.iban.trim() || null,
          ...(profileOn && (trade || vatRegime)
            ? { legal_profile: { trade: trade || null, vat_regime: vatRegime || null } }
            : {}),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || "Erreur inconnue")
      }
      toast.success("Entreprise enregistrée.")
      trackEvent("CompleteRegistration", { currency: "EUR", value: 0 })
      router.push("/dashboard")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de la sauvegarde"
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  /** Contrôle de la clé de Luhn dès que les 9 chiffres sont saisis (indication seulement). */
  const sirenDigits = fields.siren.trim()
  const sirenChecked = /^\d{9}$/.test(sirenDigits)
  const sirenOk = sirenChecked && isValidSiren(sirenDigits)

  const input = (key: keyof Fields, extra?: string) => ({
    id: key,
    className: cn(AUTH_INPUT, extra),
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `${key}-error` : undefined,
    value: fields[key],
    onChange: set(key),
    disabled: loading,
  })

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>

      {/* ── Identité : SIREN puis ce que le répertoire Sirene remplit ── */}
      <section className={cn(CARD, "flex flex-col gap-[18px]")} aria-labelledby="company-identity">
        <h2 id="company-identity" className="sr-only">Identité de l’entreprise</h2>

        <Field
          id="siren"
          label="Numéro SIREN"
          error={errors.siren}
          hint={
            sirenOk
              ? <span className="q-field-ok"><Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden /> SIREN valide. « Rechercher » remplit le nom et l’adresse.</span>
              : sirenChecked
                ? <span className="text-q-danger">Ce numéro ne correspond à aucun SIREN : vérifiez les 9 chiffres.</span>
                : "Les 9 chiffres de votre avis de situation Sirene. « Rechercher » remplit le reste depuis l’INSEE."
          }
        >
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <input
                {...input("siren", "font-mono tracking-[0.04em] !pr-11")}
                placeholder="948211375"
                maxLength={9}
                autoComplete="off"
                inputMode="numeric"
              />
              {sirenOk && (
                <Check className="pointer-events-none absolute right-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-q-ok" strokeWidth={2.25} aria-hidden />
              )}
            </div>
            <button
              type="button"
              onClick={searchSiren}
              disabled={sirenLoading || loading}
              className="q-btn q-btn-secondary !h-12 shrink-0 !rounded-xl !px-4"
            >
              {sirenLoading
                ? <Loader2 className="animate-spin" aria-hidden />
                : <Search aria-hidden />
              }
              <span className="hidden sm:inline">Rechercher</span>
              <span className="sr-only sm:hidden">Rechercher par SIREN (INSEE)</span>
            </button>
          </div>
        </Field>

        <div className="h-px bg-q-line-soft" aria-hidden />

        <Field id="name" label="Raison sociale" error={errors.name}>
          <input {...input("name")} placeholder="Garnier Plâtrerie Isolation" autoComplete="organization" />
        </Field>

        <Field id="address" label="Adresse" error={errors.address}>
          <input {...input("address")} placeholder="14 rue des Lices" autoComplete="street-address" />
        </Field>

        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3">
          <Field id="zip_code" label="Code postal" error={errors.zip_code}>
            <input {...input("zip_code")} placeholder="49100" maxLength={5} inputMode="numeric" autoComplete="postal-code" />
          </Field>
          <Field id="city" label="Ville" error={errors.city}>
            <input {...input("city")} placeholder="Angers" autoComplete="address-level2" />
          </Field>
        </div>

        {profileOn && (
          <Field
            id="trade"
            label={<>Métier principal <span className="font-normal text-q-text-4">(facultatif)</span></>}
            hint="Votre catalogue vous proposera les prestations courantes de ce métier, prix à compléter."
          >
            <select
              id="trade"
              className={AUTH_SELECT}
              value={trade}
              disabled={loading}
              onChange={(e) => setTrade(isTradeId(e.target.value) ? e.target.value : "")}
            >
              <option value="">Choisir un métier</option>
              {TRADES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </Field>
        )}
      </section>

      {/* ── TVA et paiement ── */}
      <section className={cn(CARD, "flex flex-col gap-[18px]")} aria-labelledby="company-payment">
        <div>
          <h2 id="company-payment" className="m-0 text-[17px] font-semibold text-q-ink">TVA et paiement</h2>
          <p className="mt-1 text-[14px] text-q-text-3">Repris sur vos devis et vos factures. Modifiables ensuite dans les paramètres.</p>
        </div>

        {profileOn && (
          <Field
            id="vat_regime"
            label={<>Régime de TVA <span className="font-normal text-q-text-4">(facultatif)</span></>}
            hint={vatRegime === "franchise"
              ? "« TVA non applicable, art. 293 B du CGI » sera ajoutée d'office à vos documents."
              : "Vos assurances et votre statut se complètent ensuite dans Paramètres › Entreprise."}
          >
            <select
              id="vat_regime"
              className={AUTH_SELECT}
              value={vatRegime}
              disabled={loading}
              onChange={(e) => setVatRegime(e.target.value === "franchise" || e.target.value === "assujetti" ? e.target.value : "")}
            >
              <option value="">Choisir</option>
              {VAT_REGIMES.map((r) => <option key={r.id} value={r.id}>{r.id === "franchise" ? "Franchise en base (pas de TVA facturée)" : r.label}</option>)}
            </select>
          </Field>
        )}

        <Field
          id="vat_number"
          label={<>N° de TVA intracommunautaire <span className="font-normal text-q-text-4">(facultatif)</span></>}
        >
          <input {...input("vat_number", "font-mono")} placeholder="FR32948211375" autoComplete="off" />
        </Field>

        <Field
          id="iban"
          label={<>IBAN <span className="font-normal text-q-text-4">(facultatif)</span></>}
          hint="Affiché sur vos factures pour que vos clients vous paient par virement."
        >
          <input {...input("iban", "font-mono")} placeholder="FR76 3000 1007 9412 3456 7890 185" autoComplete="off" />
        </Field>
      </section>

      <div className="flex justify-end pt-1">
        <AuthSubmit loading={loading} loadingLabel="Enregistrement…" className="sm:w-auto">
          Accéder à mon espace
        </AuthSubmit>
      </div>
    </form>
  )
}
