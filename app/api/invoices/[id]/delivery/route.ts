/**
 * Canaux d'envoi d'une facture (fenêtre d'envoi, planches D14 et M13) : par la
 * plateforme agréée quand le client est dans l'annuaire, sinon par email.
 * Lecture seule ; la route d'envoi refait le contrôle avant d'envoyer.
 */
import { NextResponse } from "next/server"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { loadDeliveryOptions } from "@/lib/pa/delivery-server"

export const dynamic = "force-dynamic"

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  const { id } = await params
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("id, client:clients(email, siren, country)")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: "Lecture impossible pour le moment." }, { status: 503 })
  if (!invoice) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 })
  const client = (Array.isArray(invoice.client) ? invoice.client[0] : invoice.client) ?? null
  const res = await loadDeliveryOptions(createAdminClient(), user.id, client, { document: { type: "invoice", id } })
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })
  return NextResponse.json({ options: res.options }, { headers: { "Cache-Control": "no-store" } })
}
