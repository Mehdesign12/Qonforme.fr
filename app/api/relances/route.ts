import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { canIssueInvoices } from "@/lib/stripe/access"
import { loadReminderLog, loadReminderSettings } from "@/lib/reminders/store"
import { DEFAULT_REMINDER_SETTINGS } from "@/lib/reminders/settings"
import { legacyLog, type QueueInvoice, type QueueQuote } from "@/lib/reminders/queue"

export const dynamic = "force-dynamic"

/** Statuts d'une facture émise et non réglée (lib/utils/document-status.ts, canRemindInvoice). */
const OPEN = ["sent", "pending", "received", "accepted", "overdue"]

type Join = { name?: string | null; email?: string | null } | { name?: string | null; email?: string | null }[] | null
const one = (j: Join) => (Array.isArray(j) ? j[0] ?? null : j)

/**
 * GET /api/relances — données de la page Relances. La file se calcule côté
 * navigateur (lib/reminders/queue.ts), avec le même planificateur que le cron.
 *
 * - `legacy` : journal `document_reminders` absent (migration
 *   20261003_invoice_number_at_issue_and_reminders.sql) : J+30 et J+45,
 *   reconstitués depuis reminder_1_sent_at / reminder_2_sent_at ;
 * - `hasPlan` : le cron saute les comptes sans formule ; null si la lecture
 *   de l'abonnement a échoué (on ne conclut pas « pas de formule »).
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const [settingsRes, subRes] = await Promise.all([
    loadReminderSettings(supabase, user.id),
    supabase.from("subscriptions").select("status").eq("user_id", user.id).maybeSingle(),
  ])
  if (settingsRes.error) {
    console.error("[relances] réglages :", settingsRes.error.message)
    return NextResponse.json({ error: "Impossible de lire vos réglages de relance." }, { status: 503 })
  }
  const legacy = !settingsRes.available
  const settings = legacy ? DEFAULT_REMINDER_SETTINGS : settingsRes.settings
  const hasPlan = subRes.error ? null : canIssueInvoices(subRes.data?.status)

  const [invRes, quoteRes] = await Promise.all([
    supabase.from("invoices")
      .select("id, invoice_number, status, issue_date, due_date, sent_at, total_ttc, reminder_1_sent_at, reminder_2_sent_at, client:clients(name, email)")
      .eq("user_id", user.id).eq("is_archived", false).in("status", OPEN).not("invoice_number", "is", null)
      .order("due_date", { ascending: true }),
    legacy
      ? Promise.resolve({ data: [], error: null })
      : supabase.from("quotes")
          .select("id, quote_number, status, issue_date, valid_until, sent_at, converted_invoice_id, total_ttc, client:clients(name, email)")
          .eq("user_id", user.id).eq("status", "sent").is("converted_invoice_id", null),
  ])
  if (invRes.error || quoteRes.error) {
    console.error("[relances] documents :", invRes.error?.message ?? quoteRes.error?.message)
    return NextResponse.json({ error: "Impossible de charger vos factures." }, { status: 500 })
  }
  const invRows = (invRes.data ?? []) as unknown as Record<string, unknown>[]
  const quoteRows = (quoteRes.data ?? []) as unknown as Record<string, unknown>[]

  const [invLog, quoteLog] = legacy
    ? [null, null]
    : await Promise.all([
        loadReminderLog(supabase, "invoice", invRows.map((r) => String(r.id))),
        loadReminderLog(supabase, "quote", quoteRows.map((r) => String(r.id))),
      ])
  if (invLog?.error || quoteLog?.error) {
    console.error("[relances] journal :", invLog?.error?.message ?? quoteLog?.error?.message)
    return NextResponse.json({ error: "Impossible de lire le journal des relances." }, { status: 503 })
  }

  const invoices: QueueInvoice[] = invRows.map((r) => {
    const client = one(r.client as Join)
    return {
      id: String(r.id),
      invoice_number: (r.invoice_number as string | null) ?? null,
      status: String(r.status),
      issue_date: (r.issue_date as string | null) ?? null,
      due_date: (r.due_date as string | null) ?? null,
      sent_at: (r.sent_at as string | null) ?? null,
      total_ttc: Number(r.total_ttc) || 0,
      client_name: client?.name ?? null,
      client_email: client?.email ?? null,
      reminders: legacy
        ? legacyLog(r as { reminder_1_sent_at?: string | null; reminder_2_sent_at?: string | null })
        : invLog?.log.get(String(r.id)) ?? [],
    }
  })
  const quotes: QueueQuote[] = quoteRows.map((r) => {
    const client = one(r.client as Join)
    return {
      id: String(r.id),
      quote_number: String(r.quote_number ?? ""),
      status: String(r.status),
      issue_date: (r.issue_date as string | null) ?? null,
      valid_until: (r.valid_until as string | null) ?? null,
      sent_at: (r.sent_at as string | null) ?? null,
      converted_invoice_id: (r.converted_invoice_id as string | null) ?? null,
      total_ttc: Number(r.total_ttc) || 0,
      client_name: client?.name ?? null,
      client_email: client?.email ?? null,
      reminders: quoteLog?.log.get(String(r.id)) ?? [],
    }
  })

  return NextResponse.json(
    { legacy, hasPlan, settings, invoices, quotes },
    { headers: { "Cache-Control": "no-store" } },
  )
}
