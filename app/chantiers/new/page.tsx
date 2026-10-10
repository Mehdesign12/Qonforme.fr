'use client'

export const dynamic = "force-dynamic"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChantierForm, type ChantierPayload, type FormClient, type SubmitResult } from "@/components/chantiers/ChantierForm"

type ApiClient = { id: string; name: string; address?: string | null; zip_code?: string | null; city?: string | null }

export default function NewChantierPage() {
  const router = useRouter()
  const [clients, setClients] = useState<FormClient[] | null>(null)

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((json) => setClients((json.clients ?? []).map((c: ApiClient) => ({
        id: c.id,
        name: c.name,
        address: [c.address, [c.zip_code, c.city].filter(Boolean).join(" ")].filter(Boolean).join(", "),
      }))))
      .catch(() => setClients([]))
  }, [])

  const submit = async (p: ChantierPayload): Promise<SubmitResult> => {
    try {
      const res = await fetch("/api/chantiers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) })
      const json = await res.json()
      if (!res.ok) return { ok: false, message: json.error || "Le chantier n’a pas pu être créé" }
      return { ok: true, id: json.id }
    } catch {
      return { ok: false, message: "Connexion impossible, réessayez dans un instant" }
    }
  }

  return (
    <ChantierForm
      clients={clients}
      cancelHref="/chantiers"
      onSubmit={submit}
      onCreated={(id) => { toast.success("Chantier créé"); router.push(`/chantiers/${id}`) }}
    />
  )
}
