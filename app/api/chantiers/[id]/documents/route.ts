/**
 * Documents d'un chantier.
 *
 * GET  : documents qu'on peut y rattacher (devis, factures, avoirs, bons de
 *        commande sans chantier), les plus récents d'abord, ceux du client du
 *        chantier en tête.
 * POST : `{ type, id, attach }` rattache (ou détache) un document existant.
 *        Seul le lien change : le contenu d'un document émis reste tel quel.
 *        Un devis entraîne ses acomptes, situations et solde.
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireArtisanAccess } from "@/lib/artisan/access"
import { attachDocument, getChantier, isAttachType } from "@/lib/artisan/server"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"

export const dynamic = "force-dynamic"

interface Params { params: Promise<{ id: string }> }

export interface AttachCandidate {
  type: "quote" | "invoice" | "credit_note" | "purchase_order"
  id: string
  number: string | null
  status: string | null
  issue_date: string | null
  total_ttc: number
  client_id: string | null
  client_name: string | null
}

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)

export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  const { id } = await params

  try {
    const chantier = await getChantier(supabase, user.id, id)
    if (!chantier) return NextResponse.json({ error: "Chantier introuvable" }, { status: 404 })
    if ("unavailable" in chantier) return NextResponse.json({ available: false, candidates: [] })

    const [quotes, invoices, credits, pos] = await Promise.all([
      supabase.from("quotes").select("id, quote_number, status, issue_date, total_ttc, client_id, client:clients(name)").eq("user_id", user.id).is("chantier_id", null).order("created_at", { ascending: false }).limit(40),
      supabase.from("invoices").select("id, invoice_number, status, issue_date, total_ttc, client_id, client:clients(name)").eq("user_id", user.id).is("chantier_id", null).order("created_at", { ascending: false }).limit(40),
      supabase.from("credit_notes").select("id, credit_note_number, issue_date, total_ttc, client_id, client:clients(name)").eq("user_id", user.id).is("chantier_id", null).order("created_at", { ascending: false }).limit(20),
      supabase.from("purchase_orders").select("id, po_number, status, issue_date, total_ttc, client_id, client:clients(name)").eq("user_id", user.id).is("chantier_id", null).order("created_at", { ascending: false }).limit(20),
    ])
    for (const r of [quotes, invoices, credits, pos]) {
      if (r.error) {
        if (isMissingSchemaError(r.error)) return NextResponse.json({ available: false, candidates: [] })
        throw new Error(r.error.message)
      }
    }
    const rows = (res: { data: unknown }) => (res.data ?? []) as Record<string, unknown>[]
    const map = (type: AttachCandidate["type"], numberKey: string) => (r: Record<string, unknown>): AttachCandidate => ({
      type,
      id: String(r.id),
      number: (r[numberKey] as string | null) ?? null,
      status: (r.status as string | null) ?? null,
      issue_date: (r.issue_date as string | null) ?? null,
      total_ttc: Number(r.total_ttc ?? 0) || 0,
      client_id: (r.client_id as string | null) ?? null,
      client_name: one(r.client as { name?: string } | { name?: string }[] | null)?.name ?? null,
    })
    const candidates = [
      ...rows(quotes).map(map("quote", "quote_number")),
      ...rows(invoices).map(map("invoice", "invoice_number")),
      ...rows(credits).map(map("credit_note", "credit_note_number")),
      ...rows(pos).map(map("purchase_order", "po_number")),
    ].sort((a, b) => {
      const sa = a.client_id && a.client_id === chantier.client_id ? 0 : 1
      const sb = b.client_id && b.client_id === chantier.client_id ? 0 : 1
      return sa - sb || (b.issue_date ?? "").localeCompare(a.issue_date ?? "")
    })
    return NextResponse.json({ available: true, candidates })
  } catch (err) {
    console.error("[chantiers/documents] candidats:", err)
    return NextResponse.json({ error: "Impossible de charger vos documents." }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const blocked = await requireArtisanAccess(supabase, user.id)
  if (blocked) return blocked

  const { id } = await params
  const body = (await request.json().catch(() => ({}))) as { type?: unknown; id?: unknown; attach?: unknown }
  if (!isAttachType(body.type) || typeof body.id !== "string" || !body.id) {
    return NextResponse.json({ error: "Document invalide" }, { status: 400 })
  }

  try {
    const chantier = await getChantier(supabase, user.id, id)
    if (!chantier) return NextResponse.json({ error: "Chantier introuvable" }, { status: 404 })
    if ("unavailable" in chantier) return NextResponse.json({ error: "Les chantiers ne sont pas encore activés." }, { status: 503 })
    const res = await attachDocument(supabase, user.id, body.type, body.id, body.attach === false ? null : id)
    if ("unavailable" in res) return NextResponse.json({ error: "Les chantiers ne sont pas encore activés." }, { status: 503 })
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[chantiers/documents] rattachement:", err)
    return NextResponse.json({ error: "Le rattachement a échoué. Réessayez." }, { status: 500 })
  }
}
