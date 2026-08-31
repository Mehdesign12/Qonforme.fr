import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { canCreateInvoice } from "@/lib/stripe/subscription"
import { insertWithSequentialNumber } from "@/lib/utils/document-numbering"

// GET /api/invoices
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status   = searchParams.get("status")
  const archived = searchParams.get("archived") // "true" pour voir les archivées

  let query = supabase
    .from("invoices")
    .select(`*, client:clients(id, name, email, city, siren)`)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  // Par défaut on masque les archivées ; ?archived=true les affiche exclusivement
  if (archived === "true") {
    query = query.eq("is_archived", true)
  } else {
    query = query.eq("is_archived", false)
    if (status && status !== "all") {
      query = query.eq("status", status)
    }
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ invoices: data })
}

// POST /api/invoices — crée une facture avec numérotation automatique
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  // ── Vérifier la limite du plan Starter ──────────────────────
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan, status")
    .eq("user_id", user.id)
    .single()

  const check = await canCreateInvoice(user.id, sub as Parameters<typeof canCreateInvoice>[1])

  if (!check.allowed) {
    if (check.reason === "starter_limit_reached") {
      return NextResponse.json(
        {
          error: "Limite atteinte",
          message: `Vous avez atteint la limite de ${check.limit} factures ce mois-ci sur le plan Starter. Passez au plan Pro pour des factures illimitées.`,
          code: "STARTER_LIMIT_REACHED",
          invoicesThisMonth: check.invoicesThisMonth,
          limit: check.limit,
        },
        { status: 402 }
      )
    }
    return NextResponse.json({ error: "Abonnement inactif" }, { status: 402 })
  }
  // ────────────────────────────────────────────────────────────

  const body = await request.json()

  // Récupérer le préfixe configuré par l'entreprise
  const { data: company } = await supabase
    .from("companies")
    .select("invoice_prefix")
    .eq("user_id", user.id)
    .single()

  const prefix = company?.invoice_prefix || "F"
  const year   = new Date().getFullYear()
  const pfx    = `${prefix}-${year}-`

  // Calculer les totaux
  const lines       = body.lines || []
  const subtotal_ht = lines.reduce((sum: number, l: { total_ht: number }) => sum + (l.total_ht || 0), 0)
  const total_vat   = lines.reduce((sum: number, l: { total_vat: number }) => sum + (l.total_vat || 0), 0)
  const total_ttc   = subtotal_ht + total_vat

  // Créer la facture — numérotation robuste (voir lib/utils/document-numbering.ts)
  const { data: invoice, error } = await insertWithSequentialNumber(supabase, {
    table: "invoices",
    numberColumn: "invoice_number",
    userId: user.id,
    prefix: pfx,
    selectClause: `*, client:clients(id, name, email)`,
    buildRow: (invoice_number) => ({
      user_id: user.id,
      client_id: body.client_id,
      invoice_number,
      status: body.status || "draft",
      issue_date: body.issue_date,
      due_date: body.due_date,
      lines: body.lines,
      subtotal_ht,
      total_vat,
      total_ttc,
      notes: body.notes || null,
      payment_terms: body.payment_terms || null,
    }),
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ invoice }, { status: 201 })
}
