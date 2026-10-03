import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { insertDraftInvoice } from "@/lib/utils/document-numbering"
import { todayInParis } from "@/lib/utils/paris-date"
import { canConvertQuote } from "@/lib/utils/document-status"

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

  if (!canConvertQuote(quote.status)) {
    return NextResponse.json({ error: "Seul un devis envoyé ou accepté peut être converti en facture" }, { status: 400 })
  }

  // 2. La facture naît brouillon, sans numéro : elle le reçoit à son émission,
  //    dans la même série que les factures directes (lib/utils/document-numbering.ts).
  //    Le préfixe ne sert que si la base exige encore un numéro à la création.
  const { data: company } = await supabase
    .from("companies")
    .select("invoice_prefix")
    .eq("user_id", user.id)
    .single()

  const today = todayInParis()

  // 3. Créer la facture à partir du devis
  const { data: invoice, error: invErr } = await insertDraftInvoice<{ id: string }>(supabase, {
    userId: user.id,
    companyPrefix: company?.invoice_prefix,
    today,
    row: {
      user_id:     user.id,
      client_id:   quote.client_id,
      status:      "draft",
      issue_date:  today,
      due_date:    quote.valid_until,
      lines:       quote.lines,
      subtotal_ht: quote.subtotal_ht,
      total_vat:   quote.total_vat,
      total_ttc:   quote.total_ttc,
      notes:       quote.notes,
    },
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
