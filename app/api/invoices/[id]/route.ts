import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { canTransition, isContentLocked, transitionError } from "@/lib/utils/document-status"
import { requireIssuingAccess } from "@/lib/stripe/subscription"
import { requireIssuerIdentity } from "@/lib/legal/issuer"
import { issueDraftInvoice } from "@/lib/utils/document-numbering"
import { todayInParis } from "@/lib/utils/paris-date"
import { paidAtChange } from "@/lib/utils/payment-date"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import { loadReminderLog } from "@/lib/reminders/store"
import { isArtisanKind } from "@/lib/artisan/billing"
import { requireArtisanAccess } from "@/lib/artisan/access"
import { invoiceKindOf } from "@/lib/artisan/server"
import { hasReverseCharge } from "@/lib/artisan/reverse-charge"

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

  // Relances envoyées (journal, migration 20261003) pour l'historique de la fiche.
  // `reminders: null` : journal absent ou illisible, la fiche s'en tient aux
  // colonnes reminder_1_sent_at / reminder_2_sent_at.
  let reminders: { stage: string; origin: string; sent_at: string }[] | null = null
  if (data.status !== "draft") {
    const logRes = await loadReminderLog(supabase, "invoice", [id])
    if (logRes.available && !logRes.error) reminders = logRes.log.get(id) ?? []
  }

  return NextResponse.json({ invoice: { ...data, reminders } })
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

  let issuing = false
  // Date de paiement (« encaissé » du tableau de bord) : posée au passage à
  // « payée », effacée au retour (lib/utils/payment-date.ts)
  let paidAt: string | null | undefined

  if (touchesContent || body.status !== undefined) {
    const { data: current } = await supabase
      .from("invoices")
      .select("status, issue_date")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()

    if (!current) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 })
    issuing = current.status === "draft" && body.status !== undefined && body.status !== "draft"

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

    if (body.status !== undefined) {
      const change = paidAtChange({
        from: current.status, to: body.status, requested: body.paid_at,
        issueDate: current.issue_date, today: todayInParis(), now: new Date(),
      })
      if (!change.ok) return NextResponse.json({ error: change.error, field: "paid_at" }, { status: 400 })
      paidAt = change.value
    }

    // Acompte, situation, solde (formule Artisan) : contenu calculé depuis le
    // devis, jamais réécrit à la main
    const artisanDoc = (touchesContent || issuing) && isArtisanKind(await invoiceKindOf(supabase, id, user.id))
    if (artisanDoc && touchesContent) {
      return NextResponse.json(
        { error: "Ce brouillon est calculé depuis le devis (acompte, situation ou solde) : supprimez-le, puis recréez-le depuis le devis." },
        { status: 409 },
      )
    }

    // Sortir du brouillon, c'est émettre la facture (« Marquer comme envoyée ») :
    // même mur de paiement que l'envoi par email (formule Artisan pour un
    // acompte, une situation ou un solde).
    if (issuing) {
      // Identité de l'émetteur (SIREN, adresse) d'abord : jamais payer pour être bloqué ensuite
      const noIdentity = await requireIssuerIdentity(supabase, user.id)
      if (noIdentity) return noIdentity
      const blocked = artisanDoc
        ? await requireArtisanAccess(supabase, user.id)
        : await requireIssuingAccess(supabase, user.id)
      if (blocked) return blocked
    }
  }

  // Autoliquidation en sous-traitance : formule Artisan
  if (Array.isArray(body.lines) && hasReverseCharge(body.lines)) {
    const artisanBlocked = await requireArtisanAccess(supabase, user.id)
    if (artisanBlocked) return artisanBlocked
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

  if (body.status && !issuing) updateData.status = body.status
  if (paidAt !== undefined && !issuing) updateData.paid_at = paidAt
  if (body.is_archived !== undefined) updateData.is_archived = body.is_archived
  if (body.client_id) updateData.client_id = body.client_id
  if (body.issue_date) updateData.issue_date = body.issue_date
  if (body.due_date) updateData.due_date = body.due_date
  if (body.notes !== undefined) updateData.notes = body.notes
  if (body.payment_terms !== undefined) updateData.payment_terms = body.payment_terms

  const select = `*, client:clients(id, name, email)`
  let data: Record<string, unknown> | null = null

  if (Object.keys(updateData).length > 0 || !issuing) {
    const update = (values: Record<string, unknown>) => supabase
      .from("invoices")
      .update(values)
      .eq("id", id)
      .eq("user_id", user.id)
      .select(select)
      .single()
    let res = await update(updateData)
    // Colonne paid_at absente (migration 20261010_invoice_paid_at.sql) : le statut change quand même
    if (res.error && "paid_at" in updateData && isMissingSchemaError(res.error)) {
      const { paid_at: _skipped, ...rest } = updateData
      void _skipped
      res = await update(rest)
    }
    if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 })
    data = res.data
  }

  // Émission (« Marquer comme envoyée ») : numéro définitif, statut et date
  // d'émission en une seule écriture (lib/utils/document-numbering.ts)
  if (issuing) {
    const [{ data: company }, { data: draft }] = await Promise.all([
      supabase.from("companies").select("invoice_prefix").eq("user_id", user.id).maybeSingle(),
      supabase.from("invoices").select("status, invoice_number, issue_date, due_date").eq("id", id).eq("user_id", user.id).single(),
    ])
    if (!draft) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 })

    const issued = await issueDraftInvoice<Record<string, unknown>>(supabase, {
      invoiceId: id,
      userId: user.id,
      companyPrefix: company?.invoice_prefix,
      draft,
      status: body.status,
      today: todayInParis(),
      selectClause: select,
    })
    if (issued.error || !issued.data) {
      return NextResponse.json({ error: issued.error?.message ?? "La facture n'a pas pu être émise. Réessayez." }, { status: 500 })
    }
    data = issued.data
  }

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
