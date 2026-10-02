"use client"

import { notFound, useParams } from "next/navigation"
import { toast } from "sonner"
import { SetCrumb } from "@/components/layout/crumb"
import { ClientFormPage } from "@/components/clients/ClientForm"
import { demoClientRecord } from "@/components/clients/demo-clients"
import { DEMO_CLIENTS } from "@/lib/demo/data"

/** Miroir de /clients/[id]/edit : même formulaire, rien n'est enregistré. */
export default function DemoEditClientPage() {
  const { id } = useParams<{ id: string }>()
  const source = DEMO_CLIENTS.find((c) => c.id === id)
  if (!source) notFound()

  const c = demoClientRecord(source)
  return (
    <>
      <SetCrumb label={c.name} />
      <ClientFormPage
        mode="edit"
        initial={{
          name: c.name,
          siren: c.siren ?? "",
          vat_number: c.vat_number ?? "",
          email: c.email ?? "",
          phone: c.phone ?? "",
          address: c.address ?? "",
          zip_code: c.zip_code ?? "",
          city: c.city ?? "",
        }}
        country={c.country}
        title="Modifier le client"
        subtitle={c.name}
        backHref={`/demo/clients/${c.id}`}
        backLabel={c.name}
        cancelHref={`/demo/clients/${c.id}`}
        submitLabel="Enregistrer"
        onSubmit={() => {
          toast("Démo : rien n'est enregistré. Créez un compte pour modifier vos clients", {
            action: { label: "Créer mon compte", onClick: () => { window.location.href = "/signup" } },
          })
        }}
      />
    </>
  )
}
