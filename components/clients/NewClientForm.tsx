'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Fields = {
  name: string
  siren: string
  vat_number: string
  email: string
  phone: string
  address: string
  zip_code: string
  city: string
}

function validate(f: Fields): Record<string, string> {
  const errs: Record<string, string> = {}
  if (!f.name || f.name.trim().length < 2)
    errs.name = "Raison sociale requise (2 caractères min.)"
  if (f.siren && !/^\d{9}$/.test(f.siren.trim()))
    errs.siren = "SIREN invalide (9 chiffres)"
  if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim()))
    errs.email = "Email invalide"
  return errs
}

export function NewClientForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [fields, setFields] = useState<Fields>({
    name: "",
    siren: "",
    vat_number: "",
    email: "",
    phone: "",
    address: "",
    zip_code: "",
    city: "",
  })

  const set = (key: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = key === "siren"
      ? e.target.value.replace(/\D/g, "").slice(0, 9)
      : e.target.value
    setFields(prev => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n })
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate(fields)
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setLoading(true)
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fields.name.trim(),
          siren: fields.siren.trim() || null,
          vat_number: fields.vat_number.trim() || null,
          email: fields.email.trim() || null,
          phone: fields.phone.trim() || null,
          address: fields.address.trim() || null,
          zip_code: fields.zip_code.trim() || null,
          city: fields.city.trim() || null,
          country: "FR",
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || "Erreur lors de la création")
        return
      }
      toast.success("Client créé avec succès !")
      router.push("/clients")
      router.refresh()
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>

      {/* Recherche SIREN — bientôt disponible */}
      <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-4 h-4 text-[#94A3B8]" />
          <p className="text-sm font-medium text-[#64748B]">
            Recherche automatique par SIREN
          </p>
          <span className="text-xs bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0] px-2 py-0.5 rounded-full">
            Bientôt disponible
          </span>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Ex: 123456789"
            disabled
            className="font-mono bg-white opacity-50 cursor-not-allowed"
            maxLength={9}
          />
          <Button
            type="button"
            variant="outline"
            disabled
            className="gap-2 shrink-0 opacity-50 cursor-not-allowed"
          >
            Rechercher
          </Button>
        </div>
        <p className="text-xs text-[#94A3B8] mt-2">
          Pré-remplissage automatique depuis la base INSEE Sirene — disponible prochainement
        </p>
      </div>

      {/* Informations générales */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 space-y-4 shadow-sm">
        <h3 className="text-sm font-semibold text-[#0F172A]">Informations générales</h3>

        <div>
          <Label htmlFor="name">Raison sociale *</Label>
          <Input
            id="name"
            placeholder="Nom de l'entreprise ou du client"
            className="mt-1"
            value={fields.name}
            onChange={set("name")}
            autoComplete="organization"
          />
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="siren">SIREN</Label>
            <Input
              id="siren"
              placeholder="123456789"
              className="mt-1 font-mono"
              maxLength={9}
              value={fields.siren}
              onChange={set("siren")}
              autoComplete="off"
            />
            {errors.siren && <p className="text-xs text-red-500 mt-1">{errors.siren}</p>}
          </div>
          <div>
            <Label htmlFor="vat_number">N° TVA intracommunautaire</Label>
            <Input
              id="vat_number"
              placeholder="FR12345678901"
              className="mt-1 font-mono"
              value={fields.vat_number}
              onChange={set("vat_number")}
              autoComplete="off"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="contact@entreprise.fr"
              className="mt-1"
              value={fields.email}
              onChange={set("email")}
              autoComplete="email"
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>
          <div>
            <Label htmlFor="phone">Téléphone</Label>
            <Input
              id="phone"
              placeholder="06 00 00 00 00"
              className="mt-1"
              value={fields.phone}
              onChange={set("phone")}
              autoComplete="tel"
            />
          </div>
        </div>
      </div>

      {/* Adresse */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 space-y-4 shadow-sm">
        <h3 className="text-sm font-semibold text-[#0F172A]">Adresse</h3>

        <div>
          <Label htmlFor="address">Adresse</Label>
          <Input
            id="address"
            placeholder="10 rue de la Paix"
            className="mt-1"
            value={fields.address}
            onChange={set("address")}
            autoComplete="street-address"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="zip_code">Code postal</Label>
            <Input
              id="zip_code"
              placeholder="75001"
              className="mt-1 font-mono"
              maxLength={5}
              value={fields.zip_code}
              onChange={set("zip_code")}
              autoComplete="postal-code"
            />
          </div>
          <div className="col-span-2">
            <Label htmlFor="city">Ville</Label>
            <Input
              id="city"
              placeholder="Paris"
              className="mt-1"
              value={fields.city}
              onChange={set("city")}
              autoComplete="address-level2"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3 justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/clients")}
        >
          Annuler
        </Button>
        <Button
          type="submit"
          className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white gap-2"
          disabled={loading}
        >
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Créer le client
        </Button>
      </div>
    </form>
  )
}
