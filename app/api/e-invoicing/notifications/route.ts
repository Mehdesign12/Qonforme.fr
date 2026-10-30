/**
 * PATCH /api/e-invoicing/notifications — réglages des emails du raccordement
 * (Paramètres › Facturation électronique) : résumé quotidien, une facture à la
 * fois, alerte si la relève échoue, adresse de destination.
 */
import { NextResponse } from "next/server"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { loadEInvoicingView } from "@/lib/pa/server"
import { loadConnection, updateConnection, type ConnectionRow } from "@/lib/pa/store"

export const dynamic = "force-dynamic"

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  const patch: Partial<ConnectionRow> = {}
  if (typeof body.digest === "boolean") patch.notify_digest = body.digest
  if (typeof body.each === "boolean") patch.notify_each = body.each
  if (typeof body.failure === "boolean") patch.notify_failure = body.failure
  if (body.email !== undefined) {
    const email = typeof body.email === "string" ? body.email.trim() : ""
    if (email && !EMAIL.test(email)) return NextResponse.json({ error: "Adresse email invalide." }, { status: 422 })
    patch.notify_email = email || null
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Rien à enregistrer." }, { status: 400 })

  const admin = createAdminClient()
  const loaded = await loadConnection(admin, user.id)
  if (!loaded.ok) return NextResponse.json({ error: "Lecture impossible pour le moment." }, { status: 503 })
  if (!loaded.row) return NextResponse.json({ error: "Aucun raccordement." }, { status: 404 })
  if (!(await updateConnection(admin, user.id, patch))) return NextResponse.json({ error: "Enregistrement impossible. Réessayez." }, { status: 500 })

  const view = await loadEInvoicingView(admin, user.id)
  return NextResponse.json({ view: view.ok ? view.view : null })
}
