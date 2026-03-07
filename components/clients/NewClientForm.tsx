'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Loader2, Search, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const schema = z.object({
  name: z.string().min(2, "Nom requis"),
  siren: z.string().length(9, "SIREN doit faire 9 chiffres").optional().or(z.literal("")),
  vat_number: z.string().optional(),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  zip_code: z.string().optional(),
  city: z.string().optional(),
  country: z.string(),
})

type FormData = z.infer<typeof schema>

interface SireneResult {
  siren: string
  name: string
  address: string
  zip_code: string
  city: string
  vat_number?: string
}

export function NewClientForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [sirenSearch, setSirenSearch] = useState("")
  const [sirenLoading, setSirenLoading] = useState(false)
  const [sirenFound, setSirenFound] = useState(false)

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { country: "FR" },
  })

  const lookupSiren = async () => {
    if (sirenSearch.length !== 9) {
      toast.error("Le SIREN doit faire 9 chiffres")
      return
    }
    setSirenLoading(true)
    setSirenFound(false)
    try {
      const res = await fetch(`/api/sirene?siren=${sirenSearch}`)
      const json = await res.json()
      if (json.result) {
        const r: SireneResult = json.result
        setValue("name", r.name)
        setValue("siren", r.siren)
        setValue("address", r.address || "")
        setValue("zip_code", r.zip_code || "")
        setValue("city", r.city || "")
        if (r.vat_number) setValue("vat_number", r.vat_number)
        setSirenFound(true)
        toast.success(`${r.name} trouvé`)
      } else {
        toast.error("SIREN introuvable dans la base INSEE")
      }
    } catch {
      toast.error("Erreur lors de la recherche SIREN")
    } finally {
      setSirenLoading(false)
    }
  }

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Recherche SIREN */}
      <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-4">
        <p className="text-sm font-medium text-[#1E40AF] mb-3">
          Recherche automatique par SIREN
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="Ex: 123456789"
            value={sirenSearch}
            onChange={(e) => setSirenSearch(e.target.value.replace(/\D/g, "").slice(0, 9))}
            className="font-mono bg-white"
            maxLength={9}
          />
          <Button
            type="button"
            variant="outline"
            onClick={lookupSiren}
            disabled={sirenLoading || sirenSearch.length !== 9}
            className="gap-2 shrink-0"
          >
            {sirenLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : sirenFound ? (
              <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Rechercher
          </Button>
        </div>
        <p className="text-xs text-[#3B82F6] mt-2">
          Pré-remplit automatiquement les informations depuis la base INSEE Sirene
        </p>
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 space-y-4 shadow-sm">
        <h3 className="text-sm font-semibold text-[#0F172A]">Informations générales</h3>

        <div>
          <Label htmlFor="name">Raison sociale *</Label>
          <Input id="name" placeholder="Nom de l'entreprise" className="mt-1" {...register("name")} />
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="siren">SIREN</Label>
            <Input id="siren" placeholder="123456789" className="mt-1 font-mono" maxLength={9} {...register("siren")} />
            {errors.siren && <p className="text-xs text-red-500 mt-1">{errors.siren.message}</p>}
          </div>
          <div>
            <Label htmlFor="vat_number">N° TVA intracommunautaire</Label>
            <Input id="vat_number" placeholder="FR12345678901" className="mt-1 font-mono" {...register("vat_number")} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="contact@entreprise.fr" className="mt-1" {...register("email")} />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <Label htmlFor="phone">Téléphone</Label>
            <Input id="phone" placeholder="06 00 00 00 00" className="mt-1" {...register("phone")} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 space-y-4 shadow-sm">
        <h3 className="text-sm font-semibold text-[#0F172A]">Adresse</h3>

        <div>
          <Label htmlFor="address">Adresse</Label>
          <Input id="address" placeholder="10 rue de la Paix" className="mt-1" {...register("address")} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="zip_code">Code postal</Label>
            <Input id="zip_code" placeholder="75001" className="mt-1 font-mono" {...register("zip_code")} />
          </div>
          <div className="col-span-2">
            <Label htmlFor="city">Ville</Label>
            <Input id="city" placeholder="Paris" className="mt-1" {...register("city")} />
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
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Créer le client
        </Button>
      </div>
    </form>
  )
}
