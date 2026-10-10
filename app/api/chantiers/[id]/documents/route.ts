import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { FEATURES } from "@/lib/features"

export const dynamic = "force-dynamic"

interface Params { params: Promise<{ id: string }> }

/**
 * POST /api/chantiers/[id]/documents
 * { type: "quote" | "invoice", documentId, attach: boolean }
 * Rattache un devis ou une facture au chantier, ou l'en détache.
 */
export async function POST(request: NextRequest, { params }: Params) {
  if (!FEATURES.chantiers) return NextResponse.json({ error: "Fonction non activée" }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  const { id } = await params

  const body = await request.json().catch(() => ({}))
  const table = body.type === "quote" ? "quotes" : body.type === "invoice" ? "invoices" : null
  if (!table || typeof body.documentId !== "string") return NextResponse.json({ error: "Document invalide" }, { status: 422 })

  const { data: chantier } = await supabase.from("chantiers").select("id").eq("id", id).eq("user_id", user.id).maybeSingle()
  if (!chantier) return NextResponse.json({ error: "Chantier introuvable" }, { status: 404 })

  let query = supabase.from(table).update({ chantier_id: body.attach ? id : null }).eq("id", body.documentId).eq("user_id", user.id)
  // on ne détache que ce qui est rattaché à CE chantier
  if (!body.attach) query = query.eq("chantier_id", id)
  const { data, error } = await query.select("id").maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Document introuvable" }, { status: 404 })
  return NextResponse.json({ success: true })
}
