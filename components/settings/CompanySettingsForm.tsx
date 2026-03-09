'use client'

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Loader2, Search, CheckCircle2, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { createClient } from "@/lib/supabase/client"

interface FormData {
  name: string
  siren: string
  siret: string
  vat_number: string
  address: string
  zip_code: string
  city: string
  country: string
  iban: string
  invoice_prefix: string
  payment_terms: string
}

const DEFAULT_PAYMENT_TERMS =
  "Paiement par virement bancaire sous 30 jours.\nPénalités de retard : 3 fois le taux d'intérêt légal en vigueur."

const EMPTY: FormData = {
  name: "", siren: "", siret: "", vat_number: "",
  address: "", zip_code: "", city: "", country: "FR",
  iban: "", invoice_prefix: "F", payment_terms: DEFAULT_PAYMENT_TERMS,
}

export function CompanySettingsForm() {
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [companyId, setCompanyId]   = useState<string | null>(null)
  const [fields, setFields]         = useState<FormData>(EMPTY)
  const [saved, setSaved]           = useState<FormData>(EMPTY)   // copie au dernier save/load
  const [errors, setErrors]         = useState<Partial<Record<keyof FormData, string>>>({})

  const [sirenSearch, setSirenSearch]   = useState("")
  const [sirenLoading, setSirenLoading] = useState(false)
  const [sirenFound, setSirenFound]     = useState(false)

  const isDirty = JSON.stringify(fields) !== JSON.stringify(saved)

  /* ───────────────────────────── Chargement ───────────────────── */
  useEffect(() => {
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
        const loaded: FormData = {
          name:           company.name           ?? "",
          siren:          company.siren          ?? "",
          siret:          company.siret          ?? "",
          vat_number:     company.vat_number     ?? "",
          address:        company.address        ?? "",
          zip_code:       company.zip_code       ?? "",
          city:           company.city           ?? "",
          country:        company.country        ?? "FR",
          iban:           company.iban           ?? "",
          invoice_prefix: company.invoice_prefix ?? "F",
          payment_terms:  company.payment_terms  ?? DEFAULT_PAYMENT_TERMS,
        }
        setFields(loaded)
        setSaved(loaded)
        setCompanyId(company.id)
      }
      setLoading(false)
    })
  }, [])

  /* ──────────────────── Helpers champs contrôlés ─────────────── */
  const set = (key: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFields(prev => ({ ...prev, [key]: e.target.value }))
    // effacer l'erreur dès que l'utilisateur modifie le champ
    if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n })
  }

  /* ─────────────────── Lookup SIREN INSEE ─────────────────────── */
  const lookupSiren = async () => {
    if (sirenSearch.length !== 9) { toast.error("Le SIREN doit faire 9 chiffres"); return }
    setSirenLoading(true); setSirenFound(false)
    try {
      const res  = await fetch(`/api/sirene?siren=${sirenSearch}`)
      const json = await res.json()
      if (json.result) {
        const r = json.result
        setFields(prev => ({
          ...prev,
          name:       r.name        ?? prev.name,
          siren:      r.siren       ?? prev.siren,
          address:    r.address     ?? prev.address,
          zip_code:   r.zip_code    ?? prev.zip_code,
          city:       r.city        ?? prev.city,
          vat_number: r.vat_number  ?? prev.vat_number,
        }))
        setErrors({})
        setSirenFound(true)
        toast.success(`${r.name} trouvé`)
      } else {
        toast.error("SIREN introuvable dans la base INSEE")
      }
    } catch { toast.error("Erreur lors de la recherche") }
    finally { setSirenLoading(false) }
  }

  /* ────────────────────────── Validation ──────────────────────── */
  function validate(f: FormData): Partial<Record<keyof FormData, string>> {
    const e: Partial<Record<keyof FormData, string>> = {}
    if (!f.name.trim())                              e.name     = "Requis"
    if (!f.siren.trim())                             e.siren    = "Requis"
    else if (!/^\d{9}$/.test(f.siren.trim()))        e.siren    = "9 chiffres exactement"
    if (!f.address.trim())                           e.address  = "Requis"
    if (!f.zip_code.trim())                          e.zip_code = "Requis"
    if (!f.city.trim())                              e.city     = "Requis"
    return e
  }

  /* ─────────────────────────── Sauvegarde ─────────────────────── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate(fields)
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error("Session expirée, veuillez vous reconnecter"); return }

      const payload = {
        user_id:        user.id,
        name:           fields.name.trim(),
        siren:          fields.siren.trim(),
        siret:          fields.siret.trim()      || null,
        vat_number:     fields.vat_number.trim() || null,
        address:        fields.address.trim(),
        zip_code:       fields.zip_code.trim(),
        city:           fields.city.trim(),
        country:        fields.country           || "FR",
        iban:           fields.iban.trim()       || null,
        invoice_prefix: fields.invoice_prefix    || "F",
        payment_terms:  fields.payment_terms     || null,
      }

      let dbError
      if (companyId) {
        const { error } = await supabase
          .from("companies")
          .update(payload)
          .eq("id", companyId)
        dbError = error
      } else {
        const { data, error } = await supabase
          .from("companies")
          .upsert({ ...payload, invoice_sequence: 1 }, { onConflict: "user_id" })
          .select("id")
          .single()
        dbError = error
        if (!error && data) setCompanyId(data.id)
      }

      if (dbError) {
        console.error("Erreur sauvegarde:", dbError)
        toast.error(dbError.message || "Erreur lors de la sauvegarde")
        return
      }

      setSaved({ ...fields })
      toast.success("Informations sauvegardées ✓")
    } catch (err) {
      console.error(err)
      toast.error("Erreur réseau")
    } finally {
      setSaving(false)
    }
  }

  /* ───────────────────────────── UI ───────────────────────────── */
  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 text-[#2563EB] animate-spin" />
    </div>
  )

  const currentYear  = new Date().getFullYear()
  const exampleNumber = `${fields.invoice_prefix || "F"}-${currentYear}-001`

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Recherche SIREN auto-fill */}
      <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="w-4 h-4 text-[#2563EB]" />
          <p className="text-sm font-medium text-[#1E40AF]">Pré-remplissage automatique par SIREN</p>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Ex: 123456789"
            value={sirenSearch}
            onChange={e => setSirenSearch(e.target.value.replace(/\D/g, "").slice(0, 9))}
            className="font-mono bg-white max-w-48"
            maxLength={9}
          />
          <Button
            type="button"
            variant="outline"
            onClick={lookupSiren}
            disabled={sirenLoading || sirenSearch.length !== 9}
            className="gap-1.5 shrink-0"
          >
            {sirenLoading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : sirenFound
                ? <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                : <Search className="w-4 h-4" />}
            Rechercher
          </Button>
        </div>
        <p className="text-xs text-[#3B82F6] mt-2">Pré-remplit automatiquement via la base INSEE Sirene</p>
      </div>

      {/* Identité juridique */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 space-y-4 shadow-sm">
        <h2 className="text-sm font-semibold text-[#0F172A]">Identité juridique</h2>

        <div>
          <Label htmlFor="name">Raison sociale *</Label>
          <Input
            id="name"
            placeholder="Mon Entreprise SARL"
            className="mt-1"
            value={fields.name}
            onChange={set("name")}
          />
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="siren">SIREN *</Label>
            <Input
              id="siren"
              placeholder="123456789"
              className="mt-1 font-mono"
              maxLength={9}
              value={fields.siren}
              onChange={set("siren")}
            />
            {errors.siren && <p className="text-xs text-red-500 mt-1">{errors.siren}</p>}
          </div>
          <div>
            <Label htmlFor="siret">SIRET</Label>
            <Input
              id="siret"
              placeholder="12345678900001"
              className="mt-1 font-mono"
              maxLength={14}
              value={fields.siret}
              onChange={set("siret")}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="vat_number">N° TVA intracommunautaire</Label>
          <Input
            id="vat_number"
            placeholder="FR12123456789"
            className="mt-1 font-mono"
            value={fields.vat_number}
            onChange={set("vat_number")}
          />
          <p className="text-xs text-slate-400 mt-1">Mentionné obligatoirement sur toutes les factures</p>
        </div>
      </div>

      {/* Adresse */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 space-y-4 shadow-sm">
        <h2 className="text-sm font-semibold text-[#0F172A]">Adresse du siège social</h2>

        <div>
          <Label htmlFor="address">Adresse *</Label>
          <Input
            id="address"
            placeholder="10 rue de la Paix"
            className="mt-1"
            value={fields.address}
            onChange={set("address")}
          />
          {errors.address && <p className="text-xs text-red-500 mt-1">{errors.address}</p>}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="zip_code">Code postal *</Label>
            <Input
              id="zip_code"
              placeholder="75001"
              className="mt-1 font-mono"
              value={fields.zip_code}
              onChange={set("zip_code")}
            />
            {errors.zip_code && <p className="text-xs text-red-500 mt-1">{errors.zip_code}</p>}
          </div>
          <div className="col-span-2">
            <Label htmlFor="city">Ville *</Label>
            <Input
              id="city"
              placeholder="Paris"
              className="mt-1"
              value={fields.city}
              onChange={set("city")}
            />
            {errors.city && <p className="text-xs text-red-500 mt-1">{errors.city}</p>}
          </div>
        </div>
      </div>

      {/* Coordonnées bancaires */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 space-y-4 shadow-sm">
        <h2 className="text-sm font-semibold text-[#0F172A]">Coordonnées bancaires</h2>
        <div>
          <Label htmlFor="iban">IBAN</Label>
          <Input
            id="iban"
            placeholder="FR76 3000 6000 0112 3456 7890 189"
            className="mt-1 font-mono text-sm"
            value={fields.iban}
            onChange={set("iban")}
          />
          <p className="text-xs text-slate-400 mt-1">Affiché dans les conditions de paiement sur vos factures</p>
        </div>
      </div>

      {/* Numérotation */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 space-y-4 shadow-sm">
        <h2 className="text-sm font-semibold text-[#0F172A]">Numérotation des factures</h2>
        <div className="grid grid-cols-2 gap-4 items-end">
          <div>
            <Label htmlFor="invoice_prefix">Préfixe</Label>
            <Input
              id="invoice_prefix"
              placeholder="F"
              className="mt-1 font-mono uppercase"
              maxLength={5}
              value={fields.invoice_prefix}
              onChange={set("invoice_prefix")}
            />
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Aperçu</p>
            <div className="px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg font-mono text-sm text-slate-600">
              {exampleNumber}
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-400">
          Le numéro est généré automatiquement : {exampleNumber}, {fields.invoice_prefix || "F"}-{currentYear}-002…
        </p>
      </div>

      {/* Conditions de paiement */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 space-y-3 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold text-[#0F172A]">Conditions de paiement par défaut</h2>
          <p className="text-xs text-slate-400 mt-0.5">Pré-remplies dans chaque nouvelle facture</p>
        </div>
        <textarea
          rows={3}
          value={fields.payment_terms}
          onChange={set("payment_terms")}
          className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#2563EB] text-slate-600"
          placeholder="Paiement par virement bancaire sous 30 jours..."
        />
      </div>

      <Separator />

      {/* Actions */}
      <div className="flex items-center justify-between">
        {isDirty && (
          <p className="text-xs text-[#D97706] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-[#D97706] rounded-full inline-block" />
            Modifications non sauvegardées
          </p>
        )}
        <Button
          type="submit"
          className="ml-auto bg-[#2563EB] hover:bg-[#1D4ED8] text-white gap-2"
          disabled={saving || !isDirty}
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? "Sauvegarde…" : "Sauvegarder les modifications"}
        </Button>
      </div>
    </form>
  )
}
