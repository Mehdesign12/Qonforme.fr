import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { FEATURES } from "@/lib/features"
import { cleanLots } from "@/lib/chantiers/metrics"
import { loadChantiers, parseChantierBody } from "@/lib/chantiers/server"

export const dynamic = "force-dynamic"

const disabled = () => NextResponse.json({ error: "Fonction non activée" }, { status: 404 })

// GET /api/chantiers — chantiers non archivés, avec devis et factures rattachés
export async function GET() {
  if (!FEATURES.chantiers) return disabled()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { chantiers, error } = await loadChantiers(supabase, user.id)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ chantiers })
}

// POST /api/chantiers — création
export async function POST(request: NextRequest) {
  if (!FEATURES.chantiers) return disabled()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { data, error } = parseChantierBody(body, false)
  if (error) return NextResponse.json({ error }, { status: 422 })
  if (data.lots) data.lots = cleanLots(data.lots as { label: string; amount_ht: number | string }[])

  // le client doit appartenir à l'utilisateur
  if (data.client_id) {
    const { data: client } = await supabase.from("clients").select("id").eq("id", data.client_id).eq("user_id", user.id).maybeSingle()
    if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 422 })
  }

  const { data: created, error: insErr } = await supabase
    .from("chantiers")
    .insert({ ...data, user_id: user.id, status: data.status ?? "todo" })
    .select("id")
    .single()
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  return NextResponse.json({ id: created.id }, { status: 201 })
}
