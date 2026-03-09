'use client'

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { Loader2, Search, CheckCircle2, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { createClient } from "@/lib/supabase/client"

interface CompanyForm {
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
  email: string
}

interface SireneResult {
  siren: string
  name: string
  address: string
  zip_code: string
  city: string
  vat_number?: string
}

export function CompanySettingsForm() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasCompany, setHasCompany] = useState(false)
  const [sirenSearch, setSirenSearch] = useState("")
  const [sirenLoading, setSirenLoading] = useState(false)
  const [sirenFound, setSirenFound] = useState(false)

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isDirty } } = useForm<CompanyForm>({
    defaultValues: {
      name: "", siren: "", siret: "", vat_number: "",
      address: "", zip_code: "", city: "", country: "FR",
      iban: "", invoice_prefix: "F", email: "",
      payment_terms: "Paiement par virement bancaire sous 30 jours.\nPénalités de retard : 3 fois le taux d'intérêt légal en vigueur.",
    },
  })

  const invoicePrefix = watch("invoice_prefix")

  /* Chargement des données — directement via le client Supabase browser */
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
        console.error("Erreur chargement entreprise:", error)
        toast.error("Impossible de charger les informations de l'entreprise")
        setLoading(false)
        return
      }

      if (company) {
        reset({
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
          email:          company.email          ?? "",
          payment_terms:  company.payment_terms  ?? "Paiement par virement bancaire sous 30 jours.\nPénalités de retard : 3 fois le taux d'intérêt légal en vigueur.",
        })
        setHasCompany(true)
      }
      setLoading(false)
    })
  }, [reset])

  /* Lookup SIREN INSEE */
  const lookupSiren = async () => {
    if (sirenSearch.length !== 9) { toast.error("Le SIREN doit faire 9 chiffres"); return }
    setSirenLoading(true); setSirenFound(false)
    try {
      const res = await fetch(`/api/sirene?siren=${sirenSearch}`)
      const json = await res.json()
      if (json.result) {
        const r: SireneResult = json.result
        setValue("name", r.name, { shouldDirty: true })
        setValue("siren", r.siren, { shouldDirty: true })
        setValue("address", r.address ?? "", { shouldDirty: true })
        setValue("zip_code", r.zip_code ?? "", { shouldDirty: true })
        setValue("city", r.city ?? "", { shouldDirty: true })
        if (r.vat_number) setValue("vat_number", r.vat_number, { shouldDirty: true })
        setSirenFound(true)
        toast.success(`${r.name} trouvé`)
      } else {
        toast.error("SIREN introuvable dans la base INSEE")
      }
    } catch { toast.error("Erreur lors de la recherche") }
    finally { setSirenLoading(false) }
  }

  /* Sauvegarde */
  const onSubmit = async (data: CompanyForm) => {
    setSaving(true)
    try {
      const method = hasCompany ? "PATCH" : "POST"
      const res = await fetch("/api/company", {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error || "Erreur lors de la sauvegarde"); return }
      setHasCompany(true)
      reset(data) // réinitialise isDirty
      toast.success("Informations sauvegardées ✓")
    } catch { toast.error("Erreur réseau") }
    finally { setSaving(false) }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 text-[#2563EB] animate-spin" />
    </div>
  )

  const currentYear = new Date().getFullYear()
  const exampleNumber = `${invoicePrefix || "F"}-${currentYear}-001`

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

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
            type="button" variant="outline"
            onClick={lookupSiren}
            disabled={sirenLoading || sirenSearch.length !== 9}
            className="gap-1.5 shrink-0"
          >
            {sirenLoading ? <Loader2 className="w-4 h-4 animate-spin" /> :
              sirenFound ? <CheckCircle2 className="w-4 h-4 text-[#10B981]" /> :
                <Search className="w-4 h-4" />}
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
          <Input id="name" placeholder="Mon Entreprise SARL" className="mt-1" {...register("name", { required: "Requis" })} />
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="siren">SIREN *</Label>
            <Input id="siren" placeholder="123456789" className="mt-1 font-mono" maxLength={9}
              {...register("siren", { required: "Requis", pattern: { value: /^\d{9}$/, message: "9 chiffres" } })} />
            {errors.siren && <p className="text-xs text-red-500 mt-1">{errors.siren.message}</p>}
          </div>
          <div>
            <Label htmlFor="siret">SIRET</Label>
            <Input id="siret" placeholder="12345678900001" className="mt-1 font-mono" maxLength={14} {...register("siret")} />
          </div>
        </div>

        <div>
          <Label htmlFor="vat_number">N° TVA intracommunautaire</Label>
          <Input id="vat_number" placeholder="FR12123456789" className="mt-1 font-mono" {...register("vat_number")} />
          <p className="text-xs text-slate-400 mt-1">Mentionné obligatoirement sur toutes les factures</p>
        </div>
      </div>

      {/* Adresse */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 space-y-4 shadow-sm">
        <h2 className="text-sm font-semibold text-[#0F172A]">Adresse du siège social</h2>

        <div>
          <Label htmlFor="address">Adresse *</Label>
          <Input id="address" placeholder="10 rue de la Paix" className="mt-1" {...register("address", { required: "Requis" })} />
          {errors.address && <p className="text-xs text-red-500 mt-1">{errors.address.message}</p>}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="zip_code">Code postal *</Label>
            <Input id="zip_code" placeholder="75001" className="mt-1 font-mono" {...register("zip_code", { required: "Requis" })} />
            {errors.zip_code && <p className="text-xs text-red-500 mt-1">{errors.zip_code.message}</p>}
          </div>
          <div className="col-span-2">
            <Label htmlFor="city">Ville *</Label>
            <Input id="city" placeholder="Paris" className="mt-1" {...register("city", { required: "Requis" })} />
            {errors.city && <p className="text-xs text-red-500 mt-1">{errors.city.message}</p>}
          </div>
        </div>
      </div>

      {/* Email de contact */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 space-y-4 shadow-sm">
        <h2 className="text-sm font-semibold text-[#0F172A]">Contact & envois</h2>
        <div>
          <Label htmlFor="email">Email professionnel</Label>
          <Input
            id="email"
            type="email"
            placeholder="contact@monentreprise.fr"
            className="mt-1"
            {...register("email")}
          />
          <p className="text-xs text-slate-400 mt-1">
            Utilisé comme expéditeur et copie CC sur les emails envoyés à vos clients
          </p>
        </div>
      </div>

      {/* Coordonnées bancaires */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 space-y-4 shadow-sm">
        <h2 className="text-sm font-semibold text-[#0F172A]">Coordonnées bancaires</h2>
        <div>
          <Label htmlFor="iban">IBAN</Label>
          <Input id="iban" placeholder="FR76 3000 6000 0112 3456 7890 189" className="mt-1 font-mono text-sm" {...register("iban")} />
          <p className="text-xs text-slate-400 mt-1">Affiché dans les conditions de paiement sur vos factures</p>
        </div>
      </div>

      {/* Numérotation */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 space-y-4 shadow-sm">
        <h2 className="text-sm font-semibold text-[#0F172A]">Numérotation des factures</h2>
        <div className="grid grid-cols-2 gap-4 items-end">
          <div>
            <Label htmlFor="invoice_prefix">Préfixe</Label>
            <Input id="invoice_prefix" placeholder="F" className="mt-1 font-mono uppercase" maxLength={5} {...register("invoice_prefix")} />
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Aperçu</p>
            <div className="px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg font-mono text-sm text-slate-600">
              {exampleNumber}
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-400">Le numéro est généré automatiquement : {exampleNumber}, {invoicePrefix || "F"}-{currentYear}-002…</p>
      </div>

      {/* Conditions de paiement par défaut */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 space-y-3 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold text-[#0F172A]">Conditions de paiement par défaut</h2>
          <p className="text-xs text-slate-400 mt-0.5">Pré-remplies dans chaque nouvelle facture</p>
        </div>
        <textarea
          {...register("payment_terms")}
          rows={3}
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
