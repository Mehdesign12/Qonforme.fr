/**
 * Rattache un acompte libre (émis sans devis) au devis signé du même client :
 * la facture de solde ou les situations le reprendront. Seul le lien
 * (quote_id, chantier_id) est écrit : la facture d'acompte émise ne change pas
 * (son contenu et son contexte sont figés par le déclencheur
 * freeze_invoice_billing).
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireArtisanAccess } from "@/lib/artisan/access"
import { loadQuoteBilling } from "@/lib/artisan/server"
import { depositGroups, parseBillingContext, sumGroups } from "@/lib/artisan/billing"

export const dynamic = "force-dynamic"

interface Params { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const blocked = await requireArtisanAccess(supabase, user.id)
  if (blocked) return blocked

  const { id } = await params
  const body = (await request.json().catch(() => ({}))) as { invoice_id?: unknown }
  const invoiceId = typeof body.invoice_id === "string" ? body.invoice_id : ""
  if (!invoiceId) return NextResponse.json({ error: "Acompte manquant" }, { status: 400 })

  try {
    const billing = await loadQuoteBilling(supabase, user.id, id)
    if (!billing) return NextResponse.json({ error: "Devis introuvable" }, { status: 404 })
    if ("unavailable" in billing) return NextResponse.json({ error: "Fonction pas encore activée." }, { status: 503 })
    const { quote, state } = billing
    if (quote.status !== "accepted" || quote.converted_invoice_id) {
      return NextResponse.json({ error: "Seul un devis accepté, pas encore converti en facture, reçoit un acompte." }, { status: 409 })
    }
    if (state.finalIssued) return NextResponse.json({ error: "Ce devis est entièrement facturé." }, { status: 409 })
    if (state.draft) return NextResponse.json({ error: "Un brouillon est en cours pour ce devis : envoyez-le ou supprimez-le d'abord." }, { status: 409 })

    const { data: inv, error } = await supabase
      .from("invoices")
      .select("id, client_id, status, invoice_kind, billing_context, quote_id, chantier_id, lines")
      .eq("id", invoiceId)
      .eq("user_id", user.id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    const row = inv as Record<string, unknown> | null
    if (!row || row.invoice_kind !== "deposit") return NextResponse.json({ error: "Acompte introuvable" }, { status: 404 })
    if (row.quote_id || parseBillingContext(row.billing_context)?.quote) {
      return NextResponse.json({ error: "Cet acompte est déjà lié à un devis." }, { status: 409 })
    }
    if (row.client_id !== quote.client_id) return NextResponse.json({ error: "L'acompte et le devis n'ont pas le même client." }, { status: 409 })
    if (["draft", "credited", "cancelled"].includes(String(row.status))) {
      return NextResponse.json({ error: "Seul un acompte émis, non annulé, se rattache à un devis." }, { status: 409 })
    }
    const ttc = sumGroups(depositGroups(row.lines as never)).ttc
    if (state.depositsTtc + ttc > state.contractTtc) {
      return NextResponse.json({ error: "Les acomptes dépasseraient le montant du devis." }, { status: 409 })
    }

    const { error: upErr } = await supabase
      .from("invoices")
      .update({ quote_id: quote.id, ...(row.chantier_id ? {} : { chantier_id: quote.chantier_id ?? null }) })
      .eq("id", invoiceId)
      .eq("user_id", user.id)
    if (upErr) throw new Error(upErr.message)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[artisan/attach-deposit]", err)
    return NextResponse.json({ error: "Le rattachement a échoué. Réessayez." }, { status: 500 })
  }
}
