export const dynamic = "force-dynamic"

import DemoNewClientForm from "@/components/demo/DemoNewClientForm"

/** Miroir de /clients/new : même formulaire, rien n'est enregistré. */
export default function DemoNewClientPage() {
  return <DemoNewClientForm />
}
