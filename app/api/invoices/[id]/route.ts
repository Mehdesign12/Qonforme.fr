import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { canTransition, isContentLocked, transitionError } from "@/lib/utils/document-status"
import { requireIssuingAccess } from "@/lib/stripe/subscription"

interface Params {
  params: Promise<{ id: string }>
}

// GET /api/invoices/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { id } = await params

  const { data, error } = await supabase
    .from("invoices")
    .select(`*, client:clients(*)`)
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ invoice: data })
}

// PATCH /api/invoices/[id]
export async function PATCH(request: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  // Le contenu d'une facture (lignes, montants, client, dates) ne doit plus
  // bouger une fois qu'elle n'est plus un brouillon — le formulaire d'édition
  // le bloque déjà côté client, mais un appel direct à cette route contournait
  // ce garde-fou et pouvait réécrire les montants d'un document Factur-X déjà
  // émis. Les changements de statut suivent la liste blanche de
  // lib/utils/document-status.ts : jamais de retour au brouillon, pas
  // d'annulation ni d'avoir posés à la main. L'archivage reste libre.
  const contentFields = ["lines", "client_id", "issue_date", "due_date", "notes", "payment_terms"]
  const touchesContent = contentFields.some((f) => body[f] !== undefined)

  if (touchesContent || body.status !== undefined) {
    const { data: current } = await supabase
      .from("invoices")
      .select("status")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()

    if (!current) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 })

    if (touchesContent && isContentLocked(current.status)) {
      return NextResponse.json(
        { error: "Seules les factures brouillons peuvent être modifiées. Pour corriger une facture émise, créez un avoir." },
        { status: 403 }
      )
    }

    if (body.status !== undefined && !canTransition("invoice", current.status, body.status)) {
      return NextResponse.json(
        { error: transitionError("invoice", current.status, body.status) },
        { status: 403 }
      )
    }

    // Sortir du brouillon, c'est émettre la facture (« Marquer comme envoyée ») :
    // même mur de paiement que l'envoi par email.
    if (current.status === "draft" && body.status !== undefined && body.status !== "draft") {
      const blocked = await requireIssuingAccess(supabase, user.id)
      if (blocked) return blocked
    }
  }

  // Recalculer les totaux si les lignes sont modifiées
  let updateData: Record<string, unknown> = {}

  if (body.lines) {
    const subtotal_ht = body.lines.reduce((sum: number, l: { total_ht: number }) => sum + (l.total_ht || 0), 0)
    const total_vat = body.lines.reduce((sum: number, l: { total_vat: number }) => sum + (l.total_vat || 0), 0)
    updateData = {
      lines: body.lines,
      subtotal_ht,
      total_vat,
      total_ttc: subtotal_ht + total_vat,
    }
  }

  if (body.status) updateData.status = body.status
  if (body.is_archived !== undefined) updateData.is_archived = body.is_archived
  if (body.client_id) updateData.client_id = body.client_id
  if (body.issue_date) updateData.issue_date = body.issue_date
  if (body.due_date) updateData.due_date = body.due_date
  if (body.notes !== undefined) updateData.notes = body.notes
  if (body.payment_terms !== undefined) updateData.payment_terms = body.payment_terms

  const { data, error } = await supabase
    .from("invoices")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", user.id)
    .select(`*, client:clients(id, name, email)`)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ invoice: data })
}

// DELETE /api/invoices/[id] — seulement les brouillons
export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { id } = await params

  // Vérifier que c'est un brouillon
  const { data: inv } = await supabase
    .from("invoices")
    .select("status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (inv?.status !== "draft") {
    return NextResponse.json({ error: "Seuls les brouillons peuvent être supprimés" }, { status: 403 })
  }

  const { error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
