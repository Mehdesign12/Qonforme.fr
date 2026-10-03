import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, Lock, RefreshCw } from "lucide-react"
import { createClient, createAdminClient } from "@/lib/supabase/server"
import { todayInParis } from "@/lib/utils/paris-date"
import { defaultPeriod, parsePeriod, periodPresets } from "@/lib/accountant/rules"
import { authorizeDossier, loadDossier, recordView } from "@/lib/accountant/server"
import { DossierView } from "@/components/accountant/DossierView"
import { EmptyState } from "@/components/app/kit"
import type { DossierData } from "@/lib/accountant/types"

export const dynamic = "force-dynamic"

interface Props {
  params: Promise<{ accessId: string }>
  searchParams: Promise<{ du?: string; au?: string }>
}

/**
 * Un dossier de l'espace comptable. À chaque affichage : compte connecté,
 * accès accepté, non révoqué et à ce compte (sinon « introuvable », sans dire
 * si le dossier existe), consultation journalisée, puis lecture des documents
 * de l'entreprise de cet accès avec la clé service_role.
 */
export default async function DossierPage({ params, searchParams }: Props) {
  const { accessId } = await params
  const sp = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login?next=/comptable")

  let data: DossierData | null = null
  let state: "ok" | "not_found" | "error" = "ok"
  const today = todayInParis()
  try {
    const db = createAdminClient()
    const access = await authorizeDossier(accessId, user.id, db)
    if (!access) {
      state = "not_found"
    } else {
      const period = parsePeriod(sp.du, sp.au) ?? defaultPeriod(today)
      // Une consultation qui ne peut pas être journalisée n'a pas lieu
      await recordView(db, access)
      data = await loadDossier({ ownerId: access.owner_id, period, today, db })
    }
  } catch (err) {
    console.error("[comptable] dossier", err)
    state = "error"
  }

  if (state !== "ok" || !data) {
    return (
      <section className="q-card">
        <EmptyState
          className="py-14"
          icon={state === "error" ? <RefreshCw className="size-5" aria-hidden /> : <Lock className="size-5" aria-hidden />}
          title={state === "error" ? "Impossible d'afficher ce dossier" : "Dossier introuvable"}
          text={state === "error"
            ? "Vérifiez votre connexion, puis rechargez la page."
            : "Ce dossier n'existe pas, ou l'entreprise vous en a retiré l'accès."}
          action={
            <Link href="/comptable" className="q-btn q-btn-secondary">
              <ArrowLeft aria-hidden />
              Vos dossiers
            </Link>
          }
        />
      </section>
    )
  }

  return (
    <DossierView
      mode="app"
      data={data}
      presets={periodPresets(today)}
      basePath={`/comptable/${accessId}`}
      backHref="/comptable"
      exportUrl={`/api/comptable/${accessId}/export`}
    />
  )
}
