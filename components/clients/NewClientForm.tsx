'use client'

import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ClientFormPage, type ClientPayload } from "./ClientForm"

/**
 * Création d'un client (POST /api/clients). Retour à la liste, ou au
 * formulaire d'origine (`redirectTo`, chemin interne déjà filtré) avec le
 * nouveau client en paramètre `client`.
 */
export function NewClientForm({ redirectTo = null }: { redirectTo?: string | null }) {
  const router = useRouter()

  const create = async (payload: ClientPayload) => {
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json.error || "Erreur lors de la création")
        return
      }
      toast.success("Client créé")
      const id: string | undefined = json.client?.id
      if (redirectTo && id) {
        router.push(`${redirectTo}${redirectTo.includes("?") ? "&" : "?"}client=${encodeURIComponent(id)}`)
      } else {
        router.push("/clients")
      }
      router.refresh()
    } catch {
      toast.error("Erreur réseau")
    }
  }

  return (
    <ClientFormPage
      mode="create"
      title="Nouveau client"
      subtitle="Avec le SIREN, Qonforme retrouve la raison sociale et le numéro de TVA."
      backHref={redirectTo ?? "/clients"}
      backLabel={redirectTo ? "Retour" : "Clients"}
      cancelHref={redirectTo ?? "/clients"}
      submitLabel="Créer le client"
      mobileSubmitLabel="Enregistrer le client"
      onSubmit={create}
    />
  )
}
