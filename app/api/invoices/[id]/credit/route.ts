import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

interface Params {
  params: Promise<{ id: string }>
}

// POST /api/invoices/[id]/credit — émet un avoir sur une facture
export async function POST(request: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const { reason, lines } = body // lines = toutes ou une sélection

  if (!reason?.trim()) {
    return NextResponse.json({ error: "Le motif de l'avoir est obligatoire" }, { status: 400 })
  }

  // 1. Récupérer la facture originale
  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .select("*, client:clients(id,name)")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (invErr || !invoice) {
    return NextResponse.json({ error: "Facture introuvable" }, { status: 404 })
  }

  // 2. Vérifier que la facture n'est pas un brouillon (les brouillons se suppriment)
  if (invoice.status === "draft") {
    return NextResponse.json({ error: "Un brouillon doit être supprimé, pas annulé par avoir" }, { status: 400 })
  }

  // 3. Vérifier qu'elle n'a pas déjà un avoir
  if (invoice.status === "credited" || invoice.status === "cancelled") {
    return NextResponse.json({ error: "Cette facture a déjà été annulée par avoir" }, { status: 400 })
  }

  // 4. Lignes de l'avoir (toutes les lignes de la facture ou sélection)
  const creditLines = (lines ?? invoice.lines ?? []).map((l: {
    description: string
    quantity: number
    unit_price_ht: number
    vat_rate: number
    total_ht: number
    total_vat: number
    total_ttc: number
  }) => ({
    description: l.description,
    quantity: l.quantity,
    unit_price_ht: l.unit_price_ht,
    vat_rate: l.vat_rate,
    total_ht: l.total_ht,
    total_vat: l.total_vat,
    total_ttc: l.total_ttc,
  }))

  // 5. Calcul des totaux de l'avoir
  const subtotal_ht = creditLines.reduce((s: number, l: { total_ht: number }) => s + l.total_ht, 0)
  const total_vat   = creditLines.reduce((s: number, l: { total_vat: number }) => s + l.total_vat, 0)
  const total_ttc   = subtotal_ht + total_vat

  // 6. Numérotation de l'avoir : AV-{ANNÉE}-{SEQ}
  const year   = new Date().getFullYear()
  const avPfx  = `AV-${year}-`

  // Numérotation robuste : MAX des avoirs existants pour cet utilisateur
  const { data: existingAv } = await supabase
    .from("credit_notes")
    .select("credit_note_number")
    .eq("user_id", user.id)
    .like("credit_note_number", `${avPfx}%`)
    .order("credit_note_number", { ascending: false })
    .limit(1)

  let nextAvSeq = 1
  if (existingAv && existingAv.length > 0) {
    const lastNum = existingAv[0].credit_note_number
    const parts   = lastNum.split("-")
    const lastSeq = parseInt(parts[parts.length - 1], 10)
    if (!isNaN(lastSeq)) nextAvSeq = lastSeq + 1
  }

  const credit_note_number = `${avPfx}${String(nextAvSeq).padStart(3, "0")}`

  // 7. Créer l'avoir
  const { data: creditNote, error: cnErr } = await supabase
    .from("credit_notes")
    .insert({
      user_id: user.id,
      credit_note_number,
      original_invoice_id: invoice.id,
      client_id: invoice.client_id,
      reason: reason.trim(),
      lines: creditLines,
      subtotal_ht,
      total_vat,
      total_ttc,
      issue_date: new Date().toISOString().split("T")[0],
    })
    .select()
    .single()

  if (cnErr) {
    return NextResponse.json({ error: cnErr.message }, { status: 500 })
  }

  // 8. Mettre la facture en statut "credited"
  await supabase
    .from("invoices")
    .update({ status: "credited" })
    .eq("id", id)
    .eq("user_id", user.id)

  return NextResponse.json({ credit_note: creditNote }, { status: 201 })
}
