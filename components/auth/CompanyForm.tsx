'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Loader2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { isValidSiren, sirenToVAT } from "@/lib/utils/invoice"

const schema = z.object({
  name: z.string().min(2, "Raison sociale requise"),
  siren: z.string().regex(/^\d{9}$/, "SIREN invalide (9 chiffres)"),
  address: z.string().min(5, "Adresse requise"),
  zip_code: z.string().regex(/^\d{5}$/, "Code postal invalide"),
  city: z.string().min(2, "Ville requise"),
  vat_number: z.string().optional(),
  iban: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default function CompanyForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [sirenLoading, setSirenLoading] = useState(false)

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const siren = watch("siren")

  const searchSiren = async () => {
    if (!siren || siren.length !== 9) {
      toast.error("Entre un SIREN valide à 9 chiffres")
      return
    }
    if (!isValidSiren(siren)) {
      toast.error("SIREN invalide")
      return
    }
    setSirenLoading(true)
    try {
      const res = await fetch(`/api/sirene?siren=${siren}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (data.name) setValue("name", data.name)
      if (data.address) setValue("address", data.address)
      if (data.zip_code) setValue("zip_code", data.zip_code)
      if (data.city) setValue("city", data.city)
      // Générer numéro TVA automatiquement
      setValue("vat_number", sirenToVAT(siren))
      toast.success("Entreprise trouvée !")
    } catch {
      toast.error("Entreprise non trouvée. Remplis manuellement.")
    } finally {
      setSirenLoading(false)
    }
  }

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const res = await fetch("/api/company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
      toast.success("Profil entreprise enregistré !")
      router.push("/dashboard")
    } catch {
      toast.error("Erreur lors de la sauvegarde")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* SIREN avec recherche auto */}
      <div>
        <Label htmlFor="siren">SIREN</Label>
        <div className="flex gap-2 mt-1">
          <Input
            id="siren"
            placeholder="123456789"
            maxLength={9}
            className="font-mono"
            {...register("siren")}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={searchSiren}
            disabled={sirenLoading}
            title="Rechercher par SIREN"
          >
            {sirenLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>
        {errors.siren && <p className="text-xs text-red-500 mt-1">{errors.siren.message}</p>}
        <p className="text-xs text-slate-400 mt-1">Clique sur 🔍 pour pré-remplir automatiquement</p>
      </div>

      {/* Raison sociale */}
      <div>
        <Label htmlFor="name">Raison sociale</Label>
        <Input id="name" placeholder="Mon Entreprise SARL" className="mt-1" {...register("name")} />
        {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
      </div>

      {/* Adresse */}
      <div>
        <Label htmlFor="address">Adresse</Label>
        <Input id="address" placeholder="12 rue de la Paix" className="mt-1" {...register("address")} />
        {errors.address && <p className="text-xs text-red-500 mt-1">{errors.address.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="zip_code">Code postal</Label>
          <Input id="zip_code" placeholder="75001" maxLength={5} className="mt-1 font-mono" {...register("zip_code")} />
          {errors.zip_code && <p className="text-xs text-red-500 mt-1">{errors.zip_code.message}</p>}
        </div>
        <div>
          <Label htmlFor="city">Ville</Label>
          <Input id="city" placeholder="Paris" className="mt-1" {...register("city")} />
          {errors.city && <p className="text-xs text-red-500 mt-1">{errors.city.message}</p>}
        </div>
      </div>

      {/* Numéro TVA */}
      <div>
        <Label htmlFor="vat_number">Numéro de TVA intracommunautaire <span className="text-slate-400">(optionnel)</span></Label>
        <Input id="vat_number" placeholder="FR12345678901" className="mt-1 font-mono" {...register("vat_number")} />
      </div>

      {/* IBAN */}
      <div>
        <Label htmlFor="iban">IBAN <span className="text-slate-400">(pour les mentions de paiement)</span></Label>
        <Input id="iban" placeholder="FR76 3000 1007 9412 3456 7890 185" className="mt-1 font-mono text-sm" {...register("iban")} />
      </div>

      <Button type="submit" className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white mt-2" disabled={loading}>
        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Accéder à mon espace →
      </Button>
    </form>
  )
}
