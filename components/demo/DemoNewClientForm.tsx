'use client'

import { toast } from "sonner"
import { ClientFormPage } from "@/components/clients/ClientForm"

/**
 * Démo de /clients/new : même formulaire (recherche Sirene comprise, qui
 * interroge le vrai répertoire), mais l'enregistrement invite à créer un compte.
 */
export default function DemoNewClientForm() {
  return (
    <ClientFormPage
      mode="create"
      title="Nouveau client"
      subtitle="Avec le SIREN, Qonforme retrouve la raison sociale et le numéro de TVA."
      backHref="/demo/clients"
      backLabel="Clients"
      cancelHref="/demo/clients"
      submitLabel="Créer le client"
      mobileSubmitLabel="Enregistrer le client"
      onSubmit={() => {
        toast("Démo : rien n'est enregistré. Créez un compte pour ajouter vos clients", {
          action: { label: "Créer mon compte", onClick: () => { window.location.href = "/signup" } },
        })
      }}
    />
  )
}
