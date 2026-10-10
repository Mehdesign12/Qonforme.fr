import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import { LIST_COLUMNS, RECEIVED_TABLE, isReceptionUnavailable, toListItem } from "@/lib/reception/server"
import { OPEN_INVOICE_STATUSES, type ForecastInvoice } from "@/lib/treasury/forecast"
import { creditedByInvoice, joinedOne } from "@/lib/treasury/credited"
import { payablesFromReceived } from "@/lib/treasury/payables"

export const dynamic = "force-dynamic"

/**
 * GET /api/tresorerie
 * - factures émises et non réglées (hors archives), avec les avoirs déjà émis
 *   sur chacune et la retenue de garantie quand sa colonne existe (formule Artisan) ;
 * - factures reçues à payer ; `payablesAvailable: false` tant que la migration
 *   20261003_received_invoices.sql n'est pas appliquée.
 * La prévision se calcule côté navigateur (lib/treasury/forecast.ts).
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const base = "id, invoice_number, status, due_date, total_ttc, client:clients(name)"
  const run = (extra: string) =>
    supabase.from("invoices").select(base + extra)
      .eq("user_id", user.id).eq("is_archived", false)
      .in("status", [...OPEN_INVOICE_STATUSES]).order("due_date", { ascending: true })
  // Retenue de garantie seulement si sa colonne existe (migration de la formule Artisan)
  let res = await run(", retention_amount")
  if (res.error && isMissingSchemaError(res.error)) res = await run("")
  if (res.error) {
    console.error("[tresorerie] factures:", res.error.message)
    return NextResponse.json({ error: "Impossible de charger vos factures." }, { status: 500 })
  }
  const rows = (res.data ?? []) as unknown as Record<string, unknown>[]

  const { credited, error: cErr } = await creditedByInvoice(supabase, user.id, rows.map((r) => String(r.id)))
  if (cErr) {
    console.error("[tresorerie] avoirs:", cErr)
    return NextResponse.json({ error: "Impossible de charger vos avoirs." }, { status: 500 })
  }

  const invoices: ForecastInvoice[] = rows.map((r) => ({
    id: String(r.id),
    invoice_number: (r.invoice_number as string | null) ?? null,
    client_name: joinedOne(r.client as { name?: string } | { name?: string }[] | null)?.name ?? null,
    due_date: (r.due_date as string | null) ?? null,
    total_ttc: Number(r.total_ttc) || 0,
    credited_ttc: credited[String(r.id)] || 0,
    retention_ttc: Number(r.retention_amount) || 0,
    status: String(r.status),
  }))

  const rec = await supabase.from(RECEIVED_TABLE).select(LIST_COLUMNS).eq("user_id", user.id).limit(2000)
  if (rec.error && !isReceptionUnavailable(rec.error)) {
    console.error("[tresorerie] factures reçues:", rec.error.message)
    return NextResponse.json({ error: "Impossible de charger vos factures reçues." }, { status: 500 })
  }
  const payablesAvailable = !rec.error
  const payables = payablesAvailable
    ? payablesFromReceived((rec.data ?? []).map((r) => toListItem(r as Record<string, unknown>)))
    : []

  return NextResponse.json({ invoices, payables, payablesAvailable })
}
