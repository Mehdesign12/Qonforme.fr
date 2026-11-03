/**
 * Canaux d'envoi d'un avoir (fenêtre d'envoi) et son envoi par la plateforme
 * agréée s'il y en a un (fiche). L'avoir suit le chemin de sa facture
 * (lib/pa/credit-note-delivery.ts).
 */
import { NextResponse } from "next/server"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { CREDIT_NOTE_PLATFORM_TEXT, loadCreditNoteDelivery } from "@/lib/pa/credit-note-delivery"
import { toPlatformInfo } from "@/lib/pa/outbound-view"

export const dynamic = "force-dynamic"

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  const { id } = await params
  const { data: note, error } = await supabase
    .from("credit_notes").select("id, original_invoice_id").eq("id", id).eq("user_id", user.id).maybeSingle()
  if (error) return NextResponse.json({ error: "Lecture impossible pour le moment." }, { status: 503 })
  if (!note) return NextResponse.json({ error: "Avoir introuvable" }, { status: 404 })

  const d = await loadCreditNoteDelivery(createAdminClient(), user.id, note as { id: string; original_invoice_id: string | null })
  const platform = d.platform.offered
    ? { offered: true, address: d.platform.address }
    : { offered: false, address: d.platform.address, reason: d.platform.reason, text: CREDIT_NOTE_PLATFORM_TEXT[d.platform.reason] }
  return NextResponse.json(
    { platform, outbound: d.active ? toPlatformInfo(d.active) : null },
    { headers: { "Cache-Control": "no-store" } },
  )
}
