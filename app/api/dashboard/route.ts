import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { ISSUED_INVOICE_STATUSES, OPEN_INVOICE_STATUSES } from "@/components/dashboard/model"
import { todayInParis } from "@/lib/utils/paris-date"

/**
 * GET /api/dashboard — indicateurs résumés (la page /dashboard lit ses données
 * côté serveur, components/dashboard/data.ts ; cette route reste pour les
 * appels directs).
 *
 * Statuts « émise et non réglée » pris en bloc, « overdue » compris : une
 * facture relancée ou marquée en retard ne sort plus des montants à encaisser
 * ni du chiffre facturé. Le retard se calcule sur l'échéance, en heure de Paris.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const today = todayInParis()
  const [y, m] = today.split("-").map(Number)
  const monthStart = `${today.slice(0, 7)}-01`
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10)
  const prevEnd = new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10)

  const sum = (rows: { total_ttc: number | null }[] | null) =>
    Math.round((rows ?? []).reduce((s, r) => s + (Number(r.total_ttc) || 0), 0) * 100) / 100

  const [current, previous, sentCount, open, recent] = await Promise.all([
    supabase.from("invoices").select("total_ttc")
      .eq("user_id", user.id).in("status", [...ISSUED_INVOICE_STATUSES]).gte("issue_date", monthStart),
    supabase.from("invoices").select("total_ttc")
      .eq("user_id", user.id).in("status", [...ISSUED_INVOICE_STATUSES]).gte("issue_date", prev).lte("issue_date", prevEnd),
    supabase.from("invoices").select("id", { count: "exact", head: true })
      .eq("user_id", user.id).neq("status", "draft").gte("issue_date", monthStart),
    // Avec la retenue de garantie quand sa colonne existe : elle n'est due qu'à sa libération
    (async () => {
      const run = (cols: string) => supabase.from("invoices").select(cols)
        .eq("user_id", user.id).in("status", [...OPEN_INVOICE_STATUSES])
      const withRetention = await run("total_ttc, due_date, retention_amount")
      return withRetention.error && isMissingSchemaError(withRetention.error) ? run("total_ttc, due_date") : withRetention
    })(),
    supabase.from("invoices").select(`id, invoice_number, status, issue_date, total_ttc, client:clients(name)`)
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
  ])

  // Montant exigible : TTC moins la retenue de garantie éventuelle
  const openRows = ((open.data ?? []) as unknown as { total_ttc: number | null; due_date: string | null; retention_amount?: number | null }[])
    .map((r) => ({ total_ttc: (Number(r.total_ttc) || 0) - (Number(r.retention_amount) || 0), due_date: r.due_date }))
  const late = openRows.filter((r) => r.due_date && String(r.due_date).slice(0, 10) < today)

  return NextResponse.json({
    revenue_current_month: sum(current.data),
    revenue_previous_month: sum(previous.data),
    invoices_sent_count: sentCount.count || 0,
    invoices_pending_amount: sum(openRows),
    invoices_overdue_amount: sum(late),
    recent_invoices: recent.data || [],
    ppf_connected: false,
  })
}
