import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { insertWithSequentialNumber } from "@/lib/utils/document-numbering"

interface Params { params: Promise<{ id: string }> }

// POST /api/quotes/[id]/convert — convertit un devis accepté en facture
export async function POST(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { id } = await params

  // 1. Récupérer le devis
  const { data: quote, error: qErr } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (qErr || !quote) return NextResponse.json({ error: "Devis introuvable" }, { status: 404 })

  if (quote.converted_invoice_id) {
    return NextResponse.json({ error: "Ce devis a déjà été converti en facture" }, { status: 400 })
  }

  // 2. Numérotation facture — même compteur (MAX robuste sur la table invoices,
  //    voir lib/utils/document-numbering.ts) que la création directe, pour ne
  //    plus jamais produire de doublon avec les factures déjà émises hors
  //    conversion de devis (ancien bug : ce compteur relisait companies.invoice_sequence,
  //    un compteur séparé jamais incrémenté par la création directe de facture).
  const { data: company } = await supabase
    .from("companies")
    .select("invoice_prefix")
    .eq("user_id", user.id)
    .single()

  const prefix = company?.invoice_prefix || "F"
  const year   = new Date().getFullYear()
  const pfx    = `${prefix}-${year}-`

  // 3. Créer la facture à partir du devis
  const { data: invoice, error: invErr } = await insertWithSequentialNumber<{ id: string }>(supabase, {
    table: "invoices",
    numberColumn: "invoice_number",
    userId: user.id,
    prefix: pfx,
    buildRow: (invoice_number) => ({
      user_id:     user.id,
      client_id:   quote.client_id,
      invoice_number,
      status:      "draft",
      issue_date:  new Date().toISOString().split("T")[0],
      due_date:    quote.valid_until,
      lines:       quote.lines,
      subtotal_ht: quote.subtotal_ht,
      total_vat:   quote.total_vat,
      total_ttc:   quote.total_ttc,
      notes:       quote.notes,
    }),
  })

  if (invErr || !invoice) return NextResponse.json({ error: invErr?.message ?? "Erreur création facture" }, { status: 500 })

  // 4. Marquer le devis comme converti
  await supabase
    .from("quotes")
    .update({ converted_invoice_id: invoice.id, status: "accepted" })
    .eq("id", id)
    .eq("user_id", user.id)

  return NextResponse.json({ invoice }, { status: 201 })
}
