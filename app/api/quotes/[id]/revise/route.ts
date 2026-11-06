import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prepareLinesForSave } from "@/lib/documents/discounts"
import { insertWithSequentialNumber } from "@/lib/utils/document-numbering"
import { requireArtisanAccess } from "@/lib/artisan/access"
import { hasReverseCharge } from "@/lib/artisan/reverse-charge"
import { addDays, daysBetween, todayInParis } from "@/lib/utils/paris-date"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import { REVISION_UNAVAILABLE, reviseRefusal } from "@/lib/quotes/revision"

interface Params { params: Promise<{ id: string }> }

/**
 * POST /api/quotes/[id]/revise — « Corriger ce devis » (lib/quotes/revision.ts).
 * Crée la nouvelle version en brouillon (même client, mêmes lignes, datée du jour,
 * même durée de validité), liée au devis envoyé. Une correction déjà ouverte est
 * rendue au lieu d'en créer une seconde. L'ancien devis ne change qu'à l'envoi.
 */
export async function POST(_req: Request, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { id } = await params

  const { data: quote, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: "Le devis n'a pas pu être lu. Réessayez." }, { status: 500 })
  if (!quote) return NextResponse.json({ error: "Devis introuvable" }, { status: 404 })

  // Colonnes de la migration 20261106 absentes de la ligne : correction pas encore activée
  if (!("revises_quote_id" in quote)) return NextResponse.json({ error: REVISION_UNAVAILABLE }, { status: 503 })

  // Correction déjà ouverte (brouillon) : on la rouvre
  const { data: open, error: openError } = await supabase
    .from("quotes")
    .select("id, quote_number, status")
    .eq("user_id", user.id)
    .eq("revises_quote_id", id)
    .maybeSingle()
  if (openError) {
    if (isMissingSchemaError(openError)) return NextResponse.json({ error: REVISION_UNAVAILABLE }, { status: 503 })
    return NextResponse.json({ error: "Le devis n'a pas pu être lu. Réessayez." }, { status: 500 })
  }
  // Refus d'abord : un devis accepté entre-temps ne rouvre pas sa correction en cours
  const refusal = reviseRefusal(quote)
  if (refusal) return NextResponse.json({ error: refusal }, { status: 409 })
  if (open && open.status === "draft") return NextResponse.json({ quote: open, existing: true })
  if (open) return NextResponse.json({ error: `Ce devis a déjà une nouvelle version : ${open.quote_number}.` }, { status: 409 })

  const lines = Array.isArray(quote.lines) ? quote.lines : []
  if (hasReverseCharge(lines)) {
    const artisanBlocked = await requireArtisanAccess(supabase, user.id)
    if (artisanBlocked) return artisanBlocked
  }
  const prepared = prepareLinesForSave(lines)
  if (!prepared.ok) return NextResponse.json({ error: prepared.error }, { status: 400 })

  const today = todayInParis()
  const validity = Math.max(1, daysBetween(quote.issue_date, quote.valid_until) || 30)
  const prefix = `D-${today.slice(0, 4)}-`

  const { data: created, error: insertError } = await insertWithSequentialNumber(supabase, {
    table: "quotes",
    numberColumn: "quote_number",
    userId: user.id,
    prefix,
    selectClause: "id, quote_number, status",
    buildRow: (quote_number) => ({
      user_id: user.id,
      client_id: quote.client_id ?? null,
      quote_number,
      status: "draft",
      issue_date: today,
      valid_until: addDays(today, validity),
      lines: prepared.lines,
      subtotal_ht: prepared.subtotal_ht,
      total_vat: prepared.total_vat,
      total_ttc: prepared.total_ttc,
      notes: quote.notes ?? null,
      revises_quote_id: id,
      revises_quote_number: quote.quote_number,
      ...(quote.chantier_id ? { chantier_id: quote.chantier_id } : {}),
    }),
  })

  if (insertError) {
    // Deux clics simultanés : l'index unique garde une seule correction, on la rend
    const { data: again } = await supabase
      .from("quotes").select("id, quote_number, status").eq("user_id", user.id).eq("revises_quote_id", id).maybeSingle()
    if (again) return NextResponse.json({ quote: again, existing: true })
    console.error("[quote-revise] création :", insertError)
    return NextResponse.json({ error: "La nouvelle version n'a pas pu être créée. Réessayez." }, { status: 500 })
  }
  return NextResponse.json({ quote: created }, { status: 201 })
}
