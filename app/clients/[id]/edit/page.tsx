'use client'

export const dynamic = "force-dynamic"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft, Loader2, Save } from "lucide-react"
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

export default function EditClientPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const [clientName, setClientName] = useState("")
  const [loadingData, setLoadingData] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [fields, setFields] = useState<Fields>({
    name: "", siren: "", vat_number: "",
    email: "", phone: "",
    address: "", zip_code: "", city: "",
  })

  useEffect(() => {
    fetch(`/api/clients/${id}`)
      .then(r => r.json())
      .then(json => {
        if (json.client) {
          const c = json.client
          setClientName(c.name)
          setFields({
            name:       c.name        || "",
            siren:      c.siren       || "",
            vat_number: c.vat_number  || "",
            email:      c.email       || "",
            phone:      c.phone       || "",
            address:    c.address     || "",
            zip_code:   c.zip_code    || "",
            city:       c.city        || "",
          })
        } else {
          toast.error("Client introuvable")
          router.replace("/clients")
        }
      })
      .finally(() => setLoadingData(false))
  }, [id, router])

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

    setSaving(true)
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:       fields.name.trim(),
          siren:      fields.siren.trim()       || null,
          vat_number: fields.vat_number.trim()  || null,
          email:      fields.email.trim()       || null,
          phone:      fields.phone.trim()       || null,
          address:    fields.address.trim()     || null,
          zip_code:   fields.zip_code.trim()    || null,
          city:       fields.city.trim()        || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error || "Erreur lors de la sauvegarde"); return }
      toast.success("Client mis à jour")
      router.push(`/clients/${id}`)
      router.refresh()
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setSaving(false)
    }
  }

  if (loadingData) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-8 h-8 text-[#2563EB] animate-spin" />
    </div>
  )

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/clients/${id}`}>
          <Button variant="ghost" size="sm" className="gap-1.5 text-slate-500 hover:text-slate-700">
            <ArrowLeft className="w-4 h-4" /> Retour
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-[#0F172A] dark:text-[#E2E8F0]">Modifier {clientName}</h1>
          <p className="text-sm text-slate-400 mt-0.5">Informations du client</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-5" noValidate>

        {/* Informations générales */}
        <div className="bg-white dark:bg-[#0F1E35] rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] p-5 space-y-4 shadow-sm">
          <h3 className="text-sm font-semibold text-[#0F172A] dark:text-[#E2E8F0]">Informations générales</h3>

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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        <div className="bg-white dark:bg-[#0F1E35] rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] p-5 space-y-4 shadow-sm">
          <h3 className="text-sm font-semibold text-[#0F172A] dark:text-[#E2E8F0]">Adresse</h3>

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

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end pb-8">
          <Link href={`/clients/${id}`}>
            <Button type="button" variant="outline" className="w-full sm:w-auto">
              Annuler
            </Button>
          </Link>
          <Button
            type="submit"
            className="w-full sm:w-auto bg-[#2563EB] hover:bg-[#1D4ED8] text-white gap-2"
            disabled={saving}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Enregistrer
          </Button>
        </div>
      </form>
    </div>
  )
}
