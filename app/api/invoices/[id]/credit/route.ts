import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { insertWithSequentialNumber } from "@/lib/utils/document-numbering"

const EPSILON = 0.01 // tolérance d'arrondi centime sur les comparaisons de montants

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

  // 6. Un avoir partiel ne doit ni dépasser le solde restant de la facture,
  //    ni bloquer l'émission d'avoirs partiels suivants sur ce qui reste dû.
  const { data: priorCredits } = await supabase
    .from("credit_notes")
    .select("total_ttc")
    .eq("original_invoice_id", id)
    .eq("user_id", user.id)

  const alreadyCredited = (priorCredits ?? []).reduce((s, c) => s + (c.total_ttc || 0), 0)

  if (alreadyCredited + total_ttc > invoice.total_ttc + EPSILON) {
    return NextResponse.json({
      error: `Le montant total des avoirs (${(alreadyCredited + total_ttc).toFixed(2)} €) dépasserait le montant de la facture (${invoice.total_ttc.toFixed(2)} €)`,
    }, { status: 400 })
  }

  // Cet avoir solde-t-il entièrement la facture (compte tenu des avoirs déjà émis) ?
  const isFullCredit = alreadyCredited + total_ttc >= invoice.total_ttc - EPSILON

  // 7. Numérotation de l'avoir : AV-{ANNÉE}-{SEQ} — numérotation robuste
  //    (voir lib/utils/document-numbering.ts)
  const year  = new Date().getFullYear()
  const avPfx = `AV-${year}-`

  const { data: creditNote, error: cnErr } = await insertWithSequentialNumber(supabase, {
    table: "credit_notes",
    numberColumn: "credit_note_number",
    userId: user.id,
    prefix: avPfx,
    buildRow: (credit_note_number) => ({
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
    }),
  })

  if (cnErr) {
    return NextResponse.json({ error: cnErr.message }, { status: 500 })
  }

  // 8. Ne marquer la facture "credited" que si l'avoir la solde entièrement —
  //    un avoir partiel laisse le statut inchangé pour ne pas bloquer un
  //    avoir ultérieur ni fausser les calculs de CA encaissé ailleurs dans l'app.
  if (isFullCredit) {
    await supabase
      .from("invoices")
      .update({ status: "credited" })
      .eq("id", id)
      .eq("user_id", user.id)
  }

  return NextResponse.json({ credit_note: creditNote }, { status: 201 })
}
