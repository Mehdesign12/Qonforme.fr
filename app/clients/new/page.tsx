import type { Metadata } from "next"
import { NewClientForm } from "@/components/clients/NewClientForm"
import { safeNextPath } from "@/lib/stripe/access"

export const metadata: Metadata = { title: "Nouveau client" }
export const dynamic = "force-dynamic"

interface Props {
  /** `?redirect=/invoices/new` : après la création, retour au formulaire d'origine. */
  searchParams: { redirect?: string | string[] }
}

export default function NewClientPage({ searchParams }: Props) {
  const raw = Array.isArray(searchParams.redirect) ? searchParams.redirect[0] : searchParams.redirect
  return <NewClientForm redirectTo={safeNextPath(raw)} />
}
