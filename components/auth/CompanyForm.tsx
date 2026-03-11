'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Search } from "lucide-react"
import { isValidSiren, sirenToVAT } from "@/lib/utils/invoice"
import { createClient } from "@/lib/supabase/client"

/* ─── classes communes ──────────────────────────────────────────────────── */
const inputBase =
  "w-full h-11 rounded-[10px] border border-[#E2E8F0] bg-white px-3.5 text-sm text-[#0F172A] placeholder:text-slate-400 outline-none transition-all focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10 disabled:opacity-50"
const inputError =
  "border-red-400 focus:border-red-400 focus:ring-red-400/10"
const labelCls  = "block text-[13px] font-semibold text-[#0F172A] mb-1.5"
const btnPrimary =
  "w-full h-11 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-[0.98] text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"

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

  const set = (key: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFields(prev => ({ ...prev, [key]: e.target.value }))
    if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n })
  }

  const searchSiren = async () => {
    const siren = fields.siren.trim()
    if (!siren || siren.length !== 9) { toast.error("Entre un SIREN valide à 9 chiffres"); return }
    if (!isValidSiren(siren)) { toast.error("SIREN invalide (algorithme de Luhn)"); return }
    setSirenLoading(true)
    try {
      const res = await fetch(`/api/sirene?siren=${siren}`)
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
      toast.success("Entreprise trouvée et formulaire pré-rempli !")
    } catch {
      toast.error("Entreprise non trouvée. Remplis manuellement.")
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
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token
      if (!accessToken) {
        toast.error("Session expirée. Veuillez vous reconnecter.", { duration: 6000 })
        setLoading(false)
        return
      }
      const res = await fetch("/api/company", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          siren:      fields.siren.trim(),
          name:       fields.name.trim(),
          address:    fields.address.trim(),
          zip_code:   fields.zip_code.trim(),
          city:       fields.city.trim(),
          vat_number: fields.vat_number.trim() || null,
          iban:       fields.iban.trim() || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || "Erreur inconnue")
      }
      toast.success("Profil entreprise enregistré !")
      router.push("/pricing")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de la sauvegarde"
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>

      {/* SIREN */}
      <div>
        <label htmlFor="siren" className={labelCls}>Numéro SIREN</label>
        <div className="flex gap-2">
          <input
            id="siren"
            placeholder="123456789"
            maxLength={9}
            autoComplete="off"
            inputMode="numeric"
            className={`${inputBase} font-mono flex-1 ${errors.siren ? inputError : ""}`}
            value={fields.siren}
            onChange={set("siren")}
            disabled={loading}
          />
          <button
            type="button"
            onClick={searchSiren}
            disabled={sirenLoading || loading}
            title="Rechercher par SIREN (INSEE)"
            className="h-11 w-11 shrink-0 rounded-[10px] border border-[#E2E8F0] bg-white hover:bg-[#EFF6FF] hover:border-[#2563EB] transition-all flex items-center justify-center text-slate-400 hover:text-[#2563EB] disabled:opacity-50"
          >
            {sirenLoading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Search className="w-4 h-4" />
            }
          </button>
        </div>
        {errors.siren && <p className="text-xs text-red-500 mt-1.5">{errors.siren}</p>}
        <p className="text-xs text-slate-400 mt-1.5">
          Clique sur l&apos;icône 🔍 pour pré-remplir automatiquement depuis l&apos;INSEE
        </p>
      </div>

      {/* Raison sociale */}
      <div>
        <label htmlFor="name" className={labelCls}>Raison sociale</label>
        <input
          id="name"
          placeholder="Mon Entreprise SARL"
          autoComplete="organization"
          className={`${inputBase} ${errors.name ? inputError : ""}`}
          value={fields.name}
          onChange={set("name")}
          disabled={loading}
        />
        {errors.name && <p className="text-xs text-red-500 mt-1.5">{errors.name}</p>}
      </div>

      {/* Adresse */}
      <div>
        <label htmlFor="address" className={labelCls}>Adresse</label>
        <input
          id="address"
          placeholder="12 rue de la Paix"
          autoComplete="street-address"
          className={`${inputBase} ${errors.address ? inputError : ""}`}
          value={fields.address}
          onChange={set("address")}
          disabled={loading}
        />
        {errors.address && <p className="text-xs text-red-500 mt-1.5">{errors.address}</p>}
      </div>

      {/* Code postal + Ville */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="zip_code" className={labelCls}>Code postal</label>
          <input
            id="zip_code"
            placeholder="75001"
            maxLength={5}
            inputMode="numeric"
            autoComplete="postal-code"
            className={`${inputBase} font-mono ${errors.zip_code ? inputError : ""}`}
            value={fields.zip_code}
            onChange={set("zip_code")}
            disabled={loading}
          />
          {errors.zip_code && <p className="text-xs text-red-500 mt-1.5">{errors.zip_code}</p>}
        </div>
        <div>
          <label htmlFor="city" className={labelCls}>Ville</label>
          <input
            id="city"
            placeholder="Paris"
            autoComplete="address-level2"
            className={`${inputBase} ${errors.city ? inputError : ""}`}
            value={fields.city}
            onChange={set("city")}
            disabled={loading}
          />
          {errors.city && <p className="text-xs text-red-500 mt-1.5">{errors.city}</p>}
        </div>
      </div>

      {/* TVA */}
      <div>
        <label htmlFor="vat_number" className={labelCls}>
          N° de TVA intracommunautaire{" "}
          <span className="text-slate-400 font-normal">(optionnel)</span>
        </label>
        <input
          id="vat_number"
          placeholder="FR12345678901"
          autoComplete="off"
          className={`${inputBase} font-mono`}
          value={fields.vat_number}
          onChange={set("vat_number")}
          disabled={loading}
        />
      </div>

      {/* IBAN */}
      <div>
        <label htmlFor="iban" className={labelCls}>
          IBAN{" "}
          <span className="text-slate-400 font-normal">(pour les mentions de paiement)</span>
        </label>
        <input
          id="iban"
          placeholder="FR76 3000 1007 9412 3456 7890 185"
          autoComplete="off"
          className={`${inputBase} font-mono text-[13px]`}
          value={fields.iban}
          onChange={set("iban")}
          disabled={loading}
        />
      </div>

      <button type="submit" className={`${btnPrimary} mt-2`} disabled={loading}>
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {loading ? "Enregistrement…" : "Accéder à mon espace →"}
      </button>
    </form>
  )
}
