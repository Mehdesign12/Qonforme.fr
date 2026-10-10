'use client'

import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChantierForm } from "@/components/chantiers/ChantierForm"
import { DEMO_CLIENTS } from "@/lib/demo/chantiers"

export default function DemoNewChantierPage() {
  const router = useRouter()
  return (
    <ChantierForm
      clients={DEMO_CLIENTS}
      cancelHref="/demo/chantiers"
      onSubmit={async () => {
        await new Promise((r) => setTimeout(r, 400))
        return { ok: true, id: "1" }
      }}
      onCreated={(id) => { toast.success("Démo : chantier créé (non enregistré)"); router.push(`/demo/chantiers/${id}`) }}
    />
  )
}
