'use client'

export const dynamic = "force-dynamic"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { ClientFormPage, type ClientFormValues, type ClientPayload } from "@/components/clients/ClientForm"
import { SetCrumb } from "@/components/layout/crumb"

export default function EditClientPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const [loaded, setLoaded] = useState<{ name: string; country: string; values: ClientFormValues } | null>(null)

  useEffect(() => {
    fetch(`/api/clients/${id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.client) {
          const c = json.client
          setLoaded({
            name: c.name,
            country: c.country || "FR",
            values: {
              name:       c.name        || "",
              siren:      c.siren       || "",
              vat_number: c.vat_number  || "",
              email:      c.email       || "",
              phone:      c.phone       || "",
              address:    c.address     || "",
              zip_code:   c.zip_code    || "",
              city:       c.city        || "",
            },
          })
        } else {
          toast.error("Client introuvable")
          router.replace("/clients")
        }
      })
      .catch(() => {
        toast.error("Erreur réseau")
        router.replace("/clients")
      })
  }, [id, router])

  const save = async (payload: ClientPayload) => {
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(json.error || "Erreur lors de la sauvegarde"); return }
      toast.success("Client mis à jour")
      router.push(`/clients/${id}`)
      router.refresh()
    } catch {
      toast.error("Erreur réseau")
    }
  }

  if (!loaded) {
    return (
      <div className="grid place-items-center py-24" role="status" aria-label="Chargement du client">
        <Loader2 className="size-7 animate-spin text-[var(--q-accent)]" aria-hidden />
      </div>
    )
  }

  return (
    <>
      <SetCrumb label={loaded.name} />
      <ClientFormPage
        mode="edit"
        initial={loaded.values}
        country={loaded.country}
        title="Modifier le client"
        subtitle={loaded.name}
        backHref={`/clients/${id}`}
        backLabel={loaded.name}
        cancelHref={`/clients/${id}`}
        submitLabel="Enregistrer"
        onSubmit={save}
      />
    </>
  )
}
