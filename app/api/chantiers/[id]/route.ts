import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { FEATURES } from "@/lib/features"
import { cleanLots } from "@/lib/chantiers/metrics"
import { loadChantiers, parseChantierBody } from "@/lib/chantiers/server"

export const dynamic = "force-dynamic"

interface Params { params: Promise<{ id: string }> }

const disabled = () => NextResponse.json({ error: "Fonction non activée" }, { status: 404 })

// GET /api/chantiers/[id] — fiche + documents du client pas encore rattachés
export async function GET(_req: NextRequest, { params }: Params) {
  if (!FEATURES.chantiers) return disabled()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  const { id } = await params

  const { chantiers, error } = await loadChantiers(supabase, user.id, id)
  if (error) return NextResponse.json({ error }, { status: 500 })
  const chantier = chantiers[0]
  if (!chantier) return NextResponse.json({ error: "Chantier introuvable" }, { status: 404 })

  // documents du même client sans chantier, proposés au rattachement
  let attachable: { quotes: unknown[]; invoices: unknown[] } = { quotes: [], invoices: [] }
  if (chantier.client_id) {
    const [q, i] = await Promise.all([
      supabase.from("quotes").select("id, quote_number, status, issue_date, total_ttc").eq("user_id", user.id).eq("client_id", chantier.client_id).is("chantier_id", null).order("issue_date", { ascending: false }).limit(50),
      supabase.from("invoices").select("id, invoice_number, status, issue_date, total_ttc").eq("user_id", user.id).eq("client_id", chantier.client_id).is("chantier_id", null).eq("is_archived", false).order("issue_date", { ascending: false }).limit(50),
    ])
    attachable = {
      quotes:   (q.data ?? []).map((d) => ({ id: d.id, number: d.quote_number, status: d.status, issue_date: d.issue_date, total_ttc: d.total_ttc })),
      invoices: (i.data ?? []).map((d) => ({ id: d.id, number: d.invoice_number, status: d.status, issue_date: d.issue_date, total_ttc: d.total_ttc })),
    }
  }
  return NextResponse.json({ chantier, attachable })
}

// PATCH /api/chantiers/[id] — modification partielle (statut, dates, lots…)
export async function PATCH(request: NextRequest, { params }: Params) {
  if (!FEATURES.chantiers) return disabled()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  const { id } = await params

  const body = await request.json().catch(() => ({}))
  const { data, error } = parseChantierBody(body, true)
  if (error) return NextResponse.json({ error }, { status: 422 })
  if (data.lots) data.lots = cleanLots(data.lots as { label: string; amount_ht: number | string }[])
  if (data.client_id) {
    const { data: client } = await supabase.from("clients").select("id").eq("id", data.client_id).eq("user_id", user.id).maybeSingle()
    if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 422 })
  }

  const { data: updated, error: upErr } = await supabase
    .from("chantiers")
    .update(data)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle()
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
  if (!updated) return NextResponse.json({ error: "Chantier introuvable" }, { status: 404 })
  return NextResponse.json({ id })
}

// DELETE /api/chantiers/[id] — les devis et factures restent, sans chantier
export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!FEATURES.chantiers) return disabled()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  const { id } = await params

  const { data, error } = await supabase.from("chantiers").delete().eq("id", id).eq("user_id", user.id).select("id").maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Chantier introuvable" }, { status: 404 })
  return NextResponse.json({ success: true })
}
