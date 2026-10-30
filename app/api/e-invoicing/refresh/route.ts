/**
 * POST /api/e-invoicing/refresh — « Actualiser l'état », « Vérifier l'annuaire »
 * (`{}`) ou « Relever maintenant » (`{ "sync": true }`). Une demande par
 * 20 secondes au plus : au-delà, la vue enregistrée est rendue telle quelle.
 */
import { NextResponse } from "next/server"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { loadEInvoicingView } from "@/lib/pa/server"
import { loadConnection } from "@/lib/pa/store"
import { runConnection } from "@/lib/pa/run"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const MIN_INTERVAL_MS = 20_000

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  const body = (await request.json().catch(() => ({}))) as { sync?: unknown }
  const admin = createAdminClient()

  const loaded = await loadConnection(admin, user.id)
  if (!loaded.ok) return NextResponse.json({ error: "Lecture impossible pour le moment." }, { status: 503 })
  if (!loaded.row) return NextResponse.json({ error: "Aucun raccordement à actualiser." }, { status: 404 })

  let message: string | null = null
  const recent = loaded.row.last_check_at && Date.now() - Date.parse(loaded.row.last_check_at) < MIN_INTERVAL_MS
  if (!recent || body.sync === true) {
    const res = await runConnection(admin, user.id, { forceCheck: !recent, sync: body.sync === true })
    if (!res.ok) {
      message = res.reason === "busy"
        ? "Une relève est déjà en cours. Réessayez dans un instant."
        : "Super PDP ne répond pas pour le moment. Réessayez dans quelques minutes."
    } else if (res.skippedSync === "no_plan") {
      message = "La relève automatique demande la formule Essentiel."
    } else if (res.sync) {
      message = res.sync.newInvoices > 0
        ? `${res.sync.newInvoices} nouvelle${res.sync.newInvoices > 1 ? "s" : ""} facture${res.sync.newInvoices > 1 ? "s" : ""} reçue${res.sync.newInvoices > 1 ? "s" : ""}.`
        : "Aucune nouvelle facture."
    }
  }
  const view = await loadEInvoicingView(admin, user.id)
  if (!view.ok) return NextResponse.json({ error: view.error }, { status: view.status })
  return NextResponse.json({ view: view.view, message })
}
