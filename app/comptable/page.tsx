import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { listDossiers } from "@/lib/accountant/server"
import { DossierList } from "@/components/accountant/DossierList"
import type { DossierSummary } from "@/lib/accountant/types"

export const dynamic = "force-dynamic"

/** Espace comptable : les entreprises qui ont donné accès au compte connecté. */
export default async function ComptablePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login?next=/comptable")

  let dossiers: DossierSummary[] = []
  let error: string | null = null
  try {
    // Migration absente : liste vide, comme pour un compte sans dossier
    dossiers = (await listDossiers(user.id)).dossiers
  } catch {
    error = "Vérifiez votre connexion, puis rechargez la page."
  }

  return <DossierList dossiers={dossiers} error={error} hrefFor={(id) => `/comptable/${id}`} />
}
