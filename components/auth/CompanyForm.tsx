'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { isValidSiren, sirenToVAT } from "@/lib/utils/invoice"
import { createClient } from "@/lib/supabase/client"

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
  const [loading, setLoading] = useState(false)
  const [sirenLoading, setSirenLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

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
    if (!siren || siren.length !== 9) {
      toast.error("Entre un SIREN valide à 9 chiffres")
      return
    }
    if (!isValidSiren(siren)) {
      toast.error("SIREN invalide (algorithme de Luhn)")
      return
    }
    setSirenLoading(true)
    try {
      const res = await fetch(`/api/sirene?siren=${siren}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setFields(prev => ({
        ...prev,
        name: data.name || prev.name,
        address: data.address || prev.address,
        zip_code: data.zip_code || prev.zip_code,
        city: data.city || prev.city,
        vat_number: sirenToVAT(siren),
      }))
      // Effacer les erreurs des champs pré-remplis
      setErrors(prev => {
        const n = { ...prev }
        if (data.name) delete n.name
        if (data.address) delete n.address
        if (data.zip_code) delete n.zip_code
        if (data.city) delete n.city
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
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    setLoading(true)
    try {
      // Récupérer le token de session (disponible côté client juste après signUp)
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
          siren: fields.siren.trim(),
          name: fields.name.trim(),
          address: fields.address.trim(),
          zip_code: fields.zip_code.trim(),
          city: fields.city.trim(),
          vat_number: fields.vat_number.trim() || null,
          iban: fields.iban.trim() || null,
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
        <Label htmlFor="siren">SIREN</Label>
        <div className="flex gap-2 mt-1">
          <Input
            id="siren"
            placeholder="123456789"
            maxLength={9}
            className="font-mono"
            value={fields.siren}
            onChange={set("siren")}
            autoComplete="off"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={searchSiren}
            disabled={sirenLoading}
            title="Rechercher par SIREN (INSEE)"
          >
            {sirenLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>
        {errors.siren && <p className="text-xs text-red-500 mt-1">{errors.siren}</p>}
        <p className="text-xs text-slate-400 mt-1">Clique sur 🔍 pour pré-remplir automatiquement</p>
      </div>

      {/* Raison sociale */}
      <div>
        <Label htmlFor="name">Raison sociale</Label>
        <Input
          id="name"
          placeholder="Mon Entreprise SARL"
          className="mt-1"
          value={fields.name}
          onChange={set("name")}
          autoComplete="organization"
        />
        {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
      </div>

      {/* Adresse */}
      <div>
        <Label htmlFor="address">Adresse</Label>
        <Input
          id="address"
          placeholder="12 rue de la Paix"
          className="mt-1"
          value={fields.address}
          onChange={set("address")}
          autoComplete="street-address"
        />
        {errors.address && <p className="text-xs text-red-500 mt-1">{errors.address}</p>}
      </div>

      {/* Code postal + Ville */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="zip_code">Code postal</Label>
          <Input
            id="zip_code"
            placeholder="75001"
            maxLength={5}
            className="mt-1 font-mono"
            value={fields.zip_code}
            onChange={set("zip_code")}
            autoComplete="postal-code"
          />
          {errors.zip_code && <p className="text-xs text-red-500 mt-1">{errors.zip_code}</p>}
        </div>
        <div>
          <Label htmlFor="city">Ville</Label>
          <Input
            id="city"
            placeholder="Paris"
            className="mt-1"
            value={fields.city}
            onChange={set("city")}
            autoComplete="address-level2"
          />
          {errors.city && <p className="text-xs text-red-500 mt-1">{errors.city}</p>}
        </div>
      </div>

      {/* TVA */}
      <div>
        <Label htmlFor="vat_number">
          Numéro de TVA intracommunautaire{" "}
          <span className="text-slate-400 font-normal">(optionnel)</span>
        </Label>
        <Input
          id="vat_number"
          placeholder="FR12345678901"
          className="mt-1 font-mono"
          value={fields.vat_number}
          onChange={set("vat_number")}
          autoComplete="off"
        />
      </div>

      {/* IBAN */}
      <div>
        <Label htmlFor="iban">
          IBAN{" "}
          <span className="text-slate-400 font-normal">(pour les mentions de paiement)</span>
        </Label>
        <Input
          id="iban"
          placeholder="FR76 3000 1007 9412 3456 7890 185"
          className="mt-1 font-mono text-sm"
          value={fields.iban}
          onChange={set("iban")}
          autoComplete="off"
        />
      </div>

      <Button
        type="submit"
        className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white mt-2"
        disabled={loading}
      >
        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Accéder à mon espace →
      </Button>
    </form>
  )
}
