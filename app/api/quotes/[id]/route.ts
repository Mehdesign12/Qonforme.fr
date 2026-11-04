import { prepareLinesForSave } from "@/lib/documents/discounts"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { canTransition, isContentLocked, transitionError } from "@/lib/utils/document-status"
import { requireIssuerIdentity } from "@/lib/legal/issuer"
import { requireArtisanAccess } from "@/lib/artisan/access"
import { hasReverseCharge } from "@/lib/artisan/reverse-charge"

interface Params { params: Promise<{ id: string }> }

// GET /api/quotes/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { id } = await params
  const { data, error } = await supabase
    .from("quotes")
    .select(`*, client:clients(*)`)
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ quote: data })
}

// PATCH /api/quotes/[id]
export async function PATCH(request: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { id }  = await params
  const body    = await request.json()

  // Contenu figé hors brouillon et changements de statut en liste blanche
  // (lib/utils/document-status.ts) : l'interface masque déjà ces actions,
  // mais un appel direct à la route ne doit pas pouvoir les contourner.
  const contentFields = ["lines", "client_id", "issue_date", "valid_until", "notes"]
  const touchesContent = contentFields.some((f) => body[f] !== undefined)

  if (touchesContent || body.status !== undefined) {
    const { data: current } = await supabase
      .from("quotes")
      .select("status")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()

    if (!current) return NextResponse.json({ error: "Document introuvable" }, { status: 404 })

    if (touchesContent && isContentLocked(current.status)) {
      return NextResponse.json({ error: "Un devis envoyé ne se modifie plus. Dupliquez-le pour en faire une nouvelle version." }, { status: 403 })
    }

    if (body.status !== undefined && !canTransition("quote", current.status, body.status)) {
      return NextResponse.json({ error: transitionError("quote", current.status, body.status) }, { status: 403 })
    }

    // Sortir un devis du brouillon (« Marquer comme envoyé ») : l'identité de
    // l'émetteur (SIREN, adresse) doit y figurer, comme pour un envoi par email
    if (body.status !== undefined && current.status === "draft" && body.status !== "draft") {
      const noIdentity = await requireIssuerIdentity(supabase, user.id)
      if (noIdentity) return noIdentity
    }
  }

  // Autoliquidation en sous-traitance du BTP : fonction de la formule Artisan
  if (Array.isArray(body.lines) && hasReverseCharge(body.lines)) {
    const artisanBlocked = await requireArtisanAccess(supabase, user.id)
    if (artisanBlocked) return artisanBlocked
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.lines) {
    // Remises contrôlées et recalculées, totaux au centime (lib/documents/discounts.ts)
    const prepared = prepareLinesForSave(body.lines)
    if (!prepared.ok) return NextResponse.json({ error: prepared.error }, { status: 400 })
    update.lines       = prepared.lines
    update.subtotal_ht = prepared.subtotal_ht
    update.total_vat   = prepared.total_vat
    update.total_ttc   = prepared.total_ttc
  }

  if (body.status)      update.status      = body.status
  if (body.client_id !== undefined) update.client_id = body.client_id
  if (body.issue_date)  update.issue_date  = body.issue_date
  if (body.valid_until) update.valid_until = body.valid_until
  if (body.notes !== undefined) update.notes = body.notes

  const { data, error } = await supabase
    .from("quotes")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id)
    .select(`*, client:clients(id, name, email)`)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ quote: data })
}

// DELETE /api/quotes/[id] — brouillons seulement
export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { id } = await params
  const { data: q } = await supabase
    .from("quotes")
    .select("status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (q?.status !== "draft") {
    return NextResponse.json({ error: "Seuls les brouillons peuvent être supprimés" }, { status: 403 })
  }

  const { error } = await supabase.from("quotes").delete().eq("id", id).eq("user_id", user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
