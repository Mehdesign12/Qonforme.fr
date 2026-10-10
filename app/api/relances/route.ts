import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { REMINDABLE_STATUSES, type ReminderInvoice } from "@/lib/reminders/queue"
import { creditedByInvoice, joinedOne } from "@/lib/treasury/credited"

export const dynamic = "force-dynamic"

/**
 * GET /api/relances
 * Factures que le cron peut relancer (envoyées ou en retard) et factures déjà
 * relancées (historique, même réglées depuis). La file est calculée côté client
 * à la date locale de l'utilisateur (lib/reminders/queue.ts).
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, status, due_date, total_ttc, reminder_1_sent_at, reminder_2_sent_at, client:clients(name, email)")
    .eq("user_id", user.id)
    .eq("is_archived", false)
    .or(`status.in.(${REMINDABLE_STATUSES.join(",")}),reminder_1_sent_at.not.is.null`)
    .order("due_date", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { credited, error: cErr } = await creditedByInvoice(supabase, user.id, (invoices ?? []).map((i) => i.id))
  if (cErr) return NextResponse.json({ error: cErr }, { status: 500 })

  const rows: ReminderInvoice[] = (invoices ?? []).map((i) => {
    const client = joinedOne(i.client as { name?: string; email?: string } | { name?: string; email?: string }[] | null)
    return {
      id:                 i.id,
      invoice_number:     i.invoice_number,
      client_name:        client?.name ?? null,
      client_email:       client?.email ?? null,
      due_date:           i.due_date,
      total_ttc:          i.total_ttc,
      credited_ttc:       credited[i.id] || 0,
      status:             i.status,
      reminder_1_sent_at: i.reminder_1_sent_at,
      reminder_2_sent_at: i.reminder_2_sent_at,
    }
  })

  return NextResponse.json({ invoices: rows })
}
